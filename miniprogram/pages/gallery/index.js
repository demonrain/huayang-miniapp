const api = require('../../utils/api')
const { relativeTime } = require('../../utils/format')
const { getNavMetrics } = require('../../utils/nav')

const PAGE_SIZE = 12

function splitWaterfall(items) {
  const left = []
  const right = []
  let leftH = 0
  let rightH = 0
  ;(items || []).forEach((item, index) => {
    const est = 300 + ((index * 41) % 100)
    if (leftH <= rightH) {
      left.push(item)
      leftH += est
    } else {
      right.push(item)
      rightH += est
    }
  })
  return { leftItems: left, rightItems: right }
}

Page({
  data: {
    items: [],
    leftItems: [],
    rightItems: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    page: 1,
    total: 0,
    listFooter: '',
    user: null,
    isLoggedIn: false,
    navSpacer: 176,
    galleryRewards: null,
    likingId: ''
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadList({ reset: true })
  },

  async onPullDownRefresh() {
    await this.loadList({ reset: true })
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadMore()
  },

  footerText(count, hasMore) {
    if (!count) return ''
    if (hasMore) return '上拉加载更多'
    return '已经到底啦 · 去公开你的作品吧'
  },

  applyItems(items, extra = {}) {
    const { leftItems, rightItems } = splitWaterfall(items)
    this.setData({ items, leftItems, rightItems, ...extra })
  },

  async fetchPage(page) {
    const query = [
      `page=${encodeURIComponent(String(page || 1))}`,
      `pageSize=${encodeURIComponent(String(PAGE_SIZE))}`
    ].join('&')
    const result = await api.get(`/api/gallery?${query}`)
    const items = (Array.isArray(result.items) ? result.items : []).map(item => ({
      ...item,
      relativeTime: relativeTime(item.publicShareAt || item.createdAt)
    }))
    return {
      items,
      page: Number(result.page) || page || 1,
      total: Number(result.total) || items.length,
      hasMore: Boolean(result.hasMore),
      galleryRewards: result.galleryRewards || null
    }
  },

  async loadList({ reset = false } = {}) {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const isLoggedIn = app.isLoggedIn()
      if (!isLoggedIn) {
        this.setData({
          user: null,
          isLoggedIn: false,
          items: [],
          leftItems: [],
          rightItems: [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          page: 1,
          total: 0,
          listFooter: ''
        })
        return
      }
      if (reset) this.setData({ loading: true, hasMore: false, listFooter: '' })
      const result = await this.fetchPage(1)
      this.applyItems(result.items, {
        user,
        isLoggedIn: true,
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
        galleryRewards: result.galleryRewards,
        loading: false,
        loadingMore: false,
        listFooter: this.footerText(result.items.length, result.hasMore)
      })
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false,
        items: reset ? [] : this.data.items
      })
      if (error.statusCode !== 401) {
        wx.showToast({ title: error.message || '加载失败', icon: 'none' })
      }
    }
  },

  async loadMore() {
    if (!this.data.isLoggedIn || this.data.loading || this.data.loadingMore || !this.data.hasMore) return
    this.setData({ loadingMore: true, listFooter: '加载中…' })
    try {
      const nextPage = (this.data.page || 1) + 1
      const result = await this.fetchPage(nextPage)
      const seen = new Set(this.data.items.map(item => item.id))
      const appended = result.items.filter(item => item && item.id && !seen.has(item.id))
      const items = this.data.items.concat(appended)
      this.applyItems(items, {
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
        galleryRewards: result.galleryRewards || this.data.galleryRewards,
        loadingMore: false,
        listFooter: this.footerText(items.length, result.hasMore)
      })
    } catch (error) {
      this.setData({
        loadingMore: false,
        listFooter: this.data.hasMore ? '加载失败，上拉重试' : this.footerText(this.data.items.length, false)
      })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后逛逛大家的花漾画廊')
      this.loadList({ reset: true })
    } catch (error) {}
  },

  openJob(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/job/index?id=${encodeURIComponent(id)}&showcase=1` })
  },

  async onLike(event) {
    const id = event.currentTarget.dataset.id
    if (!id || this.data.likingId) return
    const app = getApp()
    if (!app.isLoggedIn()) {
      try {
        await app.requireLogin('登录后可为作品点赞')
      } catch (error) {
        return
      }
    }
    const current = this.data.items.find(item => item.id === id)
    if (current && current.likedByMe) {
      wx.showToast({ title: '已经点过赞了', icon: 'none' })
      return
    }
    this.setData({ likingId: id })
    try {
      const result = await api.post(`/api/gallery/${encodeURIComponent(id)}/like`, {})
      if (result.user) app.setUser(result.user)
      const items = this.data.items.map(item => {
        if (item.id !== id) return item
        return {
          ...item,
          likedByMe: true,
          likeCount: Number(result.likeCount != null ? result.likeCount : (item.likeCount || 0) + 1)
        }
      })
      this.applyItems(items, {
        likingId: '',
        user: result.user || this.data.user
      })
      wx.showToast({ title: result.message || '点赞成功', icon: 'none' })
    } catch (error) {
      this.setData({ likingId: '' })
      wx.showToast({ title: error.message || '点赞失败', icon: 'none' })
    }
  },

  goPublish() {
    wx.switchTab({ url: '/pages/history/index' })
  }
})
