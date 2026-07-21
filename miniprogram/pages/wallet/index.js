const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    user: null,
    isLoggedIn: false,
    packages: [],
    transactions: [],
    checkin: null,
    selectedId: '',
    paying: false,
    checking: false,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadWallet()
  },

  async loadWallet() {
    try {
      const app = getApp()
      await app.ensureSession()
      if (!app.isLoggedIn()) {
        this.setData({
          isLoggedIn: false,
          user: null,
          packages: [],
          transactions: [],
          checkin: null
        })
        return
      }
      const { user, packages, transactions, checkin } = await api.get('/api/wallet')
      app.setUser(user)
      this.setData({
        isLoggedIn: true,
        user,
        packages,
        transactions,
        checkin,
        selectedId: this.data.selectedId || packages[1]?.id || packages[0]?.id || ''
      })
    } catch (error) {
      if (error.statusCode === 401) {
        this.setData({ isLoggedIn: false, user: null })
        return
      }
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可签到、充值并管理积分')
      this.loadWallet()
    } catch (error) {}
  },

  selectPackage(event) {
    if (!getApp().isLoggedIn()) {
      this.doLogin()
      return
    }
    this.setData({ selectedId: event.currentTarget.dataset.id })
  },

  async checkin() {
    if (this.data.checking || this.data.checkin?.claimedToday) return
    try {
      await getApp().requireLogin('登录后可每日签到领取积分')
    } catch (error) {
      return
    }
    this.setData({ checking: true })
    try {
      const { claimed, reward, user } = await api.post('/api/checkins', {})
      getApp().setUser(user)
      this.setData({ user, checkin: { reward, claimedToday: true } })
      wx.showToast({ title: claimed ? `签到成功 +${reward}` : '今天已经签到', icon: 'success' })
      await this.loadWallet()
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
    } finally {
      this.setData({ checking: false })
    }
  },

  async pay() {
    if (!this.data.selectedId || this.data.paying) return
    try {
      await getApp().requireLogin('登录后可充值积分')
    } catch (error) {
      return
    }
    this.setData({ paying: true })
    try {
      const { order, payment, user } = await api.post('/api/payments/orders', {
        packageId: this.data.selectedId
      })

      if (payment.mode === 'wechat') await this.requestPayment(payment.params)

      if (payment.mode === 'mock') {
        getApp().setUser(user)
        wx.showToast({ title: '充值成功', icon: 'success' })
        await this.loadWallet()
      } else {
        wx.showToast({ title: '支付成功', icon: 'success' })
        setTimeout(() => this.loadWallet(), 1000)
      }
    } catch (error) {
      const cancelled = String(error.errMsg || '').includes('cancel')
      if (!cancelled) wx.showModal({ title: '支付未完成', content: error.message || '请稍后重试', showCancel: false })
    } finally {
      this.setData({ paying: false })
    }
  },

  requestPayment(params) {
    return new Promise((resolve, reject) => wx.requestPayment({ ...params, success: resolve, fail: reject }))
  }
})
