import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from './config.mjs'

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function createSignedToken(claims, ttlSeconds = config.tokenTtlSeconds) {
  const payload = encode({ ...claims, exp: Math.floor(Date.now() / 1000) + ttlSeconds })
  const signature = createHmac('sha256', config.tokenSecret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}

export function createToken(userId) {
  return createSignedToken({ sub: userId, role: 'user' })
}

export function createAdminToken() {
  return createSignedToken({ sub: 'admin', role: 'admin' }, 60 * 60 * 12)
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null
  const [payload, signature] = token.split('.')
  const expected = createHmac('sha256', config.tokenSecret).update(payload).digest()
  let actual
  try {
    actual = Buffer.from(signature, 'base64url')
  } catch (error) {
    return null
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!decoded.sub || decoded.exp < Date.now() / 1000) return null
    return decoded
  } catch (error) {
    return null
  }
}

export function bearerToken(request) {
  const value = request.headers.authorization || ''
  return value.startsWith('Bearer ') ? value.slice(7) : ''
}

export function isAdminToken(token) {
  const payload = verifyToken(token)
  return Boolean(payload && payload.role === 'admin' && payload.sub === 'admin')
}
