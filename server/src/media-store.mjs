import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { config } from './config.mjs'

function encodeKey(key) {
  return String(key || '').replaceAll('\\', '/').replace(/^\/+/, '')
}

async function putLocal(key, buffer, contentType = 'application/octet-stream') {
  const relative = encodeKey(key)
  const abs = path.join(config.mediaDir, relative)
  await mkdir(path.dirname(abs), { recursive: true })
  await writeFile(abs, buffer)
  return { key: relative, contentType, url: `${config.publicBaseUrl}/media/${relative.split('/').map(encodeURIComponent).join('/')}` }
}

async function getLocal(key) {
  const abs = path.join(config.mediaDir, encodeKey(key))
  return readFile(abs)
}

async function putS3(key, buffer, contentType = 'application/octet-stream') {
  const relative = encodeKey(key)
  const endpoint = config.s3.endpoint.replace(/\/$/, '')
  const url = `${endpoint}/${config.s3.bucket}/${relative.split('/').map(encodeURIComponent).join('/')}`
  // Minimal S3-compatible PUT with path-style URL (MinIO / COS / OSS gateway)
  // Prefer AWS SDK in production; this keeps zero hard dependency when unused.
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'content-type': contentType,
      'content-length': String(buffer.length),
      ...(config.s3.accessKeyId ? { 'x-amz-meta-huayang': '1' } : {}),
      ...(config.s3.publicRead ? { 'x-amz-acl': 'public-read' } : {})
    },
    body: buffer
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`S3 upload failed HTTP ${response.status}: ${text.slice(0, 160)}`)
  }
  const publicBase = (config.s3.publicBaseUrl || `${endpoint}/${config.s3.bucket}`).replace(/\/$/, '')
  return {
    key: relative,
    contentType,
    url: `${publicBase}/${relative.split('/').map(encodeURIComponent).join('/')}`
  }
}

export async function putMediaObject(key, buffer, contentType) {
  if (config.mediaDriver === 's3') return putS3(key, buffer, contentType)
  return putLocal(key, buffer, contentType)
}

export async function readMediaObject(key) {
  if (config.mediaDriver === 's3') {
    const endpoint = config.s3.endpoint.replace(/\/$/, '')
    const url = `${endpoint}/${config.s3.bucket}/${encodeKey(key).split('/').map(encodeURIComponent).join('/')}`
    const response = await fetch(url)
    if (!response.ok) throw new Error(`S3 read failed HTTP ${response.status}`)
    return Buffer.from(await response.arrayBuffer())
  }
  return getLocal(key)
}

export function mediaObjectUrl(key) {
  const relative = encodeKey(key)
  if (config.mediaDriver === 's3') {
    const publicBase = (config.s3.publicBaseUrl || `${config.s3.endpoint.replace(/\/$/, '')}/${config.s3.bucket}`).replace(/\/$/, '')
    return `${publicBase}/${relative.split('/').map(encodeURIComponent).join('/')}`
  }
  return `${config.publicBaseUrl}/media/${relative.split('/').map(encodeURIComponent).join('/')}`
}

export function contentHash(buffer) {
  return createHash('sha256').update(buffer).digest('hex').slice(0, 16)
}
