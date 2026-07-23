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
  assetThumbUrl,
  assetUrl,
  DEFAULT_TEMPLATE_CATEGORIES,
  findTemplate,
  listTemplateCategories,
  mediaUrl,
  publicBanners,
  publicJob,
  publicPackages,
  publicShare,
  publicShareRewardSettings,
  publicTemplate,
  publicTemplates,
  seedConfig
} from './domain.mjs'
import { ensureThumb, findOriginalForThumb, isThumbPath } from './thumbs.mjs'
import { createMiniProgramCode, createMiniProgramUrlLink, isWechatShareConfigured } from './wechat-share.mjs'
import {
  isSubscribeNotifyConfigured,
  sendAdminSubscribeMessage,
  sendJobResultSubscribeMessage
} from './wechat-notify.mjs'

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

function categoryLabel(categoryId, state = null) {
  if (state) {
    const found = listTemplateCategories(state, true).find(item => item.id === categoryId)
    if (found) return found.name
  }
  return DEFAULT_TEMPLATE_CATEGORIES.find(item => item.id === categoryId)?.name || categoryId || ''
}

function publicBannerSettings(settings = {}) {
  const mode = settings.bannerSwitchMode === 'manual' ? 'manual' : 'auto'
  const intervalMs = Math.min(30000, Math.max(1500, Number(settings.bannerSwitchIntervalMs) || 4500))
  return {
    mode,
    intervalMs,
    circular: settings.bannerCircular !== false,
    autoplay: mode === 'auto'
  }
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

function applyTemplateFields(target, body, creating = false, categories = DEFAULT_TEMPLATE_CATEGORIES) {
  if (creating || 'name' in body) target.name = cleanText(body.name, '模板名称', 30, true)
  if (creating || 'shortName' in body) {
    // shortName is optional; default to first chars of name
    const shortName = String(body.shortName ?? '').trim()
    if (shortName) target.shortName = cleanText(shortName, '模板简称', 8, false)
    else target.shortName = cleanText(String(target.name || body.name || '风格').slice(0, 4), '模板简称', 8, true)
  }
  if (creating || 'category' in body) {
    const category = cleanText(body.category, '模板分类', 40, true)
    if (!categories.some(item => item.id === category)) {
      throw new HttpError(400, 'INVALID_CATEGORY', `分类需为：${categories.map(item => item.name).join('、') || '请先创建分类'}`)
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
  admin_adjust: '后台调整',
  share_friend: '分享作品到好友',
  share_timeline: '分享作品到朋友圈',
  invite_login: '邀请新用户登录',
  invite_first_job: '邀请新用户完成首作',
  cdk_redeem: 'CDK 兑换积分'
}

const feedbackTypeLabels = {
  problem: '问题反馈',
  feature: '功能建议',
  template_request: '请求新模板'
}

const feedbackStatusLabels = {
  pending: '待回复',
  replied: '已回复'
}

function publicFeedback(item, state, { includeUser = false } = {}) {
  const images = (item.assetIds || []).map(assetId => {
    const asset = state.assets.find(a => a.id === assetId)
    if (!asset) return null
    const full = assetUrl(asset)
    return { id: asset.id, url: full, thumbUrl: assetThumbUrl(asset) || full }
  }).filter(Boolean)
  const status = item.reply ? 'replied' : (item.status || 'pending')
  const value = {
    id: item.id,
    type: item.type,
    typeLabel: feedbackTypeLabels[item.type] || item.type,
    content: item.content,
    images,
    status,
    statusLabel: feedbackStatusLabels[status] || status,
    reply: item.reply || '',
    repliedAt: item.repliedAt || '',
    repliedTime: item.repliedAt ? displayTime(item.repliedAt) : '',
    createdAt: item.createdAt,
    createdTime: displayTime(item.createdAt)
  }
  if (includeUser) {
    const owner = state.users.find(user => user.id === item.userId)
    value.userId = item.userId
    value.userNickname = owner?.nickname || '未知用户'
    value.userMaskedId = String(item.userId || '').slice(0, 8)
  }
  return value
}

// Avoid ambiguous 0/O/1/I in redemption codes
const CDK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomCdkSegment(length = 4) {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CDK_ALPHABET[randomBytes(1)[0] % CDK_ALPHABET.length]
  }
  return out
}

function generateCdkCode() {
  return `${randomCdkSegment(4)}-${randomCdkSegment(4)}-${randomCdkSegment(4)}`
}

function normalizeCdkCode(code) {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .replace(/(.{4})(?=.)/g, '$1-')
    .replace(/-$/, '')
}

function resolveCdkExpiresAt(expireType, customExpiresAt) {
  const type = String(expireType || 'never').trim()
  if (type === 'never' || type === '' || type === 'unlimited') return ''
  const nowMs = Date.now()
  if (type === '1d') return new Date(nowMs + 1 * 24 * 60 * 60 * 1000).toISOString()
  if (type === '3d') return new Date(nowMs + 3 * 24 * 60 * 60 * 1000).toISOString()
  if (type === '7d') return new Date(nowMs + 7 * 24 * 60 * 60 * 1000).toISOString()
  if (type === 'custom') {
    const raw = String(customExpiresAt || '').trim()
    if (!raw) throw new HttpError(400, 'INVALID_EXPIRE', '自定义有效期请选择截止日期')
    const date = new Date(raw)
    if (Number.isNaN(date.getTime())) throw new HttpError(400, 'INVALID_EXPIRE', '自定义有效期格式不正确')
    if (date.getTime() <= nowMs) throw new HttpError(400, 'INVALID_EXPIRE', '有效期必须晚于当前时间')
    return date.toISOString()
  }
  throw new HttpError(400, 'INVALID_EXPIRE', '有效期类型不支持')
}

function cdkRedeemCount(item) {
  if (Array.isArray(item.redemptions) && item.redemptions.length) return item.redemptions.length
  if (item.redeemedAt || item.redeemedBy) return 1
  return Number(item.redeemCount || 0)
}

function cdkMaxUses(item) {
  // 0 = unlimited; default 1 for legacy single-use codes
  if (item.maxUses === 0 || item.maxUses === '0') return 0
  if (item.maxUses == null || item.maxUses === '') return 1
  return Math.max(0, Number(item.maxUses) || 1)
}

function cdkStatus(item, at = Date.now()) {
  if (item.expiresAt && new Date(item.expiresAt).getTime() <= at) return 'expired'
  const used = cdkRedeemCount(item)
  const maxUses = cdkMaxUses(item)
  if (maxUses === 0) return used > 0 ? 'active' : 'unused' // unlimited
  if (used <= 0) return 'unused'
  if (used >= maxUses) return 'exhausted'
  return 'active' // partially used multi-use
}

function publicCdk(item, state = null) {
  const status = cdkStatus(item)
  const used = cdkRedeemCount(item)
  const maxUses = cdkMaxUses(item)
  const redemptions = Array.isArray(item.redemptions) && item.redemptions.length
    ? item.redemptions
    : (item.redeemedBy
      ? [{ userId: item.redeemedBy, redeemedAt: item.redeemedAt || '' }]
      : [])
  const last = redemptions[redemptions.length - 1]
  const redeemer = state && last?.userId
    ? state.users.find(user => user.id === last.userId)
    : null
  const statusLabels = {
    unused: '未使用',
    active: '使用中',
    exhausted: '已兑完',
    redeemed: '已兑换',
    expired: '已过期'
  }
  return {
    id: item.id,
    code: item.code,
    credits: Number(item.credits || 0),
    maxUses,
    maxUsesLabel: maxUses === 0 ? '不限次数' : `${maxUses} 次`,
    redeemCount: used,
    remainingUses: maxUses === 0 ? null : Math.max(0, maxUses - used),
    expiresAt: item.expiresAt || '',
    expiresLabel: item.expiresAt ? displayTime(item.expiresAt) : '永久有效',
    createdAt: item.createdAt,
    createdTime: displayTime(item.createdAt),
    redeemedAt: last?.redeemedAt || item.redeemedAt || '',
    redeemedTime: (last?.redeemedAt || item.redeemedAt) ? displayTime(last?.redeemedAt || item.redeemedAt) : '',
    redeemedBy: last?.userId || item.redeemedBy || '',
    redeemerNickname: redeemer?.nickname || '',
    status,
    statusLabel: statusLabels[status] || status,
    note: item.note || ''
  }
}

const shareChannelLabels = {
  friend: '微信好友',
  timeline: '朋友圈'
}

function creditUser(draft, userId, amount, type, title, externalRef = '') {
  if (!amount || amount <= 0) return null
  const target = draft.users.find(item => item.id === userId)
  if (!target) return null
  target.credits += amount
  target.updatedAt = now()
  const tx = {
    id: randomUUID(),
    userId,
    type,
    title,
    amount,
    balanceAfter: target.credits,
    externalRef: String(externalRef || ''),
    createdAt: now()
  }
  draft.transactions.push(tx)
  return tx
}

function applyInviteLoginReward(draft, invitee, inviteToken) {
  const settings = publicShareRewardSettings(draft.settings)
  if (!settings.inviteRewardEnabled || !inviteToken || !invitee?.isNew) return null
  if (!Array.isArray(draft.invites)) draft.invites = []
  if (draft.invites.some(item => item.inviteeId === invitee.id)) return null

  const share = draft.shares.find(item => item.token === inviteToken)
  if (!share?.userId || share.userId === invitee.id) return null
  const inviter = draft.users.find(item => item.id === share.userId)
  if (!inviter || inviter.enabled === false) return null

  const invite = {
    id: randomUUID(),
    inviterId: inviter.id,
    inviteeId: invitee.id,
    shareToken: share.token,
    jobId: share.jobId || '',
    loginRewarded: false,
    firstJobRewarded: false,
    createdAt: now()
  }

  let loginReward = 0
  if (settings.inviteLoginCredits > 0) {
    creditUser(
      draft,
      inviter.id,
      settings.inviteLoginCredits,
      'invite_login',
      '邀请新用户登录奖励',
      invitee.id
    )
    invite.loginRewarded = true
    invite.loginRewardedAt = now()
    loginReward = settings.inviteLoginCredits
  }
  draft.invites.push(invite)
  return { invite, loginReward, inviterId: inviter.id }
}

function applyInviteFirstJobReward(draft, inviteeUserId) {
  const settings = publicShareRewardSettings(draft.settings)
  if (!settings.inviteRewardEnabled || settings.inviteFirstJobCredits <= 0) return null
  if (!Array.isArray(draft.invites)) return null
  const invite = draft.invites.find(item => item.inviteeId === inviteeUserId && !item.firstJobRewarded)
  if (!invite) return null
  const inviter = draft.users.find(item => item.id === invite.inviterId)
  if (!inviter || inviter.enabled === false) {
    invite.firstJobRewarded = true
    invite.firstJobSkipped = true
    return null
  }
  // Called after current job is marked succeeded — first work only when total succeeded === 1
  const succeededCount = draft.jobs.filter(
    item => item.userId === inviteeUserId && item.status === 'succeeded'
  ).length
  if (succeededCount !== 1) return null
  creditUser(
    draft,
    inviter.id,
    settings.inviteFirstJobCredits,
    'invite_first_job',
    '邀请新用户完成首作奖励',
    inviteeUserId
  )
  invite.firstJobRewarded = true
  invite.firstJobRewardedAt = now()
  return { invite, reward: settings.inviteFirstJobCredits, inviterId: inviter.id }
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
  if (store.read(state => !state.settings || state.settings.shareTitle === '来看看我用画漾制作的作品' || !state.templates.length || !state.banners.length || !state.packages.length || !state.templateCategories?.length || state.settings.bannerSwitchMode === undefined || state.templates.some(item => !Array.isArray(item.tags) || !Number.isFinite(Number(item.popularity))))) {
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
        // Invite first-job reward for inviter (when invitee completes first succeeded work)
        applyInviteFirstJobReward(draft, job.userId)
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

      if (request.method === 'GET' && pathname === '/favicon.ico') {
        if (!(await serveFile(response, path.join(config.rootDir, 'admin', 'favicon.ico'), true))) {
          throw new HttpError(404, 'NOT_FOUND', 'favicon 不存在')
        }
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
        const relative = pathname.slice('/media/'.length).replaceAll('\\', '/')
        const mediaRoot = `${path.resolve(config.mediaDir)}${path.sep}`
        const filename = path.resolve(config.mediaDir, relative)
        if (!filename.startsWith(mediaRoot)) {
          throw new HttpError(404, 'MEDIA_NOT_FOUND', '图片不存在')
        }
        if (await serveFile(response, filename)) return
        // Lazy-generate missing thumbnails from the original file
        if (isThumbPath(relative)) {
          const originalRel = await findOriginalForThumb(relative)
          if (originalRel) {
            await ensureThumb(originalRel)
            if (await serveFile(response, filename)) return
            // Fall back to original so UI never breaks without sharp
            const originalFile = path.resolve(config.mediaDir, originalRel)
            if (originalFile.startsWith(mediaRoot) && (await serveFile(response, originalFile))) return
          }
        }
        throw new HttpError(404, 'MEDIA_NOT_FOUND', '图片不存在')
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
          templateCategories: listTemplateCategories(state).map(item => ({ id: item.id, name: item.name })),
          bannerCarousel: publicBannerSettings(state.settings),
          shareRewards: publicShareRewardSettings(state.settings)
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
        const body = await readJson(request)
        const { code } = body
        const inviteToken = String(body.inviteToken || body.shareToken || '').trim()
        const identity = await exchangeWechatCode(code)
        const created = await store.transaction(draft => {
          let found = draft.users.find(item => item.openid === identity.openid)
          if (found) {
            if (found.enabled === false) throw new HttpError(403, 'USER_DISABLED', '账号已被停用，请联系管理员')
            found.lastLoginAt = now()
            found.isNew = false
            return { user: found, invite: null }
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
          const invite = applyInviteLoginReward(draft, found, inviteToken)
          return { user: found, invite }
        })
        const state = store.read()
        json(response, 200, {
          token: createToken(created.user.id),
          user: publicUser(created.user, state),
          invite: created.invite
            ? { loginReward: created.invite.loginReward, inviterId: created.invite.inviterId }
            : null
        })
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
          // Templates are loaded via paginated GET /api/admin/templates (avoid shipping full list here)
          const templateCategoryCounts = {}
          for (const item of state.templates) {
            const key = String(item.category || '')
            if (!key) continue
            templateCategoryCounts[key] = (templateCategoryCounts[key] || 0) + 1
          }
          json(response, 200, {
            settings: state.settings,
            banners: publicBanners(state, true),
            packages: publicPackages(state, true),
            templateCategories: listTemplateCategories(state, true),
            templateCount: state.templates.length,
            templateCategoryCounts,
            bannerCarousel: publicBannerSettings(state.settings),
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
            if ('bannerSwitchMode' in body) {
              const mode = String(body.bannerSwitchMode || '').trim()
              if (!['auto', 'manual'].includes(mode)) throw new HttpError(400, 'INVALID_FIELD', 'Banner 切换方式需为 auto 或 manual')
              draft.settings.bannerSwitchMode = mode
            }
            if ('bannerSwitchIntervalMs' in body) {
              draft.settings.bannerSwitchIntervalMs = boundedInteger(body.bannerSwitchIntervalMs, 'Banner 切换间隔', 1500, 30000)
            }
            if ('bannerCircular' in body) draft.settings.bannerCircular = Boolean(body.bannerCircular)
            if ('shareRewardEnabled' in body) draft.settings.shareRewardEnabled = Boolean(body.shareRewardEnabled)
            if ('shareFriendCredits' in body) draft.settings.shareFriendCredits = boundedInteger(body.shareFriendCredits, '分享好友积分', 0, 100000)
            if ('shareTimelineCredits' in body) draft.settings.shareTimelineCredits = boundedInteger(body.shareTimelineCredits, '分享朋友圈积分', 0, 100000)
            if ('shareFriendDailyLimit' in body) draft.settings.shareFriendDailyLimit = boundedInteger(body.shareFriendDailyLimit, '分享好友每日上限', 0, 100)
            if ('shareTimelineDailyLimit' in body) draft.settings.shareTimelineDailyLimit = boundedInteger(body.shareTimelineDailyLimit, '分享朋友圈每日上限', 0, 100)
            if ('inviteRewardEnabled' in body) draft.settings.inviteRewardEnabled = Boolean(body.inviteRewardEnabled)
            if ('inviteLoginCredits' in body) draft.settings.inviteLoginCredits = boundedInteger(body.inviteLoginCredits, '邀请登录积分', 0, 100000)
            if ('inviteFirstJobCredits' in body) draft.settings.inviteFirstJobCredits = boundedInteger(body.inviteFirstJobCredits, '邀请首作积分', 0, 100000)
            return draft.settings
          })
          json(response, 200, {
            settings,
            bannerCarousel: publicBannerSettings(settings),
            shareRewards: publicShareRewardSettings(settings)
          })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/share-stats') {
          const state = store.read()
          const events = Array.isArray(state.shareEvents) ? state.shareEvents : []
          const invites = Array.isArray(state.invites) ? state.invites : []
          const today = chinaDateKey()
          const todayEvents = events.filter(item => item.dateKey === today)
          const friendToday = todayEvents.filter(item => item.channel === 'friend')
          const timelineToday = todayEvents.filter(item => item.channel === 'timeline')
          const shareRewardSum = events.reduce((sum, item) => sum + Number(item.reward || 0), 0)
          const inviteLoginCount = invites.filter(item => item.loginRewarded).length
          const inviteFirstJobCount = invites.filter(item => item.firstJobRewarded && !item.firstJobSkipped).length
          const inviteLoginRewardSum = state.transactions
            .filter(item => item.type === 'invite_login')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
          const inviteFirstJobRewardSum = state.transactions
            .filter(item => item.type === 'invite_first_job')
            .reduce((sum, item) => sum + Number(item.amount || 0), 0)
          json(response, 200, {
            summary: {
              shareEventsTotal: events.length,
              shareFriendTotal: events.filter(item => item.channel === 'friend').length,
              shareTimelineTotal: events.filter(item => item.channel === 'timeline').length,
              shareRewardCredits: shareRewardSum,
              shareTodayFriend: friendToday.length,
              shareTodayTimeline: timelineToday.length,
              shareTodayRewardCredits: todayEvents.reduce((sum, item) => sum + Number(item.reward || 0), 0),
              invitesTotal: invites.length,
              inviteLoginRewarded: inviteLoginCount,
              inviteFirstJobRewarded: inviteFirstJobCount,
              inviteLoginCredits: inviteLoginRewardSum,
              inviteFirstJobCredits: inviteFirstJobRewardSum
            },
            shareRewards: publicShareRewardSettings(state.settings)
          })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/share-events') {
          const state = store.read()
          const query = String(url.searchParams.get('query') || '').trim().toLowerCase()
          const channel = String(url.searchParams.get('channel') || 'all')
          const events = (Array.isArray(state.shareEvents) ? state.shareEvents : [])
            .filter(item => channel === 'all' || item.channel === channel)
            .filter(item => {
              if (!query) return true
              const owner = state.users.find(user => user.id === item.userId)
              return item.userId.toLowerCase().includes(query)
                || String(owner?.nickname || '').toLowerCase().includes(query)
                || String(item.jobId || '').toLowerCase().includes(query)
            })
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 500)
            .map(item => {
              const owner = state.users.find(user => user.id === item.userId)
              return {
                id: item.id,
                channel: item.channel,
                channelLabel: shareChannelLabels[item.channel] || item.channel,
                reward: Number(item.reward || 0),
                jobId: item.jobId,
                dateKey: item.dateKey,
                createdAt: item.createdAt,
                createdTime: displayTime(item.createdAt),
                userNickname: owner?.nickname || '未知用户',
                userMaskedId: item.userId.slice(0, 8)
              }
            })
          const invites = (Array.isArray(state.invites) ? state.invites : [])
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 500)
            .map(item => {
              const inviter = state.users.find(user => user.id === item.inviterId)
              const invitee = state.users.find(user => user.id === item.inviteeId)
              return {
                id: item.id,
                createdAt: item.createdAt,
                createdTime: displayTime(item.createdAt),
                inviterNickname: inviter?.nickname || '未知',
                inviterMaskedId: item.inviterId.slice(0, 8),
                inviteeNickname: invitee?.nickname || '未知',
                inviteeMaskedId: item.inviteeId.slice(0, 8),
                loginRewarded: Boolean(item.loginRewarded),
                firstJobRewarded: Boolean(item.firstJobRewarded && !item.firstJobSkipped),
                shareToken: item.shareToken || ''
              }
            })
          json(response, 200, { events, invites, totalEvents: events.length, totalInvites: invites.length })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/categories') {
          json(response, 200, { categories: listTemplateCategories(store.read(), true) })
          return
        }

        if (request.method === 'POST' && pathname === '/api/admin/categories') {
          const body = await readJson(request)
          let id = String(body.id || '').trim().toLowerCase()
          if (id) {
            if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(id)) throw new HttpError(400, 'INVALID_CATEGORY_ID', '分类 ID 仅支持小写字母、数字和连字符')
          } else {
            id = slugifyTemplateId(body.name || 'category').replace(/^tpl-/, 'cat-')
          }
          const name = cleanText(body.name, '分类名称', 40, true)
          const sortOrder = boundedInteger(body.sortOrder ?? 0, '排序值', 0, 100000)
          const enabled = body.enabled !== false
          await store.transaction(draft => {
            if (!Array.isArray(draft.templateCategories)) draft.templateCategories = []
            while (draft.templateCategories.some(item => item.id === id)) {
              id = slugifyTemplateId(name).replace(/^tpl-/, 'cat-')
            }
            draft.templateCategories.push({ id, name, sortOrder, enabled })
          })
          json(response, 201, { category: listTemplateCategories(store.read(), true).find(item => item.id === id) })
          return
        }

        const adminCategoryMatch = pathname.match(/^\/api\/admin\/categories\/([^/]+)$/)
        if (request.method === 'PATCH' && adminCategoryMatch) {
          const body = await readJson(request)
          const categoryId = adminCategoryMatch[1]
          await store.transaction(draft => {
            if (!Array.isArray(draft.templateCategories)) draft.templateCategories = []
            const item = draft.templateCategories.find(entry => entry.id === categoryId)
            if (!item) throw new HttpError(404, 'CATEGORY_NOT_FOUND', '分类不存在')
            if ('name' in body) item.name = cleanText(body.name, '分类名称', 40, true)
            if ('sortOrder' in body) item.sortOrder = boundedInteger(body.sortOrder, '排序值', 0, 100000)
            if ('enabled' in body) item.enabled = Boolean(body.enabled)
          })
          json(response, 200, { category: listTemplateCategories(store.read(), true).find(item => item.id === categoryId) })
          return
        }

        if (request.method === 'DELETE' && adminCategoryMatch) {
          const categoryId = adminCategoryMatch[1]
          await store.transaction(draft => {
            if (!Array.isArray(draft.templateCategories)) draft.templateCategories = []
            const index = draft.templateCategories.findIndex(entry => entry.id === categoryId)
            if (index === -1) throw new HttpError(404, 'CATEGORY_NOT_FOUND', '分类不存在')
            const inUse = draft.templates.some(item => item.category === categoryId)
            if (inUse) throw new HttpError(409, 'CATEGORY_IN_USE', '仍有模板使用该分类，请先调整模板后再删除')
            if (draft.templateCategories.length <= 1) throw new HttpError(409, 'CATEGORY_REQUIRED', '至少保留一个模板分类')
            draft.templateCategories.splice(index, 1)
          })
          json(response, 200, { ok: true, id: categoryId })
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
              const template = findTemplate(state, item.templateId, true)
              const sampleResultIds = new Set(
                (template?.sampleRefs || []).filter(ref => ref.jobId === item.id).map(ref => ref.resultId)
              )
              return {
                ...job,
                userNickname: owner?.nickname || '未知用户',
                userMaskedId: item.userId.slice(0, 8),
                createdTime: displayTime(item.createdAt),
                completedTime: item.completedAt ? displayTime(item.completedAt) : '',
                durationSeconds: item.startedAt && endTime ? Math.max(0, Math.round((new Date(endTime) - new Date(item.startedAt)) / 1000)) : null,
                results: (job.results || []).map(result => ({
                  ...result,
                  isSample: sampleResultIds.has(result.id)
                }))
              }
            })
          json(response, 200, { jobs, total: jobs.length })
          return
        }

        // Add / remove a job result in its template's "更多效果参考" samples
        const adminJobSampleMatch = pathname.match(/^\/api\/admin\/jobs\/([^/]+)\/samples$/)
        if (adminJobSampleMatch && (request.method === 'POST' || request.method === 'DELETE')) {
          const jobId = adminJobSampleMatch[1]
          const body = await readJson(request)
          const resultId = cleanText(body.resultId, '结果 ID', 80, true)

          if (request.method === 'DELETE') {
            const updated = await store.transaction(draft => {
              const job = draft.jobs.find(item => item.id === jobId)
              if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', '任务不存在')
              const template = draft.templates.find(item => item.id === job.templateId)
              if (!template) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '关联模板不存在')
              if (!Array.isArray(template.sampleRefs)) template.sampleRefs = []
              const before = template.sampleRefs.length
              template.sampleRefs = template.sampleRefs.filter(item =>
                !(item.resultId === resultId || (item.jobId === jobId && item.resultId === resultId))
              )
              // Also match by storage path when result still exists on job
              const result = (job.results || []).find(item => item.id === resultId)
              if (result?.storagePath) {
                template.sampleRefs = template.sampleRefs.filter(item =>
                  !(item.jobId === jobId && item.storagePath === result.storagePath)
                )
              }
              if (template.sampleRefs.length === before) {
                throw new HttpError(404, 'SAMPLE_NOT_FOUND', '该效果不在更多效果参考中')
              }
              return template
            })
            const state = store.read()
            json(response, 200, {
              ok: true,
              template: publicTemplate(updated, state, true),
              message: '已从更多效果参考中移除'
            })
            return
          }

          const updated = await store.transaction(draft => {
            const job = draft.jobs.find(item => item.id === jobId)
            if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', '任务不存在')
            if (job.status !== 'succeeded') throw new HttpError(409, 'JOB_NOT_READY', '仅已完成作品可添加为效果参考')
            const result = (job.results || []).find(item => item.id === resultId)
            if (!result || !result.storagePath) throw new HttpError(404, 'RESULT_NOT_FOUND', '生成结果不存在')
            const template = draft.templates.find(item => item.id === job.templateId)
            if (!template) throw new HttpError(404, 'TEMPLATE_NOT_FOUND', '关联模板不存在')
            if (!Array.isArray(template.sampleRefs)) template.sampleRefs = []
            if (template.sampleRefs.some(item => item.resultId === resultId || (item.jobId === jobId && item.storagePath === result.storagePath))) {
              throw new HttpError(409, 'SAMPLE_EXISTS', '该效果已在更多效果参考中')
            }
            template.sampleRefs.push({
              id: randomUUID(),
              resultId: result.id,
              jobId: job.id,
              storagePath: result.storagePath,
              mime: result.mime || 'image/jpeg',
              createdAt: now()
            })
            // Cap sample gallery size
            if (template.sampleRefs.length > 24) {
              template.sampleRefs = template.sampleRefs.slice(-24)
            }
            return template
          })
          const state = store.read()
          json(response, 201, {
            ok: true,
            template: publicTemplate(updated, state, true),
            message: '已加入该模板的更多效果参考'
          })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/feedbacks') {
          const state = store.read()
          const type = String(url.searchParams.get('type') || 'all')
          const status = String(url.searchParams.get('status') || 'all')
          const list = (state.feedbacks || [])
            .filter(item => type === 'all' || item.type === type)
            .filter(item => {
              if (status === 'all') return true
              const itemStatus = item.reply ? 'replied' : (item.status || 'pending')
              return itemStatus === status
            })
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 500)
            .map(item => publicFeedback(item, state, { includeUser: true }))
          json(response, 200, { feedbacks: list, total: list.length })
          return
        }

        const adminFeedbackReplyMatch = pathname.match(/^\/api\/admin\/feedbacks\/([^/]+)\/reply$/)
        if (request.method === 'POST' && adminFeedbackReplyMatch) {
          const feedbackId = adminFeedbackReplyMatch[1]
          const body = await readJson(request)
          const reply = cleanText(body.reply, '回复内容', 1000, true)
          const updated = await store.transaction(draft => {
            if (!Array.isArray(draft.feedbacks)) draft.feedbacks = []
            const item = draft.feedbacks.find(entry => entry.id === feedbackId)
            if (!item) throw new HttpError(404, 'FEEDBACK_NOT_FOUND', '反馈不存在')
            item.reply = reply
            item.repliedAt = now()
            item.status = 'replied'
            return item
          })
          const state = store.read()
          json(response, 200, {
            ok: true,
            feedback: publicFeedback(updated, state, { includeUser: true }),
            message: '回复已保存'
          })
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
          ensureThumb(relativePath).catch(error => console.warn('[thumbs] banner', error.message))
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

        if (request.method === 'GET' && pathname === '/api/admin/templates') {
          const state = store.read()
          const query = String(url.searchParams.get('query') || '').trim().toLowerCase()
          const status = String(url.searchParams.get('status') || 'all')
          const category = String(url.searchParams.get('category') || 'all')
          const pageRaw = Number(url.searchParams.get('page') || 1)
          const pageSizeRaw = Number(url.searchParams.get('pageSize') || 20)
          const page = Math.max(1, Number.isFinite(pageRaw) ? Math.floor(pageRaw) : 1)
          const pageSize = Math.min(100, Math.max(1, Number.isFinite(pageSizeRaw) ? Math.floor(pageSizeRaw) : 20))

          let list = state.templates.slice()
          if (status === 'enabled') list = list.filter(item => item.enabled !== false)
          else if (status === 'disabled') list = list.filter(item => item.enabled === false)
          if (category !== 'all') list = list.filter(item => item.category === category)
          if (query) {
            list = list.filter(item => {
              const tags = Array.isArray(item.tags) ? item.tags.join(' ') : ''
              return [
                item.id,
                item.name,
                item.shortName,
                item.description,
                item.badge,
                tags
              ].some(field => String(field || '').toLowerCase().includes(query))
            })
          }
          list.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0) || String(a.id).localeCompare(String(b.id)))
          const total = list.length
          const pages = Math.max(1, Math.ceil(total / pageSize) || 1)
          const safePage = Math.min(page, pages)
          const offset = (safePage - 1) * pageSize
          const templates = list.slice(offset, offset + pageSize).map(item => publicTemplate(item, state, true))
          json(response, 200, { templates, total, page: safePage, pageSize, pages })
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
            applyTemplateFields(item, body, true, listTemplateCategories(draft, true))
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
            applyTemplateFields(item, body, false, listTemplateCategories(draft, true))
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
          ensureThumb(relativePath).catch(error => console.warn('[thumbs] cover', error.message))
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

        if (request.method === 'GET' && pathname === '/api/admin/cdks') {
          const state = store.read()
          const status = String(url.searchParams.get('status') || 'all')
          const query = String(url.searchParams.get('query') || '').trim().toUpperCase()
          if (!Array.isArray(state.cdks)) state.cdks = []
          const cdks = state.cdks
            .map(item => publicCdk(item, state))
            .filter(item => status === 'all' || item.status === status)
            .filter(item => {
              if (!query) return true
              const needle = query.replace(/-/g, '')
              return item.code.replace(/-/g, '').includes(needle)
            })
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .slice(0, 500)
          const all = state.cdks.map(item => cdkStatus(item))
          json(response, 200, {
            cdks,
            total: cdks.length,
            summary: {
              total: state.cdks.length,
              unused: all.filter(s => s === 'unused').length,
              active: all.filter(s => s === 'active').length,
              exhausted: all.filter(s => s === 'exhausted' || s === 'redeemed').length,
              redeemed: all.filter(s => s === 'exhausted' || s === 'redeemed').length,
              expired: all.filter(s => s === 'expired').length
            }
          })
          return
        }

        if (request.method === 'POST' && pathname === '/api/admin/cdks') {
          const body = await readJson(request)
          const credits = boundedInteger(body.credits, 'CDK 积分', 1, 1000000)
          const count = boundedInteger(body.count ?? 1, '生成数量', 1, 100)
          // 0 = unlimited redemptions; default 1
          const maxUses = boundedInteger(body.maxUses ?? 1, '可兑换次数', 0, 1000000)
          const note = cleanText(body.note || '', '备注', 80, false)
          const expiresAt = resolveCdkExpiresAt(body.expireType, body.expiresAt)
          const customCodeRaw = String(body.customCode || '').trim()
          if (customCodeRaw && count !== 1) {
            throw new HttpError(400, 'INVALID_CDK', '指定通用兑换码时，生成数量只能为 1')
          }
          let customCode = ''
          if (customCodeRaw) {
            customCode = normalizeCdkCode(customCodeRaw)
            const compact = customCode.replace(/-/g, '')
            if (compact.length < 6 || compact.length > 24) {
              throw new HttpError(400, 'INVALID_CDK', '通用兑换码长度需为 6–24 位字母数字')
            }
          }
          const created = await store.transaction(draft => {
            if (!Array.isArray(draft.cdks)) draft.cdks = []
            const existing = new Set(draft.cdks.map(item => item.code.replace(/-/g, '')))
            const batch = []
            for (let i = 0; i < count; i += 1) {
              let code = customCode || generateCdkCode()
              if (!customCode) {
                let guard = 0
                while (existing.has(code.replace(/-/g, '')) && guard < 20) {
                  code = generateCdkCode()
                  guard += 1
                }
              }
              if (existing.has(code.replace(/-/g, ''))) {
                throw new HttpError(409, 'CDK_EXISTS', customCode ? '该通用兑换码已存在' : 'CDK 生成冲突，请重试')
              }
              existing.add(code.replace(/-/g, ''))
              const item = {
                id: randomUUID(),
                code,
                credits,
                maxUses,
                redemptions: [],
                expiresAt,
                note,
                createdAt: now(),
                redeemedAt: '',
                redeemedBy: ''
              }
              draft.cdks.push(item)
              batch.push(item)
            }
            return batch
          })
          const state = store.read()
          json(response, 201, {
            cdks: created.map(item => publicCdk(item, state)),
            count: created.length
          })
          return
        }

        const adminCdkMatch = pathname.match(/^\/api\/admin\/cdks\/([^/]+)$/)
        if (request.method === 'DELETE' && adminCdkMatch) {
          const cdkId = adminCdkMatch[1]
          await store.transaction(draft => {
            if (!Array.isArray(draft.cdks)) draft.cdks = []
            const index = draft.cdks.findIndex(item => item.id === cdkId)
            if (index === -1) throw new HttpError(404, 'CDK_NOT_FOUND', 'CDK 不存在')
            const item = draft.cdks[index]
            if (cdkRedeemCount(item) > 0) throw new HttpError(409, 'CDK_REDEEMED', '已有兑换记录的 CDK 不能删除')
            draft.cdks.splice(index, 1)
          })
          json(response, 200, { ok: true, id: cdkId })
          return
        }

        // —— In-app announcements ——
        if (request.method === 'GET' && pathname === '/api/admin/announcements') {
          const state = store.read()
          const list = (Array.isArray(state.announcements) ? state.announcements : [])
            .slice()
            .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
            .map(item => ({
              id: item.id,
              title: item.title,
              content: item.content,
              enabled: item.enabled !== false,
              createdAt: item.createdAt,
              createdTime: displayTime(item.createdAt),
              updatedAt: item.updatedAt || item.createdAt
            }))
          json(response, 200, { announcements: list })
          return
        }

        if (request.method === 'POST' && pathname === '/api/admin/announcements') {
          const body = await readJson(request)
          const title = cleanText(body.title, '公告标题', 40, true)
          const content = cleanText(body.content, '公告内容', 500, true)
          const id = randomUUID()
          await store.transaction(draft => {
            if (!Array.isArray(draft.announcements)) draft.announcements = []
            draft.announcements.push({
              id,
              title,
              content,
              enabled: body.enabled !== false,
              createdAt: now(),
              updatedAt: now()
            })
          })
          const item = store.read(state => (state.announcements || []).find(entry => entry.id === id))
          json(response, 201, {
            announcement: {
              id: item.id,
              title: item.title,
              content: item.content,
              enabled: item.enabled !== false,
              createdAt: item.createdAt,
              createdTime: displayTime(item.createdAt)
            }
          })
          return
        }

        const adminAnnouncementMatch = pathname.match(/^\/api\/admin\/announcements\/([^/]+)$/)
        if (request.method === 'PATCH' && adminAnnouncementMatch) {
          const body = await readJson(request)
          const id = adminAnnouncementMatch[1]
          await store.transaction(draft => {
            if (!Array.isArray(draft.announcements)) draft.announcements = []
            const item = draft.announcements.find(entry => entry.id === id)
            if (!item) throw new HttpError(404, 'ANNOUNCEMENT_NOT_FOUND', '公告不存在')
            if ('title' in body) item.title = cleanText(body.title, '公告标题', 40, true)
            if ('content' in body) item.content = cleanText(body.content, '公告内容', 500, true)
            if ('enabled' in body) item.enabled = Boolean(body.enabled)
            item.updatedAt = now()
          })
          const item = store.read(state => (state.announcements || []).find(entry => entry.id === id))
          json(response, 200, {
            announcement: {
              id: item.id,
              title: item.title,
              content: item.content,
              enabled: item.enabled !== false,
              createdAt: item.createdAt,
              createdTime: displayTime(item.createdAt)
            }
          })
          return
        }

        if (request.method === 'DELETE' && adminAnnouncementMatch) {
          const id = adminAnnouncementMatch[1]
          await store.transaction(draft => {
            if (!Array.isArray(draft.announcements)) draft.announcements = []
            const index = draft.announcements.findIndex(entry => entry.id === id)
            if (index === -1) throw new HttpError(404, 'ANNOUNCEMENT_NOT_FOUND', '公告不存在')
            draft.announcements.splice(index, 1)
          })
          json(response, 200, { ok: true, id })
          return
        }

        // —— Subscribe message broadcast (best-effort; WeChat one-shot limit applies) ——
        if (request.method === 'POST' && pathname === '/api/admin/subscribe-broadcast') {
          if (!isSubscribeNotifyConfigured()) {
            throw new HttpError(409, 'SUBSCRIBE_NOT_CONFIGURED', '未配置订阅消息模板，无法推送')
          }
          const body = await readJson(request)
          const style = cleanText(body.style || body.title || '花漾相绘通知', '推送标题', 20, true)
          const status = cleanText(body.status || '活动提醒', '推送状态', 5, true)
          const tip = cleanText(body.tip || body.content || '打开小程序查看详情', '推送提示', 20, true)
          const page = cleanText(body.page || 'pages/home/index', '跳转页面', 120, false) || 'pages/home/index'
          const state = store.read()
          const targets = state.users.filter(item =>
            item.enabled !== false
            && item.openid
            && !String(item.openid).startsWith('dev-openid')
            && item.subscribeEligible
          )
          if (!targets.length) {
            json(response, 200, {
              ok: true,
              total: 0,
              sent: 0,
              failed: 0,
              message: '暂无订阅过消息的可推送用户（用户需在生成时授权订阅）'
            })
            return
          }
          let sent = 0
          let failed = 0
          const errors = []
          for (const target of targets) {
            const result = await sendAdminSubscribeMessage({
              openid: target.openid,
              style,
              status,
              tip,
              page
            })
            if (result.ok) sent += 1
            else {
              failed += 1
              if (errors.length < 5) errors.push(result.error || '发送失败')
            }
          }
          json(response, 200, {
            ok: true,
            total: targets.length,
            sent,
            failed,
            message: `已尝试推送 ${targets.length} 人：成功 ${sent}，失败 ${failed}`,
            errors
          })
          return
        }

        if (request.method === 'GET' && pathname === '/api/admin/subscribe-stats') {
          const state = store.read()
          const eligible = state.users.filter(item =>
            item.enabled !== false && item.subscribeEligible && item.openid && !String(item.openid).startsWith('dev-openid')
          ).length
          json(response, 200, {
            subscribeConfigured: isSubscribeNotifyConfigured(),
            subscribeTemplateId: config.wechat.subscribeTemplateId || '',
            eligibleUsers: eligible,
            totalUsers: state.users.length
          })
          return
        }

        throw new HttpError(404, 'ADMIN_API_NOT_FOUND', '后台接口不存在')
      }

      // Public: active in-app announcements (no auth)
      if (request.method === 'GET' && pathname === '/api/announcements') {
        const state = store.read()
        const announcements = (Array.isArray(state.announcements) ? state.announcements : [])
          .filter(item => item.enabled !== false)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .map(item => ({
            id: item.id,
            title: item.title,
            content: item.content,
            createdAt: item.createdAt
          }))
        json(response, 200, { announcements })
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
        ensureThumb(relativePath).catch(error => console.warn('[thumbs] asset', error.message))
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
          // Accumulate template popularity when user creates a job (per image)
          const popularityBump = body.assetIds.length
          currentTemplate.popularity = Number(currentTemplate.popularity || 0) + popularityBump
          // Mark user eligible for admin subscribe broadcast after they accept notify once
          if (body.notify) {
            target.subscribeEligible = true
            target.subscribeEligibleAt = now()
          }
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

      if (request.method === 'DELETE' && jobMatch) {
        await store.transaction(draft => {
          const index = draft.jobs.findIndex(item => item.id === jobMatch[1] && item.userId === user.id)
          if (index === -1) throw new HttpError(404, 'JOB_NOT_FOUND', '创作任务不存在')
          const job = draft.jobs[index]
          if (job.status !== 'failed') {
            throw new HttpError(409, 'JOB_NOT_DELETABLE', '仅支持删除生成失败的作品记录')
          }
          draft.jobs.splice(index, 1)
          // Drop share records tied to this job (if any)
          draft.shares = draft.shares.filter(item => item.jobId !== job.id)
        })
        json(response, 200, { ok: true, id: jobMatch[1] })
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

      // Report share action and optionally grant credits
      if (request.method === 'POST' && pathname === '/api/share-rewards') {
        const body = await readJson(request)
        const jobId = String(body.jobId || '').trim()
        const channel = String(body.channel || '').trim()
        const clientRequestId = String(body.clientRequestId || '').slice(0, 80)
        if (!jobId) throw new HttpError(400, 'INVALID_FIELD', '缺少作品任务 ID')
        if (!['friend', 'timeline'].includes(channel)) {
          throw new HttpError(400, 'INVALID_CHANNEL', '分享渠道需为 friend 或 timeline')
        }

        const result = await store.transaction(draft => {
          if (!Array.isArray(draft.shareEvents)) draft.shareEvents = []
          const settings = publicShareRewardSettings(draft.settings)
          const job = draft.jobs.find(item => item.id === jobId && item.userId === user.id)
          if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', '创作任务不存在')
          if (job.status !== 'succeeded') throw new HttpError(409, 'JOB_NOT_READY', '作品完成后才能分享领奖')

          const dateKey = chinaDateKey()
          if (clientRequestId) {
            const existingByClient = draft.shareEvents.find(
              item => item.userId === user.id && item.clientRequestId === clientRequestId
            )
            if (existingByClient) {
              return {
                rewarded: existingByClient.reward > 0,
                reward: existingByClient.reward,
                reason: 'duplicate',
                event: existingByClient,
                user: draft.users.find(item => item.id === user.id)
              }
            }
          }

          // One reward per job + channel + day
          const alreadyToday = draft.shareEvents.find(
            item => item.userId === user.id
              && item.jobId === jobId
              && item.channel === channel
              && item.dateKey === dateKey
              && item.reward > 0
          )
          if (alreadyToday) {
            return {
              rewarded: false,
              reward: 0,
              reason: 'already_shared_job',
              message: '该作品今日已领取过该渠道分享奖励',
              event: alreadyToday,
              user: draft.users.find(item => item.id === user.id)
            }
          }

          let reward = 0
          let reason = 'ok'
          let message = ''
          if (!settings.shareRewardEnabled) {
            reason = 'disabled'
            message = '分享奖励暂未开启'
          } else {
            const dailyLimit = channel === 'friend' ? settings.shareFriendDailyLimit : settings.shareTimelineDailyLimit
            const creditAmount = channel === 'friend' ? settings.shareFriendCredits : settings.shareTimelineCredits
            const rewardedToday = draft.shareEvents.filter(
              item => item.userId === user.id && item.channel === channel && item.dateKey === dateKey && item.reward > 0
            ).length
            if (creditAmount <= 0) {
              reason = 'zero_reward'
              message = '当前渠道分享积分为 0'
            } else if (dailyLimit <= 0) {
              reason = 'limit_zero'
              message = '当前渠道每日分享奖励已关闭'
            } else if (rewardedToday >= dailyLimit) {
              reason = 'daily_limit'
              message = '今日该渠道分享奖励次数已用完'
            } else {
              reward = creditAmount
            }
          }

          if (reward > 0) {
            creditUser(
              draft,
              user.id,
              reward,
              channel === 'friend' ? 'share_friend' : 'share_timeline',
              channel === 'friend' ? '分享作品到好友' : '分享作品到朋友圈',
              jobId
            )
          }

          const event = {
            id: randomUUID(),
            userId: user.id,
            jobId,
            channel,
            reward,
            dateKey,
            clientRequestId: clientRequestId || '',
            reason,
            createdAt: now()
          }
          draft.shareEvents.push(event)
          return {
            rewarded: reward > 0,
            reward,
            reason,
            message: reward > 0 ? `分享成功，积分 +${reward}` : message,
            event,
            user: draft.users.find(item => item.id === user.id),
            remainingToday: (() => {
              const s = publicShareRewardSettings(draft.settings)
              const limit = channel === 'friend' ? s.shareFriendDailyLimit : s.shareTimelineDailyLimit
              const used = draft.shareEvents.filter(
                item => item.userId === user.id && item.channel === channel && item.dateKey === dateKey && item.reward > 0
              ).length
              return Math.max(0, limit - used)
            })()
          }
        })

        const state = store.read()
        json(response, 200, {
          rewarded: result.rewarded,
          reward: result.reward,
          reason: result.reason,
          message: result.message || '',
          remainingToday: result.remainingToday,
          user: publicUser(result.user, state),
          shareRewards: publicShareRewardSettings(state.settings)
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/share-rewards/me') {
        const state = store.read()
        const settings = publicShareRewardSettings(state.settings)
        const dateKey = chinaDateKey()
        const events = (Array.isArray(state.shareEvents) ? state.shareEvents : []).filter(item => item.userId === user.id)
        const friendUsed = events.filter(item => item.channel === 'friend' && item.dateKey === dateKey && item.reward > 0).length
        const timelineUsed = events.filter(item => item.channel === 'timeline' && item.dateKey === dateKey && item.reward > 0).length
        const invites = (Array.isArray(state.invites) ? state.invites : []).filter(item => item.inviterId === user.id)
        json(response, 200, {
          shareRewards: settings,
          today: {
            friendUsed,
            friendRemaining: Math.max(0, settings.shareFriendDailyLimit - friendUsed),
            timelineUsed,
            timelineRemaining: Math.max(0, settings.shareTimelineDailyLimit - timelineUsed)
          },
          totals: {
            shareCount: events.length,
            shareRewardCredits: events.reduce((sum, item) => sum + Number(item.reward || 0), 0),
            inviteCount: invites.length,
            inviteLoginCount: invites.filter(item => item.loginRewarded).length,
            inviteFirstJobCount: invites.filter(item => item.firstJobRewarded && !item.firstJobSkipped).length
          }
        })
        return
      }

      if (request.method === 'POST' && pathname === '/api/cdks/redeem') {
        const body = await readJson(request)
        const rawCode = String(body.code || '').trim()
        if (!rawCode) throw new HttpError(400, 'INVALID_CDK', '请输入兑换码')
        const normalized = normalizeCdkCode(rawCode)
        // Accept both formatted ABCD-EFGH-IJKL and raw ABCDEFGHIJKL
        const compact = normalized.replace(/-/g, '')
        if (compact.length < 8 || compact.length > 24) {
          throw new HttpError(400, 'INVALID_CDK', '兑换码格式不正确')
        }

        const result = await store.transaction(draft => {
          if (!Array.isArray(draft.cdks)) draft.cdks = []
          const item = draft.cdks.find(entry => entry.code.replace(/-/g, '') === compact)
          if (!item) throw new HttpError(404, 'CDK_NOT_FOUND', '兑换码不存在')
          // migrate legacy fields
          if (!Array.isArray(item.redemptions)) {
            item.redemptions = []
            if (item.redeemedBy) {
              item.redemptions.push({ userId: item.redeemedBy, redeemedAt: item.redeemedAt || now() })
            }
          }
          if (item.maxUses == null) item.maxUses = 1

          const status = cdkStatus(item)
          if (status === 'expired') throw new HttpError(409, 'CDK_EXPIRED', '该兑换码已过期')
          if (status === 'exhausted' || status === 'redeemed') {
            throw new HttpError(409, 'CDK_EXHAUSTED', '该兑换码已达使用次数上限')
          }
          if (item.redemptions.some(entry => entry.userId === user.id)) {
            throw new HttpError(409, 'CDK_ALREADY_USED', '你已经兑换过该兑换码')
          }

          const credits = Number(item.credits || 0)
          if (credits < 1) throw new HttpError(400, 'INVALID_CDK', '兑换码积分无效')

          creditUser(draft, user.id, credits, 'cdk_redeem', `CDK 兑换 ${credits} 积分`, item.id)
          const stamp = now()
          item.redemptions.push({ userId: user.id, redeemedAt: stamp })
          item.redeemedAt = stamp
          item.redeemedBy = user.id
          return {
            credits,
            code: item.code,
            remainingUses: cdkMaxUses(item) === 0 ? null : Math.max(0, cdkMaxUses(item) - cdkRedeemCount(item)),
            user: draft.users.find(entry => entry.id === user.id)
          }
        })

        const state = store.read()
        json(response, 200, {
          ok: true,
          credits: result.credits,
          code: result.code,
          message: `兑换成功，积分 +${result.credits}`,
          user: publicUser(result.user, state)
        })
        return
      }

      if (request.method === 'GET' && pathname === '/api/feedbacks') {
        const state = store.read()
        const list = (state.feedbacks || [])
          .filter(item => item.userId === user.id)
          .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
          .slice(0, 100)
          .map(item => publicFeedback(item, state))
        json(response, 200, { feedbacks: list, total: list.length })
        return
      }

      if (request.method === 'POST' && pathname === '/api/feedbacks') {
        const body = await readJson(request)
        const type = cleanText(body.type, '反馈类型', 40, true)
        if (!feedbackTypeLabels[type]) {
          throw new HttpError(400, 'INVALID_FIELD', '反馈类型无效')
        }
        const content = cleanText(body.content, '反馈内容', 800, true)
        const assetIds = Array.isArray(body.assetIds)
          ? body.assetIds.map(item => String(item || '').trim()).filter(Boolean).slice(0, 6)
          : []
        if (type === 'template_request' && !assetIds.length && content.length < 4) {
          throw new HttpError(400, 'INVALID_FIELD', '请求新模板请补充描述或上传参考图')
        }
        const state = store.read()
        for (const assetId of assetIds) {
          const asset = state.assets.find(item => item.id === assetId && item.userId === user.id)
          if (!asset) throw new HttpError(400, 'ASSET_NOT_FOUND', '参考图片不存在或不属于你')
        }
        const item = await store.transaction(draft => {
          if (!Array.isArray(draft.feedbacks)) draft.feedbacks = []
          const feedback = {
            id: randomUUID(),
            userId: user.id,
            type,
            content,
            assetIds,
            status: 'pending',
            reply: '',
            repliedAt: '',
            createdAt: now()
          }
          draft.feedbacks.push(feedback)
          return feedback
        })
        json(response, 201, {
          ok: true,
          feedback: publicFeedback(item, store.read()),
          message: '感谢反馈，我们会认真查看'
        })
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
        const limitRaw = Number(url.searchParams.get('limit') ?? 50)
        const offsetRaw = Number(url.searchParams.get('offset') ?? 0)
        const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50))
        const offset = Math.max(0, Number.isFinite(offsetRaw) ? Math.floor(offsetRaw) : 0)
        const allTransactions = state.transactions
          .filter(item => item.userId === user.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        const transactionsTotal = allTransactions.length
        const transactions = allTransactions
          .slice(offset, offset + limit)
          .map(publicTransaction)
        json(response, 200, {
          user: publicUser(state.users.find(item => item.id === user.id), state),
          packages: publicPackages(state),
          transactions,
          transactionsTotal,
          transactionsHasMore: offset + transactions.length < transactionsTotal,
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
