const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')
const pageShare = require('../../behaviors/page-share')

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
  behaviors: [pageShare],
  data: {
    token: '',
    share: null,
    comparePairs: [],
    shareTitle: SHARE_TITLES[0],
    loading: true,
    saving: false,
    navSpacer: 176
  },

  onLoad(query) {
    let token = String(query.token || '').trim()
    if (!token && query.scene) {
      // 扫小程序码进入：scene 即为分享 token
      try {
        token = decodeURIComponent(String(query.scene))
      } catch (error) {
        token = String(query.scene)
      }
    }
    // 兼容 scene 写成 token=xxx 的旧格式
    if (token && token.includes('token=')) {
      const match = /(?:^|[?&])token=([^&]+)/.exec(token)
      if (match) {
        try {
          token = decodeURIComponent(match[1])
        } catch (error) {
          token = match[1]
        }
      }
    }
    this.setData({ ...getNavMetrics(), token, shareTitle: pickShareTitle() })
    if (token) getApp().setInviteToken(token)
    getApp().captureInviteFromQuery(query)
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.loadShare()
  },

  async loadShare() {
    try {
      const { share } = await api.get(`/api/shares/${encodeURIComponent(this.data.token)}`)
      const comparePairs = Array.isArray(share.comparePairs) ? share.comparePairs : []
      this.setData({ share, comparePairs, loading: false })
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

  previewCompare(event) {
    const current = event.currentTarget.dataset.url
    const kind = event.currentTarget.dataset.kind
    const pairs = this.data.comparePairs || []
    const urls = kind === 'original'
      ? pairs.map(item => item.original && item.original.url).filter(Boolean)
      : pairs.map(item => item.result && item.result.url).filter(Boolean)
    if (!current || !urls.length) return
    wx.previewImage({ current, urls })
  },

  async saveAll() {
    if (this.data.saving) return
    const share = this.data.share || {}
    const resultUrls = (share.results || []).map(item => item.url).filter(Boolean)
    const originalUrls = share.showOriginals
      ? (share.originals || []).map(item => item.url).filter(Boolean)
      : []
    // 先效果后原图，避免重复
    const urls = [...resultUrls]
    for (const url of originalUrls) {
      if (!urls.includes(url)) urls.push(url)
    }
    if (!urls.length) {
      wx.showToast({ title: '暂无可保存图片', icon: 'none' })
      return
    }
    this.setData({ saving: true })
    try {
      const { ensureAlbumPermission, saveImageToAlbum, hideLoadingQuiet } = require('../../utils/album')
      await ensureAlbumPermission()
      wx.showLoading({ title: `保存中 0/${urls.length}`, mask: true })
      let done = 0
      for (const url of urls) {
        const filePath = await this.download(url)
        await saveImageToAlbum(filePath)
        done += 1
        wx.showLoading({ title: `保存中 ${done}/${urls.length}`, mask: true })
      }
      hideLoadingQuiet()
      wx.showToast({ title: `已保存 ${done} 张`, icon: 'success' })
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
    try {
      const app = getApp()
      if (!app.isLoggedIn()) {
        await app.requireLogin('登录后即可开始创作，并记录邀请关系')
      }
    } catch (error) {}
    wx.switchTab({ url: '/pages/home/index' })
  }
})
