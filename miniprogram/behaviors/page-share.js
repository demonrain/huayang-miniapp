/**
 * 开启右上角「转发」「分享到朋友圈」
 * 页面可实现 getPageShareConfig() 覆盖标题/路径/封面
 */
const DEFAULT_TITLE = '花漾相绘 · 把日常画成花漾模样'
const DEFAULT_PATH = '/pages/home/index'

function resolveShareConfig(page) {
  if (page && typeof page.getPageShareConfig === 'function') {
    try {
      return page.getPageShareConfig() || {}
    } catch (error) {
      return {}
    }
  }
  return {}
}

module.exports = Behavior({
  pageLifetimes: {
    show() {
      if (typeof wx.showShareMenu !== 'function') return
      // withShareTicket:true 会导致分享卡片在微信会话里无法长按二次转发
      wx.showShareMenu({
        withShareTicket: false,
        menus: ['shareAppMessage', 'shareTimeline']
      })
      if (typeof wx.updateShareMenu === 'function') {
        wx.updateShareMenu({ withShareTicket: false })
      }
    }
  },
  methods: {
    onShareAppMessage() {
      const custom = resolveShareConfig(this)
      return {
        title: custom.title || DEFAULT_TITLE,
        path: custom.path || DEFAULT_PATH,
        imageUrl: custom.imageUrl || ''
      }
    },
    onShareTimeline() {
      const custom = resolveShareConfig(this)
      return {
        title: custom.title || DEFAULT_TITLE,
        query: custom.query || '',
        imageUrl: custom.imageUrl || ''
      }
    }
  }
})
