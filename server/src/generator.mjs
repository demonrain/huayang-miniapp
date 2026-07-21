import { createHash } from 'node:crypto'
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import { ensureThumb } from './thumbs.mjs'
import path from 'node:path'
import { Blob } from 'node:buffer'
import { config } from './config.mjs'

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function extensionForMime(mime) {
  return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[mime] || '.png'
}

function clipError(text, max = 200) {
  return String(text || '').replace(/\s+/g, ' ').trim().slice(0, max)
}

async function readResponsePayload(response) {
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  if (!raw) return { raw: '', json: null }
  if (contentType.includes('application/json') || raw.trim().startsWith('{') || raw.trim().startsWith('[')) {
    try {
      return { raw, json: JSON.parse(raw) }
    } catch {
      return { raw, json: null }
    }
  }
  return { raw, json: null }
}

function extractApiError(status, payload) {
  const json = payload.json
  if (json) {
    const message =
      json.error?.message ||
      json.error?.code ||
      json.message ||
      json.msg ||
      json.detail ||
      (typeof json.error === 'string' ? json.error : '')
    if (message) return clipError(message)
  }
  if (payload.raw) return clipError(payload.raw)
  return `生图服务返回 HTTP ${status}`
}

function pickResultItem(body) {
  if (!body || typeof body !== 'object') return null
  if (Array.isArray(body.data) && body.data[0]) return body.data[0]
  if (Array.isArray(body.images) && body.images[0]) {
    const item = body.images[0]
    if (typeof item === 'string') {
      if (item.startsWith('http')) return { url: item }
      return { b64_json: item.replace(/^data:image\/\w+;base64,/, '') }
    }
    return item
  }
  if (body.b64_json) return body
  if (body.url) return body
  if (body.image) {
    const image = body.image
    if (typeof image === 'string') {
      if (image.startsWith('http')) return { url: image }
      return { b64_json: image.replace(/^data:image\/\w+;base64,/, '') }
    }
  }
  return null
}

async function mockGenerate(job, assets) {
  console.warn(
    `[image:mock] job=${job.id} IMAGE_PROVIDER=mock — returning original uploads after ${config.image.mockDelayMs}ms. ` +
    'Set IMAGE_PROVIDER=compatible with IMAGE_API_BASE and IMAGE_API_KEY for real generation.'
  )
  await sleep(config.image.mockDelayMs)
  const directory = path.join(config.mediaDir, 'outputs', job.userId)
  await mkdir(directory, { recursive: true })
  const results = []
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index]
    const extension = path.extname(asset.storagePath) || extensionForMime(asset.mime)
    const relativePath = path.join('outputs', job.userId, `${job.id}-${index + 1}${extension}`)
    const storagePath = relativePath.replaceAll('\\', '/')
    await copyFile(path.join(config.mediaDir, asset.storagePath), path.join(config.mediaDir, relativePath))
    ensureThumb(storagePath).catch(error => console.warn('[thumbs] mock result', error.message))
    results.push({ id: `${job.id}-${index + 1}`, storagePath, mime: asset.mime })
  }
  return results
}

async function downloadImageBytes(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), config.image.timeoutMs)
  try {
    const imageResponse = await fetch(url, { signal: controller.signal })
    if (!imageResponse.ok) throw new Error(`无法下载生图结果 HTTP ${imageResponse.status}`)
    const mime = imageResponse.headers.get('content-type')?.split(';')[0] || 'image/png'
    const output = Buffer.from(await imageResponse.arrayBuffer())
    return { output, mime }
  } finally {
    clearTimeout(timer)
  }
}

