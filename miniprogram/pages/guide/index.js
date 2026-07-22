const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')
const { markOnboardingDone } = require('../../utils/demo')

const LOADING_TIPS = [
  '小花瓣在排队挑风格，马上就好…',
  '正在给模板浇水，灵感很快发芽',
  'AI 在翻今日花色图鉴，请稍等一下'
]

Page({
  data: {
    navSpacer: 176,
    phase: 'intro', // intro | pick
    loading: false,
    loadingTip: LOADING_TIPS[0],
    welcomeCredits: 20,
    categories: [{ id: 'all', name: '全部' }],
    activeCategory: 'all',
    templates: [],
    filteredTemplates: []
  },

  onLoad(query) {
    this.setData({
      ...getNavMetrics(),
      welcomeCredits: Number(query.credits) || 20
    })
  },

  onUnload() {
    this.stopLoadingTips()
  },

  skipAll() {
    markOnboardingDone()
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/home/index' })
    })
  },

  async startPick() {
    this.setData({ phase: 'pick', loading: true, loadingTip: LOADING_TIPS[0] })
    this.startLoadingTips()
    try {
      const [{ templates }, config] = await Promise.all([
        api.get('/api/templates'),
        api.get('/api/config').catch(() => ({}))
      ])
      const displayTemplates = (templates || []).map(item => ({
        ...item,
        popularityText: item.popularity >= 10000
          ? `${(item.popularity / 10000).toFixed(1)}万`
          : String(item.popularity || 0)
      }))
      const categories = Array.isArray(config.templateCategories) && config.templateCategories.length
        ? [{ id: 'all', name: '全部' }, ...config.templateCategories.map(item => ({ id: item.id, name: item.name }))]
        : this.data.categories
      this.stopLoadingTips()
      this.setData({
        templates: displayTemplates,
        filteredTemplates: displayTemplates,
        categories,
        welcomeCredits: config.newUserCredits || this.data.welcomeCredits,
        loading: false
      })
    } catch (error) {
      this.stopLoadingTips()
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '模板加载失败', icon: 'none' })
    }
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

  selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.id
    const filteredTemplates = activeCategory === 'all'
      ? this.data.templates
      : this.data.templates.filter(item => item.category === activeCategory)
    this.setData({ activeCategory, filteredTemplates })
  },

  /** Enter real template detail in demo mode (same UI, fake generate later). */
  openTemplate(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: `/pages/template/index?id=${encodeURIComponent(id)}&demo=1`
    })
  },

  backIntro() {
    this.setData({ phase: 'intro' })
  }
})
