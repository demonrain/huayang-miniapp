const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    user: null,
    stats: null,
    avatarUrl: '',
    nickname: '',
    avatarInitial: '画',
    profileComplete: false,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadProfile()
  },

  async loadProfile() {
    try {
      const app = getApp()
      await app.ensureSession()
      if (!app.isLoggedIn()) {
        this.setData({ user: null, stats: null, profileComplete: false })
        return
      }
      const { user, stats } = await api.get('/api/profile')
      app.setUser(user)
      this.applyUser(user, stats)
    } catch (error) {
      if (error.statusCode === 401) {
        this.setData({ user: null, stats: null, profileComplete: false })
        return
      }
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  applyUser(user, stats) {
    const nickname = user.nickname || ''
    this.setData({
      user,
      stats: stats || this.data.stats,
      avatarUrl: user.avatarUrl || '',
      nickname,
      avatarInitial: (nickname || '画').slice(0, 1),
      profileComplete: Boolean(user.profileComplete)
    })
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可管理个人资料与作品数据')
      await this.loadProfile()
      if (!this.data.profileComplete) {
        wx.showToast({ title: '请设置头像和昵称', icon: 'none' })
      }
    } catch (error) {}
  },

  async chooseAvatar(event) {
    try {
      await getApp().requireLogin('登录后可设置头像')
    } catch (error) {
      return
    }
    const avatarUrl = event.detail.avatarUrl
    if (!avatarUrl) return
    this.setData({ avatarUrl })
    // Temp file from WeChat: upload then bind asset. HTTPS CDN url: save directly.
    if (/^https:\/\//i.test(avatarUrl)) {
      await this.saveProfile({ avatarUrl })
      return
    }
    await this.saveProfile({ avatarUrl })
  },

  nicknameInput(event) {
    this.setData({ nickname: event.detail.value })
  },

  nicknameReview(event) {
    // WeChat nickname review callback (pass / fail)
    if (event.detail && event.detail.pass === false) {
      wx.showToast({ title: '昵称未通过审核', icon: 'none' })
    }
  },

  async nicknameBlur() {
    if (!this.data.user) return
    const nickname = (this.data.nickname || '').trim()
    if (!nickname) return
    if (nickname === this.data.user.nickname) return
    await this.saveProfile({ nickname })
  },

  async saveProfile(changes) {
    try {
      await getApp().requireLogin('登录后可更新资料')
      let payload = { ...changes }
      const avatarUrl = changes.avatarUrl || ''
      // chooseAvatar usually returns a local temp path that must be uploaded
      const isLocalTemp =
        avatarUrl.startsWith('wxfile://') ||
        avatarUrl.startsWith('http://tmp/') ||
        avatarUrl.startsWith('http://usr/') ||
        (avatarUrl.startsWith('https://') && /\/tmp\//i.test(avatarUrl))
      if (isLocalTemp) {
        wx.showLoading({ title: '上传头像', mask: true })
        try {
          const { asset } = await api.upload(avatarUrl)
          payload = { avatarAssetId: asset.id }
        } finally {
          wx.hideLoading()
        }
      }

      const { user } = await api.patch('/api/me', payload)
      getApp().setUser(user)
      this.applyUser(user)
      wx.showToast({ title: '资料已更新', icon: 'success' })
    } catch (error) {
      if (error.code === 'LOGIN_CANCELLED') return
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  openHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '选择风格后上传清晰照片即可生成。任务失败时积分会自动退回。头像请点左侧圆形按钮授权微信头像，昵称请点输入框授权微信昵称。',
      showCancel: false
    })
  },

  openPrivacy() {
    wx.showModal({
      title: '隐私说明',
      content: '上传的照片仅用于完成本次图片生成。微信头像与昵称仅在你主动授权后才会保存到账号资料中。',
      showCancel: false
    })
  }
})
