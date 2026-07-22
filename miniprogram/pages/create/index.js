const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    templateId: '',
    template: null,
    files: [],
    busy: false,
    maxFiles: 6,
    totalCost: 0,
    credits: null,
    navSpacer: 176,
    subscribeEnabled: false,
    subscribeTemplateId: ''
  },

  async onLoad(query) {
    this.setData({ ...getNavMetrics(), templateId: query.templateId || '' })
    try {
      const app = getApp()
      let user = await app.ensureSession()
      if (!app.isLoggedIn()) {
        user = await app.requireLogin('登录后即可上传照片并开始创作')
      }
      const [{ templates }, config] = await Promise.all([
        api.get('/api/templates'),
        api.get('/api/config')
      ])
      const template = templates.find(item => item.id === this.data.templateId)
      if (!template) throw new Error('模板不存在或已下架')
      this.setData({
        template,
        credits: user?.credits ?? null,
        subscribeEnabled: Boolean(config.subscribeEnabled && config.subscribeTemplateId),
        subscribeTemplateId: config.subscribeTemplateId || ''
      })
    } catch (error) {
      if (error.code === 'LOGIN_CANCELLED') {
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) })
        return
      }
      wx.showModal({ title: '无法开始创作', content: error.message, showCancel: false })
    }
  },

  chooseImages() {
    const count = this.data.maxFiles - this.data.files.length
    wx.chooseMedia({
      count,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        const next = tempFiles.map(file => ({ path: file.tempFilePath, size: file.size }))
        const files = this.data.files.concat(next)
        this.setData({ files, totalCost: files.length * this.data.template.cost })
      }
    })
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = this.data.files.filter((_, itemIndex) => itemIndex !== index)
    this.setData({ files, totalCost: files.length * this.data.template.cost })
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.path
    wx.previewImage({ current, urls: this.data.files.map(file => file.path) })
  },

  /** Ask user to allow one-shot subscribe message for job completion push. */
  requestNotifyPermission() {
    const templateId = this.data.subscribeTemplateId
    if (!this.data.subscribeEnabled || !templateId) {
      return Promise.resolve(false)
    }
    return new Promise(resolve => {
      wx.requestSubscribeMessage({
        tmplIds: [templateId],
        success(res) {
          resolve(res[templateId] === 'accept')
        },
        fail() {
          resolve(false)
        }
      })
    })
  },

  async generate() {
    if (!this.data.files.length || this.data.busy) return
    try {
      await getApp().requireLogin('登录后即可生成作品')
    } catch (error) {
      return
    }
    const user = getApp().globalData.user
    if (user && user.credits < this.data.totalCost) {
      wx.showModal({
        title: '积分不够了',
        content: `本次需要 ${this.data.totalCost} 积分。可到「我的」领取每日签到积分。`,
        confirmText: '去我的',
        success: result => {
          if (result.confirm) wx.switchTab({ url: '/pages/profile/index' })
        }
      })
      return
    }

    // Must call subscribe API while still in a user gesture context
    const notify = await this.requestNotifyPermission()

    this.setData({ busy: true })
    wx.showLoading({ title: '正在上传', mask: true })
    try {
      const assetIds = []
      for (let index = 0; index < this.data.files.length; index += 1) {
        wx.showLoading({ title: `上传 ${index + 1}/${this.data.files.length}`, mask: true })
        const { asset } = await api.upload(this.data.files[index].path)
        assetIds.push(asset.id)
      }
      wx.showLoading({ title: '提交创作', mask: true })
      const { job, user: nextUser } = await api.post('/api/jobs', {
        templateId: this.data.templateId,
        assetIds,
        notify,
        clientRequestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`
      })
      getApp().setUser(nextUser)
      this.setData({ credits: nextUser?.credits ?? this.data.credits })
      wx.hideLoading()
      wx.redirectTo({ url: `/pages/job/index?id=${job.id}` })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '提交失败', content: error.message, showCancel: false })
      this.setData({ busy: false })
    }
  }
})
