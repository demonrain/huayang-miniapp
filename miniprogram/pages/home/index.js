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
    bannerAutoplay: false,
    bannerInterval: 4500,
    bannerCircular: true,
    welcomeCredits: 20,
    templates: [],
    filteredTemplates: [],
    // Fallback; prefer server-managed categories from /api/config
    categories: [
      { id: 'all', name: '全部' },
      { id: 'portrait', name: '人像' },
      { id: 'life', name: '生活' },
      { id: 'pet', name: '宠物' },
      { id: 'art', name: '艺术' }
    ],
    activeCategory: 'all',
    navSpacer: 176,
    showOnboarding: false,
    announcements: [],
    latestAnnouncement: null,
    announcement: null,
    showAnnouncement: false
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
    // Sync sheet if guide page completed/skipped while we were away
    const done = !!wx.getStorageSync('huayang_onboarding_done')
    const guestTourPending = !getApp().isLoggedIn() && !done
    if (!guestTourPending && this.data.showOnboarding) {
      this.setData({ showOnboarding: false })
    }
    if (guestTourPending) return
    this.maybeShowAnnouncement()
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
      const [{ templates }, { banners }, config, announcementResult] = await Promise.all([
        api.get('/api/templates'),
        api.get('/api/banners'),
        api.get('/api/config'),
        api.get('/api/announcements').catch(error => {
          console.warn('[announcement] load failed', error && error.message)
          return { announcements: [] }
        })
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
      const carousel = config.bannerCarousel || {}
      const multiBanner = banners.length > 1
      const bannerAutoplay = multiBanner && carousel.autoplay !== false && carousel.mode !== 'manual'
      const bannerInterval = Math.min(30000, Math.max(1500, Number(carousel.intervalMs) || 4500))
      const bannerCircular = multiBanner && carousel.circular !== false
      this.stopLoadingTips()
      const announcements = Array.isArray(announcementResult.announcements) ? announcementResult.announcements : []
      const showOnboarding = !app.isLoggedIn() && !wx.getStorageSync('huayang_onboarding_done')
      this.setData({
        user: app.isLoggedIn() ? user : null,
        banners,
        bannerAutoplay,
        bannerInterval,
        bannerCircular,
        welcomeCredits: config.newUserCredits,
        categories,
        templates: displayTemplates,
        filteredTemplates: this.data.activeCategory === 'all'
          ? displayTemplates
          : displayTemplates.filter(item => item.category === this.data.activeCategory),
        loading: false,
        showOnboarding,
        announcements,
        latestAnnouncement: announcements[0] || null
      })
      if (!showOnboarding) this.maybeShowAnnouncement()
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
    const tabPages = ['/pages/home/index', '/pages/history/index', '/pages/profile/index']
    if (tabPages.includes(path)) wx.switchTab({ url: path })
    else wx.navigateTo({ url: path })
  },

  markOnboardingDone() {
    wx.setStorageSync('huayang_onboarding_done', '1')
    if (this.data.showOnboarding) this.setData({ showOnboarding: false })
  },

  finishOnboarding() {
    const recommended = this.data.templates.find(item => Array.isArray(item.tags) && item.tags.includes('热门')) || this.data.templates[0]
    if (!recommended) {
      wx.showToast({ title: '模板还在准备中，请稍后再试', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/template/index?id=${encodeURIComponent(recommended.id)}&demo=1&tour=1`
    })
  },

  skipOnboarding() {
    wx.setStorageSync('huayang_onboarding_done', '1')
    this.setData({ showOnboarding: false }, () => this.maybeShowAnnouncement())
  },

  async maybeShowAnnouncement() {
    // Don't stack onboarding + announcement
    if (this.data.showOnboarding || this.data.showAnnouncement) return
    try {
      let list = Array.isArray(this.data.announcements) ? this.data.announcements : []
      if (!list.length) {
        const result = await api.get('/api/announcements')
        list = Array.isArray(result.announcements) ? result.announcements : []
        this.setData({ announcements: list, latestAnnouncement: list[0] || null })
      }
      if (!list.length) return
      let dismissed = []
      try {
        dismissed = JSON.parse(wx.getStorageSync('huayang_dismissed_announcements') || '[]')
      } catch (error) {
        dismissed = []
      }
      if (!Array.isArray(dismissed)) dismissed = []
      const next = list.find(item => item && item.id && dismissed.indexOf(item.id) === -1)
      if (!next) return
      this.setData({
        announcement: next,
        showAnnouncement: true
      })
    } catch (error) {
      console.warn('[announcement] show failed', error && error.message)
    }
  },

  openLatestAnnouncement() {
    const announcement = this.data.latestAnnouncement
    if (!announcement) return
    this.setData({ announcement, showAnnouncement: true })
  },

  dismissAnnouncementOnce() {
    this.setData({ showAnnouncement: false, announcement: null })
  },

  dismissAnnouncementForever() {
    const id = this.data.announcement && this.data.announcement.id
    if (id) {
      let dismissed = []
      try {
        dismissed = JSON.parse(wx.getStorageSync('huayang_dismissed_announcements') || '[]')
      } catch (error) {
        dismissed = []
      }
      if (!Array.isArray(dismissed)) dismissed = []
      if (dismissed.indexOf(id) === -1) dismissed.push(id)
      // Keep storage bounded
      wx.setStorageSync('huayang_dismissed_announcements', JSON.stringify(dismissed.slice(-50)))
    }
    this.setData({ showAnnouncement: false, announcement: null })
  },

  noop() {}
})
