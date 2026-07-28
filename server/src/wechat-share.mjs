import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.mjs'

let accessToken = ''
let accessTokenExpiresAt = 0

function serviceError(code, message, statusCode = 502) {
  const error = new Error(message)
  error.code = code
  error.statusCode = statusCode
  return error
}

export function isWechatShareConfigured() {
  return Boolean(!config.wechat.mockLogin && config.wechat.appId && config.wechat.appSecret)
}

export async function getAccessToken() {
  if (!isWechatShareConfigured()) {
    throw serviceError('WECHAT_SHARE_NOT_CONFIGURED', '请先配置真实微信 AppID 和 AppSecret', 409)
  }
  if (accessToken && Date.now() < accessTokenExpiresAt) return accessToken

  const query = new URLSearchParams({
    grant_type: 'client_credential',
    appid: config.wechat.appId,
    secret: config.wechat.appSecret
  })
  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${query}`)
  const body = await response.json()
  if (!response.ok || !body.access_token) {
    throw serviceError('WECHAT_TOKEN_FAILED', body.errmsg || '无法获取微信 access_token')
  }
  accessToken = body.access_token
  accessTokenExpiresAt = Date.now() + Math.max(60, Number(body.expires_in || 7200) - 300) * 1000
  return accessToken
}

export async function createMiniProgramCode(share) {
  const token = await getAccessToken()
  const response = await fetch(`https://api.weixin.qq.com/wxa/getwxacodeunlimit?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      scene: share.token,
      page: 'pages/share/index',
      check_path: false,
      env_version: config.wechat.envVersion,
      width: 430
    })
  })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || contentType.includes('application/json')) {
    const body = await response.json().catch(() => ({}))
    throw serviceError('WECHAT_QRCODE_FAILED', body.errmsg || '生成小程序码失败')
  }

  const directory = path.join(config.mediaDir, 'shares')
  await mkdir(directory, { recursive: true })
  const relativePath = `shares/${share.id}.png`
  await writeFile(path.join(config.mediaDir, relativePath), Buffer.from(await response.arrayBuffer()))
  return relativePath
}

export async function createMiniProgramUrlLink(share) {
  const token = await getAccessToken()
  const response = await fetch(`https://api.weixin.qq.com/wxa/generate_urllink?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: 'pages/share/index',
      query: `token=${encodeURIComponent(share.token)}`,
      env_version: config.wechat.envVersion,
      expire_type: 1,
      expire_interval: 30
    })
  })
  const body = await response.json()
  if (response.ok && !body.errcode && body.url_link) return body.url_link

  const errmsg = String(body.errmsg || '')
  const noScheme = /no scheme permission|scheme/i.test(errmsg) || Number(body.errcode) === 85400
  // Fallback: short link (also needs MP console permission, but different capability)
  try {
    const short = await createMiniProgramShortLink(share, token)
    if (short) return short
  } catch (error) {
    // continue to structured failure
  }
  const hint = noScheme
    ? '微信后台未开通「URL Link / 明文 scheme」权限，请在公众平台开通后再试；也可先用小程序码分享'
    : (errmsg || '生成小程序链接失败')
  const error = serviceError('WECHAT_URL_LINK_FAILED', hint)
  error.wechatErrcode = body.errcode
  error.noScheme = noScheme
  throw error
}

/** Short link fallback when URL Link is unavailable. */
export async function createMiniProgramShortLink(share, existingToken = '') {
  const token = existingToken || await getAccessToken()
  const response = await fetch(`https://api.weixin.qq.com/wxa/genwxashortlink?access_token=${encodeURIComponent(token)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      page_url: `pages/share/index?token=${encodeURIComponent(share.token)}`,
      page_title: '花漾相绘作品',
      is_permanent: false
    })
  })
  const body = await response.json()
  if (!response.ok || body.errcode || !body.link) {
    throw serviceError('WECHAT_SHORT_LINK_FAILED', body.errmsg || '生成短链失败')
  }
  return body.link
}

/** Plain-text fallback when WeChat link APIs are unavailable. */
export function buildShareFallbackText(share, appName = '花漾相绘') {
  const path = `pages/share/index?token=${share.token}`
  return `打开微信小程序「${appName}」，在顶部搜索或从分享卡片进入作品。\n路径：${path}\n口令：${share.token}`
}
