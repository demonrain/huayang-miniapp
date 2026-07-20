const api = require('../../utils/api')

const STATUS_TEXT = {
  queued: '正在排队',
  processing: '正在创作',
  succeeded: '作品完成',
  failed: '生成失败'
}

Page({
  data: {
    id: '',
    job: null,
    statusText: '',
    saving: false,
    share: null,
    sharing: false,
    showQr: false
  },

  onLoad(query) {
    this.setData({ id: query.id })
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.loadJob()
  },

  onUnload() {
    if (this.timer) clearTimeout(this.timer)
  },

  async loadJob() {
    try {
      await getApp().ensureSession()
      const { job } = await api.get(`/api/jobs/${this.data.id}`)
      this.setData({ job, statusText: STATUS_TEXT[job.status] || '处理中' })
      if (job.status === 'queued' || job.status === 'processing') {
        this.timer = setTimeout(() => this.loadJob(), 1600)
      } else if (job.status === 'succeeded') {
        this.ensureShare()
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  preview(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({ current, urls: this.data.job.results.map(item => item.url) })
  },

  onShareAppMessage() {
    return {
      title: this.data.share?.title || '来看看我用花漾相绘制作的作品',
      path: this.data.share?.path || '/pages/home/index',
      imageUrl: this.data.job?.results?.[0]?.url || ''
    }
  },

  onShareTimeline() {
    return {
      title: this.data.share?.title || '来看看我用花漾相绘制作的作品',
      query: this.data.share ? `token=${encodeURIComponent(this.data.share.token)}` : '',
      imageUrl: this.data.job?.results?.[0]?.url || ''
    }
  },

  async ensureShare() {
    if (this.data.share) return this.data.share
    if (!this.sharePromise) {
      this.sharePromise = api.post(`/api/jobs/${this.data.id}/share`, {})
        .then(({ share }) => {
          this.setData({ share })
          return share
        })
        .finally(() => { this.sharePromise = null })
    }
    return this.sharePromise
  },

  async saveAll() {
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '正在保存', mask: true })
    try {
      for (const result of this.data.job.results) {
        const tempFilePath = await this.download(result.url)
        await this.saveToAlbum(tempFilePath)
      }
      wx.hideLoading()
      wx.showToast({ title: `已保存 ${this.data.job.results.length} 张`, icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '保存失败', content: error.message || '请检查相册权限', showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  async saveOne(event) {
    wx.showLoading({ title: '正在保存', mask: true })
    try {
      const tempFilePath = await this.download(event.currentTarget.dataset.url)
      await this.saveToAlbum(tempFilePath)
      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
    }
  },

  async shareImage(event) {
    wx.showLoading({ title: '正在准备', mask: true })
    try {
      const url = event.currentTarget.dataset.url || this.data.job.results[0].url
      const tempFilePath = await this.download(url)
      wx.hideLoading()
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({ path: tempFilePath })
      } else {
        wx.previewImage({ current: url, urls: [url] })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '图片准备失败', icon: 'none' })
    }
  },

  async showQrCode() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成小程序码', mask: true })
    try {
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/qrcode`, {})
      wx.hideLoading()
      this.setData({ share, showQr: true })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '暂时无法生成', content: error.message, showCancel: false })
    } finally {
      this.setData({ sharing: false })
    }
  },

  hideQrCode() {
    this.setData({ showQr: false })
  },

  noop() {},

  async copyUrlLink() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成链接', mask: true })
    try {
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/url-link`, {})
      await new Promise((resolve, reject) => wx.setClipboardData({ data: share.urlLink, success: resolve, fail: reject }))
      wx.hideLoading()
      this.setData({ share })
      wx.showToast({ title: '链接已复制', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '暂时无法生成', content: error.message, showCancel: false })
    } finally {
      this.setData({ sharing: false })
    }
  },

  download(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({ url, success: result => resolve(result.tempFilePath), fail: reject })
    })
  },

  saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject })
    })
  },

  createAgain() {
    wx.redirectTo({ url: `/pages/create/index?templateId=${this.data.job.templateId}` })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
