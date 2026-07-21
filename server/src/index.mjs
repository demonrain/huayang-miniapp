import { createServer } from 'node:http'
import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { config, assertProductionConfig } from './config.mjs'
import { JsonStore } from './store.mjs'
import { bearerToken, createAdminToken, createToken, isAdminToken, verifyToken } from './auth.mjs'
import { exchangeWechatCode } from './wechat.mjs'
import { generateImages } from './generator.mjs'
import { createWechatPrepay, decryptWechatResource, verifyWechatNotification } from './payments.mjs'
import { HttpError, json, readBody, readImageUpload, readJson, serveFile, setCors } from './http.mjs'
import {
  assetUrl,
  findTemplate,
  mediaUrl,
  publicBanners,
  publicJob,
  publicPackages,
  publicShare,
  publicTemplates,
  seedConfig
} from './domain.mjs'
import { createMiniProgramCode, createMiniProgramUrlLink, isWechatShareConfigured } from './wechat-share.mjs'
import { isSubscribeNotifyConfigured, sendJobResultSubscribeMessage } from './wechat-notify.mjs'

const now = () => new Date().toISOString()

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', extension: '.jpg' }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extension: '.png' }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return { mime: 'image/webp', extension: '.webp' }
  return null
}

function publicUser(user, state) {
  const avatar = user.avatarAssetId ? state.assets.find(item => item.id === user.avatarAssetId) : null
  return {
    id: user.id,
    maskedId: user.id.slice(0, 4).toUpperCase(),
    nickname: user.nickname || '微信用户',
    // Prefer uploaded asset; fall back to WeChat CDN / external avatar URL
    avatarUrl: avatar ? assetUrl(avatar) : (user.avatarUrl || ''),
    profileComplete: Boolean(
      user.nickname &&
      user.nickname !== '微信用户' &&
      (user.avatarAssetId || user.avatarUrl)
    ),
    credits: user.credits,
    isNew: Boolean(user.isNew),
    enabled: user.enabled !== false,
    createdAt: user.createdAt
  }
}

const TEMPLATE_CATEGORIES = [
  { id: 'portrait', name: '人像' },
  { id: 'life', name: '生活' },
  { id: 'pet', name: '宠物' },
  { id: 'art', name: '艺术' }
]

function categoryLabel(categoryId) {
  return TEMPLATE_CATEGORIES.find(item => item.id === categoryId)?.name || categoryId || ''
}

function slugifyTemplateId(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 24)
  const suffix = randomBytes(3).toString('hex')
  if (base.length >= 2) return `${base}-${suffix}`
  return `tpl-${suffix}`
}

function displayTime(value) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
  }).format(new Date(value)).replaceAll('/', '-')
}

function publicTransaction(transaction) {
  return { ...transaction, displayTime: displayTime(transaction.createdAt) }
}

function getAuthenticatedUser(request, store) {
  const payload = verifyToken(bearerToken(request))
  if (!payload) throw new HttpError(401, 'UNAUTHORIZED', '登录状态已失效，请重新进入小程序')
  const user = store.read(state => state.users.find(item => item.id === payload.sub))
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', '用户不存在')
  if (user.enabled === false) throw new HttpError(403, 'USER_DISABLED', '账号已被停用，请联系管理员')
  return user
}

function requireAdmin(request) {
  if (!isAdminToken(bearerToken(request))) throw new HttpError(401, 'ADMIN_UNAUTHORIZED', '管理员登录已失效')
}

function safePasswordEqual(actual, expected) {
  const left = Buffer.from(String(actual || ''))
  const right = Buffer.from(String(expected || ''))
  return left.length === right.length && timingSafeEqual(left, right)
}

function chinaDateKey(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(value)
}

function boundedInteger(value, label, min, max) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) {
    throw new HttpError(400, 'INVALID_FIELD', `${label}需为 ${min}–${max} 的整数`)
  }
  return number
}

function cleanText(value, label, maxLength, required = true) {
  const text = String(value ?? '').trim()
  if ((required && !text) || text.length > maxLength) {
    throw new HttpError(400, 'INVALID_FIELD', `${label}${required ? '不能为空且' : ''}不能超过 ${maxLength} 个字符`)
  }
  return text
}

function cleanTags(value) {
  const tags = (Array.isArray(value) ? value : String(value || '').split(/[,，]/))
    .map(item => String(item).trim())
    .filter(Boolean)
  if (tags.length > 6 || tags.some(item => item.length > 12)) {
    throw new HttpError(400, 'INVALID_FIELD', '模板标签最多 6 个，每个不能超过 12 个字符')
  }
  return [...new Set(tags)]
}

function applyTemplateFields(target, body, creating = false) {
  if (creating || 'name' in body) target.name = cleanText(body.name, '模板名称', 30, true)
  if (creating || 'shortName' in body) {
    // shortName is optional; default to first chars of name
    const shortName = String(body.shortName ?? '').trim()
    if (shortName) target.shortName = cleanText(shortName, '模板简称', 8, false)
    else target.shortName = cleanText(String(target.name || body.name || '风格').slice(0, 4), '模板简称', 8, true)
  }
  if (creating || 'category' in body) {
    const category = cleanText(body.category, '模板分类', 20, true)
    if (!TEMPLATE_CATEGORIES.some(item => item.id === category)) {
      throw new HttpError(400, 'INVALID_CATEGORY', `分类需为：${TEMPLATE_CATEGORIES.map(item => item.name).join('、')}`)
    }
    target.category = category
  }
  if (creating || 'description' in body) target.description = cleanText(body.description, '模板描述', 80, true)
  if (creating || 'badge' in body) target.badge = cleanText(body.badge, '模板角标', 12, false)
  if (creating || 'palette' in body) target.palette = cleanText(body.palette, '模板配色', 240, true)
  if (creating || 'prompt' in body) target.prompt = cleanText(body.prompt, '生图提示词', 3000, true)
  if (creating || 'cost' in body) target.cost = boundedInteger(body.cost, '模板积分', 0, 10000)
  if (creating || 'popularity' in body) target.popularity = boundedInteger(body.popularity ?? 0, '人气值', 0, 100000000)
  if (creating || 'tags' in body) target.tags = cleanTags(body.tags)
  if (creating || 'sortOrder' in body) target.sortOrder = boundedInteger(body.sortOrder ?? 0, '排序值', 0, 100000)
  if ('enabled' in body) target.enabled = Boolean(body.enabled)
}

