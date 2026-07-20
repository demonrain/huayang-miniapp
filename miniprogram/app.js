const api = require('./utils/api')
const { API_BASE_URL } = require('./config')

App({
  globalData: {
    user: null,
    apiBase: API_BASE_URL
  },

  onLaunch() {
    this.sessionPromise = this.login()
  },

  async login() {
    const token = wx.getStorageSync('huayang_token')
    if (token) {
      try {
        const { user } = await api.get('/api/me')
        this.globalData.user = user
        return user
      } catch (error) {
        wx.removeStorageSync('huayang_token')
      }
    }

    const code = await new Promise((resolve, reject) => {
      wx.login({ success: ({ code }) => resolve(code), fail: reject })
    })
    const { token: nextToken, user } = await api.post('/api/auth/wechat', { code })
    wx.setStorageSync('huayang_token', nextToken)
    this.globalData.user = user
    return user
  },

  async ensureSession() {
    if (!this.sessionPromise) this.sessionPromise = this.login()
    return this.sessionPromise
  },

  setUser(user) {
    this.globalData.user = user
  }
})
