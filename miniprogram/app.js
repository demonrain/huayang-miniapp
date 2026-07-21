const api = require('./utils/api')
const { API_BASE_URL } = require('./config')

App({
  globalData: {
    user: null,
    isLoggedIn: false,
    apiBase: API_BASE_URL
  },

  onLaunch() {
    this.restorePromise = this.tryRestoreSession()
  },

  isLoggedIn() {
    return Boolean(this.globalData.isLoggedIn && this.globalData.user && wx.getStorageSync('huayang_token'))
  },

  /** Silent restore from local token. Guests stay logged out. */
  async tryRestoreSession() {
    const token = wx.getStorageSync('huayang_token')
    if (!token) {
      this.globalData.user = null
      this.globalData.isLoggedIn = false
      return null
    }
    try {
      const { user } = await api.get('/api/me')
      this.globalData.user = user
      this.globalData.isLoggedIn = true
      return user
    } catch (error) {
      wx.removeStorageSync('huayang_token')
      this.globalData.user = null
      this.globalData.isLoggedIn = false
      return null
    }
  },

  /** WeChat login and create/restore server session. */
  async login() {
    if (this.loginPromise) return this.loginPromise
    this.loginPromise = (async () => {
      const code = await new Promise((resolve, reject) => {
        wx.login({ success: ({ code }) => resolve(code), fail: reject })
      })
      const { token: nextToken, user } = await api.post('/api/auth/wechat', { code })
      wx.setStorageSync('huayang_token', nextToken)
      this.globalData.user = user
      this.globalData.isLoggedIn = true
      return user
    })()
    try {
      return await this.loginPromise
    } finally {
      this.loginPromise = null
    }
  },

  /**
   * Return current user if logged in (optionally wait restore).
   * Does not force login — suitable for browsing as guest.
   */
  async ensureSession() {
    if (this.isLoggedIn()) return this.globalData.user
    if (this.restorePromise) {
      const restored = await this.restorePromise
      if (restored) return restored
    }
    return this.tryRestoreSession()
  },

  /**
   * Require login for protected actions (checkin / generate / pay / works).
   * Shows a modal; on confirm runs WeChat login.
   */
  async requireLogin(message = '登录后即可使用该功能') {
    if (this.isLoggedIn()) return this.globalData.user
    await this.ensureSession()
    if (this.isLoggedIn()) return this.globalData.user

    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '需要登录',
        content: message,
        confirmText: '微信登录',
        cancelText: '再逛逛',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) {
      const error = new Error('需要登录')
      error.code = 'LOGIN_CANCELLED'
      throw error
    }

    wx.showLoading({ title: '登录中', mask: true })
    try {
      const user = await this.login()
      wx.hideLoading()
      wx.showToast({ title: '登录成功', icon: 'success' })
      return user
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
      throw error
    }
  },

  setUser(user) {
    this.globalData.user = user
    this.globalData.isLoggedIn = Boolean(user)
  },

  logout() {
    wx.removeStorageSync('huayang_token')
    this.globalData.user = null
    this.globalData.isLoggedIn = false
  }
})
