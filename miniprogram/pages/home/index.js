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

const PAGE_SIZE = 12

function mapTemplate(item) {
  return {
    ...item,
    popularityText: item.popularity >= 10000
      ? `${(item.popularity / 10000).toFixed(1)}万`
      : String(item.popularity || 0)
  }
}

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
    page: 1,
    pageSize: PAGE_SIZE,
    hasMore: false,
    loadingMore: false,
    listFooter: '',
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

  onReachBottom() {
    this.loadMoreTemplates()
  },

  /** Initial / pull-refresh: meta + first page of templates */
  async loadPage() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const [{ banners }, config, announcementResult, firstPage] = await Promise.all([
        api.get('/api/banners'),
        api.get('/api/config'),
        api.get('/api/announcements').catch(error => {
          console.warn('[announcement] load failed', error && error.message)
          return { announcements: [] }
        }),
        this.fetchTemplatesPage({
          page: 1,
          category: this.data.activeCategory || 'all'
        })
      ])
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
      const templates = firstPage.list
      // Normalize admin-configured text colors for WXML style binding.
      // Use explicit color + !important so page defaults / image white CSS cannot override.
      const bannersWithStyle = (banners || []).map(item => {
        const titleColor = String(item.titleColor || '').trim()
        const subtitleColor = String(item.subtitleColor || '').trim()
        const badgeColor = String(item.badgeColor || '').trim()
        const colorStyle = (hex) => (hex ? `color: ${hex} !important;` : '')
        return {
          ...item,
          titleColor,
          subtitleColor,
          badgeColor,
          titleStyle: colorStyle(titleColor),
          subtitleStyle: colorStyle(subtitleColor),
          badgeStyle: colorStyle(badgeColor)
        }
      })
      this.setData({
        user: app.isLoggedIn() ? user : null,
        banners: bannersWithStyle,
        bannerAutoplay,
        bannerInterval,
        bannerCircular,
        welcomeCredits: config.newUserCredits,
        categories,
        templates,
        filteredTemplates: templates,
        page: firstPage.page,
        hasMore: firstPage.hasMore,
        loadingMore: false,
        listFooter: this.footerText(templates.length, firstPage.hasMore),
        loading: false,
        showOnboarding,
        announcements,
        latestAnnouncement: announcements[0] || null
      })
      if (!showOnboarding) this.maybeShowAnnouncement()
    } catch (error) {
      this.stopLoadingTips()
      this.setData({ loading: false, loadingMore: false })
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  footerText(count, hasMore) {
    if (!count) return ''
    if (hasMore) return '上拉加载更多'
    return '已经到底啦'
  },

  async fetchTemplatesPage({ page, category }) {
    // Mini program runtime has no URLSearchParams — build query manually
    const query = [
      `page=${encodeURIComponent(String(page || 1))}`,
      `pageSize=${encodeURIComponent(String(PAGE_SIZE))}`,
      `category=${encodeURIComponent(category && category !== 'all' ? category : 'all')}`
    ].join('&')
    const result = await api.get(`/api/templates?${query}`)
    const list = (Array.isArray(result.templates) ? result.templates : []).map(mapTemplate)
    const hasMore = typeof result.hasMore === 'boolean'
      ? result.hasMore
      : Number(result.page || page) < Number(result.pages || 1)
    return {
      list,
      page: Number(result.page) || page || 1,
      pages: Number(result.pages) || 1,
      total: Number(result.total) || list.length,
      hasMore
    }
  },

  async loadMoreTemplates() {
    if (this.data.loading || this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true, listFooter: '加载中…' })
    try {
      const nextPage = (this.data.page || 1) + 1
      const result = await this.fetchTemplatesPage({
        page: nextPage,
        category: this.data.activeCategory
      })
      // Dedupe by id
      const seen = new Set(this.data.filteredTemplates.map(item => item.id))
      const appended = result.list.filter(item => item && item.id && !seen.has(item.id))
      const filteredTemplates = this.data.filteredTemplates.concat(appended)
      this.setData({
        templates: filteredTemplates,
        filteredTemplates,
        page: result.page,
        hasMore: result.hasMore,
        loadingMore: false,
        listFooter: this.footerText(filteredTemplates.length, result.hasMore)
      })
    } catch (error) {
      this.setData({
        loadingMore: false,
        listFooter: this.data.hasMore ? '加载失败，上拉重试' : this.footerText(this.data.filteredTemplates.length, false)
      })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
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

  async selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.id
    if (activeCategory === this.data.activeCategory && this.data.filteredTemplates.length) return
    this.setData({
      activeCategory,
      loading: true,
      loadingTip: LOADING_TIPS[0],
      filteredTemplates: [],
      templates: [],
      page: 1,
      hasMore: false,
      listFooter: ''
    })
    this.startLoadingTips()
    try {
      const result = await this.fetchTemplatesPage({ page: 1, category: activeCategory })
      this.stopLoadingTips()
      this.setData({
        templates: result.list,
        filteredTemplates: result.list,
        page: result.page,
        hasMore: result.hasMore,
        listFooter: this.footerText(result.list.length, result.hasMore),
        loading: false
      })
    } catch (error) {
      this.stopLoadingTips()
      this.setData({ loading: false })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  startCreate(event) {
    const id = event.currentTarget.dataset.id
    this.markOnboardingDone()
    wx.navigateTo({ url: `/pages/template/index?id=${id}` })
  },

  openBanner(event) {
    let path = String(event.currentTarget.dataset.path || '').trim()
    if (!path) return
    // Normalize: ensure leading slash; reject non-mini-program schemes
    if (!path.startsWith('/')) path = `/${path}`
    if (/^\/[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith('//')) {
      wx.showToast({ title: '跳转路径无效', icon: 'none' })
      return
    }
    // switchTab only accepts path without query
    const qIndex = path.indexOf('?')
    const pathOnly = qIndex >= 0 ? path.slice(0, qIndex) : path
    const tabPages = ['/pages/home/index', '/pages/history/index', '/pages/profile/index']
    if (tabPages.includes(pathOnly)) {
      wx.switchTab({
        url: pathOnly,
        fail: () => wx.showToast({ title: '页面打开失败', icon: 'none' })
      })
      return
    }
    wx.navigateTo({
      url: path,
      fail: (err) => {
        console.warn('[banner navigate]', path, err)
        wx.showToast({ title: '页面打开失败，请检查路径', icon: 'none' })
      }
    })
  },

  markOnboardingDone() {
    wx.setStorageSync('huayang_onboarding_done', '1')
    if (this.data.showOnboarding) this.setData({ showOnboarding: false })
  },

  finishOnboarding() {
    const pool = (this.data.filteredTemplates && this.data.filteredTemplates.length)
      ? this.data.filteredTemplates
      : (this.data.templates || [])
    const recommended = pool.find(item => Array.isArray(item.tags) && item.tags.includes('热门')) || pool[0]
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
      if (dismissed.length > 50) dismissed = dismissed.slice(-50)
      wx.setStorageSync('huayang_dismissed_announcements', JSON.stringify(dismissed))
    }
    this.setData({ showAnnouncement: false, announcement: null })
  },

  noop() {}
})
