const api = require('./utils/api')
const { API_BASE_URL } = require('./config')

App({
  globalData: {
    user: null,
    isLoggedIn: false,
    apiBase: API_BASE_URL,
    inviteToken: ''
  },

  onLaunch(options) {
    this.captureInviteFromQuery(options && options.query)
    this.restorePromise = this.tryRestoreSession()
  },

  /** Persist invite/share token for attribution after login */
  captureInviteFromQuery(query) {
    if (!query) return
    const token = query.token || query.inviteToken || query.shareToken || ''
    if (token) this.setInviteToken(decodeURIComponent(String(token)))
  },

  setInviteToken(token) {
    const value = String(token || '').trim()
    if (!value) return
    this.globalData.inviteToken = value
    wx.setStorageSync('huayang_invite_token', value)
  },

  getInviteToken() {
    return this.globalData.inviteToken || wx.getStorageSync('huayang_invite_token') || ''
  },

  clearInviteToken() {
    this.globalData.inviteToken = ''
    wx.removeStorageSync('huayang_invite_token')
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
      const inviteToken = this.getInviteToken()
      const payload = { code }
      if (inviteToken) payload.inviteToken = inviteToken
      const { token: nextToken, user } = await api.post('/api/auth/wechat', payload)
      wx.setStorageSync('huayang_token', nextToken)
      this.globalData.user = user
      this.globalData.isLoggedIn = true
      // Invite is applied only for brand-new accounts; clear either way after login
      this.clearInviteToken()
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
   * After first login, guides user to authorize avatar + nickname (WeChat policy).
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
      // WeChat no longer allows silent getUserInfo; prompt profile setup after login
      this.maybePromptProfileSetup(user)
      return user
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
      throw error
    }
  },

  /**
   * After WeChat login, open profile tab so user can one-tap authorize
   * avatar (chooseAvatar) and nickname (type=nickname). Cannot silent-fetch.
   */
  maybePromptProfileSetup(user) {
    if (!user || user.profileComplete) return
    if (wx.getStorageSync('huayang_profile_setup_prompted')) return
    wx.setStorageSync('huayang_profile_setup_prompted', '1')
    setTimeout(() => {
      wx.showModal({
        title: '设置头像与昵称',
        content: '登录成功！请授权使用微信头像和昵称，方便在作品页展示你的主页。',
        confirmText: '去设置',
        cancelText: '稍后',
        success: res => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/index' })
          }
        }
      })
    }, 400)
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
