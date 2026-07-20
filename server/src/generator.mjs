import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Blob } from 'node:buffer'
import { config } from './config.mjs'

const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))

function extensionForMime(mime) {
  return ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' })[mime] || '.png'
}

async function mockGenerate(job, assets) {
  await sleep(config.image.mockDelayMs)
  const directory = path.join(config.mediaDir, 'outputs', job.userId)
  await mkdir(directory, { recursive: true })
  const results = []
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index]
    const extension = path.extname(asset.storagePath) || extensionForMime(asset.mime)
    const relativePath = path.join('outputs', job.userId, `${job.id}-${index + 1}${extension}`)
    await copyFile(path.join(config.mediaDir, asset.storagePath), path.join(config.mediaDir, relativePath))
    results.push({ id: `${job.id}-${index + 1}`, storagePath: relativePath.replaceAll('\\', '/'), mime: asset.mime })
  }
  return results
}

async function compatibleGenerate(job, template, assets) {
  const directory = path.join(config.mediaDir, 'outputs', job.userId)
  await mkdir(directory, { recursive: true })
  const results = []

  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index]
    const source = await readFile(path.join(config.mediaDir, asset.storagePath))
    const form = new FormData()
    form.append('model', config.image.model)
    form.append('prompt', template.prompt)
    form.append('size', config.image.size)
    form.append('image', new Blob([source], { type: asset.mime }), asset.originalName || `image-${index + 1}.jpg`)

    const response = await fetch(config.image.apiBase, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.image.apiKey}` },
      body: form
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok || !body.data?.[0]) {
      throw new Error(body.error?.message || `生图服务返回 ${response.status}`)
    }

    const item = body.data[0]
    let output
    let mime = 'image/png'
    if (item.b64_json) {
      output = Buffer.from(item.b64_json, 'base64')
    } else if (item.url) {
      const imageResponse = await fetch(item.url)
      if (!imageResponse.ok) throw new Error('无法下载生图结果')
      mime = imageResponse.headers.get('content-type')?.split(';')[0] || mime
      output = Buffer.from(await imageResponse.arrayBuffer())
    } else {
      throw new Error('生图服务未返回图片数据')
    }

    const relativePath = path.join('outputs', job.userId, `${job.id}-${index + 1}${extensionForMime(mime)}`)
    await writeFile(path.join(config.mediaDir, relativePath), output)
    results.push({ id: `${job.id}-${index + 1}`, storagePath: relativePath.replaceAll('\\', '/'), mime })
  }
  return results
}

export async function generateImages(job, template, assets) {
  if (config.image.provider === 'mock') return mockGenerate(job, assets)
  if (config.image.provider === 'compatible') return compatibleGenerate(job, template, assets)
  throw new Error(`不支持的 IMAGE_PROVIDER: ${config.image.provider}`)
}

