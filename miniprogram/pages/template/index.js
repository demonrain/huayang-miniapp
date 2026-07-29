const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')
const { isDemoQuery } = require('../../utils/demo')
const pageShare = require('../../behaviors/page-share')

const CATEGORY_LABELS = {
  portrait: '人像',
  life: '生活',
  pet: '宠物',
  art: '艺术'
}

function formatPromoEndText(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = n => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

Page({
  behaviors: [pageShare],
  data: {
    templateId: '',
    template: null,
    samples: [],
    categoryLabel: '',
    displayTags: [],
    popularityText: '',
    promoEndText: '',
    credits: null,
    navSpacer: 176,
    demo: false,
    favorited: false
  },

  async onLoad(query) {
    this.setData({
      ...getNavMetrics(),
      templateId: query.id || query.templateId || '',
      demo: isDemoQuery(query)
    })
    await this.loadTemplate()
    this.touchRecent()
    this.checkFavorite()
  },

  onShow() {
    const user = getApp().globalData.user
    if (user) this.setData({ credits: user.credits })
  },

  getPageShareConfig() {
    const template = this.data.template
    if (!template || !template.id) return null
    return {
      title: `花漾相绘 · ${template.name || '风格分享'}`,
      path: `/pages/template/index?id=${encodeURIComponent(template.id)}`,
      query: `id=${encodeURIComponent(template.id)}`,
      imageUrl: template.coverFullUrl || template.coverUrl || ''
    }
  },

  async loadTemplate() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const { templates } = await api.get('/api/templates')
      const template = templates.find(item => item.id === this.data.templateId)
      if (!template) throw new Error('模板不存在或已下架')

      const samples = this.buildSamples(template)
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
        categoryLabel: (Array.isArray(template.categoryLabels) && template.categoryLabels.length
          ? template.categoryLabels.join(' · ')
          : (template.categoryLabel || CATEGORY_LABELS[template.category] || template.category || '风格')),
        displayTags: tags.slice(0, 5),
        popularityText: template.popularity >= 10000
          ? `${(template.popularity / 10000).toFixed(1)}万`
          : String(template.popularity || 0),
        promoEndText: formatPromoEndText(template.promoEndAt),
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

  buildSamples(current) {
    // Prefer admin-curated samples from job results
    const curated = Array.isArray(current.samples) ? current.samples.filter(item => item && (item.url || item.thumbUrl)) : []
    if (curated.length) {
      return curated.map((item, index) => ({
        key: item.id || `sample-${index}`,
        name: item.name || current.shortName || '效果参考',
        coverUrl: item.thumbUrl || item.url || '',
        coverFullUrl: item.url || item.thumbUrl || '',
        palette: current.palette || 'linear-gradient(145deg, #f2c5cc, #e9f7f2)'
      }))
    }
    // Fallback: only this template cover (no cross-template mix)
    if (current.coverUrl || current.coverFullUrl) {
      return [{
        key: `self-${current.id}`,
        name: current.shortName || current.name || '效果参考',
        coverUrl: current.coverUrl || current.coverFullUrl || '',
        coverFullUrl: current.coverFullUrl || current.coverUrl || '',
        palette: current.palette || 'linear-gradient(145deg, #f2c5cc, #e9f7f2)'
      }]
    }
    return []
  },

  previewCover() {
    const template = this.data.template
    if (!template) return
    const full = template.coverFullUrl || template.coverUrl
    if (!full) return
    wx.previewImage({ current: full, urls: [full] })
  },

  previewSample(event) {
    const url = event.currentTarget.dataset.url
    if (!url) return
    const urls = this.data.samples
      .map(item => item.coverFullUrl || item.coverUrl)
      .filter(Boolean)
    if (!urls.length) return
    wx.previewImage({ current: url, urls })
  },

  async useStyle() {
    if (!this.data.template) return
    const demoQ = this.data.demo ? '&demo=1' : ''
    if (this.data.demo) {
      wx.navigateTo({
        url: `/pages/create/index?templateId=${encodeURIComponent(this.data.template.id)}${demoQ}`
      })
      return
    }
    try {
      await getApp().requireLogin('登录后即可使用该风格创作')
      wx.navigateTo({
        url: `/pages/create/index?templateId=${encodeURIComponent(this.data.template.id)}`
      })
    } catch (error) {}
  },

  async touchRecent() {
    if (this.data.demo || !this.data.templateId) return
    if (!getApp().isLoggedIn()) return
    try {
      await api.post(`/api/templates/${encodeURIComponent(this.data.templateId)}/touch`, {})
    } catch (error) {}
  },

  async checkFavorite() {
    if (this.data.demo || !this.data.templateId || !getApp().isLoggedIn()) return
    try {
      const result = await api.get('/api/me/favorites/templates')
      const favorited = (result.templates || []).some(item => item.id === this.data.templateId)
      this.setData({ favorited })
    } catch (error) {}
  },

  async toggleFavorite() {
    if (this.data.demo || !this.data.templateId) return
    try {
      await getApp().requireLogin('登录后可收藏风格')
      if (this.data.favorited) {
        await api.del(`/api/me/favorites/templates/${encodeURIComponent(this.data.templateId)}`)
        this.setData({ favorited: false })
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      } else {
        await api.post(`/api/me/favorites/templates/${encodeURIComponent(this.data.templateId)}`, {})
        this.setData({ favorited: true })
        wx.showToast({ title: '已收藏', icon: 'success' })
      }
    } catch (error) {
      if (error.code !== 'LOGIN_CANCELLED') {
        wx.showToast({ title: error.message || '操作失败', icon: 'none' })
      }
    }
  }
})
