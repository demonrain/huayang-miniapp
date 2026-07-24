const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

function emptyStats() {
  return { completedJobs: 0, generatedImages: 0 }
}

function buildCheckinView(checkin) {
  if (!checkin) {
    return {
      checkinInfo: null,
      checkinTitle: '每日花签',
      checkinSub: '登录后可领取今日积分',
      checkinBtnText: '加载中',
      checkinDone: false,
      checkinReady: false
    }
  }
  const claimed = Boolean(checkin.claimedToday)
  const reward = Number(checkin.reward) || 0
  return {
    checkinInfo: checkin,
    checkinTitle: claimed ? '今日花签已领取' : '每日花签',
    checkinSub: claimed ? '明天再来收集新的灵感' : `今天可领取 ${reward} 积分`,
    checkinBtnText: claimed ? '已签到' : `+${reward} 领取`,
    checkinDone: claimed,
    checkinReady: true
  }
}

Page({
  data: {
    user: null,
    stats: emptyStats(),
    avatarUrl: '',
    nickname: '',
    avatarInitial: '画',
    profileComplete: false,
    checking: false,
    checkinInfo: null,
    checkinTitle: '每日花签',
    checkinSub: '今天可领取积分',
    checkinBtnText: '加载中',
    checkinDone: false,
    checkinReady: false,
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
        this.setData({
          user: null,
          stats: emptyStats(),
          profileComplete: false,
          ...buildCheckinView(null)
        })
        return
      }

      // Load profile first (critical path); wallet only for check-in status
      const { user, stats } = await api.get('/api/profile')
      app.setUser(user)
      this.applyUser(user, stats)

      try {
        const wallet = await api.get('/api/wallet')
        this.setData(buildCheckinView(wallet.checkin || null))
      } catch (error) {
        // Keep page usable even if wallet/check-in fails
        this.setData(buildCheckinView({ reward: 3, claimedToday: false }))
      }
    } catch (error) {
      if (error.statusCode === 401) {
        this.setData({
          user: null,
          stats: emptyStats(),
          profileComplete: false,
          ...buildCheckinView(null)
        })
        return
      }
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  applyUser(user, stats) {
    const nickname = user.nickname || ''
    this.setData({
      user,
      stats: stats || this.data.stats || emptyStats(),
      avatarUrl: user.avatarUrl || '',
      nickname: nickname === '微信用户' ? '' : nickname,
      avatarInitial: (nickname && nickname !== '微信用户' ? nickname : '画').slice(0, 1),
      profileComplete: Boolean(user.profileComplete)
    })
  },

  /**
   * Intentional login from profile guest panel.
   * Call getUserProfile first while the button tap gesture is still valid,
   * then create session and auto-fill avatar/nickname when WeChat returns them.
   */
  async doLogin() {
    const app = getApp()
    if (app.isLoggedIn()) {
      await this.loadProfile()
      return
    }
    await app.ensureSession()
    if (app.isLoggedIn()) {
      await this.loadProfile()
      return
    }

    // Must request profile in the same user gesture as the login button
    const profile = await app.getUserProfileIfAvailable()

    wx.showLoading({ title: '登录中', mask: true })
    try {
      const user = await app.login()
      let next = user
      if (profile) {
        next = (await app.applyWechatProfile(profile)) || user
      }
      wx.hideLoading()
      if (next && next.profileComplete) {
        wx.showToast({ title: '登录成功', icon: 'success' })
      } else {
        wx.showToast({ title: '登录成功，请完善资料', icon: 'none', duration: 2200 })
      }
      app.maybePromptProfileSetup(next)
      await this.loadProfile()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '登录失败', icon: 'none' })
    }
  },

  async chooseAvatar(event) {
    try {
      await getApp().requireLogin('登录后可设置头像')
    } catch (error) {
      return
    }
    const avatarUrl = event.detail && event.detail.avatarUrl
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

  async saveProfile(changes, options) {
    options = options || {}
    try {
      await getApp().requireLogin('登录后可更新资料')
      let payload = Object.assign({}, changes)
      const avatarUrl = changes.avatarUrl || ''
      const isLocalTemp =
        avatarUrl.indexOf('wxfile://') === 0 ||
        avatarUrl.indexOf('http://tmp/') === 0 ||
        avatarUrl.indexOf('http://usr/') === 0 ||
        (avatarUrl.indexOf('https://') === 0 && /\/tmp\//i.test(avatarUrl))
      if (isLocalTemp) {
        wx.showLoading({ title: '上传头像', mask: true })
        try {
          const result = await api.upload(avatarUrl)
          payload = { avatarAssetId: result.asset.id }
        } finally {
          wx.hideLoading()
        }
      }

      const result = await api.patch('/api/me', payload)
      getApp().setUser(result.user)
      this.applyUser(result.user)
      if (!options.silent) {
        wx.showToast({ title: '资料已更新', icon: 'success' })
      }
    } catch (error) {
      if (error.code === 'LOGIN_CANCELLED') return
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    }
  },

  async doCheckin() {
    if (this.data.checking || this.data.checkinDone) return
    try {
      await getApp().requireLogin('登录后可每日签到领取积分')
    } catch (error) {
      return
    }
    this.setData({ checking: true })
    try {
      const result = await api.post('/api/checkins', {})
      getApp().setUser(result.user)
      this.applyUser(result.user)
      this.setData(buildCheckinView({
        reward: result.reward,
        claimedToday: true
      }))
      wx.showToast({
        title: result.claimed ? `签到成功 +${result.reward}` : '今天已经签到',
        icon: 'success'
      })
    } catch (error) {
      wx.showToast({ title: error.message || '签到失败', icon: 'none' })
    } finally {
      this.setData({ checking: false })
    }
  },

  noop() {},

  goWorks() {
    wx.switchTab({ url: '/pages/history/index' })
  },

  goRedeem() {
    wx.navigateTo({ url: '/pages/redeem/index' })
  },

  goFeedback() {
    wx.navigateTo({ url: '/pages/feedback/index' })
  },

  openHelp() {
    wx.showModal({
      title: '使用帮助',
      content: '真实流程：首页选风格 → 上传 1–6 张照片 → 确认积分生成（约 2–5 分钟）。失败任务积分自动退回。\n\n可进入「模拟生图」使用本地示例照片走完整流程，不登录、不上传、不扣积分。',
      confirmText: '模拟生图',
      cancelText: '知道了',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/guide/index' })
        }
      }
    })
  },

  openPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/index?type=privacy' })
  },

  openUserAgreement() {
    wx.navigateTo({ url: '/pages/privacy/index?type=agreement' })
  }
})
