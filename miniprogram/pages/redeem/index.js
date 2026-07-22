const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    code: '',
    credits: null,
    transactions: [],
    loadingLedger: false,
    isLoggedIn: false,
    redeeming: false,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadPage()
  },

  async loadPage() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      if (!app.isLoggedIn() || !user) {
        this.setData({
          isLoggedIn: false,
          credits: null,
          transactions: [],
          loadingLedger: false
        })
        return
      }
      this.setData({ isLoggedIn: true, loadingLedger: true })
      const { user: walletUser, transactions } = await api.get('/api/wallet')
      if (walletUser) app.setUser(walletUser)
      this.setData({
        credits: walletUser?.credits ?? user.credits ?? null,
        transactions: Array.isArray(transactions) ? transactions : [],
        loadingLedger: false
      })
    } catch (error) {
      this.setData({ loadingLedger: false })
      // Still show credits from session if wallet fails
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

  async refreshCredits() {
    await this.loadPage()
  },

  onCodeInput(event) {
    const raw = String(event.detail.value || '').toUpperCase()
    this.setData({ code: raw.replace(/[^A-Z0-9-]/g, '') })
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可兑换积分并查看明细')
      this.loadPage()
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
      // Reload ledger so CDK redeem appears immediately
      await this.loadPage()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '兑换失败', icon: 'none' })
    } finally {
      this.setData({ redeeming: false })
    }
  }
})
