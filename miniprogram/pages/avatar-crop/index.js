const { getNavMetrics } = require('../../utils/nav')
const { ensureAlbumPermission, saveImageToAlbum, hideLoadingQuiet } = require('../../utils/album')
const {
  baseOrigin,
  clampTranslate,
  cropSourceRect,
  coverViewSize
} = require('../../utils/avatar-crop-math')

const EXPORT_SIZE = 600
const SCALE_MAX = 4

/**
 * Avatar crop page.
 * Fixed centered crop frame; image pans/pinches underneath with hard bounds so
 * the frame always stays inside the image. Export uses the same geometry.
 */
Page({
  data: {
    navSpacer: 176,
    url: '',
    filePath: '',
    shape: 'square',
    ready: false,
    saving: false,
    stageW: 375,
    stageH: 400,
    cropPx: 280,
    maskSide: 40,
    maskTop: 40,
    viewW: 280,
    viewH: 280,
    baseLeft: 0,
    baseTop: 0,
    tx: 0,
    ty: 0,
    scale: 1,
    scaleMin: 1,
    exportSize: EXPORT_SIZE,
    imgW: 0,
    imgH: 0
  },

  onLoad(query) {
    const metrics = getNavMetrics()
    const url = decodeURIComponent(query.url || '')
    const sys = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const winW = sys.windowWidth || 375
    const winH = sys.windowHeight || 667
    const stageW = Math.floor(winW)
    const stageH = Math.max(280, Math.floor(winH - (metrics.navBarHeight || 64) - 200))
    const cropPx = Math.floor(Math.min(stageW, stageH) * 0.78)
    const maskSide = Math.max(0, Math.floor((stageW - cropPx) / 2))
    const maskTop = Math.max(0, Math.floor((stageH - cropPx) / 2))

    this._tx = 0
    this._ty = 0
    this._scale = 1
    this._touch = null

    this.setData({
      ...metrics,
      url,
      stageW,
      stageH,
      cropPx,
      maskSide,
      maskTop
    })

    if (!url) {
      wx.showToast({ title: '图片无效', icon: 'none' })
      return
    }
    this.prepareImage(url)
  },

  noop() {},

  goBack() {
    wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/history/index' }) })
  },

  setShape(event) {
    const shape = event.currentTarget.dataset.shape === 'circle' ? 'circle' : 'square'
    this.setData({ shape })
  },

  applyTransform(tx, ty, scale) {
    const {
      stageW, stageH, viewW, viewH, cropPx, scaleMin
    } = this.data
    const s = Math.min(SCALE_MAX, Math.max(scaleMin || 1, scale))
    const clamped = clampTranslate(stageW, stageH, viewW, viewH, cropPx, tx, ty, s)
    this._tx = clamped.tx
    this._ty = clamped.ty
    this._scale = s
    this.setData({
      tx: clamped.tx,
      ty: clamped.ty,
      scale: s
    })
    return clamped
  },

  async prepareImage(url) {
    try {
      wx.showLoading({ title: '加载图片', mask: true })
      const filePath = await this.download(url)
      const info = await this.getImageInfo(filePath)
      const { cropPx, stageW, stageH } = this.data
      const imgW = info.width
      const imgH = info.height
      if (!imgW || !imgH) throw new Error('无法读取图片尺寸')

      // Cover crop frame at scale=1, aspect preserved — portrait/landscape both fill the frame
      const { viewW, viewH } = coverViewSize(imgW, imgH, cropPx)
      const base = baseOrigin(stageW, stageH, viewW, viewH)
      const centered = clampTranslate(stageW, stageH, viewW, viewH, cropPx, 0, 0, 1)

      this._tx = centered.tx
      this._ty = centered.ty
      this._scale = 1

      this.setData({
        filePath,
        imgW,
        imgH,
        viewW: Math.round(viewW * 1000) / 1000,
        viewH: Math.round(viewH * 1000) / 1000,
        baseLeft: base.left,
        baseTop: base.top,
        tx: centered.tx,
        ty: centered.ty,
        scale: 1,
        scaleMin: 1,
        ready: true
      })

      hideLoadingQuiet()
    } catch (error) {
      hideLoadingQuiet()
      wx.showModal({
        title: '加载失败',
        content: error.message || '无法加载图片',
        showCancel: false,
        success: () => this.goBack()
      })
    }
  },

  onTouchStart(event) {
    if (!this.data.ready || this.data.saving) return
    const touches = event.touches || []
    if (touches.length === 1) {
      this._touch = {
        mode: 'pan',
        x0: touches[0].clientX,
        y0: touches[0].clientY,
        tx0: this._tx,
        ty0: this._ty,
        scale0: this._scale
      }
    } else if (touches.length >= 2) {
      const d = this.touchDistance(touches[0], touches[1])
      this._touch = {
        mode: 'pinch',
        dist0: d || 1,
        tx0: this._tx,
        ty0: this._ty,
        scale0: this._scale
      }
    }
  },

  onTouchMove(event) {
    if (!this._touch || !this.data.ready) return
    const touches = event.touches || []
    if (this._touch.mode === 'pan' && touches.length === 1) {
      const dx = touches[0].clientX - this._touch.x0
      const dy = touches[0].clientY - this._touch.y0
      this.applyTransform(this._touch.tx0 + dx, this._touch.ty0 + dy, this._touch.scale0)
    } else if (touches.length >= 2) {
      if (this._touch.mode !== 'pinch') {
        const d = this.touchDistance(touches[0], touches[1])
        this._touch = {
          mode: 'pinch',
          dist0: d || 1,
          tx0: this._tx,
          ty0: this._ty,
          scale0: this._scale
        }
      }
      const dist = this.touchDistance(touches[0], touches[1]) || this._touch.dist0
      const nextScale = this._touch.scale0 * (dist / (this._touch.dist0 || 1))
      // Pinch: keep focal roughly stable by keeping current center translate origin
      this.applyTransform(this._tx, this._ty, nextScale)
    }
  },

  onTouchEnd(event) {
    const touches = (event.touches || []).length
    if (touches === 0) {
      this._touch = null
      this.applyTransform(this._tx, this._ty, this._scale)
      return
    }
    if (touches === 1) {
      const t = event.touches[0]
      this._touch = {
        mode: 'pan',
        x0: t.clientX,
        y0: t.clientY,
        tx0: this._tx,
        ty0: this._ty,
        scale0: this._scale
      }
    }
  },

  touchDistance(a, b) {
    const dx = a.clientX - b.clientX
    const dy = a.clientY - b.clientY
    return Math.sqrt(dx * dx + dy * dy)
  },

  download(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(new Error('图片地址无效'))
        return
      }
      if (!/^https?:\/\//i.test(url)) {
        resolve(url)
        return
      }
      wx.downloadFile({
        url,
        success: res => {
          if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) resolve(res.tempFilePath)
          else reject(new Error('下载图片失败'))
        },
        fail: reject
      })
    })
  },

  getImageInfo(src) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({ src, success: resolve, fail: reject })
    })
  },

  async saveAvatar() {
    if (this.data.saving || !this.data.ready) return
    this.setData({ saving: true })
    try {
      await ensureAlbumPermission()
      wx.showLoading({ title: '导出中', mask: true })
      this.applyTransform(this._tx, this._ty, this._scale)
      const out = await this.exportCrop()
      await saveImageToAlbum(out)
      hideLoadingQuiet()
      wx.showToast({ title: '头像已保存', icon: 'success' })
      setTimeout(() => this.goBack(), 600)
    } catch (error) {
      hideLoadingQuiet()
      wx.showModal({
        title: error.code === 'ALBUM_DENIED' ? '需要相册权限' : '保存失败',
        content: error.message || '请稍后重试',
        showCancel: false
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  exportCrop() {
    const {
      filePath, imgW, imgH, viewW, viewH, cropPx, stageW, stageH, shape
    } = this.data
    const scale = this._scale || 1
    const tx = this._tx != null ? this._tx : this.data.tx
    const ty = this._ty != null ? this._ty : this.data.ty
    const { sx, sy, sSide } = cropSourceRect(
      stageW, stageH, viewW, viewH, cropPx, imgW, imgH, tx, ty, scale
    )
    return this.drawExport(filePath, sx, sy, sSide, shape)
  },

  drawExport(filePath, sx, sy, sSide, shape) {
    const size = EXPORT_SIZE
    return new Promise((resolve, reject) => {
      const query = wx.createSelectorQuery()
      query.select('#exportCanvas').fields({ node: true, size: true }).exec(res => {
        const canvas = res && res[0] && res[0].node
        if (!canvas) {
          this.drawExportLegacy(filePath, sx, sy, sSide, shape, size)
            .then(resolve)
            .catch(reject)
          return
        }
        const ctx = canvas.getContext('2d')
        const dpr = 2
        canvas.width = size * dpr
        canvas.height = size * dpr
        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, size, size)
        if (shape === 'circle') {
          ctx.beginPath()
          ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
          ctx.closePath()
          ctx.clip()
        }
        const img = canvas.createImage()
        img.onload = () => {
          ctx.drawImage(img, sx, sy, sSide, sSide, 0, 0, size, size)
          wx.canvasToTempFilePath({
            canvas,
            destWidth: size,
            destHeight: size,
            fileType: 'png',
            success: r => resolve(r.tempFilePath),
            fail: reject
          })
        }
        img.onerror = () => reject(new Error('导出图片失败'))
        img.src = filePath
      })
    })
  },

  drawExportLegacy(filePath, sx, sy, sSide, shape, size) {
    return new Promise((resolve, reject) => {
      const ctx = wx.createCanvasContext('exportCanvasLegacy', this)
      if (shape === 'circle') {
        ctx.beginPath()
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
        ctx.clip()
      }
      ctx.drawImage(filePath, sx, sy, sSide, sSide, 0, 0, size, size)
      ctx.draw(false, () => {
        setTimeout(() => {
          wx.canvasToTempFilePath({
            canvasId: 'exportCanvasLegacy',
            destWidth: size,
            destHeight: size,
            fileType: 'png',
            success: r => resolve(r.tempFilePath),
            fail: reject
          }, this)
        }, 100)
      })
    })
  }
})
