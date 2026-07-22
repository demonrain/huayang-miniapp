import { config } from './config.mjs'

export async function exchangeWechatCode(code) {
  if (!code) throw Object.assign(new Error('微信登录 code 不能为空'), { statusCode: 400, code: 'INVALID_CODE' })
  if (config.wechat.mockLogin) {
    // Derive openid from code so multi-user invite tests can create distinct accounts
    const suffix = String(code).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'local'
    return { openid: `dev-openid-${suffix}`, unionid: null }
  }

  const query = new URLSearchParams({
    appid: config.wechat.appId,
    secret: config.wechat.appSecret,
    js_code: code,
    grant_type: 'authorization_code'
  })
  const response = await fetch(`https://api.weixin.qq.com/sns/jscode2session?${query}`)
  const body = await response.json()
  if (!response.ok || body.errcode || !body.openid) {
    const error = new Error(body.errmsg || '微信登录失败')
    error.statusCode = 502
    error.code = 'WECHAT_LOGIN_FAILED'
    throw error
  }
  return { openid: body.openid, unionid: body.unionid || null }
}
