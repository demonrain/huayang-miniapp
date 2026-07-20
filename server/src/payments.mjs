import { createDecipheriv, randomBytes, sign, verify } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { config } from './config.mjs'

function nonce() {
  return randomBytes(16).toString('hex')
}

function timestamp() {
  return Math.floor(Date.now() / 1000).toString()
}

function privateKey() {
  return readFileSync(config.payment.privateKeyPath, 'utf8')
}

function rsaSign(message) {
  return sign('RSA-SHA256', Buffer.from(message), privateKey()).toString('base64')
}

export async function createWechatPrepay(order, openid) {
  const pathname = '/v3/pay/transactions/jsapi'
  const body = JSON.stringify({
    appid: config.wechat.appId,
    mchid: config.payment.mchId,
    description: `花漾相绘积分充值 ${order.credits} 积分`,
    out_trade_no: order.id.replaceAll('-', ''),
    notify_url: config.payment.notifyUrl,
    amount: { total: order.amountFen, currency: 'CNY' },
    payer: { openid },
    attach: order.id
  })
  const requestTimestamp = timestamp()
  const requestNonce = nonce()
  const message = `POST\n${pathname}\n${requestTimestamp}\n${requestNonce}\n${body}\n`
  const signature = rsaSign(message)
  const authorization = `WECHATPAY2-SHA256-RSA2048 mchid="${config.payment.mchId}",nonce_str="${requestNonce}",timestamp="${requestTimestamp}",serial_no="${config.payment.certSerial}",signature="${signature}"`

  const response = await fetch(`https://api.mch.weixin.qq.com${pathname}`, {
    method: 'POST',
    headers: { Authorization: authorization, Accept: 'application/json', 'Content-Type': 'application/json' },
    body
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || !result.prepay_id) {
    const error = new Error(result.message || '微信支付下单失败')
    error.statusCode = 502
    error.code = 'WECHAT_PREPAY_FAILED'
    throw error
  }

  const payTimestamp = timestamp()
  const payNonce = nonce()
  const packageValue = `prepay_id=${result.prepay_id}`
  return {
    timeStamp: payTimestamp,
    nonceStr: payNonce,
    package: packageValue,
    signType: 'RSA',
    paySign: rsaSign(`${config.wechat.appId}\n${payTimestamp}\n${payNonce}\n${packageValue}\n`)
  }
}

export function verifyWechatNotification(headers, rawBody) {
  const notificationTimestamp = headers['wechatpay-timestamp']
  const notificationNonce = headers['wechatpay-nonce']
  const signature = headers['wechatpay-signature']
  if (!notificationTimestamp || !notificationNonce || !signature) return false
  const message = `${notificationTimestamp}\n${notificationNonce}\n${rawBody.toString('utf8')}\n`
  const publicKey = readFileSync(config.payment.platformPublicKeyPath, 'utf8')
  return verify('RSA-SHA256', Buffer.from(message), publicKey, Buffer.from(signature, 'base64'))
}

export function decryptWechatResource(resource) {
  const key = Buffer.from(config.payment.apiV3Key, 'utf8')
  if (key.length !== 32) throw new Error('WECHAT_PAY_API_V3_KEY 必须是 32 字节')
  const encrypted = Buffer.from(resource.ciphertext, 'base64')
  const authTag = encrypted.subarray(encrypted.length - 16)
  const ciphertext = encrypted.subarray(0, encrypted.length - 16)
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(resource.nonce, 'utf8'))
  decipher.setAuthTag(authTag)
  decipher.setAAD(Buffer.from(resource.associated_data || '', 'utf8'))
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return JSON.parse(plaintext.toString('utf8'))
}
