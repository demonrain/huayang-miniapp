const api = require('../../utils/api')

Page({
  data: {
    templateId: '',
    template: null,
    files: [],
    busy: false,
    maxFiles: 6,
    totalCost: 0
  },

  async onLoad(query) {
    this.setData({ templateId: query.templateId || '' })
    try {
      await getApp().ensureSession()
      const { templates } = await api.get('/api/templates')
      const template = templates.find(item => item.id === this.data.templateId)
      if (!template) throw new Error('模板不存在或已下架')
      this.setData({ template })
    } catch (error) {
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

  async generate() {
    if (!this.data.files.length || this.data.busy) return
    const user = getApp().globalData.user
    if (user && user.credits < this.data.totalCost) {
      wx.showModal({
        title: '积分不够了',
        content: `本次需要 ${this.data.totalCost} 积分，去充值后即可继续。`,
        confirmText: '去充值',
        success: result => {
          if (result.confirm) wx.switchTab({ url: '/pages/wallet/index' })
        }
      })
      return
    }

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
        clientRequestId: `${Date.now()}-${Math.random().toString(36).slice(2)}`
      })
      getApp().setUser(nextUser)
      wx.hideLoading()
      wx.redirectTo({ url: `/pages/job/index?id=${job.id}` })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '提交失败', content: error.message, showCancel: false })
      this.setData({ busy: false })
    }
  }
})
