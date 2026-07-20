const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    user: null,
    templates: [],
    filteredTemplates: [],
    categories: [
      { id: 'all', name: '全部' },
      { id: 'portrait', name: '人像' },
      { id: 'life', name: '生活' },
      { id: 'pet', name: '宠物' },
      { id: 'art', name: '艺术' }
    ],
    activeCategory: 'all'
  },

  onLoad() {
    this.loadPage()
  },

  onShow() {
    if (!this.data.loading) this.refreshUser()
  },

  async onPullDownRefresh() {
    await this.loadPage()
    wx.stopPullDownRefresh()
  },

  async loadPage() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const { templates } = await api.get('/api/templates')
      this.setData({
        user,
        templates,
        filteredTemplates: templates,
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  async refreshUser() {
    try {
      const { user } = await api.get('/api/me')
      getApp().setUser(user)
      this.setData({ user })
    } catch (error) {}
  },

  selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.id
    const filteredTemplates = activeCategory === 'all'
      ? this.data.templates
      : this.data.templates.filter(item => item.category === activeCategory)
    this.setData({ activeCategory, filteredTemplates })
  },

  startCreate(event) {
    const id = event.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/create/index?templateId=${id}` })
  },

  openWallet() {
    wx.switchTab({ url: '/pages/wallet/index' })
  }
})

