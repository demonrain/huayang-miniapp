/**
 * 按上传原图比例选择 Images Edits 支持的输出尺寸。
 * gpt-image 常见取值：1024x1024 / 1536x1024 / 1024x1536
 */

const PORTRAIT = '1024x1536'
const LANDSCAPE = '1536x1024'
const SQUARE = '1024x1024'
/** 宽高比偏离 1 超过该阈值才判为横/竖，避免轻微裁切被误判 */
const SQUARE_TOLERANCE = 1.12

let sharpLoader

async function loadSharp() {
  if (sharpLoader !== undefined) return sharpLoader
  try {
    const mod = await import('sharp')
    sharpLoader = mod.default || mod
  } catch {
    sharpLoader = null
  }
  return sharpLoader
}

/** EXIF orientation 5–8 时显示宽高对调 */
export function orientedDimensions(width, height, orientation = 1) {
  const w = Number(width) || 0
  const h = Number(height) || 0
  const o = Number(orientation) || 1
  if (w <= 0 || h <= 0) return null
  if (o >= 5 && o <= 8) return { width: h, height: w }
  return { width: w, height: h }
}

/**
 * 由宽高映射到网关 size。
 * @returns {'1024x1536'|'1536x1024'|'1024x1024'}
 */
export function mapAspectToSize(width, height, options = {}) {
  const dims = orientedDimensions(width, height, options.orientation)
  if (!dims) return options.square || SQUARE
  const { width: w, height: h } = dims
  const portrait = options.portrait || PORTRAIT
  const landscape = options.landscape || LANDSCAPE
  const square = options.square || SQUARE
  const ratio = w / h
  if (ratio >= SQUARE_TOLERANCE) return landscape
  if (1 / ratio >= SQUARE_TOLERANCE) return portrait
  return square
}

/** 轻量读 PNG/JPEG 头（无 sharp 时兜底；JPEG 不含 EXIF 旋转） */
function probeFromHeaders(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 24) return null
  // PNG
  if (
    buffer.length >= 24 &&
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
  ) {
    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20),
      orientation: 1
    }
  }
  // JPEG SOF
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) break
      const marker = buffer[offset + 1]
      if (marker === 0xd9 || marker === 0xda) break
      const length = buffer.readUInt16BE(offset + 2)
      // SOF0 / SOF2
      if (marker === 0xc0 || marker === 0xc2) {
        return {
          height: buffer.readUInt16BE(offset + 5),
          width: buffer.readUInt16BE(offset + 7),
          orientation: 1
        }
      }
      offset += 2 + length
    }
  }
  // WEBP VP8X / VP8
  if (
    buffer.length >= 30 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const chunk = buffer.toString('ascii', 12, 16)
    if (chunk === 'VP8X' && buffer.length >= 30) {
      const width = 1 + buffer[24] + (buffer[25] << 8) + (buffer[26] << 16)
      const height = 1 + buffer[27] + (buffer[28] << 8) + (buffer[29] << 16)
      return { width, height, orientation: 1 }
    }
    if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return {
        width: buffer.readUInt16LE(26) & 0x3fff,
        height: buffer.readUInt16LE(28) & 0x3fff,
        orientation: 1
      }
    }
  }
  return null
}

export async function probeImageDimensions(buffer) {
  const sharp = await loadSharp()
  if (sharp) {
    try {
      const meta = await sharp(buffer).metadata()
      const dims = orientedDimensions(meta.width, meta.height, meta.orientation)
      if (dims) return { ...dims, orientation: meta.orientation || 1 }
    } catch {
      // fall through
    }
  }
  return probeFromHeaders(buffer)
}

/**
 * 解析最终传给生图 API 的 size。
 * - IMAGE_SIZE=auto（默认）：按原图比例选
 * - IMAGE_SIZE=（空）：不传 size
 * - IMAGE_SIZE=1024x1024 等：固定值
 */
export async function resolveEditSize(buffer, imageConfig = {}) {
  const configured = String(imageConfig.size ?? 'auto').trim().toLowerCase()
  if (!configured) return ''
  if (configured !== 'auto' && configured !== 'aspect' && configured !== 'fit') {
    return String(imageConfig.size).trim()
  }
  const probed = await probeImageDimensions(buffer)
  if (!probed) return imageConfig.sizeSquare || SQUARE
  return mapAspectToSize(probed.width, probed.height, {
    orientation: 1, // probe 已做过方向校正
    portrait: imageConfig.sizePortrait || PORTRAIT,
    landscape: imageConfig.sizeLandscape || LANDSCAPE,
    square: imageConfig.sizeSquare || SQUARE
  })
}
