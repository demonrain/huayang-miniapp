const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

const LOADING_TIPS = [
  '小花瓣在排队挑风格，马上就好…',
  '正在给模板浇水，灵感很快发芽',
  'AI 在翻今日花色图鉴，请稍等一下',
  '像素小猫踩着键盘跑来了',
  '好风格值得等一等，像等一朵花开',
  '正在把心动装进模板盒子里'
]

Page({
  data: {
    loading: true,
    loadingTip: LOADING_TIPS[0],
    user: null,
    banners: [],
    welcomeCredits: 20,
    templates: [],
    filteredTemplates: [],
    // Keep in sync with server TEMPLATE_CATEGORIES / admin select
    categories: [
      { id: 'all', name: '全部' },
      { id: 'portrait', name: '人像' },
      { id: 'life', name: '生活' },
      { id: 'pet', name: '宠物' },
      { id: 'art', name: '艺术' }
    ],
    activeCategory: 'all',
    navSpacer: 176,
    showOnboarding: false
  },

  onLoad() {
    this.setData(getNavMetrics())
    this.startLoadingTips()
    this.loadPage()
  },

  onUnload() {
    this.stopLoadingTips()
  },

  onShow() {
    if (!this.data.loading) this.refreshUser()
  },

  startLoadingTips() {
    this.loadingTipIndex = 0
    this.stopLoadingTips()
    this.loadingTipTimer = setInterval(() => {
      this.loadingTipIndex = (this.loadingTipIndex + 1) % LOADING_TIPS.length
      this.setData({ loadingTip: LOADING_TIPS[this.loadingTipIndex] })
    }, 2800)
  },

  stopLoadingTips() {
    if (this.loadingTipTimer) {
      clearInterval(this.loadingTipTimer)
      this.loadingTipTimer = null
    }
  },

  async onPullDownRefresh() {
    this.setData({ loading: true, loadingTip: LOADING_TIPS[0] })
    this.startLoadingTips()
    await this.loadPage()
    wx.stopPullDownRefresh()
  },

  async loadPage() {
    try {
      const app = getApp()
      // Guest can browse templates; only restore session if already logged in
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
      // Prefer server-provided categories (Chinese labels) when available
      const categories = Array.isArray(config.templateCategories) && config.templateCategories.length
        ? [{ id: 'all', name: '全部' }, ...config.templateCategories.map(item => ({ id: item.id, name: item.name }))]
        : this.data.categories
      this.stopLoadingTips()
      const showOnboarding = !wx.getStorageSync('huayang_onboarding_done')
      this.setData({
        user: app.isLoggedIn() ? user : null,
        banners,
        welcomeCredits: config.newUserCredits,
        categories,
        templates: displayTemplates,
        filteredTemplates: this.data.activeCategory === 'all'
          ? displayTemplates
          : displayTemplates.filter(item => item.category === this.data.activeCategory),
        loading: false,
        showOnboarding
      })
    } catch (error) {
      this.stopLoadingTips()
      this.setData({ loading: false })
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  async refreshUser() {
    try {
      const app = getApp()
      if (!app.isLoggedIn()) {
        this.setData({ user: null })
        return
      }
      const { user } = await api.get('/api/me')
      app.setUser(user)
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
    this.markOnboardingDone()
    wx.navigateTo({ url: `/pages/template/index?id=${id}` })
  },

  openBanner(event) {
    const path = event.currentTarget.dataset.path
    if (!path) return
    const tabPages = ['/pages/home/index', '/pages/history/index', '/pages/wallet/index', '/pages/profile/index']
    if (tabPages.includes(path)) wx.switchTab({ url: path })
    else wx.navigateTo({ url: path })
  },

  markOnboardingDone() {
    wx.setStorageSync('huayang_onboarding_done', '1')
    if (this.data.showOnboarding) this.setData({ showOnboarding: false })
  },

  finishOnboarding() {
    this.markOnboardingDone()
    const first = this.data.filteredTemplates[0] || this.data.templates[0]
    if (first) {
      wx.navigateTo({ url: `/pages/template/index?id=${first.id}` })
      return
    }
    wx.showToast({ title: '请选择一个风格', icon: 'none' })
  },

  skipOnboarding() {
    this.markOnboardingDone()
  },

  noop() {}
})
