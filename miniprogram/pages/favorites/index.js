const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')
const pageShare = require('../../behaviors/page-share')

Page({
  behaviors: [pageShare],
  data: {
    templates: [],
    loading: true,
    user: null,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.load()
  },

  async load() {
    try {
      const app = getApp()
      await app.requireLogin('登录后可查看收藏')
      this.setData({ user: app.globalData.user, loading: true })
      const result = await api.get('/api/me/favorites/templates')
      this.setData({ templates: result.templates || [], loading: false })
    } catch (error) {
      this.setData({ loading: false, templates: [] })
      if (error.code !== 'LOGIN_CANCELLED') {
        wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      }
    }
  },

  openTemplate(event) {
    wx.navigateTo({ url: `/pages/template/index?id=${event.currentTarget.dataset.id}` })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
