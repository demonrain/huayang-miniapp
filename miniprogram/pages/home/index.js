const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    user: null,
    banners: [],
    welcomeCredits: 20,
    templates: [],
    filteredTemplates: [],
    categories: [
      { id: 'all', name: '全部' },
      { id: 'portrait', name: '人像' },
      { id: 'life', name: '生活' },
      { id: 'pet', name: '宠物' },
      { id: 'art', name: '艺术' }
    ],
    activeCategory: 'all',
    navSpacer: 176
  },

  onLoad() {
    const windowInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const menuButton = wx.getMenuButtonBoundingClientRect()
    const navSpacer = Math.ceil((menuButton.bottom + 8) * 750 / windowInfo.windowWidth)
    this.setData({ navSpacer })
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
      const [{ templates }, { banners }, config] = await Promise.all([
        api.get('/api/templates'),
        api.get('/api/banners'),
        api.get('/api/config')
      ])
      const displayTemplates = templates.map(item => ({
        ...item,
        popularityText: item.popularity >= 10000
          ? `${(item.popularity / 10000).toFixed(1)}万`
          : String(item.popularity || 0)
      }))
      this.setData({
        user,
        banners,
        welcomeCredits: config.newUserCredits,
        templates: displayTemplates,
        filteredTemplates: displayTemplates,
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

  openBanner(event) {
    const path = event.currentTarget.dataset.path
    if (!path) return
    const tabPages = ['/pages/home/index', '/pages/history/index', '/pages/wallet/index', '/pages/profile/index']
    if (tabPages.includes(path)) wx.switchTab({ url: path })
    else wx.navigateTo({ url: path })
  },

  openWallet() {
    wx.switchTab({ url: '/pages/wallet/index' })
  }
})
