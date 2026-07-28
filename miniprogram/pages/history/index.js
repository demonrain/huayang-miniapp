const api = require('../../utils/api')
const { relativeTime } = require('../../utils/format')
const { getNavMetrics } = require('../../utils/nav')

const PAGE_SIZE = 12

const STATUS_FILTERS = [
  { id: 'all', name: '全部' },
  { id: 'succeeded', name: '已完成' },
  { id: 'active', name: '生成中' },
  { id: 'failed', name: '失败' }
]

const DEFAULT_CATEGORIES = [
  { id: 'all', name: '全部' },
  { id: 'portrait', name: '人像' },
  { id: 'life', name: '生活' },
  { id: 'pet', name: '宠物' },
  { id: 'art', name: '艺术' }
]

const EMPTY_BY_STATUS = {
  all: { title: '还没有作品', sub: '选一个喜欢的风格，制作第一组照片', showCreate: true },
  succeeded: { title: '还没有已完成作品', sub: '完成出图后会出现在这里', showCreate: true },
  active: { title: '没有进行中的任务', sub: '排队或生成中的作品会出现在这里', showCreate: true },
  failed: { title: '没有失败记录', sub: '失败的任务可在这里查看并删除', showCreate: false }
}

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
    navSpacer: 176,
    statusFilters: STATUS_FILTERS,
    activeStatus: 'all',
    categories: DEFAULT_CATEGORIES,
    activeCategory: 'all',
    emptyTitle: EMPTY_BY_STATUS.all.title,
    emptySub: EMPTY_BY_STATUS.all.sub,
    emptyShowCreate: true
  },

  onLoad() {
    this.setData(getNavMetrics())
    this.loadCategories()
  },

  onShow() {
    this.loadJobs({ reset: true })
  },

  async onPullDownRefresh() {
    await Promise.all([this.loadCategories(), this.loadJobs({ reset: true })])
    wx.stopPullDownRefresh()
  },

  onReachBottom() {
    this.loadMoreJobs()
  },

  async loadCategories() {
    try {
      const config = await api.get('/api/config')
      const fromServer = Array.isArray(config.templateCategories) ? config.templateCategories : []
      const categories = [
        { id: 'all', name: '全部' },
        ...fromServer.map(item => ({ id: item.id, name: item.name }))
      ]
      if (categories.length > 1) this.setData({ categories })
    } catch (error) {
      // Keep fallback categories
    }
  },

  emptyCopy(status, category) {
    const base = EMPTY_BY_STATUS[status] || EMPTY_BY_STATUS.all
    if (!category || category === 'all') return base
    const cat = (this.data.categories || []).find(item => item.id === category)
    const name = (cat && cat.name) || '该分类'
    return {
      title: `还没有「${name}」作品`,
      sub: status === 'all'
        ? `试试其他分类，或去创作一款${name}风格`
        : `${base.sub}`,
      showCreate: base.showCreate
    }
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

  async fetchJobsPage(page, status, category) {
    const activeStatus = status || this.data.activeStatus || 'all'
    const activeCategory = category || this.data.activeCategory || 'all'
    const query = [
      `page=${encodeURIComponent(String(page || 1))}`,
      `pageSize=${encodeURIComponent(String(PAGE_SIZE))}`,
      `status=${encodeURIComponent(activeStatus)}`,
      `category=${encodeURIComponent(activeCategory)}`
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

  resetListState(extra = {}) {
    return {
      jobs: [],
      leftJobs: [],
      rightJobs: [],
      page: 1,
      total: 0,
      hasMore: false,
      listFooter: '',
      ...extra
    }
  },

  selectStatus(event) {
    const activeStatus = event.currentTarget.dataset.id || 'all'
    if (activeStatus === this.data.activeStatus) return
    const empty = this.emptyCopy(activeStatus, this.data.activeCategory)
    this.setData(this.resetListState({
      activeStatus,
      emptyTitle: empty.title,
      emptySub: empty.sub,
      emptyShowCreate: empty.showCreate
    }))
    this.loadJobs({ reset: true })
  },

  selectCategory(event) {
    const activeCategory = event.currentTarget.dataset.id || 'all'
    if (activeCategory === this.data.activeCategory) return
    const empty = this.emptyCopy(this.data.activeStatus, activeCategory)
    this.setData(this.resetListState({
      activeCategory,
      emptyTitle: empty.title,
      emptySub: empty.sub,
      emptyShowCreate: empty.showCreate
    }))
    this.loadJobs({ reset: true })
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

      const result = await this.fetchJobsPage(1, this.data.activeStatus, this.data.activeCategory)
      const empty = this.emptyCopy(this.data.activeStatus, this.data.activeCategory)
      this.applyJobs(result.jobs, {
        user,
        isLoggedIn: true,
        page: result.page,
        total: result.total,
        hasMore: result.hasMore,
        loading: false,
        loadingMore: false,
        listFooter: this.footerText(result.jobs.length, result.hasMore),
        emptyTitle: empty.title,
        emptySub: empty.sub,
        emptyShowCreate: empty.showCreate
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
      const result = await this.fetchJobsPage(nextPage, this.data.activeStatus, this.data.activeCategory)
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
