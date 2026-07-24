const { getNavMetrics } = require('../../utils/nav')
const { ensureAlbumPermission, saveImageToAlbum, hideLoadingQuiet } = require('../../utils/album')

const EXPORT_SIZE = 600

Page({
  data: {
    navSpacer: 176,
    url: '',
    filePath: '',
    shape: 'square',
    ready: false,
    saving: false,
    stagePx: 400,
    areaPx: 360,
    cropPx: 280,
    maskSide: 40,
    viewW: 280,
    viewH: 280,
    x: 0,
    y: 0,
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
    const stagePx = Math.max(280, Math.floor(winH - (metrics.navBarHeight || 64) - 200))
    const cropPx = Math.floor(Math.min(winW * 0.78, stagePx * 0.72))
    const areaPx = Math.floor(Math.min(winW, stagePx))
    const maskSide = Math.max(0, Math.floor((winW - cropPx) / 2))

    this._x = 0
    this._y = 0
    this._scale = 1

    this.setData({
      ...metrics,
      url,
      stagePx,
      cropPx,
      areaPx,
      maskSide
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

  onMove(event) {
    const { x, y, source } = event.detail || {}
    if (source === 'touch' || source === 'friction' || source === 'out-of-bounds') {
      this._x = x
      this._y = y
    }
  },

  onScale(event) {
    const { x, y, scale } = event.detail || {}
    if (scale != null) this._scale = scale
    if (x != null) this._x = x
    if (y != null) this._y = y
  },

  async prepareImage(url) {
    try {
      wx.showLoading({ title: '加载图片', mask: true })
      const filePath = await this.download(url)
      const info = await this.getImageInfo(filePath)
      const { cropPx, areaPx } = this.data
      // Base view size so image covers crop frame at scale=1
      const ratio = info.width / info.height
      let viewW
      let viewH
      if (ratio >= 1) {
        viewH = cropPx
        viewW = Math.ceil(cropPx * ratio)
      } else {
        viewW = cropPx
        viewH = Math.ceil(cropPx / ratio)
      }
      // Center image in movable-area
      const x = (areaPx - viewW) / 2
      const y = (areaPx - viewH) / 2
      this._x = x
      this._y = y
      this._scale = 1
      this.setData({
        filePath,
        imgW: info.width,
        imgH: info.height,
        viewW,
        viewH,
        x,
        y,
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

  /**
   * Map movable-view transform to source crop rect, then draw square/circle PNG.
   */
  exportCrop() {
    const {
      filePath, imgW, imgH, viewW, viewH, areaPx, cropPx, shape
    } = this.data
    const scale = this._scale || 1
    const x = this._x != null ? this._x : this.data.x
    const y = this._y != null ? this._y : this.data.y

    // Frame center in area coordinates
    const frameLeft = (areaPx - cropPx) / 2
    const frameTop = (areaPx - cropPx) / 2

    // Image drawn size after scale
    const drawW = viewW * scale
    const drawH = viewH * scale

    // Top-left of scaled image in area coords (movable-view x/y is unscaled top-left before scale from center...)
    // WeChat movable-view: scale is from center of the view. Approximate using:
    // scaled top-left = x - (drawW - viewW)/2, y - (drawH - viewH)/2
    const imgLeft = x - (drawW - viewW) / 2
    const imgTop = y - (drawH - viewH) / 2

    // Crop frame relative to image
    const relX = frameLeft - imgLeft
    const relY = frameTop - imgTop

    // Map to natural image pixels (aspectFill base mapping: view covers image proportionally)
    const scaleToNatural = imgW / viewW
    let sx = (relX / scale) * scaleToNatural
    let sy = (relY / scale) * scaleToNatural
    let sSide = (cropPx / scale) * scaleToNatural

    // Clamp
    sSide = Math.max(1, Math.min(sSide, Math.min(imgW, imgH)))
    sx = Math.max(0, Math.min(sx, imgW - sSide))
    sy = Math.max(0, Math.min(sy, imgH - sSide))

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