function applyBannerFields(target, body, creating = false) {
  const textFields = [
    ['title', 'Banner 标题', 40, true],
    ['subtitle', 'Banner 副标题', 80, false],
    ['badge', 'Banner 角标', 12, false],
    ['palette', 'Banner 配色', 240, true],
    ['targetPath', '跳转路径', 200, false]
  ]
  for (const [key, label, maxLength, required] of textFields) {
    if (creating || key in body) target[key] = cleanText(body[key], label, maxLength, required)
  }
  if (creating || 'sortOrder' in body) target.sortOrder = boundedInteger(body.sortOrder ?? 0, '排序值', 0, 100000)
  if ('enabled' in body) target.enabled = Boolean(body.enabled)
}

function adminUser(user, state) {
  const transactions = state.transactions.filter(item => item.userId === user.id)
  const jobs = state.jobs.filter(item => item.userId === user.id)
  return {
    id: user.id,
    nickname: user.nickname,
    maskedOpenid: user.openid ? `${user.openid.slice(0, 4)}...${user.openid.slice(-4)}` : '',
    credits: Number(user.credits || 0),
    enabled: user.enabled !== false,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt || '',
    jobCount: jobs.length,
    completedJobs: jobs.filter(item => item.status === 'succeeded').length,
    rechargedCredits: transactions.filter(item => item.type === 'recharge').reduce((sum, item) => sum + Number(item.amount || 0), 0),
    consumedCredits: Math.abs(transactions.filter(item => item.type === 'job_charge').reduce((sum, item) => sum + Number(item.amount || 0), 0))
  }
}

const transactionLabels = {
  welcome: '新用户赠送',
  checkin: '每日签到',
  recharge: '充值到账',
  job_charge: '作品生成',
  job_refund: '失败退回',
  admin_adjust: '后台调整'
}

function applyPackageFields(target, body, creating = false) {
  if (creating || 'credits' in body) target.credits = boundedInteger(body.credits, '到账积分', 1, 1000000)
  if (creating || 'bonus' in body) target.bonus = boundedInteger(body.bonus ?? 0, '赠送积分', 0, 1000000)
  if (creating || 'priceFen' in body) target.priceFen = boundedInteger(body.priceFen, '价格', 1, 100000000)
  if (creating || 'sortOrder' in body) target.sortOrder = boundedInteger(body.sortOrder ?? 0, '排序值', 0, 100000)
  if (creating || 'badge' in body) target.badge = cleanText(body.badge, '套餐角标', 12, false)
  if ('enabled' in body) target.enabled = Boolean(body.enabled)
}

function settleOrder(draft, orderId, providerTransactionId = '') {
  const order = draft.orders.find(item => item.id === orderId)
  if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', '充值订单不存在')
  if (order.status === 'paid') return order
  const user = draft.users.find(item => item.id === order.userId)
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', '充值用户不存在')
  order.status = 'paid'
  order.paidAt = now()
  order.providerTransactionId = providerTransactionId
  user.credits += order.credits
  user.updatedAt = now()
  draft.transactions.push({
    id: randomUUID(), userId: user.id, type: 'recharge', title: '积分充值', amount: order.credits,
    balanceAfter: user.credits, externalRef: order.id, createdAt: now()
  })
  return order
}

