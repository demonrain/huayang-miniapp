const api = require('../../utils/api')
const { relativeTime } = require('../../utils/format')
const { getNavMetrics } = require('../../utils/nav')

Page({
  data: {
    jobs: [],
    loading: true,
    user: null,
    isLoggedIn: false,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadJobs()
  },

  async onPullDownRefresh() {
    await this.loadJobs()
    wx.stopPullDownRefresh()
  },

  async loadJobs() {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const isLoggedIn = app.isLoggedIn()
      if (!isLoggedIn) {
        this.setData({
          user: null,
          isLoggedIn: false,
          jobs: [],
          loading: false
        })
        return
      }
      const { jobs } = await api.get('/api/jobs')
      this.setData({
        user,
        isLoggedIn: true,
        jobs: jobs.map(job => ({ ...job, relativeTime: relativeTime(job.createdAt) })),
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false, jobs: [] })
      if (error.statusCode !== 401) {
        wx.showToast({ title: error.message, icon: 'none' })
      }
    }
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可查看你的作品花园')
      this.loadJobs()
    } catch (error) {}
  },

  openJob(event) {
    wx.navigateTo({ url: `/pages/job/index?id=${event.currentTarget.dataset.id}` })
  },

  async deleteFailedJob(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '删除失败记录',
        content: '确定删除这条失败的作品记录吗？积分如已退回不会再次变动。',
        confirmText: '删除',
        confirmColor: '#c56f60',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    try {
      wx.showLoading({ title: '删除中', mask: true })
      await api.del(`/api/jobs/${id}`)
      wx.hideLoading()
      this.setData({ jobs: this.data.jobs.filter(item => item.id !== id) })
      wx.showToast({ title: '已删除', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '删除失败', icon: 'none' })
    }
  },

  goCreate() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
