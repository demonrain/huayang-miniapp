/**
 * Pure geometry helpers for avatar crop preview/export.
 * Transform model: image base rect centered in stage, then
 *   scale about center, then translate (tx, ty).
 */

function frameOrigin(stageW, stageH, cropPx) {
  return {
    left: (stageW - cropPx) / 2,
    top: (stageH - cropPx) / 2
  }
}

/** Base top-left of unscaled image in stage coords (centered). */
function baseOrigin(stageW, stageH, viewW, viewH) {
  return {
    left: (stageW - viewW) / 2,
    top: (stageH - viewH) / 2
  }
}

/**
 * Visual image rect after scale-from-center + translate.
 */
function imageRect(stageW, stageH, viewW, viewH, tx, ty, scale) {
  const base = baseOrigin(stageW, stageH, viewW, viewH)
  const drawW = viewW * scale
  const drawH = viewH * scale
  return {
    left: base.left + (viewW - drawW) / 2 + tx,
    top: base.top + (viewH - drawH) / 2 + ty,
    width: drawW,
    height: drawH
  }
}

/**
 * Clamp translate so the crop frame stays fully inside the scaled image.
 */
function clampTranslate(stageW, stageH, viewW, viewH, cropPx, tx, ty, scale) {
  const frame = frameOrigin(stageW, stageH, cropPx)
  const img = imageRect(stageW, stageH, viewW, viewH, tx, ty, scale)

  let desiredLeft = img.left
  if (img.width <= cropPx) {
    desiredLeft = frame.left + (cropPx - img.width) / 2
  } else {
    const maxLeft = frame.left
    const minLeft = frame.left + cropPx - img.width
    desiredLeft = Math.min(maxLeft, Math.max(minLeft, img.left))
  }

  let desiredTop = img.top
  if (img.height <= cropPx) {
    desiredTop = frame.top + (cropPx - img.height) / 2
  } else {
    const maxTop = frame.top
    const minTop = frame.top + cropPx - img.height
    desiredTop = Math.min(maxTop, Math.max(minTop, img.top))
  }

  return {
    tx: tx + (desiredLeft - img.left),
    ty: ty + (desiredTop - img.top)
  }
}

/**
 * Map crop frame to natural image source rect (sx, sy, sSide).
 */
function cropSourceRect(stageW, stageH, viewW, viewH, cropPx, imgW, imgH, tx, ty, scale) {
  const frame = frameOrigin(stageW, stageH, cropPx)
  const img = imageRect(stageW, stageH, viewW, viewH, tx, ty, scale)
  const naturalPerView = imgW / viewW
  let sx = ((frame.left - img.left) / scale) * naturalPerView
  let sy = ((frame.top - img.top) / scale) * naturalPerView
  let sSide = (cropPx / scale) * naturalPerView

  sSide = Math.max(1, Math.min(sSide, Math.min(imgW, imgH)))
  sx = Math.max(0, Math.min(sx, imgW - sSide))
  sy = Math.max(0, Math.min(sy, imgH - sSide))
  return { sx, sy, sSide }
}

/**
 * Base view size: cover crop frame completely while preserving aspect ratio.
 */
function coverViewSize(imgW, imgH, cropPx) {
  const ratio = imgW / imgH
  if (ratio >= 1) {
    return { viewW: cropPx * ratio, viewH: cropPx }
  }
  return { viewW: cropPx, viewH: cropPx / ratio }
}

module.exports = {
  frameOrigin,
  baseOrigin,
  imageRect,
  clampTranslate,
  cropSourceRect,
  coverViewSize
}
