import { config } from './config.mjs'
import { getAccessToken, isWechatShareConfigured } from './wechat-share.mjs'

function clip(value, max = 20) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text) return '—'
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function formatChinaTime(iso) {
  const date = iso ? new Date(iso) : new Date()
  if (Number.isNaN(date.getTime())) return clip(new Date().toISOString().replace('T', ' ').slice(0, 16), 20)
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(date)
  const map = Object.fromEntries(parts.filter(item => item.type !== 'literal').map(item => [item.type, item.value]))
  return `${map.year}年${map.month}月${map.day}日 ${map.hour}:${map.minute}`
}

function miniprogramState() {
  if (config.wechat.envVersion === 'trial') return 'trial'
  if (config.wechat.envVersion === 'develop') return 'developer'
  return 'formal'
}

export function isSubscribeNotifyConfigured() {
  return Boolean(
    isWechatShareConfigured() &&
    config.wechat.subscribeTemplateId
  )
}

/**
 * Send a one-shot subscribe message after the user accepted the template on client.
 * Template field keys are configurable because WeChat template keywords differ per account.
 */
export async function sendJobResultSubscribeMessage({ openid, job, templateName }) {
  if (!isSubscribeNotifyConfigured()) {
    console.log('[notify] skip: subscribe template not configured')
    return { skipped: true, reason: 'not_configured' }
  }
  if (!openid || openid.startsWith('dev-openid')) {
    console.log('[notify] skip: mock/dev openid')
    return { skipped: true, reason: 'mock_openid' }
  }
  if (!job?.notifyRequested) {
    return { skipped: true, reason: 'not_requested' }
  }

  const succeeded = job.status === 'succeeded'
  const fields = config.wechat.subscribeFields
  const data = {
    [fields.style]: { value: clip(templateName || '花漾相绘作品', 20) },
    [fields.status]: { value: clip(succeeded ? '已完成' : '生成失败', 5) },
    [fields.time]: { value: formatChinaTime(job.completedAt || job.updatedAt) },
    [fields.tip]: {
      value: clip(
        succeeded
          ? '作品已就绪，点此查看'
          : '生成失败，积分已退回',
        20
      )
    }
  }

  const token = await getAccessToken()
  const payload = {
    touser: openid,
    template_id: config.wechat.subscribeTemplateId,
    page: `pages/job/index?id=${encodeURIComponent(job.id)}`,
    miniprogram_state: miniprogramState(),
    lang: 'zh_CN',
    data
  }

  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    }
  )
  const body = await response.json().catch(() => ({}))
  if (!response.ok || body.errcode) {
    console.error('[notify] subscribe send failed', body)
    return { ok: false, error: body.errmsg || `errcode ${body.errcode}` }
  }
  console.log(`[notify] job=${job.id} subscribe message sent`)
  return { ok: true }
}

/**
 * Best-effort admin broadcast using the same subscribe template fields.
 * Only works if the user previously accepted the template (WeChat one-shot rules apply).
 */
export async function sendAdminSubscribeMessage({ openid, style, status, tip, page = 'pages/home/index' }) {
  if (!isSubscribeNotifyConfigured()) {
    return { ok: false, skipped: true, reason: 'not_configured' }
  }
  if (!openid || openid.startsWith('dev-openid')) {
    return { ok: false, skipped: true, reason: 'mock_openid' }
  }

  const fields = config.wechat.subscribeFields
  const data = {
    [fields.style]: { value: clip(style || '花漾相绘通知', 20) },
    [fields.status]: { value: clip(status || '活动提醒', 5) },
    [fields.time]: { value: formatChinaTime(new Date().toISOString()) },
    [fields.tip]: { value: clip(tip || '打开小程序查看详情', 20) }
  }

  try {
    const token = await getAccessToken()
    const payload = {
      touser: openid,
      template_id: config.wechat.subscribeTemplateId,
      page: String(page || 'pages/home/index').replace(/^\//, ''),
      miniprogram_state: miniprogramState(),
      lang: 'zh_CN',
      data
    }
    const response = await fetch(
      `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      }
    )
    const body = await response.json().catch(() => ({}))
    if (!response.ok || body.errcode) {
      return { ok: false, error: body.errmsg || `errcode ${body.errcode}` }
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error.message || 'send failed' }
  }
}
