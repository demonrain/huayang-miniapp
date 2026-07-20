import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import path from 'node:path'
import { config, assertProductionConfig } from './config.mjs'
import { JsonStore } from './store.mjs'
import { templates, creditPackages, publicTemplates, publicPackages } from './catalog.mjs'
import { bearerToken, createToken, verifyToken } from './auth.mjs'
import { exchangeWechatCode } from './wechat.mjs'
import { generateImages } from './generator.mjs'
import { createWechatPrepay, decryptWechatResource, verifyWechatNotification } from './payments.mjs'
import { HttpError, json, readBody, readImageUpload, readJson, serveFile, setCors } from './http.mjs'

const now = () => new Date().toISOString()
const statusLabels = { queued: '排队中', processing: '生成中', succeeded: '已完成', failed: '失败' }

function detectImage(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { mime: 'image/jpeg', extension: '.jpg' }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: 'image/png', extension: '.png' }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return { mime: 'image/webp', extension: '.webp' }
  return null
}

function assetUrl(asset) {
  return asset ? `${config.publicBaseUrl}/media/${asset.storagePath.split('/').map(encodeURIComponent).join('/')}` : ''
}

function publicUser(user, state) {
  const avatar = user.avatarAssetId ? state.assets.find(item => item.id === user.avatarAssetId) : null
  return {
    id: user.id,
    maskedId: user.id.slice(0, 4).toUpperCase(),
    nickname: user.nickname,
    avatarUrl: avatar ? assetUrl(avatar) : '',
    credits: user.credits,
    isNew: Boolean(user.isNew),
    createdAt: user.createdAt
  }
}

function publicJob(job) {
  const template = templates.find(item => item.id === job.templateId)
  const results = (job.results || []).map(result => ({
    id: result.id,
    mime: result.mime,
    url: `${config.publicBaseUrl}/media/${result.storagePath.split('/').map(encodeURIComponent).join('/')}`
  }))
  return {
    id: job.id,
    templateId: job.templateId,
    assetIds: job.assetIds,
    cost: job.cost,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || '',
    templateName: template?.name || '已下架模板',
    templateShortName: template?.shortName || '作品',
    templatePalette: template?.palette || '#54615b',
    statusLabel: statusLabels[job.status] || job.status,
    results,
    coverUrl: results[0]?.url || ''
  }
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
  return user
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
      const template = templates.find(item => item.id === claimed.templateId)
      if (!template) throw new Error('模板已下架')
      const assets = store.read(state => claimed.assetIds.map(id => state.assets.find(item => item.id === id)))
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
    } catch (error) {
      console.error(`[job:${jobId}]`, error)
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
        job.error = '生图服务暂时不可用，积分已退回'
        job.completedAt = now()
        job.updatedAt = now()
      })
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
        json(response, 200, {
          newUserCredits: config.newUserCredits,
          maxUploadMb: config.maxUploadBytes / 1024 / 1024,
          imageProvider: config.image.provider,
          paymentMode: config.payment.mode
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/templates') {
        json(response, 200, { templates: publicTemplates() })
        return
      }

      if (request.method === 'POST' && pathname === '/api/auth/wechat') {
        const { code } = await readJson(request)
        const identity = await exchangeWechatCode(code)
        const user = await store.transaction(draft => {
          let found = draft.users.find(item => item.openid === identity.openid)
          if (found) {
            found.lastLoginAt = now()
            found.isNew = false
            return found
          }
          found = {
            id: randomUUID(), openid: identity.openid, unionid: identity.unionid, nickname: '微信用户', avatarAssetId: '',
            credits: config.newUserCredits, isNew: true, createdAt: now(), updatedAt: now(), lastLoginAt: now()
          }
          draft.users.push(found)
          draft.transactions.push({
            id: randomUUID(), userId: found.id, type: 'welcome', title: '新用户体验积分', amount: config.newUserCredits,
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
          if (typeof body.avatarAssetId === 'string') {
            const avatar = draft.assets.find(item => item.id === body.avatarAssetId && item.userId === user.id)
            if (!avatar) throw new HttpError(400, 'INVALID_AVATAR', '头像图片不存在')
            target.avatarAssetId = avatar.id
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
        const template = templates.find(item => item.id === body.templateId)
        if (!template) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '模板不存在或已下架')
        const created = await store.transaction(draft => {
          if (body.clientRequestId) {
            const existing = draft.jobs.find(item => item.userId === user.id && item.clientRequestId === body.clientRequestId)
            if (existing) return { job: existing, created: false }
          }
          const ownerAssets = body.assetIds.map(id => draft.assets.find(item => item.id === id && item.userId === user.id))
          if (ownerAssets.some(item => !item)) throw new HttpError(400, 'INVALID_ASSET', '部分图片不存在，请重新上传')
          const target = draft.users.find(item => item.id === user.id)
          const cost = template.cost * body.assetIds.length
          if (target.credits < cost) throw new HttpError(409, 'INSUFFICIENT_CREDITS', '积分不足，请先充值')
          target.credits -= cost
          target.updatedAt = now()
          const job = {
            id: randomUUID(), clientRequestId: String(body.clientRequestId || ''), userId: user.id, templateId: template.id,
            assetIds: body.assetIds, cost, status: 'queued', results: [], error: '', createdAt: now(), updatedAt: now()
          }
          draft.jobs.push(job)
          draft.transactions.push({
            id: randomUUID(), userId: user.id, type: 'job_charge', title: `${template.name} · ${body.assetIds.length} 张`,
            amount: -cost, balanceAfter: target.credits, externalRef: job.id, createdAt: now()
          })
          return { job, created: true }
        })
        if (created.created) setTimeout(() => processJob(created.job.id), 10)
        const state = store.read()
        json(response, created.created ? 201 : 200, {
          job: publicJob(created.job),
          user: publicUser(state.users.find(item => item.id === user.id), state)
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/jobs') {
        const jobs = store.read(state => state.jobs
          .filter(item => item.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map(publicJob))
        json(response, 200, { jobs })
        return
      }

      const jobMatch = pathname.match(/^\/api\/jobs\/([^/]+)$/)
      if (request.method === 'GET' && jobMatch) {
        const job = store.read(state => state.jobs.find(item => item.id === jobMatch[1] && item.userId === user.id))
        if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', '创作任务不存在')
        json(response, 200, { job: publicJob(job) })
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
          packages: publicPackages(),
          transactions
        })
        return
      }

      if (request.method === 'POST' && pathname === '/api/payments/orders') {
        const body = await readJson(request)
        const creditPackage = creditPackages.find(item => item.id === body.packageId)
        if (!creditPackage) throw new HttpError(400, 'PACKAGE_NOT_FOUND', '充值套餐不存在')
        const order = await store.transaction(draft => {
          const item = {
            id: randomUUID(), userId: user.id, packageId: creditPackage.id, credits: creditPackage.credits,
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
