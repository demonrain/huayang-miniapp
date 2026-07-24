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

  /**
   * Silent restore from local token (huayang_token in storage).
   * Token is issued by server on WeChat login and valid ~30 days.
   * Only clear token on real auth failure (401/403), not network blips.
   */
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
      const status = error && error.statusCode
      // Token invalid / user gone / account disabled — force re-login
      if (status === 401 || status === 403) {
        wx.removeStorageSync('huayang_token')
        this.globalData.user = null
        this.globalData.isLoggedIn = false
        return null
      }
      // Network or server error: keep token so next open can restore
      console.warn('[session] restore failed, keep token', error && error.message)
      this.globalData.user = null
      this.globalData.isLoggedIn = false
      return null
    }
  },

  /**
   * Try to read WeChat avatar/nickname while still in a user-gesture context.
   * Note: WeChat no longer allows fully silent fetch; getUserProfile may return
   * defaults on some clients. Prefer chooseAvatar + type=nickname when empty.
   */
  getUserProfileIfAvailable() {
    return new Promise(resolve => {
      if (typeof wx.getUserProfile !== 'function') {
        resolve(null)
        return
      }
      wx.getUserProfile({
        desc: '用于完善头像和昵称',
        success: res => resolve((res && res.userInfo) || null),
        fail: () => resolve(null)
      })
    })
  },

  /** Save WeChat profile fields to server when they look real (not defaults). */
  async applyWechatProfile(userInfo) {
    if (!userInfo || !this.isLoggedIn()) return null
    const nickname = String(userInfo.nickName || userInfo.nickname || '').trim()
    const avatarUrl = String(userInfo.avatarUrl || '').trim()
    const defaultNicks = new Set(['', '微信用户', 'WeChat User', '微信网友'])
    const isDefaultNick = defaultNicks.has(nickname)
    // Known gray default avatar hashes used by WeChat when user has no custom avatar
    const isDefaultAvatar = !avatarUrl
      || avatarUrl.includes('mmhead/SQoo8roBCEE1lGkgb77yeg')
      || /\/POgEwh4mIHO4nibH0KlMECNjjGxQUq24ZEaGT4poC6icRiccVGKSyXwibcPq4BWmiaIGuG1icwxaQX6grC9VemZoJ8rg/i.test(avatarUrl)

    const payload = {}
    if (!isDefaultNick) payload.nickname = nickname.slice(0, 20)
    // Persist https WeChat CDN avatars (skip only known placeholders)
    if (avatarUrl && /^https:\/\//i.test(avatarUrl) && !isDefaultAvatar) {
      payload.avatarUrl = avatarUrl.slice(0, 500)
    }
    if (!Object.keys(payload).length) return null
    try {
      const { user } = await api.patch('/api/me', payload)
      this.setUser(user)
      return user
    } catch (error) {
      console.warn('[profile] apply wechat profile failed', error && error.message)
      return null
    }
  },

  /**
   * Login with optional profile authorization in the same user action.
   * Call getUserProfile first (gesture), then wx.login + session.
   */
  async loginWithProfile() {
    const profile = await this.getUserProfileIfAvailable()
    const user = await this.login()
    if (profile) {
      const updated = await this.applyWechatProfile(profile)
      return updated || user
    }
    return user
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
    // Always wait for the launch-time restore first (avoids guest flash / re-login)
    if (this.restorePromise) {
      try {
        const restored = await this.restorePromise
        if (restored || this.isLoggedIn()) return this.globalData.user || restored
      } catch (error) {}
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

    // getUserProfile must run in the confirm-button gesture chain before heavy awaits when possible.
    // After modal, it may still work on some clients; loginWithProfile tries then falls back.
    wx.showLoading({ title: '登录中', mask: true })
    try {
      // Re-try profile after confirm (gesture may be weak; chooseAvatar remains fallback)
      let profile = null
      try {
        profile = await this.getUserProfileIfAvailable()
      } catch (e) {}
      const user = await this.login()
      let next = user
      if (profile) {
        next = (await this.applyWechatProfile(profile)) || user
      }
      wx.hideLoading()
      wx.showToast({ title: '登录成功', icon: 'success' })
      this.maybePromptProfileSetup(next)
      return next
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
      throw error
    }
  },

  /**
   * After WeChat login, if avatar/nickname still missing, guide user to profile.
   * Official policy: cannot silent-fetch; chooseAvatar + type=nickname are required fallbacks.
   */
  maybePromptProfileSetup(user) {
    if (!user || user.profileComplete) return
    if (wx.getStorageSync('huayang_profile_setup_prompted')) return
    wx.setStorageSync('huayang_profile_setup_prompted', '1')
    setTimeout(() => {
      wx.showModal({
        title: '完善头像与昵称',
        content: '登录成功！点「去设置」后点头像选用微信头像、点昵称栏使用微信昵称（微信规定需你主动授权，无法静默读取）。',
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
