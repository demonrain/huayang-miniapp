const api = require('../../utils/api')

Page({
  data: {
    token: '',
    share: null,
    loading: true,
    saving: false
  },

  onLoad(query) {
    const token = query.token || decodeURIComponent(query.scene || '')
    this.setData({ token })
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.loadShare()
  },

  async loadShare() {
    try {
      const { share } = await api.get(`/api/shares/${encodeURIComponent(this.data.token)}`)
      this.setData({ share, loading: false })
    } catch (error) {
      this.setData({ loading: false })
      wx.showModal({ title: '作品暂时无法查看', content: error.message, showCancel: false })
    }
  },

  onShareAppMessage() {
    const share = this.data.share
    return {
      title: share?.title || '来看看这组画漾作品',
      path: `/pages/share/index?token=${encodeURIComponent(this.data.token)}`,
      imageUrl: share?.results?.[0]?.url || ''
    }
  },

  onShareTimeline() {
    const share = this.data.share
    return {
      title: share?.title || '来看看这组画漾作品',
      query: `token=${encodeURIComponent(this.data.token)}`,
      imageUrl: share?.results?.[0]?.url || ''
    }
  },

  preview(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({ current, urls: this.data.share.results.map(item => item.url) })
  },

  async saveImage(event) {
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '正在保存', mask: true })
    try {
      const filePath = await this.download(event.currentTarget.dataset.url)
      await this.saveToAlbum(filePath)
      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
    } finally {
      this.setData({ saving: false })
    }
  },

  async shareImage(event) {
    try {
      const filePath = await this.download(event.currentTarget.dataset.url)
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({ path: filePath })
      } else {
        wx.previewImage({ current: event.currentTarget.dataset.url, urls: [event.currentTarget.dataset.url] })
      }
    } catch (error) {
      wx.showToast({ title: '图片准备失败', icon: 'none' })
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

  goCreate() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
