import { access, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { config } from './config.mjs'

const THUMB_SUFFIX = '.thumb.webp'
const THUMB_WIDTH = 480

let sharpLoader

async function loadSharp() {
  if (sharpLoader !== undefined) return sharpLoader
  try {
    const mod = await import('sharp')
    sharpLoader = mod.default || mod
  } catch (error) {
    console.warn('[thumbs] sharp unavailable — serving full images as thumbs:', error.message)
    sharpLoader = null
  }
  return sharpLoader
}

/** Relative path of thumbnail next to the original media file. */
export function thumbStoragePath(storagePath) {
  if (!storagePath) return ''
  const normalized = String(storagePath).replaceAll('\\', '/')
  const parsed = path.posix.parse(normalized)
  return path.posix.join(parsed.dir, `${parsed.name}${THUMB_SUFFIX}`)
}

export function isThumbPath(storagePath) {
  return String(storagePath || '').replaceAll('\\', '/').endsWith(THUMB_SUFFIX)
}

/** Infer original storage path from a `.thumb.webp` relative path. */
export async function findOriginalForThumb(thumbRel) {
  const normalized = String(thumbRel || '').replaceAll('\\', '/')
  if (!normalized.endsWith(THUMB_SUFFIX)) return null
  const base = normalized.slice(0, -THUMB_SUFFIX.length)
  const candidates = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.JPG', '.JPEG', '.PNG', '.WEBP']
  for (const ext of candidates) {
    const candidate = `${base}${ext}`
    try {
      await access(path.join(config.mediaDir, candidate))
      return candidate
    } catch {
      // try next
    }
  }
  return null
}

/**
 * Create a WebP thumbnail if missing. Returns relative thumb path, or null if sharp fails.
 * When sharp is unavailable, returns null (caller should fall back to original URL).
 */
export async function ensureThumb(storagePath, options = {}) {
  if (!storagePath || isThumbPath(storagePath)) return null
  const width = Number(options.width) || THUMB_WIDTH
  const sourceRel = String(storagePath).replaceAll('\\', '/')
  const thumbRel = thumbStoragePath(sourceRel)
  const sourceFull = path.join(config.mediaDir, sourceRel)
  const thumbFull = path.join(config.mediaDir, thumbRel)

  try {
    await access(thumbFull)
    return thumbRel
  } catch {
    // generate below
  }

  const sharp = await loadSharp()
  if (!sharp) return null

  try {
    await access(sourceFull)
  } catch {
    return null
  }

  await mkdir(path.dirname(thumbFull), { recursive: true })
  await sharp(sourceFull)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toFile(thumbFull)
  return thumbRel
}
