const api = require('../../utils/api')
const { getNavMetrics } = require('../../utils/nav')
const {
  isDemoQuery,
  isDemoJobId,
  loadDemoJob,
  saveDemoJob,
  markOnboardingDone,
  delay
} = require('../../utils/demo')
const { etaStatusText, etaNoteText, waitingTipsForCount } = require('../../utils/eta')
const { recordJobFailure, isServiceUnstable } = require('../../utils/fail-guard')
const { ensureAlbumPermission, saveImageToAlbum, hideLoadingQuiet } = require('../../utils/album')

const STATUS_TEXT = {
  queued: '正在排队',
  processing: '正在出图',
  succeeded: '作品完成',
  failed: '生成失败'
}

const FAIL_MESSAGES = [
  '小精灵打了个瞌睡，这回没能完成魔法。',
  '颜料桶翻车了，作品还在酝酿中。',
  '灵感堵车啦，这次没赶上末班车。',
  '画笔休息了一会儿，再试一次也许就开花。'
]

Page({
  data: {
    id: '',
    job: null,
    statusText: '',
    isWaiting: false,
    waitingTip: '',
    waitingTips: [],
    etaStatus: '预计 2–5 分钟',
    etaNote: '',
    failMessage: FAIL_MESSAGES[0],
    serviceUnstable: false,
    saving: false,
    share: null,
    sharing: false,
    showQr: false,
    credits: null,
    retrying: false,
    deleting: false,
    shareRewards: null,
    shareFriendTip: '',
    shareTimelineTip: '',
    shareFriendCredits: 0,
    shareTimelineCredits: 0,
    shareFriendRemaining: null,
    shareTimelineRemaining: null,
    shareRewardEnabled: false,
    navSpacer: 176,
    demo: false,
    showcase: false,
    isOwner: false,
    publicShareEnabled: false,
    publicShareShowOriginals: false,
    publicShareSaving: false,
    galleryPublishCredits: 0,
    galleryLikeLikerCredits: 0,
    galleryLikeAuthorCredits: 0,
    avatarMaking: false,
    avatarShape: 'square',
    likeCount: 0,
    likedByMe: false,
    liking: false,
    authorId: '',
    authorNickname: '',
    authorWorks: []
  },

  onLoad(query) {
    const demo = isDemoQuery(query) || isDemoJobId(query.id)
    const showcase = String(query.showcase || '') === '1' || String(query.showcase || '') === 'true'
    this.setData({ ...getNavMetrics(), id: query.id, demo, showcase })
    this.tipIndex = 0
    this.shareRewardLocks = {}
    if (demo) {
      this.runDemoJob()
      return
    }
    if (showcase) {
      // Banner / public deep-link: published jobs only
      this.loadShowcaseJob()
      return
    }
    wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.loadJob()
    this.loadShareRewardConfig()
    this.loadGalleryRewardTips()
  },

  onUnload() {
    this._demoCancelled = true
    this.clearTimers()
  },

  onHide() {
    // Keep polling while waiting so returning to the page feels up to date
  },

  clearTimers() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    if (this.tipTimer) {
      clearInterval(this.tipTimer)
      this.tipTimer = null
    }
    if (this.demoTimers) {
      this.demoTimers.forEach(id => {
        clearTimeout(id)
        clearInterval(id)
      })
      this.demoTimers = []
    }
  },

  /**
   * Practice mode: reuse real job UI, simulate queued → processing → succeeded.
   * Fake results are the template cover (stored on demo job).
   */
  async runDemoJob() {
    this._demoCancelled = false
    this.demoTimers = []
    const job = loadDemoJob(this.data.id)
    if (!job) {
      wx.showModal({
        title: '练习会话已失效',
        content: '请从新手练习重新选一个风格再试。',
        showCancel: false,
        success: () => wx.navigateTo({
          url: '/pages/guide/index',
          fail: () => wx.switchTab({ url: '/pages/home/index' })
        })
      })
      return
    }

    const apply = (next) => {
      if (this._demoCancelled || !next) return
      const isWaiting = next.status === 'queued' || next.status === 'processing'
      this.setData({
        job: next,
        statusText: STATUS_TEXT[next.status] || '处理中',
        isWaiting,
        credits: getApp().globalData.user?.credits ?? null,
        share: null,
        shareRewardEnabled: false,
        shareFriendTip: '',
        shareTimelineTip: ''
      })
      if (isWaiting) this.startTipRotation()
      else this.stopTipRotation()
      saveDemoJob(next)
    }

    apply({ ...job, status: 'queued', results: [] })
    await delay(900)
    if (this._demoCancelled) return

    const mid = loadDemoJob(this.data.id) || job
    apply({ ...mid, status: 'processing', results: [] })
    await delay(2200)
    if (this._demoCancelled) return

    const latest = loadDemoJob(this.data.id) || job
    apply({
      ...latest,
      status: 'succeeded',
      results: latest._pendingResults || []
    })
    markOnboardingDone()
    wx.showToast({ title: '演示完成', icon: 'success' })
  },

  applyEta(count) {
    const n = Math.max(1, Number(count) || 1)
    const tips = waitingTipsForCount(n)
    this.waitingTips = tips
    this.tipIndex = 0
    this.setData({
      etaStatus: etaStatusText(n),
      etaNote: etaNoteText(n),
      waitingTips: tips,
      waitingTip: tips[0]
    })
  },

  startTipRotation() {
    if (this.tipTimer) return
    this.tipTimer = setInterval(() => {
      const tips = this.waitingTips || this.data.waitingTips || []
      if (!tips.length) return
      this.tipIndex = (this.tipIndex + 1) % tips.length
      this.setData({ waitingTip: tips[this.tipIndex] })
    }, 5000)
  },

  stopTipRotation() {
    if (this.tipTimer) {
      clearInterval(this.tipTimer)
      this.tipTimer = null
    }
  },

  async loadShowcaseJob() {
    try {
      const app = getApp()
      // Soft session for credit pill + likedByMe / isOwner
      try { await app.ensureSession() } catch (e) {}
      const result = await api.get(`/api/showcase/jobs/${this.data.id}`)
      const job = result.job
      const rewards = result.galleryRewards || {}
      const isOwner = Boolean(job.isOwner)
      this.setData({
        job,
        statusText: STATUS_TEXT[job.status] || '作品展示',
        isWaiting: false,
        credits: getApp().globalData.user?.credits ?? null,
        showcase: true,
        isOwner,
        shareRewardEnabled: false,
        publicShareEnabled: true,
        publicShareShowOriginals: Boolean(job.publicShareShowOriginals),
        likeCount: Number(job.likeCount || 0),
        likedByMe: Boolean(job.likedByMe),
        authorId: job.authorId || '',
        authorNickname: job.authorNickname || '',
        galleryLikeLikerCredits: Number(rewards.likeLikerCredits != null ? rewards.likeLikerCredits : this.data.galleryLikeLikerCredits),
        galleryLikeAuthorCredits: Number(rewards.likeAuthorCredits != null ? rewards.likeAuthorCredits : this.data.galleryLikeAuthorCredits)
      })
      this.loadAuthorWorks(job.authorId || '', job.id)
    } catch (error) {
      wx.showModal({
        title: '作品暂不可展示',
        content: error.message || '作者未公开此作品，或作品不存在',
        showCancel: false,
        success: () => wx.switchTab({ url: '/pages/home/index' })
      })
    }
  },

  async loadAuthorWorks(authorId, excludeId) {
    if (!authorId) {
      this.setData({ authorWorks: [] })
      return
    }
    try {
      const query = [
        `page=1`,
        `pageSize=12`,
        `authorId=${encodeURIComponent(authorId)}`,
        `exclude=${encodeURIComponent(excludeId || '')}`
      ].join('&')
      const result = await api.get(`/api/gallery?${query}`)
      const items = (result.items || []).slice(0, 12)
      this.setData({ authorWorks: items })
    } catch (error) {
      this.setData({ authorWorks: [] })
    }
  },

  openAuthorWork(event) {
    const id = event.currentTarget.dataset.id
    if (!id || id === this.data.id) return
    wx.redirectTo({ url: `/pages/job/index?id=${encodeURIComponent(id)}&showcase=1` })
  },

  async onShowcaseLike() {
    if (!this.data.showcase || this.data.isOwner || this.data.liking || this.data.likedByMe) return
    const app = getApp()
    if (!app.isLoggedIn()) {
      try {
        await app.requireLogin('登录后可为作品点赞')
      } catch (error) {
        return
      }
    }
    this.setData({ liking: true })
    try {
      const result = await api.post(`/api/gallery/${encodeURIComponent(this.data.id)}/like`, {})
      if (result.user) {
        app.setUser(result.user)
        this.setData({ credits: result.user.credits })
      }
      this.setData({
        likedByMe: true,
        likeCount: Number(result.likeCount != null ? result.likeCount : (this.data.likeCount || 0) + 1),
        liking: false
      })
      wx.showToast({ title: result.message || '点赞成功', icon: 'none' })
    } catch (error) {
      this.setData({ liking: false })
      wx.showToast({ title: error.message || '点赞失败', icon: 'none' })
    }
  },

  async loadJob() {
    try {
      const app = getApp()
      let user = await app.ensureSession()
      if (!app.isLoggedIn()) {
        // Not logged in: try public view of published job
        await this.loadShowcaseJob()
        return
      }
      let job
      try {
        const result = await api.get(`/api/jobs/${this.data.id}`)
        job = result.job
      } catch (error) {
        // Other users / not owner → public showcase if author published
        if (error.statusCode === 404 || error.code === 'JOB_NOT_FOUND') {
          await this.loadShowcaseJob()
          return
        }
        throw error
      }
      const isWaiting = job.status === 'queued' || job.status === 'processing'
      const count = (job.assetIds && job.assetIds.length) || 1
      this.applyEta(count)

      const patch = {
        job,
        statusText: STATUS_TEXT[job.status] || '处理中',
        isWaiting,
        credits: user?.credits ?? getApp().globalData.user?.credits ?? null,
        showcase: false,
        isOwner: true,
        publicShareEnabled: Boolean(job.publicShareEnabled),
        publicShareShowOriginals: Boolean(job.publicShareShowOriginals)
      }

      if (job.status === 'failed') {
        // Record once per job id to avoid poll double-counting
        if (this._failRecordedFor !== job.id) {
          this._failRecordedFor = job.id
          recordJobFailure()
        }
        const unstable = isServiceUnstable()
        patch.serviceUnstable = unstable
        patch.failMessage = unstable
          ? '小花瓣有点累了，服务可能暂时不稳定。'
          : FAIL_MESSAGES[Math.abs(String(job.id).length) % FAIL_MESSAGES.length]
      }

      this.setData(patch)

      if (isWaiting) {
        this.startTipRotation()
        if (this.pollTimer) clearTimeout(this.pollTimer)
        this.pollTimer = setTimeout(() => this.loadJob(), 2500)
      } else {
        this.stopTipRotation()
        if (this.pollTimer) {
          clearTimeout(this.pollTimer)
          this.pollTimer = null
        }
        if (job.status === 'succeeded') this.ensureShare()
      }
    } catch (error) {
      wx.showToast({ title: error.message, icon: 'none' })
      if (this.pollTimer) clearTimeout(this.pollTimer)
      this.pollTimer = setTimeout(() => this.loadJob(), 4000)
    }
  },

  onPublicShareToggle(event) {
    const enabled = Boolean(event.detail.value)
    // If turning off, also clear originals display preference for API
    const showOriginals = enabled ? Boolean(this.data.publicShareShowOriginals) : false
    this.setData({ publicShareEnabled: enabled })
    this.savePublicShare({ enabled, showOriginals })
  },

  onPublicShareOriginalsToggle(event) {
    const showOriginals = Boolean(event.detail.value)
    this.setData({ publicShareShowOriginals: showOriginals })
    if (!this.data.publicShareEnabled) return
    this.savePublicShare({ enabled: true, showOriginals })
  },

  async loadGalleryRewardTips() {
    try {
      const config = await api.get('/api/config')
      const sr = config.shareRewards || {}
      this.setData({
        galleryPublishCredits: Number(sr.galleryPublishCredits || 0),
        galleryLikeLikerCredits: Number(sr.galleryLikeLikerCredits || 0),
        galleryLikeAuthorCredits: Number(sr.galleryLikeAuthorCredits || 0)
      })
    } catch (error) {}
  },

  async savePublicShare(overrides = {}) {
    if (this.data.publicShareSaving || this.data.demo || this.data.showcase) return
    const enabled = overrides.enabled != null ? Boolean(overrides.enabled) : Boolean(this.data.publicShareEnabled)
    const showOriginals = overrides.showOriginals != null
      ? Boolean(overrides.showOriginals)
      : Boolean(this.data.publicShareShowOriginals)
    const prevEnabled = Boolean(this.data.job && this.data.job.publicShareEnabled)
    const prevOriginals = Boolean(this.data.job && this.data.job.publicShareShowOriginals)
    this.setData({ publicShareSaving: true })
    try {
      const result = await api.post(`/api/jobs/${this.data.id}/public-share`, {
        enabled,
        showOriginals: enabled ? showOriginals : false
      })
      const job = result.job || this.data.job
      if (result.user) getApp().setUser(result.user)
      const rewards = result.galleryRewards || {}
      this.setData({
        job: { ...this.data.job, ...job },
        publicShareEnabled: Boolean(job.publicShareEnabled),
        publicShareShowOriginals: Boolean(job.publicShareShowOriginals),
        publicShareSaving: false,
        credits: result.user?.credits ?? this.data.credits,
        galleryPublishCredits: Number(rewards.publishCredits != null ? rewards.publishCredits : this.data.galleryPublishCredits),
        galleryLikeLikerCredits: Number(rewards.likeLikerCredits != null ? rewards.likeLikerCredits : this.data.galleryLikeLikerCredits),
        galleryLikeAuthorCredits: Number(rewards.likeAuthorCredits != null ? rewards.likeAuthorCredits : this.data.galleryLikeAuthorCredits)
      })
      wx.showToast({
        title: result.message || (enabled ? '已分享到花海' : '已取消分享'),
        icon: 'none',
        duration: 2600
      })
    } catch (error) {
      // Revert switch UI on failure
      this.setData({
        publicShareSaving: false,
        publicShareEnabled: prevEnabled,
        publicShareShowOriginals: prevOriginals
      })
      wx.showToast({ title: error.message || '保存失败', icon: 'none' })
    }
  },

  preview(event) {
    // Preview loads full-resolution originals; list shows thumbnails first
    const current = event.currentTarget.dataset.url
    const urls = this.data.job.results.map(item => item.url).filter(Boolean)
    wx.previewImage({ current: current || urls[0], urls })
  },

  previewOriginal(event) {
    const originals = this.data.job?.originals || []
    if (!originals.length) return
    const current = event.currentTarget.dataset.url
    wx.previewImage({
      current,
      urls: originals.map(item => item.url).filter(Boolean)
    })
  },

  async loadShareRewardConfig() {
    try {
      const config = await api.get('/api/config')
      const shareRewards = config.shareRewards || null
      let friendRemaining = null
      let timelineRemaining = null
      try {
        const me = await api.get('/api/share-rewards/me')
        if (me && me.today) {
          friendRemaining = me.today.friendRemaining
          timelineRemaining = me.today.timelineRemaining
        }
        if (me && me.shareRewards) {
          // Prefer live settings from authenticated endpoint
          Object.assign(shareRewards || {}, me.shareRewards)
        }
      } catch (error) {}
      this.applyShareRewardTips(shareRewards, friendRemaining, timelineRemaining)
    } catch (error) {}
  },

  applyShareRewardTips(shareRewards, friendRemaining, timelineRemaining) {
    const enabled = Boolean(shareRewards && shareRewards.shareRewardEnabled)
    const friendCredits = enabled ? Number(shareRewards.shareFriendCredits || 0) : 0
    const timelineCredits = enabled ? Number(shareRewards.shareTimelineCredits || 0) : 0
    const fRem = friendRemaining == null ? null : Number(friendRemaining)
    const tRem = timelineRemaining == null ? null : Number(timelineRemaining)

    let shareFriendTip = ''
    let shareTimelineTip = ''
    if (enabled && friendCredits > 0) {
      shareFriendTip = fRem == null
        ? `本次分享好友可获得 ${friendCredits} 积分`
        : `本次分享好友可获得 ${friendCredits} 积分 · 今日还可 ${fRem} 次`
    }
    if (enabled && timelineCredits > 0) {
      shareTimelineTip = tRem == null
        ? `本次分享朋友圈可获得 ${timelineCredits} 积分`
        : `本次分享朋友圈可获得 ${timelineCredits} 积分 · 今日还可 ${tRem} 次`
    }
    this.setData({
      shareRewards,
      shareRewardEnabled: enabled,
      shareFriendCredits: friendCredits,
      shareTimelineCredits: timelineCredits,
      shareFriendRemaining: fRem,
      shareTimelineRemaining: tRem,
      shareFriendTip,
      shareTimelineTip
    })
  },

  onShareAppMessage() {
    this.claimShareReward('friend')
    const share = this.data.share
    return {
      title: (share && share.title) || '来看看我用花漾相绘制作的作品',
      path: (share && share.path) || '/pages/home/index',
      imageUrl: (this.data.job && this.data.job.results && this.data.job.results[0] && this.data.job.results[0].url) || ''
    }
  },

  onShareTimeline() {
    this.claimShareReward('timeline')
    const share = this.data.share
    return {
      title: (share && share.title) || '来看看我用花漾相绘制作的作品',
      query: share ? `token=${encodeURIComponent(share.token)}` : '',
      imageUrl: (this.data.job && this.data.job.results && this.data.job.results[0] && this.data.job.results[0].url) || ''
    }
  },

  async claimShareReward(channel) {
    if (!this.data.id || !this.data.job || this.data.job.status !== 'succeeded') return
    if (this.shareRewardLocks[channel]) return
    this.shareRewardLocks[channel] = true
    try {
      await this.ensureShare()
      const result = await api.post('/api/share-rewards', {
        jobId: this.data.id,
        channel,
        clientRequestId: `share-${this.data.id}-${channel}-${Date.now()}`
      })
      if (result.user) {
        getApp().setUser(result.user)
        this.setData({ credits: result.user.credits })
      }
      // Refresh remaining counts for UI
      if (result.shareRewards || result.remainingToday != null) {
        const sr = result.shareRewards || this.data.shareRewards
        let fRem = this.data.shareFriendRemaining
        let tRem = this.data.shareTimelineRemaining
        if (channel === 'friend' && result.remainingToday != null) fRem = result.remainingToday
        if (channel === 'timeline' && result.remainingToday != null) tRem = result.remainingToday
        this.applyShareRewardTips(sr, fRem, tRem)
      }
      if (result.rewarded && result.reward > 0) {
        wx.showToast({ title: `分享成功 +${result.reward} 积分`, icon: 'success' })
      } else if (result.message && (result.reason === 'daily_limit' || result.reason === 'already_shared_job')) {
        wx.showToast({ title: result.message, icon: 'none' })
      }
    } catch (error) {
      // Share still works even if reward fails
    } finally {
      setTimeout(() => {
        this.shareRewardLocks[channel] = false
      }, 1500)
    }
  },

  async ensureShare() {
    if (this.data.share) return this.data.share
    if (!this.sharePromise) {
      this.sharePromise = api.post(`/api/jobs/${this.data.id}/share`, {})
        .then(({ share }) => {
          this.setData({ share })
          return share
        })
        .finally(() => { this.sharePromise = null })
    }
    return this.sharePromise
  },

  openAvatarCrop(event) {
    if (this.data.demo) {
      wx.showToast({ title: '练习模式不支持导出头像', icon: 'none' })
      return
    }
    const results = (this.data.job && this.data.job.results) || []
    const index = Number(event.currentTarget.dataset.index)
    const result = results[Number.isFinite(index) ? index : 0] || results[0]
    const url = result && (result.url || result.thumbUrl)
    if (!url) {
      wx.showToast({ title: '暂无可制作的图片', icon: 'none' })
      return
    }
    wx.navigateTo({
      url: `/pages/avatar-crop/index?url=${encodeURIComponent(url)}`
    })
  },

  async saveAll() {
    if (this.data.demo) {
      wx.showToast({ title: '练习结果无需保存', icon: 'none' })
      return
    }
    if (this.data.saving) return
    const results = (this.data.job && this.data.job.results) || []
    if (!results.length) {
      wx.showToast({ title: '暂无可保存的作品', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    try {
      // 1) Ask album permission first — must NOT sit under showLoading mask,
      //    otherwise system authorize dialog may not appear / user can't interact.
      await ensureAlbumPermission()

      // 2) Download + save each image
      wx.showLoading({ title: `保存中 0/${results.length}`, mask: true })
      let saved = 0
      for (let i = 0; i < results.length; i += 1) {
        const result = results[i]
        const url = result.url || result.thumbUrl
        if (!url) throw Object.assign(new Error('作品地址无效'), { code: 'SAVE_FAILED' })
        wx.showLoading({ title: `保存中 ${i + 1}/${results.length}`, mask: true })
        const tempFilePath = await this.download(url)
        // Permission already granted; still use helper for auth-retry edge cases
        await saveImageToAlbum(tempFilePath)
        saved += 1
      }
      hideLoadingQuiet()
      wx.showToast({ title: `已保存 ${saved} 张到相册`, icon: 'success' })
    } catch (error) {
      hideLoadingQuiet()
      wx.showModal({
        title: error.code === 'ALBUM_DENIED' ? '需要相册权限' : '保存失败',
        content: error.message || '请开启相册权限后重试',
        showCancel: false
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  async saveOne(event) {
    if (this.data.saving) return
    this.setData({ saving: true })
    try {
      await ensureAlbumPermission()
      wx.showLoading({ title: '正在保存', mask: true })
      const tempFilePath = await this.download(event.currentTarget.dataset.url)
      await saveImageToAlbum(tempFilePath)
      hideLoadingQuiet()
      wx.showToast({ title: '已保存到相册', icon: 'success' })
    } catch (error) {
      hideLoadingQuiet()
      wx.showModal({
        title: error.code === 'ALBUM_DENIED' ? '需要相册权限' : '保存失败',
        content: error.message || '请开启相册权限后重试',
        showCancel: false
      })
    } finally {
      this.setData({ saving: false })
    }
  },

  async shareImage(event) {
    wx.showLoading({ title: '正在准备', mask: true })
    try {
      const url = event.currentTarget.dataset.url || this.data.job.results[0].url
      const tempFilePath = await this.download(url)
      wx.hideLoading()
      if (wx.showShareImageMenu) {
        wx.showShareImageMenu({
          path: tempFilePath,
          success: () => this.claimShareReward('timeline'),
          fail: () => {}
        })
      } else {
        // Fallback: menu share to timeline still available via top-right; count as timeline intent
        this.claimShareReward('timeline')
        wx.previewImage({ current: url, urls: [url] })
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: '图片准备失败', icon: 'none' })
    }
  },

  async showQrCode() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成小程序码', mask: true })
    try {
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/qrcode`, {})
      wx.hideLoading()
      this.setData({ share, showQr: true })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '暂时无法生成', content: error.message, showCancel: false })
    } finally {
      this.setData({ sharing: false })
    }
  },

  hideQrCode() {
    this.setData({ showQr: false })
  },

  noop() {},

  async copyUrlLink() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成链接', mask: true })
    try {
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/url-link`, {})
      await new Promise((resolve, reject) => wx.setClipboardData({ data: share.urlLink, success: resolve, fail: reject }))
      wx.hideLoading()
      this.setData({ share })
      wx.showToast({ title: '链接已复制', icon: 'success' })
    } catch (error) {
      wx.hideLoading()
      wx.showModal({ title: '暂时无法生成', content: error.message, showCancel: false })
    } finally {
      this.setData({ sharing: false })
    }
  },

  download(url) {
    return new Promise((resolve, reject) => {
      if (!url) {
        reject(Object.assign(new Error('图片地址无效'), { code: 'SAVE_FAILED' }))
        return
      }
      wx.downloadFile({
        url,
        success: result => {
          if (result.statusCode && result.statusCode !== 200) {
            reject(Object.assign(new Error('图片下载失败，请检查网络'), { code: 'SAVE_FAILED' }))
            return
          }
          if (!result.tempFilePath) {
            reject(Object.assign(new Error('图片下载失败'), { code: 'SAVE_FAILED' }))
            return
          }
          resolve(result.tempFilePath)
        },
        fail: () => {
          reject(Object.assign(new Error('图片下载失败，请检查网络'), { code: 'SAVE_FAILED' }))
        }
      })
    })
  },

  createAgain() {
    const id = this.data.job && this.data.job.templateId
    if (!id) return
    const demoQ = this.data.demo ? '&demo=1' : ''
    wx.redirectTo({ url: `/pages/template/index?id=${encodeURIComponent(id)}${demoQ}` })
  },

  async retryJob() {
    const job = this.data.job
    if (!job || job.status !== 'failed' || this.data.retrying) return
    if (this.data.serviceUnstable) {
      const go = await new Promise(resolve => {
        wx.showModal({
          title: '服务可能不稳定',
          content: '短时间内多次生成失败，建议过段时间再试。仍要现在重试吗？',
          confirmText: '仍要重试',
          cancelText: '稍后再说',
          success: res => resolve(Boolean(res.confirm)),
          fail: () => resolve(false)
        })
      })
      if (!go) return
    }
    if (!job.templateId || !job.assetIds?.length) {
      wx.showToast({ title: '无法重试，请重新选图', icon: 'none' })
      return
    }

    this.setData({ retrying: true })
    wx.showLoading({ title: '重新提交', mask: true })
    try {
      await getApp().requireLogin('登录后可重试生成作品')
      let notify = false
      try {
        const config = await api.get('/api/config')
        if (config.subscribeEnabled && config.subscribeTemplateId) {
          notify = await new Promise(resolve => {
            wx.requestSubscribeMessage({
              tmplIds: [config.subscribeTemplateId],
              success: res => resolve(res[config.subscribeTemplateId] === 'accept'),
              fail: () => resolve(false)
            })
          })
        }
      } catch (error) {}

      const { job: nextJob, user } = await api.post('/api/jobs', {
        templateId: job.templateId,
        assetIds: job.assetIds,
        notify,
        clientRequestId: `retry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      })
      if (user) getApp().setUser(user)
      wx.hideLoading()
      wx.redirectTo({ url: `/pages/job/index?id=${nextJob.id}` })
    } catch (error) {
      wx.hideLoading()
      if (error.code === 'LOGIN_CANCELLED') return
      wx.showModal({ title: '重试失败', content: error.message || '请稍后重试', showCancel: false })
    } finally {
      this.setData({ retrying: false })
    }
  },

  async deleteFailedJob() {
    const job = this.data.job
    if (!job || job.status !== 'failed' || this.data.deleting) return
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '删除失败记录',
        content: '确定删除这条失败记录吗？积分如已退回不会再次变动。',
        confirmText: '删除',
        confirmColor: '#c56f60',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) return
    this.setData({ deleting: true })
    try {
      await api.del(`/api/jobs/${job.id}`)
      wx.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => wx.switchTab({ url: '/pages/history/index' }), 400)
    } catch (error) {
      wx.showToast({ title: error.message || '删除失败', icon: 'none' })
    } finally {
      this.setData({ deleting: false })
    }
  },

  goWorks() {
    if (this.data.demo) {
      wx.showToast({ title: '练习结果不写入作品库', icon: 'none' })
      return
    }
    wx.switchTab({ url: '/pages/history/index' })
  },

  goHome() {
    if (this.data.demo) markOnboardingDone()
    wx.switchTab({ url: '/pages/home/index' })
  }
})
