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
const pageShare = require('../../behaviors/page-share')

const STATUS_TEXT = {
  queued: '正在排队',
  processing: '正在出图',
  succeeded: '作品完成',
  partial: '部分完成',
  failed: '生成失败'
}

const FEEDBACK_OPTIONS = [
  { id: 'satisfied', name: '很满意' },
  { id: 'unlike_person', name: '不像本人' },
  { id: 'abnormal', name: '画面异常' },
  { id: 'style_mismatch', name: '风格不符' }
]

const FAIL_MESSAGES = [
  '小精灵打了个瞌睡，这回没能完成魔法。',
  '颜料桶翻车了，作品还在酝酿中。',
  '灵感堵车啦，这次没赶上末班车。',
  '画笔休息了一会儿，再试一次也许就开花。'
]

Page({
  behaviors: [pageShare],
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
    savingQr: false,
    credits: null,
    retrying: false,
    deleting: false,
    shareRewards: null,
    shareFriendTip: '',
    shareTimelineTip: '',
    shareOpenLine: '',
    shareLoginLine: '',
    shareFirstJobLine: '',
    shareFriendCredits: 0,
    shareTimelineCredits: 0,
    shareFriendRemaining: null,
    shareTimelineRemaining: null,
    shareRewardEnabled: false,
    shareShowOriginals: false,
    shareOriginalsSaving: false,
    sharingTimeline: false,
    showFriendShareConfirm: false,
    friendShareWithOriginals: false,
    friendShareDirect: false,
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
    authorAvatarUrl: '',
    authorBio: '',
    authorInitial: '花',
    authorWorks: [],
    showAuthorCard: false,
    feedbackOptions: FEEDBACK_OPTIONS,
    resultFeedbackMap: {}
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
    wx.showShareMenu({
      withShareTicket: false,
      menus: ['shareAppMessage', 'shareTimeline']
    })
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
        shareTimelineTip: '',
        shareOpenLine: '',
        shareLoginLine: '',
        shareFirstJobLine: ''
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
    const patch = {
      etaStatus: etaStatusText(n),
      etaNote: etaNoteText(n),
      waitingTips: tips
    }
    // 生成中会轮询 loadJob；若每次重置文案，轮播会永远卡在前一两句
    if (!this.tipTimer) {
      this.tipIndex = 0
      patch.waitingTip = tips[0] || ''
    } else if (tips.length) {
      this.tipIndex = (Number(this.tipIndex) || 0) % tips.length
    }
    this.setData(patch)
  },

  startTipRotation() {
    if (this.tipTimer) return
    if (!this.waitingTips || !this.waitingTips.length) {
      this.waitingTips = this.data.waitingTips || waitingTipsForCount(1)
    }
    if (!this.data.waitingTip && this.waitingTips.length) {
      this.tipIndex = 0
      this.setData({ waitingTip: this.waitingTips[0] })
    }
    this.tipTimer = setInterval(() => {
      const tips = this.waitingTips || this.data.waitingTips || []
      if (!tips.length) return
      this.tipIndex = ((Number(this.tipIndex) || 0) + 1) % tips.length
      this.setData({ waitingTip: tips[this.tipIndex] })
    }, 4200)
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
        authorAvatarUrl: job.authorAvatarUrl || '',
        authorBio: String(job.authorBio || '').trim(),
        authorInitial: this.authorInitialFrom(job.authorNickname),
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

  authorInitialFrom(nickname) {
    const name = String(nickname || '').trim()
    if (!name) return '花'
    return name.slice(0, 1)
  },

  openAuthorCard() {
    if (!this.data.showcase) return
    this.setData({ showAuthorCard: true })
  },

  closeAuthorCard() {
    this.setData({ showAuthorCard: false })
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
        await app.requireLogin('登录后可为作品送花')
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
        likeCount: Number(
          result.flowerCount != null
            ? result.flowerCount
            : (result.likeCount != null ? result.likeCount : (this.data.likeCount || 0) + 1)
        ),
        liking: false
      })
      wx.showToast({ title: result.message || '送花成功', icon: 'none' })
    } catch (error) {
      this.setData({ liking: false })
      wx.showToast({ title: error.message || '送花失败', icon: 'none' })
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

      const resultFeedbackMap = {}
      ;(job.myFeedbacks || []).forEach(item => {
        if (item && item.resultId) resultFeedbackMap[item.resultId] = item.rating
      })

      const patch = {
        job,
        statusText: STATUS_TEXT[job.status] || '处理中',
        isWaiting,
        credits: user?.credits ?? getApp().globalData.user?.credits ?? null,
        showcase: false,
        isOwner: true,
        publicShareEnabled: Boolean(job.publicShareEnabled),
        publicShareShowOriginals: Boolean(job.publicShareShowOriginals),
        likeCount: Number(job.flowerCount != null ? job.flowerCount : (job.likeCount || 0)),
        resultFeedbackMap
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
        if (job.status === 'succeeded' || job.status === 'partial') this.ensureShare()
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
    const shareOn = Boolean(shareRewards && shareRewards.shareRewardEnabled)
    const inviteOn = Boolean(shareRewards && shareRewards.inviteRewardEnabled !== false)
    const openCredits = shareOn ? Number(shareRewards.shareOpenCredits || 0) : 0
    const openDailyLimit = shareOn ? Number(shareRewards.shareOpenDailyLimit || 0) : 0
    const loginCredits = inviteOn ? Number(shareRewards.inviteLoginCredits || 0) : 0
    const firstJobCredits = inviteOn ? Number(shareRewards.inviteFirstJobCredits || 0) : 0
    const shareOpenLine = openCredits > 0
      ? `好友打开你的分享 → 奖励${openCredits}积分（每日${openDailyLimit}次）`
      : ''
    const shareLoginLine = loginCredits > 0
      ? `新用户完成注册 → 再奖励${loginCredits}积分`
      : ''
    const shareFirstJobLine = firstJobCredits > 0
      ? `新用户首次创作 → 再再奖励${firstJobCredits}积分`
      : ''
    const hasLines = Boolean(shareOpenLine || shareLoginLine || shareFirstJobLine)
    this.setData({
      shareRewards,
      shareRewardEnabled: hasLines,
      shareFriendCredits: 0,
      shareTimelineCredits: 0,
      shareFriendRemaining: friendRemaining == null ? null : Number(friendRemaining),
      shareTimelineRemaining: timelineRemaining == null ? null : Number(timelineRemaining),
      shareOpenLine,
      shareLoginLine,
      shareFirstJobLine,
      shareFriendTip: '',
      shareTimelineTip: ''
    })
  },

  onShareAppMessage() {
    // 延后关闭，避免同步销毁 open-type="share" 节点影响系统转发面板
    setTimeout(() => {
      this.setData({ showFriendShareConfirm: false, friendShareDirect: false })
    }, 200)
    this.claimShareReward('friend')
    const withOriginals = Object.prototype.hasOwnProperty.call(this, '_friendShareOriginals')
      ? Boolean(this._friendShareOriginals)
      : Boolean(this.data.shareShowOriginals)
    this._friendShareOriginals = withOriginals
    // 以 Promise 返回，确保分享记录的 showOriginals 先写好
    return Promise.resolve()
      .then(() => this.ensureShare({ showOriginals: withOriginals }))
      .then(share => {
        this.setData({ shareShowOriginals: withOriginals, share: share || this.data.share })
        return {
          title: (share && share.title) || '来看看我用花漾相绘制作的作品',
          path: (share && share.path) || `/pages/share/index?token=${encodeURIComponent((share && share.token) || '')}`,
          imageUrl: (this.data.job && this.data.job.results && this.data.job.results[0] && this.data.job.results[0].url) || ''
        }
      })
      .catch(() => {
        const share = this.data.share
        return {
          title: (share && share.title) || '来看看我用花漾相绘制作的作品',
          path: (share && share.path) || '/pages/home/index',
          imageUrl: (this.data.job && this.data.job.results && this.data.job.results[0] && this.data.job.results[0].url) || ''
        }
      })
  },

  hideFriendShareConfirm() {
    this.setData({ showFriendShareConfirm: false, friendShareDirect: false })
  },

  /** 发给好友：弹出原图选项，点选项即直接分享（不再二次确认） */
  async prepareFriendShare() {
    if (this.data.demo || this.data.showcase || this.data.shareOriginalsSaving) return
    try {
      if (!this.data.share) {
        wx.showLoading({ title: '准备分享', mask: true })
        await this.ensureShare()
        wx.hideLoading()
      }
      const hasOriginals = ((this.data.job && this.data.job.originals) || []).length > 0
      if (!hasOriginals) {
        // 无原图：直接进入系统分享（用一个隐藏的 open-type 按钮不优雅，这里仍用面板单按钮）
        this._friendShareOriginals = false
        this.setData({
          friendShareWithOriginals: false,
          shareShowOriginals: false,
          showFriendShareConfirm: true,
          friendShareDirect: true
        })
        return
      }
      this.setData({
        showFriendShareConfirm: true,
        friendShareDirect: false
      })
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '准备失败', icon: 'none' })
    }
  },

  onFriendShareChoice(event) {
    const withOriginals = String(event.currentTarget.dataset.originals || '') === '1'
    this._friendShareOriginals = withOriginals
    // 不在此处关面板，避免销毁 open-type="share" 按钮导致转发失败；由 onShareAppMessage 关闭
    this.setData({
      friendShareWithOriginals: withOriginals,
      shareShowOriginals: withOriginals
    })
  },

  onShareTimeline() {
    this.claimShareReward('timeline')
    const share = this.data.share
    const token = share && share.token
    return {
      title: (share && share.title) || '来看看我用花漾相绘制作的作品',
      query: token ? `token=${encodeURIComponent(token)}` : '',
      imageUrl: (this.data.job && this.data.job.results && this.data.job.results[0] && this.data.job.results[0].url) || ''
    }
  },

  /** 引导：真正的「小程序卡片进朋友圈」只能走右上角菜单 */
  guideShareTimeline() {
    const withOriginals = Boolean(this.data.shareShowOriginals)
    wx.showModal({
      title: '分享到朋友圈',
      content: withOriginals
        ? '请点击右上角「···」→「分享到朋友圈」。好友点开小程序后，可看到作品与原图对照。'
        : '请点击右上角「···」→「分享到朋友圈」，将以小程序形式分享给好友。',
      confirmText: '我知道了',
      showCancel: false
    })
  },

  loadImageForCanvas(canvas, src) {
    return new Promise((resolve, reject) => {
      const img = canvas.createImage()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = src
    })
  },

  roundRectPath(ctx, x, y, w, h, r) {
    const radius = Math.max(0, Math.min(r, w / 2, h / 2))
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.arcTo(x + w, y, x + w, y + h, radius)
    ctx.arcTo(x + w, y + h, x, y + h, radius)
    ctx.arcTo(x, y + h, x, y, radius)
    ctx.arcTo(x, y, x + w, y, radius)
    ctx.closePath()
  },

  drawCoverImage(ctx, img, x, y, w, h) {
    const iw = img.width || 1
    const ih = img.height || 1
    const scale = Math.max(w / iw, h / ih)
    const dw = iw * scale
    const dh = ih * scale
    const dx = x + (w - dw) / 2
    const dy = y + (h - dh) / 2
    ctx.drawImage(img, dx, dy, dw, dh)
  },

  /**
   * 朋友圈海报：产品风边框 + 作品图 +（可选）原图参照 + 小程序码
   * 微信朋友圈支持小程序码（普通二维码不行）
   */
  async buildMomentsShareImage(qrLocalPath) {
    if (typeof wx.createOffscreenCanvas !== 'function') {
      throw new Error('当前微信版本过低，请升级后重试')
    }
    const job = this.data.job || {}
    const results = job.results || []
    const originals = job.originals || []
    const resultUrl = results[0] && (results[0].url || results[0].thumbUrl)
    if (!resultUrl) throw new Error('暂无作品图')
    if (!qrLocalPath) throw new Error('小程序码未就绪')

    const showOriginals = Boolean(this.data.shareShowOriginals)
    const originalUrl = showOriginals && originals[0] && (originals[0].url || originals[0].thumbUrl)
    const [resultPath, originalPath] = await Promise.all([
      this.download(resultUrl),
      originalUrl ? this.download(originalUrl).catch(() => '') : Promise.resolve('')
    ])

    const width = 750
    const pad = 36
    const headerH = 118
    const framePad = 18
    const photoH = 720
    const compareH = originalPath ? 168 : 0
    const footerH = 210
    const height = pad + headerH + framePad * 2 + photoH + (compareH ? compareH + 20 : 0) + footerH + pad

    const canvas = wx.createOffscreenCanvas({ type: '2d', width, height })
    const ctx = canvas.getContext('2d')

    // 背景氛围
    const bg = ctx.createLinearGradient(0, 0, width, height)
    bg.addColorStop(0, '#fff7f4')
    bg.addColorStop(0.55, '#fff9f8')
    bg.addColorStop(1, '#f3faf6')
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    // 轻装饰圆
    ctx.fillStyle = 'rgba(231, 109, 130, 0.08)'
    ctx.beginPath()
    ctx.arc(80, 70, 90, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(94, 166, 143, 0.08)'
    ctx.beginPath()
    ctx.arc(width - 60, height - 80, 110, 0, Math.PI * 2)
    ctx.fill()

    // 主卡片
    const cardX = pad
    const cardY = pad
    const cardW = width - pad * 2
    const cardH = height - pad * 2
    this.roundRectPath(ctx, cardX, cardY, cardW, cardH, 28)
    ctx.fillStyle = 'rgba(255,255,255,0.92)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(234, 223, 216, 0.95)'
    ctx.lineWidth = 2
    ctx.stroke()

    // 顶栏品牌
    ctx.fillStyle = '#E76D82'
    ctx.font = '600 22px sans-serif'
    ctx.fillText('XIANGHUI  ·  花漾相绘', cardX + 32, cardY + 48)
    ctx.fillStyle = '#3d3438'
    ctx.font = 'bold 36px sans-serif'
    const title = String(job.templateName || '花漾作品').slice(0, 16)
    ctx.fillText(title, cardX + 32, cardY + 96)

    // 作品外框
    const frameX = cardX + 28
    const frameY = cardY + headerH
    const frameW = cardW - 56
    const frameH = photoH + framePad * 2
    this.roundRectPath(ctx, frameX, frameY, frameW, frameH, 22)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(231, 109, 130, 0.28)'
    ctx.lineWidth = 3
    ctx.stroke()

    // 内边装饰线
    this.roundRectPath(ctx, frameX + 8, frameY + 8, frameW - 16, frameH - 16, 16)
    ctx.strokeStyle = 'rgba(234, 223, 216, 0.9)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    const photoX = frameX + framePad
    const photoY = frameY + framePad
    const photoW = frameW - framePad * 2
    const resultImg = await this.loadImageForCanvas(canvas, resultPath)
    ctx.save()
    this.roundRectPath(ctx, photoX, photoY, photoW, photoH, 14)
    ctx.clip()
    this.drawCoverImage(ctx, resultImg, photoX, photoY, photoW, photoH)
    ctx.restore()

    let cursorY = frameY + frameH + 24
    if (originalPath) {
      const originalImg = await this.loadImageForCanvas(canvas, originalPath)
      const thumb = 120
      const labelX = frameX
      ctx.fillStyle = '#8a7a7e'
      ctx.font = '600 22px sans-serif'
      ctx.fillText('原图参照', labelX, cursorY + 22)

      const ox = labelX
      const oy = cursorY + 36
      this.roundRectPath(ctx, ox, oy, thumb, thumb, 14)
      ctx.fillStyle = '#efe8ea'
      ctx.fill()
      ctx.save()
      this.roundRectPath(ctx, ox, oy, thumb, thumb, 14)
      ctx.clip()
      this.drawCoverImage(ctx, originalImg, ox, oy, thumb, thumb)
      ctx.restore()

      ctx.fillStyle = '#a8989c'
      ctx.font = '20px sans-serif'
      ctx.fillText('长按小程序码可查看完整对照', ox + thumb + 20, oy + 68)
      cursorY = oy + thumb + 28
    }

    // 底栏：小程序码 + 文案
    const qrSize = 148
    const qrX = frameX
    const qrY = height - pad - 28 - qrSize
    const qrImg = await this.loadImageForCanvas(canvas, qrLocalPath)

    this.roundRectPath(ctx, qrX - 6, qrY - 6, qrSize + 12, qrSize + 12, 16)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = 'rgba(234, 223, 216, 0.95)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize)

    const textX = qrX + qrSize + 24
    ctx.fillStyle = '#3d3438'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('长按识别小程序码', textX, qrY + 52)
    ctx.fillStyle = '#8a7a7e'
    ctx.font = '22px sans-serif'
    ctx.fillText('查看完整作品 · 同款风格创作', textX, qrY + 92)
    ctx.fillStyle = '#E76D82'
    ctx.font = '600 20px sans-serif'
    ctx.fillText('花漾相绘', textX, qrY + 128)

    const temp = await new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        destWidth: width,
        destHeight: height,
        fileType: 'jpg',
        quality: 0.92,
        success: res => resolve(res.tempFilePath),
        fail: reject
      })
    })
    return temp
  },

  async claimShareReward(channel) {
    if (!this.data.id || !this.data.job) return
    if (!['succeeded', 'partial'].includes(this.data.job.status)) return
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
      if (result.shareRewards || result.remainingToday != null) {
        const sr = result.shareRewards || this.data.shareRewards
        this.applyShareRewardTips(sr, this.data.shareFriendRemaining, this.data.shareTimelineRemaining)
      }
      // 分享本身不再发分，静默记录即可
    } catch (error) {
      // Share still works even if reward fails
    } finally {
      setTimeout(() => {
        this.shareRewardLocks[channel] = false
      }, 1500)
    }
  },

  async ensureShare(options = {}) {
    const hasOverride = Object.prototype.hasOwnProperty.call(options, 'showOriginals')
    if (this.data.share && !hasOverride) return this.data.share

    // 带 showOriginals 的请求必须单独发出，不能复用进行中的空 payload 请求
    if (!hasOverride && this.sharePromise) return this.sharePromise

    const seq = (this._shareSeq = (this._shareSeq || 0) + 1)
    const showOriginals = hasOverride ? Boolean(options.showOriginals) : undefined
    const payload = hasOverride ? { showOriginals } : {}
    const promise = api.post(`/api/jobs/${this.data.id}/share`, payload)
      .then((result) => {
        const share = result && result.share
        if (seq !== this._shareSeq) return share
        if (hasOverride && Boolean(share && share.showOriginals) !== showOriginals) {
          throw new Error('原图分享设置未保存成功，请重试')
        }
        const patch = { share }
        if (hasOverride) {
          patch.shareShowOriginals = showOriginals
        } else if (!this.data.shareOriginalsSaving) {
          patch.shareShowOriginals = Boolean(share && share.showOriginals)
        }
        this.setData(patch)
        return share
      })
      .finally(() => {
        if (this.sharePromise === promise) this.sharePromise = null
      })

    this.sharePromise = promise
    return promise
  },

  async onShareOriginalsToggle(event) {
    const showOriginals = Boolean(event.detail.value)
    const prev = Boolean(this.data.shareShowOriginals)
    this.setData({ shareShowOriginals: showOriginals, shareOriginalsSaving: true })
    try {
      // 作废进行中的分享请求，避免旧响应用 false 盖掉开关
      this._shareSeq = (this._shareSeq || 0) + 1
      this.sharePromise = null
      await this.ensureShare({ showOriginals })
      this.setData({ shareShowOriginals: showOriginals })
      wx.showToast({
        title: showOriginals ? '好友将看到原图对照' : '好友仅看生成效果',
        icon: 'none'
      })
    } catch (error) {
      this.setData({ shareShowOriginals: prev })
      wx.showToast({ title: error.message || '设置失败', icon: 'none' })
    } finally {
      this.setData({ shareOriginalsSaving: false })
    }
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

  async shareImage() {
    if (this.data.sharingTimeline) return
    this.setData({ sharingTimeline: true })
    wx.showLoading({ title: '正在生成海报', mask: true })
    try {
      const showOriginals = Boolean(this.data.shareShowOriginals)
      // 确保分享记录 + 小程序码就绪（朋友圈海报需要码）
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/qrcode`, { showOriginals })
      this.setData({
        share,
        shareShowOriginals: Boolean(share && share.showOriginals)
      })
      if (!share || !share.token) throw new Error('分享未就绪')
      if (!share.qrcodeUrl) throw new Error('小程序码生成失败')

      const qrLocalPath = await this.download(share.qrcodeUrl)
      const tempFilePath = await this.buildMomentsShareImage(qrLocalPath)
      wx.hideLoading()

      const entrancePath = `/pages/share/index?token=${encodeURIComponent(share.token)}`
      if (typeof wx.showShareImageMenu === 'function') {
        wx.showShareImageMenu({
          path: tempFilePath,
          needShowEntrance: true,
          entrancePath,
          success: () => this.claimShareReward('timeline'),
          fail: () => this.guideShareTimeline()
        })
      } else {
        this.guideShareTimeline()
      }
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '海报准备失败', icon: 'none' })
    } finally {
      this.setData({ sharingTimeline: false })
    }
  },

  async showQrCode() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成小程序码', mask: true })
    try {
      // 生成码时再次同步「展示原图」，避免开关只改了本地、码对应的分享记录仍是关闭
      const showOriginals = Boolean(this.data.shareShowOriginals)
      const { share } = await api.post(`/api/jobs/${this.data.id}/share/qrcode`, { showOriginals })
      wx.hideLoading()
      this.setData({
        share,
        shareShowOriginals: Boolean(share && share.showOriginals),
        showQr: true
      })
      if (showOriginals && !(share && share.showOriginals)) {
        wx.showToast({ title: '原图分享未生效，请重试开关', icon: 'none' })
      }
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

  onQrLongPress() {
    // show-menu-by-longpress handles system menu; toast as soft hint
    wx.showToast({ title: '可选择转发或保存', icon: 'none' })
  },

  async saveQrCode() {
    const url = this.data.share && this.data.share.qrcodeUrl
    if (!url || this.data.savingQr) return
    this.setData({ savingQr: true })
    try {
      await ensureAlbumPermission()
      wx.showLoading({ title: '保存中', mask: true })
      const tempFilePath = await this.download(url)
      if (wx.showShareImageMenu) {
        hideLoadingQuiet()
        wx.showShareImageMenu({
          path: tempFilePath,
          fail: async () => {
            try {
              await saveImageToAlbum(tempFilePath)
              wx.showToast({ title: '已保存到相册', icon: 'success' })
            } catch (error) {
              wx.showToast({ title: error.message || '保存失败', icon: 'none' })
            }
          }
        })
      } else {
        await saveImageToAlbum(tempFilePath)
        hideLoadingQuiet()
        wx.showToast({ title: '已保存到相册', icon: 'success' })
      }
    } catch (error) {
      hideLoadingQuiet()
      wx.showModal({
        title: error.code === 'ALBUM_DENIED' ? '需要相册权限' : '保存失败',
        content: error.message || '请开启相册权限后重试',
        showCancel: false
      })
    } finally {
      this.setData({ savingQr: false })
    }
  },

  noop() {},

  async copyUrlLink() {
    if (this.data.sharing) return
    this.setData({ sharing: true })
    wx.showLoading({ title: '生成链接', mask: true })
    try {
      const result = await api.post(`/api/jobs/${this.data.id}/share/url-link`, {})
      const share = result.share || {}
      const text = share.urlLink || result.fallbackText || ''
      if (!text) throw new Error(result.message || '暂时无法生成链接')
      await new Promise((resolve, reject) => wx.setClipboardData({ data: text, success: resolve, fail: reject }))
      wx.hideLoading()
      this.setData({ share })
      wx.showToast({
        title: share.urlLink ? '链接已复制' : '已复制打开方式',
        icon: 'none',
        duration: 2200
      })
      if (!share.urlLink && result.message) {
        setTimeout(() => {
          wx.showModal({
            title: '外链权限未开通',
            content: result.message,
            showCancel: false
          })
        }, 400)
      }
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

  async submitResultFeedback(event) {
    if (this.data.demo || this.data.showcase) return
    const resultId = event.currentTarget.dataset.resultId
    const rating = event.currentTarget.dataset.rating
    if (!resultId || !rating) return
    try {
      await api.post(`/api/jobs/${this.data.id}/result-feedbacks`, { resultId, rating })
      const map = Object.assign({}, this.data.resultFeedbackMap)
      map[resultId] = rating
      this.setData({ resultFeedbackMap: map })
      wx.showToast({ title: '感谢反馈', icon: 'success' })
    } catch (error) {
      wx.showToast({ title: error.message || '提交失败', icon: 'none' })
    }
  },

  async retryFailedImages() {
    const job = this.data.job
    if (!job || !['partial', 'failed'].includes(job.status) || this.data.retrying) return
    if (!(job.failures || []).length && job.status === 'partial') {
      wx.showToast({ title: '没有失败项', icon: 'none' })
      return
    }
    this.setData({ retrying: true })
    wx.showLoading({ title: '重试失败项', mask: true })
    try {
      await getApp().requireLogin('登录后可重试')
      const result = await api.post(`/api/jobs/${this.data.id}/retry-failed`, {})
      if (result.user) getApp().setUser(result.user)
      wx.hideLoading()
      wx.showToast({ title: '已重新提交', icon: 'success' })
      this.loadJob()
    } catch (error) {
      wx.hideLoading()
      wx.showToast({ title: error.message || '重试失败', icon: 'none' })
    } finally {
      this.setData({ retrying: false })
    }
  },

  async retryJob() {
    const job = this.data.job
    if (!job || this.data.retrying) return
    // Prefer partial retry when failures exist
    if ((job.status === 'partial' || job.status === 'failed') && (job.failures || []).length) {
      return this.retryFailedImages()
    }
    if (job.status !== 'failed') return
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
