import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'

export class HttpError extends Error {
  constructor(statusCode, code, message) {
    super(message)
    this.statusCode = statusCode
    this.code = code
  }
}

export function json(response, statusCode, body) {
  const data = Buffer.from(JSON.stringify(body))
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': data.length,
    'cache-control': 'no-store'
  })
  response.end(data)
}

export async function readBody(request, limit = 1024 * 1024) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > limit) throw new HttpError(413, 'PAYLOAD_TOO_LARGE', '请求内容过大')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export async function readJson(request, limit) {
  const body = await readBody(request, limit)
  if (!body.length) return {}
  try {
    return JSON.parse(body.toString('utf8'))
  } catch (error) {
    throw new HttpError(400, 'INVALID_JSON', 'JSON 格式不正确')
  }
}

export async function readImageUpload(request, limit) {
  const contentType = request.headers['content-type'] || ''
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
  if (!boundaryMatch) throw new HttpError(400, 'INVALID_MULTIPART', '上传格式不正确')
  const boundary = boundaryMatch[1] || boundaryMatch[2]
  const body = await readBody(request, limit + 64 * 1024)
  const boundaryBuffer = Buffer.from(`--${boundary}`)
  let cursor = 0

  while (cursor < body.length) {
    const boundaryIndex = body.indexOf(boundaryBuffer, cursor)
    if (boundaryIndex === -1) break
    const headerStart = boundaryIndex + boundaryBuffer.length + 2
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), headerStart)
    if (headerEnd === -1) break
    const headers = body.subarray(headerStart, headerEnd).toString('utf8')
    const nextBoundary = body.indexOf(Buffer.from(`\r\n--${boundary}`), headerEnd + 4)
    if (nextBoundary === -1) break
    if (/name="image"/i.test(headers)) {
      const filename = headers.match(/filename="([^"]*)"/i)?.[1] || 'upload'
      const mime = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim().toLowerCase() || ''
      const data = body.subarray(headerEnd + 4, nextBoundary)
      if (!data.length) throw new HttpError(400, 'EMPTY_FILE', '图片内容为空')
      if (data.length > limit) throw new HttpError(413, 'FILE_TOO_LARGE', '单张图片超过大小限制')
      return { filename, mime, data }
    }
    cursor = nextBoundary + 2
  }
  throw new HttpError(400, 'IMAGE_REQUIRED', '请选择要上传的图片')
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

export async function serveFile(response, filename, cache = true) {
  try {
    const info = await stat(filename)
    if (!info.isFile()) return false
    response.writeHead(200, {
      'content-type': mimeTypes[path.extname(filename).toLowerCase()] || 'application/octet-stream',
      'content-length': info.size,
      'cache-control': cache ? 'public, max-age=31536000, immutable' : 'no-store'
    })
    createReadStream(filename).pipe(response)
    return true
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

export function setCors(response) {
  response.setHeader('access-control-allow-origin', '*')
  response.setHeader('access-control-allow-headers', 'authorization, content-type')
  response.setHeader('access-control-allow-methods', 'GET, POST, PATCH, OPTIONS')
}
