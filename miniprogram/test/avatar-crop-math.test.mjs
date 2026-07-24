import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadMath() {
  const source = await readFile(new URL('../utils/avatar-crop-math.js', import.meta.url), 'utf8')
  const module = { exports: {} }
  const context = vm.createContext({ module, exports: module.exports })
  new vm.Script(source, { filename: 'avatar-crop-math.js' }).runInContext(context)
  return module.exports
}

const math = await loadMath()
const {
  coverViewSize,
  frameOrigin,
  imageRect,
  clampTranslate,
  cropSourceRect
} = math

test('coverViewSize covers crop for landscape and portrait', () => {
  const land = coverViewSize(2000, 1000, 280)
  assert.equal(land.viewH, 280)
  assert.equal(land.viewW, 560)
  const port = coverViewSize(1000, 2000, 280)
  assert.equal(port.viewW, 280)
  assert.equal(port.viewH, 560)
})

test('centered default keeps crop fully inside image', () => {
  const stageW = 375
  const stageH = 500
  const cropPx = 280
  const { viewW, viewH } = coverViewSize(1200, 800, cropPx)
  const c = clampTranslate(stageW, stageH, viewW, viewH, cropPx, 0, 0, 1)
  const frame = frameOrigin(stageW, stageH, cropPx)
  const img = imageRect(stageW, stageH, viewW, viewH, c.tx, c.ty, 1)
  assert.ok(img.left <= frame.left + 0.001)
  assert.ok(img.top <= frame.top + 0.001)
  assert.ok(img.left + img.width >= frame.left + cropPx - 0.001)
  assert.ok(img.top + img.height >= frame.top + cropPx - 0.001)
})

test('clamp prevents panning crop outside scaled image', () => {
  const stageW = 375
  const stageH = 500
  const cropPx = 280
  const { viewW, viewH } = coverViewSize(1000, 1000, cropPx)
  const scale = 2
  const c = clampTranslate(stageW, stageH, viewW, viewH, cropPx, 9999, 9999, scale)
  const frame = frameOrigin(stageW, stageH, cropPx)
  const img = imageRect(stageW, stageH, viewW, viewH, c.tx, c.ty, scale)
  assert.ok(img.left <= frame.left + 0.001)
  assert.ok(img.top <= frame.top + 0.001)
  assert.ok(img.left + img.width >= frame.left + cropPx - 0.001)
  assert.ok(img.top + img.height >= frame.top + cropPx - 0.001)
})

test('export source rect matches center of square image at identity', () => {
  const stageW = 400
  const stageH = 400
  const cropPx = 200
  const imgW = 1000
  const imgH = 1000
  const { viewW, viewH } = coverViewSize(imgW, imgH, cropPx)
  const rect = cropSourceRect(stageW, stageH, viewW, viewH, cropPx, imgW, imgH, 0, 0, 1)
  assert.ok(Math.abs(rect.sx) < 1)
  assert.ok(Math.abs(rect.sy) < 1)
  assert.ok(Math.abs(rect.sSide - 1000) < 1)
})

test('export source rect after cover layout samples expected region', () => {
  const stageW = 400
  const stageH = 400
  const cropPx = 200
  const imgW = 1000
  const imgH = 500
  const { viewW, viewH } = coverViewSize(imgW, imgH, cropPx)
  assert.equal(viewH, 200)
  assert.equal(viewW, 400)
  const rect = cropSourceRect(stageW, stageH, viewW, viewH, cropPx, imgW, imgH, 0, 0, 1)
  assert.ok(Math.abs(rect.sx - 250) < 0.5)
  assert.ok(Math.abs(rect.sy) < 0.5)
  assert.ok(Math.abs(rect.sSide - 500) < 0.5)
})
