const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

const TYPES = [
  { id: 'problem', name: '问题反馈', desc: '功能异常、卡顿、展示错误等' },
  { id: 'feature', name: '功能建议', desc: '希望增加或改进的体验' },
  { id: 'template_request', name: '请求新模板', desc: '想要的新风格，可上传参考图' }
]

Page({
  data: {
    navSpacer: 176,
    credits: null,
    tab: 'compose', // compose | history
    types: TYPES,
    type: 'problem',
    content: '',
    files: [],
    maxFiles: 6,
    submitting: false,
    needImages: false,
    history: [],
    historyLoading: false,
    historyLoaded: false
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  async onShow() {
    const user = getApp().globalData.user
    if (user) this.setData({ credits: user.credits })
    if (this.data.tab === 'history') {
      await this.loadHistory()
    }
  },

  switchTab(event) {
    const tab = event.currentTarget.dataset.tab
    if (!tab || tab === this.data.tab) return
    this.setData({ tab })
    if (tab === 'history') this.loadHistory()
  },

  selectType(event) {
    const type = event.currentTarget.dataset.id
    this.setData({
      type,
      needImages: type === 'template_request'
    })
  },

  onContentInput(event) {
    this.setData({ content: String(event.detail.value || '').slice(0, 800) })
  },

  chooseImages() {
    const remain = this.data.maxFiles - this.data.files.length
    if (remain <= 0) return
    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      sizeType: ['compressed'],
      success: ({ tempFiles }) => {
        const next = tempFiles.map(file => ({ path: file.tempFilePath, size: file.size }))
        this.setData({ files: this.data.files.concat(next) })
      }
    })
  },

  removeImage(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.setData({
      files: this.data.files.filter((_, i) => i !== index)
    })
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.path
    wx.previewImage({
      current,
      urls: this.data.files.map(item => item.path)
    })
  },

  previewHistoryImage(event) {
    const urls = event.currentTarget.dataset.urls || []
    const current = event.currentTarget.dataset.url
    if (!urls.length) return
    wx.previewImage({ current: current || urls[0], urls })
  },

  async loadHistory() {
    try {
      await getApp().requireLogin('登录后可查看反馈记录')
    } catch (error) {
      return
    }
    this.setData({ historyLoading: true })
    try {
      const result = await api.get('/api/feedbacks')
      const list = Array.isArray(result.feedbacks) ? result.feedbacks : []
      this.setData({
        history: list.map(item => ({
          ...item,
          imageUrls: (item.images || []).map(img => img.url || img.thumbUrl).filter(Boolean),
          statusClass: item.status === 'replied' ? 'is-replied' : 'is-pending'
        })),
        historyLoaded: true,
        historyLoading: false
      })
    } catch (error) {
      this.setData({ historyLoading: false, historyLoaded: true })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  async submit() {
    if (this.data.submitting) return
    try {
      await getApp().requireLogin('登录后才能提交反馈')
    } catch (error) {
      return
    }

    const content = String(this.data.content || '').trim()
    if (!content) {
      wx.showToast({ title: '请填写反馈内容', icon: 'none' })
      return
    }
    if (this.data.type === 'template_request' && !this.data.files.length && content.length < 8) {
      wx.showToast({ title: '请补充描述或上传参考图', icon: 'none' })
      return
    }

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中', mask: true })
    try {
      const assetIds = []
      for (let i = 0; i < this.data.files.length; i += 1) {
        wx.showLoading({ title: `上传图片 ${i + 1}/${this.data.files.length}`, mask: true })
        const { asset } = await api.upload(this.data.files[i].path)
        assetIds.push(asset.id)
      }
      wx.showLoading({ title: '提交反馈', mask: true })
      const result = await api.post('/api/feedbacks', {
        type: this.data.type,
        content,
        assetIds
      })
      wx.hideLoading()
      // Modal stays until user taps OK (toast disappears too fast)
      await new Promise(resolve => {
        wx.showModal({
          title: '提交成功',
          content: result.message || '感谢反馈，我们会认真查看。可在「我的反馈」中查看进度与官方回复。',
          showCancel: false,
          confirmText: '知道了',
          success: () => resolve(),
          fail: () => resolve()
        })
      })
      this.setData({
        content: '',
        files: [],
        type: 'problem',
        needImages: false,
        tab: 'history',
        historyLoaded: false
      })
      await this.loadHistory()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '提交失败', icon: 'none', duration: 2500 })
    } finally {
      this.setData({ submitting: false })
    }
  }
})
