const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

const STATUS_TEXT = {
  queued: '正在排队',
  processing: '正在出图',
  succeeded: '作品完成',
  failed: '生成失败'
}

const WAITING_TIPS = [
  '大约 2–5 分钟就好，先去刷会儿手机也行',
  '画笔正在热身，颜料也在排队喝咖啡…',
  '完成后会发微信提醒，你先忙别的也没关系',
  'AI 在认真数你的睫毛，请再给它一点点耐心',
  '光影调色中：少一点滤镜感，多一点心动感',
  '正在给照片浇水施肥，马上就开花',
  '像素们正在手拉手换装，场面有点热闹',
  '大师在琢磨构图，灵感还在路上堵车',
  '好作品值得等待，就像花期总在不经意间到来',
  '后台小精灵加班中，结果出来会喊你一声',
  '正在把平凡瞬间酿成一点点魔法',
  'AI 说：再等我五秒…好吧可能是五十秒'
]

Page({
  data: {
    id: '',
    job: null,
    statusText: '',
    isWaiting: false,
    waitingTip: WAITING_TIPS[0],
    saving: false,
    share: null,
    sharing: false,
    showQr: false,
    credits: null,
    retrying: false,
    navSpacer: 176
  },

  onLoad(query) {
    this.setData({ ...getNavMetrics(), id: query.id })
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.tipIndex = 0
    this.loadJob()
  },

  onUnload() {
    this.clearTimers()
  },

  onHide() {
    // Keep polling while waiting so returning to the page feels up to date
  },

  clearTimers() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.tipTimer) {
      clearInterval(this.tipTimer)
      this.tipTimer = null
    }
  },

  startTipRotation() {
    if (this.tipTimer) return
    this.tipTimer = setInterval(() => {
      this.tipIndex = (this.tipIndex + 1) % WAITING_TIPS.length
      this.setData({ waitingTip: WAITING_TIPS[this.tipIndex] })
    }, 5000)
  },

  stopTipRotation() {
    if (this.tipTimer) {
      clearInterval(this.tipTimer)
      this.tipTimer = null
    }
  },

  async loadJob() {
    try {
      const app = getApp()
      let user = await app.ensureSession()
      if (!app.isLoggedIn()) {
        try {
          user = await app.requireLogin('登录后可查看生成进度与作品')
        } catch (error) {
          wx.switchTab({ url: '/pages/home/index' })
          return
        }
      }
      const { job } = await api.get(`/api/jobs/${this.data.id}`)
      const isWaiting = job.status === 'queued' || job.status === 'processing'
      this.setData({
        job,
        statusText: STATUS_TEXT[job.status] || '处理中',
        isWaiting,
        credits: user?.credits ?? getApp().globalData.user?.credits ?? null
      })

      if (isWaiting) {
        this.startTipRotation()
        if (this.pollTimer) clearTimeout(this.pollTimer)
        this.pollTimer = setTimeout(() => this.loadJob(), 2500)
      } else {
        this.stopTipRotation()
        if (this.pollTimer) {
          clearTimeout(this.pollTimer)
          this.pollTimer = null
        }
        if (job.status === 'succeeded') this.ensureShare()
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
      if (this.pollTimer) clearTimeout(this.pollTimer)
      this.pollTimer = setTimeout(() => this.loadJob(), 4000)
    }
  },

  preview(event) {
    const current = event.currentTarget.dataset.url
    wx.previewImage({ current, urls: this.data.job.results.map(item => item.url) })
  },

  previewOriginal(event) {
    const originals = this.data.job?.originals || []
    if (!originals.length) return
    const current = event.currentTarget.dataset.url
    wx.previewImage({
      current,
      urls: originals.map(item => item.url).filter(Boolean)
    })
  },

  onShareAppMessage() {
    return {
      title: this.data.share?.title || '来看看我用花漾相绘制作的作品',
      path: this.data.share?.path || '/pages/home/index',
      imageUrl: this.data.job?.results?.[0]?.url || ''
    }
  },

  onShareTimeline() {
    return {
      title: this.data.share?.title || '来看看我用花漾相绘制作的作品',
      query: this.data.share ? `token=${encodeURIComponent(this.data.share.token)}` : '',
      imageUrl: this.data.job?.results?.[0]?.url || ''
    }
  },

  async ensureShare() {
    if (this.data.share) return this.data.share
    if (!this.sharePromise) {
      this.sharePromise = api.post(`/api/jobs/${this.data.id}/share`, {})
        .then(({ share }) => {
          this.setData({ share })
          return share
        })
        .finally(() => { this.sharePromise = null })
    }
    return this.sharePromise
  },

  async saveAll() {
    if (this.data.saving) return
    this.setData({ saving: true })
    wx.showLoading({ title: '正在保存', mask: true })
    try {
      for (const result of this.data.job.results) {
        const tempFilePath = await this.download(result.url)
        await this.saveToAlbum(tempFilePath)
      }
      wx.hideLoading()
      wx.showToast({ title: `已保存 ${this.data.job.results.length} 张`, icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '保存失败', content: error.message || '请检查相册权限', showCancel: false })
    } finally {
      this.setData({ saving: false })
    }
  },

  async saveOne(event) {
    wx.showLoading({ title: '正在保存', mask: true })
    try {
      const tempFilePath = await this.download(event.currentTarget.dataset.url)
      await this.saveToAlbum(tempFilePath)
      wx.hideLoading()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
    }
  },

  async shareImage(event) {
    wx.showLoading({ title: '正在准备', mask: true })
    try {
      const url = event.currentTarget.dataset.url || this.data.job.results[0].url
      const tempFilePath = await this.download(url)
      wx.hideLoading()
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({ path: tempFilePath })
      } else {
        wx.previewImage({ current: url, urls: [url] })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '图片准备失败', icon: 'none' })
    }
  },

  async showQrCode() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成小程序码', mask: true })
    try {
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/qrcode`, {})
      wx.hideLoading()
      this.setData({ share, showQr: true })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '暂时无法生成', content: error.message, showCancel: false })
    } finally {
      this.setData({ sharing: false })
    }
  },

  hideQrCode() {
    this.setData({ showQr: false })
  },

  noop() {},

  async copyUrlLink() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成链接', mask: true })
    try {
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/url-link`, {})
      await new Promise((resolve, reject) => wx.setClipboardData({ data: share.urlLink, success: resolve, fail: reject }))
      wx.hideLoading()
      this.setData({ share })
      wx.showToast({ title: '链接已复制', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '暂时无法生成', content: error.message, showCancel: false })
    } finally {
      this.setData({ sharing: false })
    }
  },

  download(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({ url, success: result => resolve(result.tempFilePath), fail: reject })
    })
  },

  saveToAlbum(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({ filePath, success: resolve, fail: reject })
    })
  },

  createAgain() {
    wx.redirectTo({ url: `/pages/template/index?id=${this.data.job.templateId}` })
  },

  async retryJob() {
    const job = this.data.job
    if (!job || job.status !== 'failed' || this.data.retrying) return
    if (!job.templateId || !job.assetIds?.length) {
      wx.showToast({ title: '无法重试，请重新选图', icon: 'none' })
      return
    }

    this.setData({ retrying: true })
    wx.showLoading({ title: '重新提交', mask: true })
    try {
      await getApp().requireLogin('登录后可重试生成作品')
      let notify = false
      try {
        const config = await api.get('/api/config')
        if (config.subscribeEnabled && config.subscribeTemplateId) {
          notify = await new Promise(resolve => {
            wx.requestSubscribeMessage({
              tmplIds: [config.subscribeTemplateId],
              success: res => resolve(res[config.subscribeTemplateId] === 'accept'),
              fail: () => resolve(false)
            })
          })
        }
      } catch (error) {}

      const { job: nextJob, user } = await api.post('/api/jobs', {
        templateId: job.templateId,
        assetIds: job.assetIds,
        notify,
        clientRequestId: `retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
      if (user) getApp().setUser(user)
      wx.hideLoading()
      wx.redirectTo({ url: `/pages/job/index?id=${nextJob.id}` })
    } catch (error) {
      wx.hideLoading()
      if (error.code === 'LOGIN_CANCELLED') return
      wx.showModal({ title: '重试失败', content: error.message || '请稍后重试', showCancel: false })
    } finally {
      this.setData({ retrying: false })
    }
  },

  goWorks() {
    wx.switchTab({ url: '/pages/history/index' })
  },

  goHome() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
