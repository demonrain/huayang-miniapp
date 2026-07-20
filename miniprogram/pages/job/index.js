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
    saving: false
  },

  onLoad(query) {
    this.setData({ id: query.id })
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
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  preview(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({ current, urls: this.data.job.results.map(item => item.url) })
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

