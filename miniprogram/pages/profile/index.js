const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    user: null,
    stats: null,
    avatarUrl: '',
    nickname: '',
    avatarInitial: '画',
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
        this.setData({ user: null, stats: null })
        return
      }
      const { user, stats } = await api.get('/api/profile')
      app.setUser(user)
      this.setData({
        user,
        stats,
        avatarUrl: user.avatarUrl || '',
        nickname: user.nickname || '',
        avatarInitial: (user.nickname || '画').slice(0, 1)
      })
    } catch (error) {
      if (error.statusCode === 401) {
        this.setData({ user: null, stats: null })
        return
      }
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可管理个人资料与作品数据')
      this.loadProfile()
    } catch (error) {}
  },

  async chooseAvatar(event) {
    try {
      await getApp().requireLogin('登录后可设置头像')
    } catch (error) {
      return
    }
    this.setData({ avatarUrl: event.detail.avatarUrl })
    this.saveProfile({ avatarUrl: event.detail.avatarUrl })
  },

  nicknameInput(event) {
    this.setData({ nickname: event.detail.value })
  },

  async nicknameBlur() {
    if (!this.data.user) return
    const nickname = this.data.nickname.trim()
    if (nickname && nickname !== this.data.user.nickname) this.saveProfile({ nickname })
  },

  async saveProfile(changes) {
    try {
      await getApp().requireLogin('登录后可更新资料')
      let payload = changes
      if (changes.avatarUrl?.startsWith('wxfile://') || changes.avatarUrl?.startsWith('http://tmp/')) {
        const { asset } = await api.upload(changes.avatarUrl)
        payload = { avatarAssetId: asset.id }
      }
      const { user } = await api.patch('/api/me', payload)
      getApp().setUser(user)
      this.setData({
        user,
        avatarUrl: user.avatarUrl || this.data.avatarUrl,
        nickname: user.nickname,
        avatarInitial: (user.nickname || '画').slice(0, 1)
      })
      wx.showToast({ title: '已更新', icon: 'success' })
    } catch (error) {
      if (error.code === 'LOGIN_CANCELLED') return
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  openHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '选择风格后上传清晰照片即可生成。任务失败时积分会自动退回；如遇支付问题，请保留订单信息联系客服。',
      showCancel: false
    })
  },

  openPrivacy() {
    wx.showModal({
      title: '隐私说明',
      content: '上传的照片仅用于完成本次图片生成。生产上线前请在微信公众平台配置并发布正式隐私保护指引。',
      showCancel: false
    })
  }
})
