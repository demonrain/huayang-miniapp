const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

const PAGE_SIZE = 20

Page({
  data: {
    code: '',
    credits: null,
    transactions: [],
    transactionsTotal: 0,
    hasMore: false,
    loadingLedger: false,
    loadingMore: false,
    isLoggedIn: false,
    redeeming: false,
    navSpacer: 176,
    ledgerFooter: ''
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadPage({ reset: true })
  },

  async loadPage({ reset = false } = {}) {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      if (!app.isLoggedIn() || !user) {
        this.setData({
          isLoggedIn: false,
          credits: null,
          transactions: [],
          transactionsTotal: 0,
          hasMore: false,
          loadingLedger: false,
          loadingMore: false,
          ledgerFooter: ''
        })
        return
      }

      if (reset) {
        this.setData({
          isLoggedIn: true,
          loadingLedger: true,
          transactions: [],
          hasMore: false,
          ledgerFooter: ''
        })
        await this.fetchTransactions({ offset: 0, append: false })
      } else {
        this.setData({ isLoggedIn: true })
        await this.fetchTransactions({ offset: this.data.transactions.length, append: true })
      }
    } catch (error) {
      this.setData({ loadingLedger: false, loadingMore: false })
      try {
        const app = getApp()
        if (app.isLoggedIn() && app.globalData.user) {
          this.setData({
            isLoggedIn: true,
            credits: app.globalData.user.credits
          })
        }
      } catch (e) {}
    }
  },

  async fetchTransactions({ offset, append }) {
    if (append) {
      if (this.data.loadingMore || this.data.loadingLedger || !this.data.hasMore) return
      this.setData({ loadingMore: true, ledgerFooter: '加载中…' })
    }

    try {
      const result = await api.get(`/api/wallet?limit=${PAGE_SIZE}&offset=${offset}`)
      const app = getApp()
      if (result.user) app.setUser(result.user)

      const page = Array.isArray(result.transactions) ? result.transactions : []
      const total = Number(result.transactionsTotal)
      const hasMore = typeof result.transactionsHasMore === 'boolean'
        ? result.transactionsHasMore
        : (offset + page.length) < (Number.isFinite(total) ? total : offset + page.length)

      const transactions = append
        ? this.data.transactions.concat(page)
        : page

      // Dedupe by id in case of race
      const seen = new Set()
      const unique = []
      for (const item of transactions) {
        if (!item || !item.id || seen.has(item.id)) continue
        seen.add(item.id)
        unique.push(item)
      }

      let ledgerFooter = ''
      if (!unique.length) ledgerFooter = ''
      else if (hasMore) ledgerFooter = '上拉加载更多'
      else ledgerFooter = '没有更多了'

      this.setData({
        credits: result.user?.credits ?? app.globalData.user?.credits ?? this.data.credits,
        transactions: unique,
        transactionsTotal: Number.isFinite(total) ? total : unique.length,
        hasMore,
        loadingLedger: false,
        loadingMore: false,
        ledgerFooter
      })
    } catch (error) {
      this.setData({
        loadingLedger: false,
        loadingMore: false,
        ledgerFooter: this.data.transactions.length ? '加载失败，上拉重试' : ''
      })
      if (!append) throw error
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  onLedgerReachBottom() {
    if (!this.data.isLoggedIn || !this.data.hasMore || this.data.loadingMore || this.data.loadingLedger) {
      return
    }
    this.fetchTransactions({ offset: this.data.transactions.length, append: true })
  },

  onCodeInput(event) {
    const raw = String(event.detail.value || '').toUpperCase()
    this.setData({ code: raw.replace(/[^A-Z0-9-]/g, '') })
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可兑换积分并查看明细')
      this.loadPage({ reset: true })
    } catch (error) {}
  },

  async doRedeem() {
    if (this.data.redeeming) return
    try {
      await getApp().requireLogin('登录后才能兑换积分')
    } catch (error) {
      return
    }

    const code = String(this.data.code || '').trim()
    if (!code) {
      wx.showToast({ title: '请输入兑换码', icon: 'none' })
      return
    }

    this.setData({ redeeming: true })
    wx.showLoading({ title: '兑换中', mask: true })
    try {
      const result = await api.post('/api/cdks/redeem', { code })
      if (result.user) {
        getApp().setUser(result.user)
        this.setData({ credits: result.user.credits, code: '' })
      }
      wx.hideLoading()
      wx.showToast({
        title: result.message || `兑换成功 +${result.credits}`,
        icon: 'success'
      })
      await this.loadPage({ reset: true })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '兑换失败', icon: 'none' })
    } finally {
      this.setData({ redeeming: false })
    }
  }
})