export async function createApplication() {
  assertProductionConfig()
  await Promise.all([
    mkdir(config.mediaDir, { recursive: true }),
    mkdir(path.join(config.mediaDir, 'uploads'), { recursive: true }),
    mkdir(path.join(config.mediaDir, 'outputs'), { recursive: true })
  ])
  const store = new JsonStore(config.dataDir)
  await store.init()
  if (store.read(state => !state.settings || state.settings.shareTitle === '来看看我用画漾制作的作品' || !state.templates.length || !state.banners.length || !state.packages.length || state.templates.some(item => !Array.isArray(item.tags) || !Number.isFinite(Number(item.popularity))))) {
    await store.transaction(draft => seedConfig(draft))
  }
  console.log(
    `[image] provider=${config.image.provider}` +
    (config.image.provider === 'compatible'
      ? ` endpoint=${config.image.apiBase} model=${config.image.model} key=${config.image.apiKey ? 'set' : 'missing'}`
      : ' (mock copies uploads; set IMAGE_PROVIDER=compatible for real AI generation)')
  )
  console.log(
    `[notify] subscribe=${isSubscribeNotifyConfigured() ? `enabled template=${config.wechat.subscribeTemplateId}` : 'disabled (set WECHAT_SUBSCRIBE_TEMPLATE_ID)'}`
  )
  const adminAttempts = new Map()

  async function notifyJobResult(jobId) {
    try {
      const state = store.read()
      const job = state.jobs.find(item => item.id === jobId)
      if (!job?.notifyRequested) return
      const user = state.users.find(item => item.id === job.userId)
      const template = findTemplate(state, job.templateId, true)
      await sendJobResultSubscribeMessage({
        openid: user?.openid,
        job,
        templateName: template?.name || '花漾相绘作品'
      })
    } catch (error) {
      console.error(`[notify] job=${jobId}`, error)
    }
  }

  async function processJob(jobId) {
    const claimed = await store.transaction(draft => {
      const job = draft.jobs.find(item => item.id === jobId)
      if (!job || !['queued', 'processing'].includes(job.status)) return null
      job.status = 'processing'
      job.startedAt ||= now()
      job.updatedAt = now()
      return job
    })
    if (!claimed) return

    try {
      console.log(`[job:${jobId}] processing template=${claimed.templateId} assets=${claimed.assetIds.length}`)
      const state = store.read()
      const template = findTemplate(state, claimed.templateId, true)
      if (!template) throw new Error('模板已下架')
      const assets = claimed.assetIds.map(id => state.assets.find(item => item.id === id))
      if (assets.some(item => !item)) throw new Error('原始图片不存在')
      const results = await generateImages(claimed, template, assets)
      await store.transaction(draft => {
        const job = draft.jobs.find(item => item.id === jobId)
        if (!job || job.status !== 'processing') return
        job.results = results
        job.status = 'succeeded'
        job.completedAt = now()
        job.updatedAt = now()
      })
      console.log(`[job:${jobId}] succeeded results=${results.length}`)
      await notifyJobResult(jobId)
    } catch (error) {
      console.error(`[job:${jobId}] failed:`, error)
      await store.transaction(draft => {
        const job = draft.jobs.find(item => item.id === jobId)
        if (!job || job.status === 'succeeded') return
        const alreadyRefunded = draft.transactions.some(item => item.type === 'job_refund' && item.externalRef === job.id)
        if (!alreadyRefunded) {
          const user = draft.users.find(item => item.id === job.userId)
          if (user) {
            user.credits += job.cost
            user.updatedAt = now()
            draft.transactions.push({
              id: randomUUID(), userId: user.id, type: 'job_refund', title: '生成失败退回', amount: job.cost,
              balanceAfter: user.credits, externalRef: job.id, createdAt: now()
            })
          }
        }
        job.status = 'failed'
        const detail = String(error?.message || error || '未知错误').replace(/\s+/g, ' ').trim().slice(0, 160)
        job.error = `生图失败：${detail}（积分已退回）`
        job.completedAt = now()
        job.updatedAt = now()
      })
      await notifyJobResult(jobId)
    }
  }

  async function handler(request, response) {
    setCors(response)
    if (request.method === 'OPTIONS') {
      response.writeHead(204)
      response.end()
      return
    }

    const url = new URL(request.url, config.publicBaseUrl)
    const pathname = decodeURIComponent(url.pathname)

    try {
      if (request.method === 'GET' && pathname === '/health') {
        json(response, 200, { ok: true, service: 'huayang-api', now: now() })
        return
      }

      if (request.method === 'GET' && pathname === '/favicon.ico') {
        response.writeHead(204)
        response.end()
        return
      }

      if (request.method === 'GET' && (pathname === '/admin' || pathname === '/admin/')) {
        await serveFile(response, path.join(config.rootDir, 'admin', 'index.html'), false)
        return
      }

      if (request.method === 'GET' && pathname.startsWith('/admin/')) {
        const relative = pathname.slice('/admin/'.length)
        const adminRoot = path.resolve(config.rootDir, 'admin')
        const filename = path.resolve(adminRoot, relative)
        if (!filename.startsWith(`${adminRoot}${path.sep}`) || !(await serveFile(response, filename, false))) {
          throw new HttpError(404, 'ADMIN_ASSET_NOT_FOUND', '后台资源不存在')
        }
        return
      }

      if (request.method === 'GET' && pathname.startsWith('/media/')) {
        const relative = pathname.slice('/media/'.length)
        const filename = path.resolve(config.mediaDir, relative)
        const mediaRoot = `${path.resolve(config.mediaDir)}${path.sep}`
        if (!filename.startsWith(mediaRoot) || !(await serveFile(response, filename))) {
          throw new HttpError(404, 'MEDIA_NOT_FOUND', '图片不存在')
        }
        return
      }

      if (request.method === 'GET' && pathname === '/api/config') {
        const state = store.read()
        json(response, 200, {
          newUserCredits: state.settings.welcomeCredits,
          checkinCredits: state.settings.checkinCredits,
          maxUploadMb: config.maxUploadBytes / 1024 / 1024,
          imageProvider: config.image.provider,
          paymentMode: config.payment.mode,
          wechatShareReady: isWechatShareConfigured(),
          subscribeEnabled: isSubscribeNotifyConfigured(),
          subscribeTemplateId: config.wechat.subscribeTemplateId || '',
          templateCategories: TEMPLATE_CATEGORIES
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/templates') {
        const state = store.read()
        json(response, 200, { templates: publicTemplates(state) })
        return
      }

      if (request.method === 'GET' && pathname === '/api/banners') {
        const state = store.read()
        json(response, 200, { banners: publicBanners(state) })
        return
      }

      if (request.method === 'GET' && pathname.startsWith('/api/shares/')) {
        const token = pathname.slice('/api/shares/'.length)
        if (!token || token.includes('/')) throw new HttpError(404, 'SHARE_NOT_FOUND', '分享不存在')
        const state = store.read()
        const share = state.shares.find(item => item.token === token)
        const result = share ? publicShare(share, state) : null
        if (!result) throw new HttpError(404, 'SHARE_NOT_FOUND', '分享不存在或作品已失效')
        json(response, 200, { share: result })
        return
      }

      if (request.method === 'POST' && pathname === '/api/admin/login') {
        const address = request.socket.remoteAddress || 'unknown'
        const attempt = adminAttempts.get(address) || { count: 0, resetAt: 0 }
        if (attempt.resetAt > Date.now() && attempt.count >= 5) {
          throw new HttpError(429, 'TOO_MANY_ATTEMPTS', '登录尝试过多，请稍后再试')
        }
        const body = await readJson(request)
        if (!safePasswordEqual(body.password, config.admin.password)) {
          adminAttempts.set(address, {
            count: attempt.resetAt > Date.now() ? attempt.count + 1 : 1,
            resetAt: Date.now() + 10 * 60 * 1000
          })
          throw new HttpError(401, 'INVALID_ADMIN_PASSWORD', '管理员密码不正确')
        }
        adminAttempts.delete(address)
        json(response, 200, { token: createAdminToken() })
        return
      }

      if (request.method === 'POST' && pathname === '/api/auth/wechat') {
        const { code } = await readJson(request)
        const identity = await exchangeWechatCode(code)
        const user = await store.transaction(draft => {
          let found = draft.users.find(item => item.openid === identity.openid)
          if (found) {
            if (found.enabled === false) throw new HttpError(403, 'USER_DISABLED', '账号已被停用，请联系管理员')
            found.lastLoginAt = now()
            found.isNew = false
            return found
          }
          found = {
            id: randomUUID(), openid: identity.openid, unionid: identity.unionid, nickname: '微信用户', avatarAssetId: '',
            credits: draft.settings.welcomeCredits, isNew: true, createdAt: now(), updatedAt: now(), lastLoginAt: now()
          }
          draft.users.push(found)
          draft.transactions.push({
            id: randomUUID(), userId: found.id, type: 'welcome', title: '新用户体验积分', amount: draft.settings.welcomeCredits,
            balanceAfter: found.credits, externalRef: '', createdAt: now()
          })
          return found
        })
        const state = store.read()
        json(response, 200, { token: createToken(user.id), user: publicUser(user, state) })
        return
      }

      if (request.method === 'POST' && pathname === '/api/payments/notify') {
        if (config.payment.mode !== 'wechat') throw new HttpError(404, 'NOT_FOUND', '接口不存在')
        const rawBody = await readBody(request, 512 * 1024)
        const notificationTime = Number(request.headers['wechatpay-timestamp'] || 0)
        if (Math.abs(Date.now() / 1000 - notificationTime) > 300 || !verifyWechatNotification(request.headers, rawBody)) {
          throw new HttpError(401, 'INVALID_SIGNATURE', '支付通知签名无效')
        }
        const notification = JSON.parse(rawBody.toString('utf8'))
        const resource = decryptWechatResource(notification.resource)
        if (resource.trade_state === 'SUCCESS' && resource.attach) {
          await store.transaction(draft => settleOrder(draft, resource.attach, resource.transaction_id || ''))
        }
        json(response, 200, { code: 'SUCCESS', message: '成功' })
        return
      }

      if (pathname.startsWith('/api/admin/')) {
        requireAdmin(request)

        if (request.method === 'GET' && pathname === '/api/admin/overview') {
          const state = store.read()
          json(response, 200, {
            settings: state.settings,
            templates: publicTemplates(state, true),
            banners: publicBanners(state, true),
            packages: publicPackages(state, true),
            templateCategories: TEMPLATE_CATEGORIES,
            stats: {
              users: state.users.length,
              jobs: state.jobs.length,
              completedJobs: state.jobs.filter(item => item.status === 'succeeded').length,
              paidOrders: state.orders.filter(item => item.status === 'paid').length,
              rechargedCredits: state.transactions.filter(item => item.type === 'recharge').reduce((sum, item) => sum + Number(item.amount || 0), 0),
              consumedCredits: Math.abs(state.transactions.filter(item => item.type === 'job_charge').reduce((sum, item) => sum + Number(item.amount || 0), 0))
            }
          })
          return
        }

        if (request.method === 'PATCH' && pathname === '/api/admin/settings') {
          const body = await readJson(request)
          const settings = await store.transaction(draft => {
            if ('welcomeCredits' in body) draft.settings.welcomeCredits = boundedInteger(body.welcomeCredits, '新用户积分', 0, 100000)
            if ('checkinCredits' in body) draft.settings.checkinCredits = boundedInteger(body.checkinCredits, '签到积分', 0, 100000)
            if ('shareTitle' in body) draft.settings.shareTitle = cleanText(body.shareTitle, '分享标题', 60, true)
            return draft.settings
          })
          json(response, 200, { settings })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/users') {
          const state = store.read()
          const query = String(url.searchParams.get('query') || '').trim().toLowerCase()
          const status = String(url.searchParams.get('status') || 'all')
          const users = state.users
            .filter(item => status === 'all' || (status === 'enabled' ? item.enabled !== false : item.enabled === false))
            .filter(item => !query || item.id.toLowerCase().includes(query) || String(item.nickname || '').toLowerCase().includes(query) || String(item.openid || '').toLowerCase().includes(query))
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 500)
            .map(item => adminUser(item, state))
          json(response, 200, { users, total: users.length })
          return
        }

        const adminUserMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)$/)
        if (request.method === 'PATCH' && adminUserMatch) {
          const body = await readJson(request)
          const userId = adminUserMatch[1]
          const updated = await store.transaction(draft => {
            const target = draft.users.find(item => item.id === userId)
            if (!target) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在')
            if ('enabled' in body) target.enabled = Boolean(body.enabled)
            target.updatedAt = now()
            return target
          })
          json(response, 200, { user: adminUser(updated, store.read()) })
          return
        }

        const adminCreditsMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/credits$/)
        if (request.method === 'POST' && adminCreditsMatch) {
          const body = await readJson(request)
          const userId = adminCreditsMatch[1]
          const amount = boundedInteger(body.amount, '调整积分', -1000000, 1000000)
          if (amount === 0) throw new HttpError(400, 'INVALID_FIELD', '调整积分不能为 0')
          const reason = cleanText(body.reason, '调整原因', 40, true)
          await store.transaction(draft => {
            const target = draft.users.find(item => item.id === userId)
            if (!target) throw new HttpError(404, 'USER_NOT_FOUND', '用户不存在')
            if (target.credits + amount < 0) throw new HttpError(409, 'INSUFFICIENT_CREDITS', '扣减后积分不能小于 0')
            target.credits += amount
            target.updatedAt = now()
            draft.transactions.push({
              id: randomUUID(), userId, type: 'admin_adjust', title: reason, amount,
              balanceAfter: target.credits, externalRef: 'admin', createdAt: now()
            })
          })
          const state = store.read()
          json(response, 200, { user: adminUser(state.users.find(item => item.id === userId), state) })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/transactions') {
          const state = store.read()
          const query = String(url.searchParams.get('query') || '').trim().toLowerCase()
          const type = String(url.searchParams.get('type') || 'all')
          const transactions = state.transactions
            .filter(item => type === 'all' || item.type === type)
            .filter(item => {
              if (!query) return true
              const owner = state.users.find(user => user.id === item.userId)
              return item.userId.toLowerCase().includes(query) || String(owner?.nickname || '').toLowerCase().includes(query) || String(item.title || '').toLowerCase().includes(query)
            })
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 1000)
            .map(item => {
              const owner = state.users.find(user => user.id === item.userId)
              const order = item.type === 'recharge' ? state.orders.find(entry => entry.id === item.externalRef) : null
              return {
                ...publicTransaction(item),
                typeLabel: transactionLabels[item.type] || item.type,
                userNickname: owner?.nickname || '未知用户',
                userMaskedId: item.userId.slice(0, 8),
                orderAmountYuan: order ? (Number(order.amountFen || 0) / 100).toFixed(2) : '',
                orderStatus: order?.status || ''
              }
            })
          json(response, 200, { transactions, total: transactions.length })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/jobs') {
          const state = store.read()
          const query = String(url.searchParams.get('query') || '').trim().toLowerCase()
          const status = String(url.searchParams.get('status') || 'all')
          const jobs = state.jobs
            .filter(item => status === 'all' || item.status === status)
            .filter(item => {
              if (!query) return true
              const owner = state.users.find(user => user.id === item.userId)
              const template = findTemplate(state, item.templateId, true)
              return item.id.toLowerCase().includes(query) || String(owner?.nickname || '').toLowerCase().includes(query) || String(template?.name || '').toLowerCase().includes(query)
            })
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 1000)
            .map(item => {
              const owner = state.users.find(user => user.id === item.userId)
              const job = publicJob(item, state)
              const endTime = item.completedAt || item.updatedAt
              return {
                ...job,
                userNickname: owner?.nickname || '未知用户',
                userMaskedId: item.userId.slice(0, 8),
                createdTime: displayTime(item.createdAt),
                completedTime: item.completedAt ? displayTime(item.completedAt) : '',
                durationSeconds: item.startedAt && endTime ? Math.max(0, Math.round((new Date(endTime) - new Date(item.startedAt)) / 1000)) : null
              }
            })
          json(response, 200, { jobs, total: jobs.length })
          return
        }

        if (request.method === 'POST' && pathname === '/api/admin/banners') {
          const body = await readJson(request)
          const id = randomUUID()
          await store.transaction(draft => {
            const item = { id, imageAssetId: '', enabled: body.enabled !== false }
            applyBannerFields(item, body, true)
            draft.banners.push(item)
          })
          const state = store.read()
          json(response, 201, { banner: publicBanners(state, true).find(item => item.id === id) })
          return
        }

        const adminBannerMatch = pathname.match(/^\/api\/admin\/banners\/([^/]+)$/)
        if (request.method === 'PATCH' && adminBannerMatch) {
          const body = await readJson(request)
          const bannerId = adminBannerMatch[1]
          await store.transaction(draft => {
            const item = draft.banners.find(entry => entry.id === bannerId)
            if (!item) throw new HttpError(404, 'BANNER_NOT_FOUND', 'Banner 不存在')
            applyBannerFields(item, body)
          })
          const state = store.read()
          json(response, 200, { banner: publicBanners(state, true).find(item => item.id === bannerId) })
          return
        }

        const bannerImageMatch = pathname.match(/^\/api\/admin\/banners\/([^/]+)\/image$/)
        if (request.method === 'POST' && bannerImageMatch) {
          const bannerId = bannerImageMatch[1]
          if (!store.read(state => state.banners.some(item => item.id === bannerId))) {
            throw new HttpError(404, 'BANNER_NOT_FOUND', 'Banner 不存在')
          }
          const upload = await readImageUpload(request, config.maxUploadBytes)
          const detected = detectImage(upload.data)
          if (!detected) throw new HttpError(415, 'UNSUPPORTED_IMAGE', '仅支持 JPG、PNG 或 WebP 图片')
          const assetId = randomUUID()
          const relativePath = path.join('banners', `${bannerId}-${assetId}${detected.extension}`).replaceAll('\\', '/')
          const filename = path.join(config.mediaDir, relativePath)
          await mkdir(path.dirname(filename), { recursive: true })
          await writeFile(filename, upload.data)
          await store.transaction(draft => {
            const banner = draft.banners.find(item => item.id === bannerId)
            if (!banner) throw new HttpError(404, 'BANNER_NOT_FOUND', 'Banner 不存在')
            draft.assets.push({
              id: assetId, userId: 'admin', originalName: path.basename(upload.filename).slice(0, 120),
              mime: detected.mime, size: upload.data.length, storagePath: relativePath, createdAt: now()
            })
            banner.imageAssetId = assetId
          })
          const state = store.read()
          json(response, 201, { banner: publicBanners(state, true).find(item => item.id === bannerId) })
          return
        }

        if (request.method === 'POST' && pathname === '/api/admin/templates') {
          const body = await readJson(request)
          // Auto-generate id when omitted; keep optional client-provided slug if valid
          let id = String(body.id || '').trim().toLowerCase()
          if (id) {
            if (!/^[a-z0-9][a-z0-9-]+$/.test(id)) throw new HttpError(400, 'INVALID_TEMPLATE_ID', '模板 ID 仅支持小写字母、数字和连字符')
          } else {
            id = slugifyTemplateId(body.name)
          }
          await store.transaction(draft => {
            while (draft.templates.some(item => item.id === id)) {
              id = slugifyTemplateId(body.name)
            }
            const item = { id, enabled: body.enabled !== false, coverAssetId: '' }
            applyTemplateFields(item, body, true)
            draft.templates.push(item)
          })
          const state = store.read()
          json(response, 201, { template: publicTemplates(state, true).find(item => item.id === id) })
          return
        }

        const adminTemplateMatch = pathname.match(/^\/api\/admin\/templates\/([^/]+)$/)
        if (request.method === 'PATCH' && adminTemplateMatch) {
          const body = await readJson(request)
          const templateId = adminTemplateMatch[1]
          await store.transaction(draft => {
            const item = draft.templates.find(template => template.id === templateId)
            if (!item) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '模板不存在')
            applyTemplateFields(item, body)
          })
          const state = store.read()
          json(response, 200, { template: publicTemplates(state, true).find(item => item.id === templateId) })
          return
        }

        const coverMatch = pathname.match(/^\/api\/admin\/templates\/([^/]+)\/cover$/)
        if (request.method === 'POST' && coverMatch) {
          const templateId = coverMatch[1]
          if (!store.read(state => state.templates.some(item => item.id === templateId))) {
            throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '模板不存在')
          }
          const upload = await readImageUpload(request, config.maxUploadBytes)
          const detected = detectImage(upload.data)
          if (!detected) throw new HttpError(415, 'UNSUPPORTED_IMAGE', '仅支持 JPG、PNG 或 WebP 图片')
          const assetId = randomUUID()
          const relativePath = path.join('covers', `${templateId}-${assetId}${detected.extension}`).replaceAll('\\', '/')
          const filename = path.join(config.mediaDir, relativePath)
          await mkdir(path.dirname(filename), { recursive: true })
          await writeFile(filename, upload.data)
          await store.transaction(draft => {
            const template = draft.templates.find(item => item.id === templateId)
            if (!template) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '模板不存在')
            draft.assets.push({
              id: assetId,
              userId: 'admin',
              originalName: path.basename(upload.filename).slice(0, 120),
              mime: detected.mime,
              size: upload.data.length,
              storagePath: relativePath,
              createdAt: now()
            })
            template.coverAssetId = assetId
          })
          const state = store.read()
          json(response, 201, { template: publicTemplates(state, true).find(item => item.id === templateId) })
          return
        }

        if (request.method === 'POST' && pathname === '/api/admin/packages') {
          const body = await readJson(request)
          const id = cleanText(body.id, '套餐 ID', 40, true)
          if (!/^[a-z0-9][a-z0-9-]+$/.test(id)) throw new HttpError(400, 'INVALID_PACKAGE_ID', '套餐 ID 仅支持小写字母、数字和连字符')
          await store.transaction(draft => {
            if (draft.packages.some(item => item.id === id)) throw new HttpError(409, 'PACKAGE_EXISTS', '套餐 ID 已存在')
            const item = { id, enabled: body.enabled !== false }
            applyPackageFields(item, body, true)
            draft.packages.push(item)
          })
          const state = store.read()
          json(response, 201, { package: publicPackages(state, true).find(item => item.id === id) })
          return
        }

        const adminPackageMatch = pathname.match(/^\/api\/admin\/packages\/([^/]+)$/)
        if (request.method === 'PATCH' && adminPackageMatch) {
          const body = await readJson(request)
          const packageId = adminPackageMatch[1]
          await store.transaction(draft => {
            const item = draft.packages.find(entry => entry.id === packageId)
            if (!item) throw new HttpError(404, 'PACKAGE_NOT_FOUND', '充值套餐不存在')
            applyPackageFields(item, body)
          })
          const state = store.read()
          json(response, 200, { package: publicPackages(state, true).find(item => item.id === packageId) })
          return
        }

        throw new HttpError(404, 'ADMIN_API_NOT_FOUND', '后台接口不存在')
      }

      const user = getAuthenticatedUser(request, store)

      if (request.method === 'GET' && pathname === '/api/me') {
        json(response, 200, { user: publicUser(user, store.read()) })
        return
      }

      if (request.method === 'PATCH' && pathname === '/api/me') {
        const body = await readJson(request)
        const updated = await store.transaction(draft => {
          const target = draft.users.find(item => item.id === user.id)
          if (typeof body.nickname === 'string') {
            const nickname = body.nickname.trim()
            if (!nickname || nickname.length > 20) throw new HttpError(400, 'INVALID_NICKNAME', '昵称需为 1–20 个字符')
            target.nickname = nickname
          }
          if (typeof body.avatarAssetId === 'string' && body.avatarAssetId) {
            const avatar = draft.assets.find(item => item.id === body.avatarAssetId && item.userId === user.id)
            if (!avatar) throw new HttpError(400, 'INVALID_AVATAR', '头像图片不存在')
            target.avatarAssetId = avatar.id
            target.avatarUrl = ''
          }
          // Allow WeChat CDN / https avatar URL (chooseAvatar may return https://tmp or thirdwx.qlogo.cn)
          if (typeof body.avatarUrl === 'string' && body.avatarUrl.trim()) {
            const avatarUrl = body.avatarUrl.trim()
            if (!/^https:\/\//i.test(avatarUrl) && !/^http:\/\/(tmp|usr)\//i.test(avatarUrl) && !avatarUrl.startsWith('wxfile://')) {
              throw new HttpError(400, 'INVALID_AVATAR_URL', '头像地址不合法')
            }
            // Permanent https URLs can be stored directly; local temp files should use upload + avatarAssetId
            if (/^https:\/\//i.test(avatarUrl)) {
              target.avatarUrl = avatarUrl.slice(0, 500)
              target.avatarAssetId = ''
            }
          }
          target.updatedAt = now()
          return target
        })
        json(response, 200, { user: publicUser(updated, store.read()) })
        return
      }

      if (request.method === 'GET' && pathname === '/api/profile') {
        const state = store.read()
        const succeeded = state.jobs.filter(item => item.userId === user.id && item.status === 'succeeded')
        json(response, 200, {
          user: publicUser(state.users.find(item => item.id === user.id), state),
          stats: { completedJobs: succeeded.length, generatedImages: succeeded.reduce((sum, item) => sum + item.results.length, 0) }
        })
        return
      }

      if (request.method === 'POST' && pathname === '/api/assets') {
        const upload = await readImageUpload(request, config.maxUploadBytes)
        const detected = detectImage(upload.data)
        if (!detected) throw new HttpError(415, 'UNSUPPORTED_IMAGE', '仅支持 JPG、PNG 或 WebP 图片')
        const id = randomUUID()
        const relativePath = path.join('uploads', user.id, `${id}${detected.extension}`).replaceAll('\\', '/')
        const filename = path.join(config.mediaDir, relativePath)
        await mkdir(path.dirname(filename), { recursive: true })
        await writeFile(filename, upload.data)
        const asset = await store.transaction(draft => {
          const item = {
            id, userId: user.id, originalName: path.basename(upload.filename).slice(0, 120), mime: detected.mime,
            size: upload.data.length, storagePath: relativePath, createdAt: now()
          }
          draft.assets.push(item)
          return item
        })
        json(response, 201, { asset: { ...asset, url: assetUrl(asset) } })
        return
      }

      if (request.method === 'POST' && pathname === '/api/jobs') {
        const body = await readJson(request)
        if (!Array.isArray(body.assetIds) || body.assetIds.length < 1 || body.assetIds.length > 6) {
          throw new HttpError(400, 'INVALID_ASSET_COUNT', '每次请选择 1–6 张图片')
        }
        if (new Set(body.assetIds).size !== body.assetIds.length) throw new HttpError(400, 'DUPLICATE_ASSET', '不能重复选择同一张图片')
        const template = findTemplate(store.read(), body.templateId)
        if (!template) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '模板不存在或已下架')
        const created = await store.transaction(draft => {
          const currentTemplate = findTemplate(draft, body.templateId)
          if (!currentTemplate) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '模板不存在或已下架')
          if (body.clientRequestId) {
            const existing = draft.jobs.find(item => item.userId === user.id && item.clientRequestId === body.clientRequestId)
            if (existing) return { job: existing, created: false }
          }
          const ownerAssets = body.assetIds.map(id => draft.assets.find(item => item.id === id && item.userId === user.id))
          if (ownerAssets.some(item => !item)) throw new HttpError(400, 'INVALID_ASSET', '部分图片不存在，请重新上传')
          const target = draft.users.find(item => item.id === user.id)
          const cost = currentTemplate.cost * body.assetIds.length
          if (target.credits < cost) throw new HttpError(409, 'INSUFFICIENT_CREDITS', '积分不足，请先充值')
          target.credits -= cost
          target.updatedAt = now()
          const job = {
            id: randomUUID(),
            clientRequestId: String(body.clientRequestId || ''),
            userId: user.id,
            templateId: currentTemplate.id,
            assetIds: body.assetIds,
            cost,
            status: 'queued',
            results: [],
            error: '',
            notifyRequested: Boolean(body.notify),
            createdAt: now(),
            updatedAt: now()
          }
          draft.jobs.push(job)
          draft.transactions.push({
            id: randomUUID(), userId: user.id, type: 'job_charge', title: `${currentTemplate.name} · ${body.assetIds.length} 张`,
            amount: -cost, balanceAfter: target.credits, externalRef: job.id, createdAt: now()
          })
          return { job, created: true }
        })
        if (created.created) setTimeout(() => processJob(created.job.id), 10)
        const state = store.read()
        json(response, created.created ? 201 : 200, {
          job: publicJob(created.job, state),
          user: publicUser(state.users.find(item => item.id === user.id), state)
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/jobs') {
        const jobs = store.read(state => state.jobs
          .filter(item => item.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(item => publicJob(item, state)))
        json(response, 200, { jobs })
        return
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/)
      if (request.method === 'GET' && jobMatch) {
        const state = store.read()
        const job = state.jobs.find(item => item.id === jobMatch[1] && item.userId === user.id)
        if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', '创作任务不存在')
        json(response, 200, { job: publicJob(job, state) })
        return
      }

      const shareJobMatch = pathname.match(/^\/api\/jobs\/([^/]+)\/share(?:\/(qrcode|url-link))?$/)
      if (request.method === 'POST' && shareJobMatch) {
        const jobId = shareJobMatch[1]
        const action = shareJobMatch[2] || 'create'
        const share = await store.transaction(draft => {
          const job = draft.jobs.find(item => item.id === jobId && item.userId === user.id)
          if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', '创作任务不存在')
          if (job.status !== 'succeeded') throw new HttpError(409, 'JOB_NOT_READY', '作品完成后才能分享')
          let item = draft.shares.find(entry => entry.jobId === job.id && entry.userId === user.id)
          if (!item) {
            item = {
              id: randomUUID(),
              token: randomBytes(18).toString('base64url'),
              jobId: job.id,
              userId: user.id,
              title: draft.settings.shareTitle,
              qrcodeStoragePath: '',
              urlLink: '',
              createdAt: now(),
              updatedAt: now()
            }
            draft.shares.push(item)
          }
          return item
        })

        if (action === 'qrcode' && !share.qrcodeStoragePath) {
          const storagePath = await createMiniProgramCode(share)
          await store.transaction(draft => {
            const item = draft.shares.find(entry => entry.id === share.id)
            item.qrcodeStoragePath = storagePath
            item.updatedAt = now()
          })
        }

        if (action === 'url-link' && !share.urlLink) {
          const urlLink = await createMiniProgramUrlLink(share)
          await store.transaction(draft => {
            const item = draft.shares.find(entry => entry.id === share.id)
            item.urlLink = urlLink
            item.updatedAt = now()
          })
        }

        const state = store.read()
        const current = state.shares.find(item => item.id === share.id)
        json(response, 200, { share: publicShare(current, state), wechatShareReady: isWechatShareConfigured() })
        return
      }

      if (request.method === 'POST' && pathname === '/api/checkins') {
        const dateKey = chinaDateKey()
        const result = await store.transaction(draft => {
          const existing = draft.transactions.find(item => item.userId === user.id && item.type === 'checkin' && item.externalRef === dateKey)
          const target = draft.users.find(item => item.id === user.id)
          if (existing) return { claimed: false, user: target }
          const amount = draft.settings.checkinCredits
          target.credits += amount
          target.updatedAt = now()
          draft.transactions.push({
            id: randomUUID(), userId: user.id, type: 'checkin', title: '每日签到', amount,
            balanceAfter: target.credits, externalRef: dateKey, createdAt: now()
          })
          return { claimed: true, user: target }
        })
        const state = store.read()
        json(response, 200, {
          claimed: result.claimed,
          reward: state.settings.checkinCredits,
          user: publicUser(state.users.find(item => item.id === user.id), state)
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/wallet') {
        const state = store.read()
        const transactions = state.transactions
          .filter(item => item.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .slice(0, 50)
          .map(publicTransaction)
        json(response, 200, {
          user: publicUser(state.users.find(item => item.id === user.id), state),
          packages: publicPackages(state),
          transactions,
          checkin: {
            reward: state.settings.checkinCredits,
            claimedToday: state.transactions.some(item => item.userId === user.id && item.type === 'checkin' && item.externalRef === chinaDateKey())
          }
        })
        return
      }

      if (request.method === 'POST' && pathname === '/api/payments/orders') {
        const body = await readJson(request)
        const creditPackage = store.read(state => state.packages.find(item => item.id === body.packageId && item.enabled !== false))
        if (!creditPackage) throw new HttpError(400, 'PACKAGE_NOT_FOUND', '充值套餐不存在')
        const order = await store.transaction(draft => {
          const item = {
            id: randomUUID(), userId: user.id, packageId: creditPackage.id,
            baseCredits: Number(creditPackage.credits), bonusCredits: Number(creditPackage.bonus || 0),
            credits: Number(creditPackage.credits) + Number(creditPackage.bonus || 0),
            amountFen: creditPackage.priceFen, status: 'pending', providerTransactionId: '', createdAt: now()
          }
          draft.orders.push(item)
          return item
        })

        if (config.payment.mode === 'mock') {
          await store.transaction(draft => settleOrder(draft, order.id, `mock-${order.id}`))
          const state = store.read()
          json(response, 201, {
            order: state.orders.find(item => item.id === order.id),
            payment: { mode: 'mock' },
            user: publicUser(state.users.find(item => item.id === user.id), state)
          })
          return
        }

        const params = await createWechatPrepay(order, user.openid)
        json(response, 201, { order, payment: { mode: 'wechat', params } })
        return
      }

      throw new HttpError(404, 'NOT_FOUND', '接口不存在')
    } catch (error) {
      const statusCode = error.statusCode || 500
      if (statusCode >= 500) console.error(error)
      if (!response.headersSent) {
        json(response, statusCode, {
          code: error.code || 'INTERNAL_ERROR',
          message: statusCode >= 500 && !error.statusCode ? '服务暂时不可用，请稍后重试' : error.message
        })
      } else {
        response.destroy()
      }
    }
  }

  const server = createServer(handler)
  const pendingJobs = store.read(state => state.jobs.filter(item => ['queued', 'processing'].includes(item.status)).map(item => item.id))
  for (const id of pendingJobs) setTimeout(() => processJob(id), 20)

  return { server, store, processJob }
}

export async function startServer(port = config.port) {
  const application = await createApplication()
  await new Promise((resolve, reject) => {
    application.server.once('error', reject)
    application.server.listen(port, '0.0.0.0', resolve)
  })
  const address = application.server.address()
  console.log(`Huayang API listening on http://127.0.0.1:${address.port}`)
  return application
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  const application = await startServer()
  const shutdown = () => application.server.close(() => process.exit(0))
  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}
