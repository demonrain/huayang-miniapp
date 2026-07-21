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

  goCreate() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})
