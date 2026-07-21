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
      nickname: nickname === '微信用户' ? '' : nickname,
      avatarInitial: (nickname && nickname !== '微信用户' ? nickname : '画').slice(0, 1),
      profileComplete: Boolean(user.profileComplete)
    })
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可管理个人资料与作品数据')
      await this.loadProfile()
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
    await this.saveProfile({ avatarUrl }, { silent: false })
  },

  nicknameInput(event) {
    this.setData({ nickname: event.detail.value })
  },

  nicknameReview(event) {
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

  async saveProfile(changes, options = {}) {
    try {
      await getApp().requireLogin('登录后可更新资料')
      let payload = { ...changes }
      const avatarUrl = changes.avatarUrl || ''
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
      if (!options.silent) {
        wx.showToast({ title: '资料已更新', icon: 'success' })
      }
    } catch (error) {
      if (error.code === 'LOGIN_CANCELLED') return
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  openHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '1. 在首页选择风格\n2. 上传 1–6 张清晰照片\n3. 消耗积分生成作品（约 2–5 分钟）\n\n失败任务积分会自动退回。头像请点圆形按钮授权微信头像，昵称请点输入框使用微信昵称（微信要求用户主动授权，无法静默获取）。',
      showCancel: false
    })
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index?type=privacy' })
  },

  openUserAgreement() {
    wx.navigateTo({ url: '/pages/privacy/index?type=agreement' })
  }
})