async function compatibleGenerate(job, template, assets) {
  if (!config.image.apiKey) {
    throw new Error('IMAGE_API_KEY 未配置，无法调用生图服务')
  }
  if (!config.image.apiBase) {
    throw new Error('IMAGE_API_BASE 未配置')
  }
  if (!template?.prompt) {
    throw new Error('模板未配置生图提示词，请在管理后台填写')
  }

  console.log(
    `[image:compatible] job=${job.id} template=${template.id} model=${config.image.model} ` +
    `endpoint=${config.image.apiBase} images=${assets.length} timeoutMs=${config.image.timeoutMs}`
  )

  const directory = path.join(config.mediaDir, 'outputs', job.userId)
  await mkdir(directory, { recursive: true })
  const results = []
  const imageField = config.image.formImageField || 'image'

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index]
    const sourcePath = path.join(config.mediaDir, asset.storagePath)
    let source
    try {
      source = await readFile(sourcePath)
    } catch (error) {
      throw new Error(`读取上传原图失败：${asset.storagePath}`)
    }

    const form = new FormData()
    form.append('model', config.image.model)
    form.append('prompt', template.prompt)
    if (config.image.size) form.append('size', config.image.size)
    if (config.image.quality) form.append('quality', config.image.quality)
    if (config.image.outputFormat) form.append('output_format', config.image.outputFormat)
    if (config.image.responseFormat) form.append('response_format', config.image.responseFormat)
    // Prefer image[] (OpenAI gpt-image edits / playground); override via IMAGE_FORM_IMAGE_FIELD
    const filename = asset.originalName || `image-${index + 1}.jpg`
    const mimeType = asset.mime || 'image/jpeg'
    const blob = new Blob([source], { type: mimeType })
    form.append(imageField, blob, filename)
    // Some gateways only accept bare "image"; send both when using image[]
    if (imageField === 'image[]') {
      form.append('image', blob, filename)
    }

    const startedAt = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), config.image.timeoutMs)
    let response
    try {
      response = await fetch(config.image.apiBase, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.image.apiKey}`
        },
        body: form,
        signal: controller.signal
      })
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error(`生图超时（>${Math.round(config.image.timeoutMs / 1000)}s），请稍后重试或减小图片`)
      }
      throw new Error(`无法连接生图服务：${clipError(error.message || error, 120)}`)
    } finally {
      clearTimeout(timer)
    }

    const payload = await readResponsePayload(response)
    if (!response.ok) {
      console.error(`[image:compatible] job=${job.id} HTTP ${response.status}`, payload.raw?.slice(0, 500))
      throw new Error(extractApiError(response.status, payload))
    }

    const body = payload.json
    if (!body) {
      console.error(`[image:compatible] job=${job.id} non-json response`, payload.raw?.slice(0, 300))
      throw new Error('生图服务返回了非 JSON 响应')
    }

    const item = pickResultItem(body)
    if (!item) {
      console.error(`[image:compatible] job=${job.id} unexpected body`, JSON.stringify(body).slice(0, 500))
      throw new Error('生图服务响应格式不支持（需要 data[0].b64_json 或 data[0].url）')
    }

    let output
    let mime = 'image/png'
    if (item.b64_json) {
      const b64 = String(item.b64_json).replace(/^data:image\/\w+;base64,/, '')
      output = Buffer.from(b64, 'base64')
    } else if (item.url) {
      const downloaded = await downloadImageBytes(item.url)
      output = downloaded.output
      mime = downloaded.mime
    } else {
      throw new Error('生图服务未返回图片数据（需要 b64_json 或 url）')
    }

    if (!output?.length) throw new Error('生图结果为空')

    const sourceHash = createHash('sha256').update(source).digest('hex')
    const outputHash = createHash('sha256').update(output).digest('hex')
    if (sourceHash === outputHash) {
      console.error(`[image:compatible] job=${job.id} output identical to input (hash=${sourceHash.slice(0, 12)})`)
      throw new Error('生图结果与原图完全相同：请确认 IMAGE_PROVIDER=compatible、模型与提示词已生效，而不是 mock 或透传')
    }

    const relativePath = path.join('outputs', job.userId, `${job.id}-${index + 1}${extensionForMime(mime)}`)
    const storagePath = relativePath.replaceAll('\\', '/')
    await writeFile(path.join(config.mediaDir, relativePath), output)
    ensureThumb(storagePath).catch(error => console.warn('[thumbs] result', error.message))
    results.push({ id: `${job.id}-${index + 1}`, storagePath, mime })
    console.log(
      `[image:compatible] job=${job.id} image ${index + 1}/${assets.length} ok in ${Date.now() - startedAt}ms ` +
      `bytes=${output.length} revised=${item.revised_prompt ? 'yes' : 'no'}`
    )
  }
  return results
}

export async function generateImages(job, template, assets) {
  if (config.image.provider === 'mock') return mockGenerate(job, assets)
  if (config.image.provider === 'compatible') return compatibleGenerate(job, template, assets)
  throw new Error(`不支持的 IMAGE_PROVIDER: ${config.image.provider}（仅支持 mock 或 compatible）`)
}
