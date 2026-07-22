const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    code: '',
    credits: null,
    redeeming: false,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.refreshCredits()
  },

  async refreshCredits() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      if (app.isLoggedIn() && user) {
        this.setData({ credits: user.credits })
        return
      }
      this.setData({ credits: null })
    } catch (error) {
      this.setData({ credits: null })
    }
  },

  onCodeInput(event) {
    const raw = String(event.detail.value || '').toUpperCase()
    // Allow letters/numbers/hyphen while typing
    this.setData({ code: raw.replace(/[^A-Z0-9-]/g, '') })
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
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '兑换失败', icon: 'none' })
    } finally {
      this.setData({ redeeming: false })
    }
  }
})
