const api = require('../../utils/api')
const { relativeTime } = require('../../utils/format')
const { getNavMetrics } = require('../../utils/nav')

const PAGE_SIZE = 12

/**
 * Split jobs into two columns for waterfall layout.
 * Prefer shorter column; use a stable height estimate so layout
 * stays balanced across varied aspect ratios.
 */
function splitWaterfall(jobs) {
  const left = []
  const right = []
  let leftH = 0
  let rightH = 0
  ;(jobs || []).forEach((job, index) => {
    // Vary estimate so different statuses / positions don't stack equally
    const base = job.status === 'failed' ? 220 : 300
    const wobble = ((index * 37) % 90)
    const est = base + wobble
    if (leftH <= rightH) {
      left.push(job)
      leftH += est
    } else {
      right.push(job)
      rightH += est
    }
  })
  return { leftJobs: left, rightJobs: right }
}

Page({
  data: {
    jobs: [],
    leftJobs: [],
    rightJobs: [],
    loading: true,
    loadingMore: false,
    hasMore: false,
    page: 1,
    total: 0,
    listFooter: '',
    user: null,
    isLoggedIn: false,
    navSpacer: 176
  },

  onLoad() {
    this.setData(getNavMetrics())
  },

  onShow() {
    this.loadJobs({ reset: true })
  },

  async onPullDownRefresh() {
    await this.loadJobs({ reset: true })
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadMoreJobs()
  },

  footerText(count, hasMore) {
    if (!count) return ''
    if (hasMore) return '上拉加载更多'
    return '已经到底啦'
  },

  applyJobs(jobs, extra = {}) {
    const { leftJobs, rightJobs } = splitWaterfall(jobs)
    this.setData({
      jobs,
      leftJobs,
      rightJobs,
      ...extra
    })
  },

  async fetchJobsPage(page) {
    const query = [
      `page=${encodeURIComponent(String(page || 1))}`,
      `pageSize=${encodeURIComponent(String(PAGE_SIZE))}`
    ].join('&')
    const result = await api.get(`/api/jobs?${query}`)
    const jobs = (Array.isArray(result.jobs) ? result.jobs : []).map(job => ({
      ...job,
      relativeTime: relativeTime(job.createdAt),
      // List uses thumb only — avoid loading full-size results
      coverUrl: job.coverUrl
        || (job.results && job.results[0] && (job.results[0].thumbUrl || job.results[0].url))
        || ''
    }))
    const hasMore = typeof result.hasMore === 'boolean'
      ? result.hasMore
      : Number(result.page || page) < Number(result.pages || 1)
    return {
      jobs,
      page: Number(result.page) || page || 1,
      pages: Number(result.pages) || 1,
      total: Number(result.total) || jobs.length,
      hasMore
    }
  },

  async loadJobs({ reset = false } = {}) {
    try {
      const app = getApp()
      const user = await app.ensureSession()
      const isLoggedIn = app.isLoggedIn()
      if (!isLoggedIn) {
        this.setData({
          user: null,
          isLoggedIn: false,
          jobs: [],
          leftJobs: [],
          rightJobs: [],
          loading: false,
          loadingMore: false,
          hasMore: false,
          page: 1,
          total: 0,
          listFooter: ''
        })
        return
      }

      if (reset) {
        this.setData({ loading: true, hasMore: false, listFooter: '' })
      }

      const result = await this.fetchJobsPage(1)
      this.applyJobs(result.jobs, {
        user,
        isLoggedIn: true,
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
        loading: false,
        loadingMore: false,
        listFooter: this.footerText(result.jobs.length, result.hasMore)
      })
    } catch (error) {
      this.setData({
        loading: false,
        loadingMore: false,
        jobs: reset ? [] : this.data.jobs,
        leftJobs: reset ? [] : this.data.leftJobs,
        rightJobs: reset ? [] : this.data.rightJobs
      })
      if (error.statusCode !== 401) {
        wx.showToast({ title: error.message, icon: 'none' })
      }
    }
  },

  async loadMoreJobs() {
    if (!this.data.isLoggedIn || this.data.loading || this.data.loadingMore || !this.data.hasMore) {
      return
    }
    this.setData({ loadingMore: true, listFooter: '加载中…' })
    try {
      const nextPage = (this.data.page || 1) + 1
      const result = await this.fetchJobsPage(nextPage)
      const seen = new Set(this.data.jobs.map(item => item.id))
      const appended = result.jobs.filter(item => item && item.id && !seen.has(item.id))
      const jobs = this.data.jobs.concat(appended)
      this.applyJobs(jobs, {
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
        loadingMore: false,
        listFooter: this.footerText(jobs.length, result.hasMore)
      })
    } catch (error) {
      this.setData({
        loadingMore: false,
        listFooter: this.data.hasMore ? '加载失败，上拉重试' : this.footerText(this.data.jobs.length, false)
      })
      wx.showToast({ title: error.message || '加载失败', icon: 'none' })
    }
  },

  async doLogin() {
    try {
      await getApp().requireLogin('登录后可查看你的作品花园')
      this.loadJobs({ reset: true })
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
      const jobs = this.data.jobs.filter(item => item.id !== id)
      const total = Math.max(0, (this.data.total || jobs.length) - 1)
      this.applyJobs(jobs, {
        total,
        listFooter: this.footerText(jobs.length, this.data.hasMore)
      })
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
