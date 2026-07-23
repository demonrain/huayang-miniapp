const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')
const { isDemoQuery, buildDemoJob, saveDemoJob, delay } = require('../../utils/demo')
const { formatEtaRange, estimateRange } = require('../../utils/eta')

const DEMO_SAMPLE = { path: '/assets/demo/demo-photo.jpg', size: 0, demoSample: true }

Page({
  data: {
    templateId: '',
    template: null,
    files: [],
    busy: false,
    maxFiles: 6,
    totalCost: 0,
    etaHint: '',
    credits: null,
    navSpacer: 176,
    subscribeEnabled: false,
    subscribeTemplateId: '',
    demo: false
  },

  async onLoad(query) {
    const demo = isDemoQuery(query)
    this.setData({
      ...getNavMetrics(),
      templateId: query.templateId || '',
      demo
    })
    try {
      const app = getApp()
      let user = await app.ensureSession()
      if (!demo && !app.isLoggedIn()) {
        user = await app.requireLogin('登录后即可上传照片并开始创作')
      }
      const [{ templates }, config] = await Promise.all([
        api.get('/api/templates'),
        api.get('/api/config').catch(() => ({}))
      ])
      const template = templates.find(item => item.id === this.data.templateId)
      if (!template) throw new Error('模板不存在或已下架')
      const files = demo ? [DEMO_SAMPLE] : this.data.files
      const totalCost = demo ? Number(template.cost || 0) : this.data.totalCost
      this.setData({
        template,
        files,
        totalCost,
        etaHint: this.buildEtaHint(files.length),
        credits: app.isLoggedIn() ? (user?.credits ?? null) : null,
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

  buildEtaHint(count) {
    if (!count) return '每张大约 2–5 分钟'
    const { count: n } = estimateRange(count)
    if (n === 1) return `预计约 ${formatEtaRange(1)}（每张 2–5 分钟）`
    return `共 ${n} 张 · 预计约 ${formatEtaRange(n)}（每张 2–5 分钟）`
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
        const current = this.data.demo && this.data.files.every(file => file.demoSample) ? [] : this.data.files
        const files = current.concat(next)
        this.setData({
          files,
          totalCost: files.length * this.data.template.cost,
          etaHint: this.buildEtaHint(files.length)
        })
      }
    })
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index)
    const files = this.data.files.filter((_, itemIndex) => itemIndex !== index)
    this.setData({
      files,
      totalCost: files.length * this.data.template.cost,
      etaHint: this.buildEtaHint(files.length)
    })
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

  /** Practice path: same UI timing, local fake job, no upload/API. */
  async generateDemo() {
    this.setData({ busy: true })
    wx.showLoading({ title: '演示：准备提交', mask: true })
    try {
      await delay(500)
      for (let index = 0; index < this.data.files.length; index += 1) {
        wx.showLoading({ title: `演示上传 ${index + 1}/${this.data.files.length}`, mask: true })
        await delay(350)
      }
      wx.showLoading({ title: '演示提交创作', mask: true })
      await delay(450)
      const job = buildDemoJob({
        template: this.data.template,
        files: this.data.files
      })
      saveDemoJob(job)
      wx.hideLoading()
      wx.redirectTo({ url: `/pages/job/index?id=${encodeURIComponent(job.id)}&demo=1` })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '演示失败', content: error.message || '请重试', showCancel: false })
      this.setData({ busy: false })
    }
  },

  async generate() {
    if (!this.data.files.length || this.data.busy) return

    if (this.data.demo) {
      await this.generateDemo()
      return
    }

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
