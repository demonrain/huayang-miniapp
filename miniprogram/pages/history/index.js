const api = require('../../utils/api')
const { relativeTime } = require('../../utils/format')

Page({
  data: { jobs: [], loading: true },

  onShow() {
    this.loadJobs()
  },

  async onPullDownRefresh() {
    await this.loadJobs()
    wx.stopPullDownRefresh()
  },

  async loadJobs() {
    try {
      await getApp().ensureSession()
      const { jobs } = await api.get('/api/jobs')
      this.setData({
        jobs: jobs.map(job => ({ ...job, relativeTime: relativeTime(job.createdAt) })),
        loading: false
      })
    } catch (error) {
      this.setData({ loading: false })
      wx.showToast({ title: error.message, icon: 'none' })
    }
  },

  openJob(event) {
    wx.navigateTo({ url: `/pages/job/index?id=${event.currentTarget.dataset.id}` })
  },

  goCreate() {
    wx.switchTab({ url: '/pages/home/index' })
  }
})

