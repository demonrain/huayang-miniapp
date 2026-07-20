import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = fileURLToPath(new URL('../..', import.meta.url))

function loadEnvFile() {
  const filename = path.join(rootDir, '.env')
  if (!existsSync(filename)) return
  for (const rawLine of readFileSync(filename, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '')
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvFile()

const port = Number(process.env.PORT || 8787)

export const config = {
  rootDir,
  port,
  publicBaseUrl: (process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${port}`).replace(/\/$/, ''),
  dataDir: path.join(rootDir, 'server', 'data'),
  mediaDir: path.join(rootDir, 'server', 'media'),
  tokenSecret: process.env.TOKEN_SECRET || 'dev-only-secret-change-before-production',
  tokenTtlSeconds: 60 * 60 * 24 * 30,
  newUserCredits: Number(process.env.NEW_USER_CREDITS || 20),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 10) * 1024 * 1024,
  admin: {
    password: process.env.ADMIN_PASSWORD || 'admin123456'
  },
  wechat: {
    mockLogin: process.env.WECHAT_MOCK_LOGIN !== 'false',
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
    envVersion: process.env.WECHAT_ENV_VERSION || 'release'
  },
  image: {
    provider: process.env.IMAGE_PROVIDER || 'mock',
    apiBase: process.env.IMAGE_API_BASE || 'https://api.openai.com/v1/images/edits',
    apiKey: process.env.IMAGE_API_KEY || '',
    model: process.env.IMAGE_MODEL || 'gpt-image-1',
    size: process.env.IMAGE_SIZE || '1024x1024',
    mockDelayMs: Number(process.env.JOB_MOCK_DELAY_MS || 800)
  },
  payment: {
    mode: process.env.PAYMENT_MODE || 'mock',
    mchId: process.env.WECHAT_PAY_MCH_ID || '',
    certSerial: process.env.WECHAT_PAY_CERT_SERIAL || '',
    privateKeyPath: process.env.WECHAT_PAY_PRIVATE_KEY_PATH || '',
    notifyUrl: process.env.WECHAT_PAY_NOTIFY_URL || '',
    apiV3Key: process.env.WECHAT_PAY_API_V3_KEY || '',
    platformPublicKeyPath: process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH || ''
  }
}

export function assertProductionConfig() {
  const errors = []
  if (!config.wechat.mockLogin && (!config.wechat.appId || !config.wechat.appSecret)) {
    errors.push('WECHAT_APP_ID and WECHAT_APP_SECRET are required')
  }
  if (process.env.NODE_ENV === 'production' && config.admin.password === 'admin123456') {
    errors.push('ADMIN_PASSWORD must be changed in production')
  }
  if (config.image.provider === 'compatible' && !config.image.apiKey) {
    errors.push('IMAGE_API_KEY is required for compatible image generation')
  }
  if (config.payment.mode === 'wechat') {
    const required = [
      ['WECHAT_APP_ID', config.wechat.appId],
      ['WECHAT_PAY_MCH_ID', config.payment.mchId],
      ['WECHAT_PAY_CERT_SERIAL', config.payment.certSerial],
      ['WECHAT_PAY_PRIVATE_KEY_PATH', config.payment.privateKeyPath],
      ['WECHAT_PAY_NOTIFY_URL', config.payment.notifyUrl],
      ['WECHAT_PAY_API_V3_KEY', config.payment.apiV3Key],
      ['WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH', config.payment.platformPublicKeyPath]
    ]
    for (const [name, value] of required) if (!value) errors.push(`${name} is required`)
  }
  if (errors.length) throw new Error(errors.join('; '))
}
