const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

/** 花漾相绘风格随机话术，进入分享页时挑一句展示 */
const SHARE_TITLES = [
  '一组值得收藏的照片',
  '把日常，画成花漾模样',
  '这一刻，刚好被花漾留住',
  '轻轻一绘，专属你的相貌',
  '温柔出片，留给喜欢的人看',
  '光影里的小确幸',
  '换一种风格，遇见更好的你',
  '花漾相绘 · 把心动定格',
  '今日份的好看，请收下',
  '一张图，一种心绪',
  '把喜欢，留成可以回看的样子',
  '从真实到花漾，只差一步'
]

function pickShareTitle() {
  return SHARE_TITLES[Math.floor(Math.random() * SHARE_TITLES.length)]
}

Page({
  data: {
    token: '',
    share: null,
    shareTitle: SHARE_TITLES[0],
    loading: true,
    saving: false,
    navSpacer: 176
  },

  onLoad(query) {
    const token = query.token || decodeURIComponent(query.scene || '')
    this.setData({ ...getNavMetrics(), token, shareTitle: pickShareTitle() })
    // Attribute invite when visitor later logs in
    if (token) getApp().setInviteToken(token)
    getApp().captureInviteFromQuery(query)
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.loadShare()
  },

  async loadShare() {
    try {
      const { share } = await api.get(`/api/shares/${encodeURIComponent(this.data.token)}`)
      this.setData({ share, loading: false })
      if (share && share.token) getApp().setInviteToken(share.token)
    } catch (error) {
      this.setData({ loading: false })
      wx.showModal({ title: '作品暂时无法查看', content: error.message, showCancel: false })
    }
  },

  onShareAppMessage() {
    const share = this.data.share
    return {
      title: share?.title || '来看看这组花漾相绘作品',
      path: `/pages/share/index?token=${encodeURIComponent(this.data.token)}`,
      imageUrl: share?.results?.[0]?.url || ''
    }
  },

  onShareTimeline() {
    const share = this.data.share
    return {
      title: share?.title || '来看看这组花漾相绘作品',
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
    try {
      const { ensureAlbumPermission, saveImageToAlbum, hideLoadingQuiet } = require('../../utils/album')
      // Permission first, without loading mask covering the system dialog
      await ensureAlbumPermission()
      wx.showLoading({ title: '正在保存', mask: true })
      const filePath = await this.download(event.currentTarget.dataset.url)
      await saveImageToAlbum(filePath)
      hideLoadingQuiet()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      try { wx.hideLoading({ fail: () => {} }) } catch (e) {}
      wx.showModal({
        title: error.code === 'ALBUM_DENIED' ? '需要相册权限' : '保存失败',
        content: error.message || '请开启相册权限后重试',
        showCancel: false
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  download(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({ url, success: result => resolve(result.tempFilePath), fail: reject })
    })
  },

  async goCreate() {
    if (this.data.token) getApp().setInviteToken(this.data.token)
    // Prompt guest to login so invite can be attributed
    try {
      const app = getApp()
      if (!app.isLoggedIn()) {
        await app.requireLogin('登录后即可开始创作，并记录邀请关系')
      }
    } catch (error) {}
    wx.switchTab({ url: '/pages/home/index' })
  }
})
