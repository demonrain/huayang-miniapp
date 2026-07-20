const api = require('../../utils/api')

Page({
  data: {
    user: null,
    packages: [],
    transactions: [],
    checkin: null,
    selectedId: '',
    paying: false,
    checking: false
  },

  onShow() {
    this.loadWallet()
  },

  async loadWallet() {
    try {
      await getApp().ensureSession()
      const { user, packages, transactions, checkin } = await api.get('/api/wallet')
      getApp().setUser(user)
      this.setData({
        user,
        packages,
        transactions,
        checkin,
        selectedId: this.data.selectedId || packages[1]?.id || packages[0]?.id || ''
      })
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  selectPackage(event) {
    this.setData({ selectedId: event.currentTarget.dataset.id })
  },

  async checkin() {
    if (this.data.checking || this.data.checkin?.claimedToday) return
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
