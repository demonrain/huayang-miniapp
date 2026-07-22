const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    navSpacer: 176,
    loading: true,
    error: ''
  },

  onLoad() {
    this.setData(getNavMetrics())
    this.startDemoTour()
  },

  async startDemoTour() {
    if (this.data.loading === false) this.setData({ loading: true, error: '' })
    try {
      const { templates } = await api.get('/api/templates')
      const list = Array.isArray(templates) ? templates : []
      const recommended = list.find(item => Array.isArray(item.tags) && item.tags.includes('热门')) || list[0]
      if (!recommended) throw new Error('暂时没有可体验的模板')
      wx.redirectTo({
        url: `/pages/template/index?id=${encodeURIComponent(recommended.id)}&demo=1&tour=1`
      })
    } catch (error) {
      this.setData({ loading: false, error: error.message || '模拟流程准备失败' })
    }
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
