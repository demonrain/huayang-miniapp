const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')

const CATEGORY_LABELS = {
  portrait: '人像',
  life: '生活',
  pet: '宠物',
  art: '艺术'
}

Page({
  data: {
    templateId: '',
    template: null,
    samples: [],
    categoryLabel: '',
    displayTags: [],
    popularityText: '',
    credits: null,
    navSpacer: 176
  },

  async onLoad(query) {
    this.setData({
      ...getNavMetrics(),
      templateId: query.id || query.templateId || ''
    })
    await this.loadTemplate()
  },

  onShow() {
    const user = getApp().globalData.user
    if (user) this.setData({ credits: user.credits })
  },

  async loadTemplate() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const { templates } = await api.get('/api/templates')
      const template = templates.find(item => item.id === this.data.templateId)
      if (!template) throw new Error('模板不存在或已下架')

      const samples = this.buildSamples(template, templates)
      const tags = Array.isArray(template.tags) ? [...template.tags] : []
      if (template.badge && !tags.includes(template.badge)) tags.unshift(template.badge)
      const defaults = ['保留五官', '高清输出']
      for (const tag of defaults) {
        if (tags.length >= 4) break
        if (!tags.includes(tag)) tags.push(tag)
      }

      this.setData({
        template,
        samples,
        categoryLabel: CATEGORY_LABELS[template.category] || template.category || '风格',
        displayTags: tags.slice(0, 5),
        popularityText: template.popularity >= 10000
          ? `${(template.popularity / 10000).toFixed(1)}万`
          : String(template.popularity || 0),
        credits: app.isLoggedIn() ? (user?.credits ?? null) : null
      })
    } catch (error) {
      wx.showModal({
        title: '无法打开模板',
        content: error.message,
        showCancel: false,
        success: () => wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) })
      })
    }
  },

  buildSamples(current, templates) {
    const samples = []
    const pushSample = (item, key) => {
      if (!item || samples.some(sample => sample.key === key)) return
      samples.push({
        key,
        name: item.shortName || item.name || '',
        coverUrl: item.coverUrl || '',
        palette: item.palette || 'linear-gradient(145deg, #f2c5cc, #e9f7f2)'
      })
    }

    pushSample(current, `self-${current.id}`)

    const sameCategory = templates.filter(item => item.id !== current.id && item.category === current.category)
    const others = templates.filter(item => item.id !== current.id && item.category !== current.category)
    for (const item of [...sameCategory, ...others]) {
      if (samples.length >= 3) break
      pushSample(item, item.id)
    }

    while (samples.length < 3) {
      samples.push({
        key: `placeholder-${samples.length}`,
        name: current.shortName || '参考',
        coverUrl: current.coverUrl || '',
        palette: current.palette || 'linear-gradient(145deg, #f2c5cc, #e9f7f2)'
      })
    }

    return samples.slice(0, 3)
  },

  previewCover() {
    const template = this.data.template
    if (!template?.coverUrl) return
    wx.previewImage({ current: template.coverUrl, urls: [template.coverUrl] })
  },

  previewSample(event) {
    const url = event.currentTarget.dataset.url
    if (!url) return
    const urls = this.data.samples.map(item => item.coverUrl).filter(Boolean)
    if (!urls.length) return
    wx.previewImage({ current: url, urls })
  },

  async useStyle() {
    if (!this.data.template) return
    try {
      await getApp().requireLogin('登录后即可使用该风格创作')
      wx.navigateTo({
        url: `/pages/create/index?templateId=${encodeURIComponent(this.data.template.id)}`
      })
    } catch (error) {}
  }
})
