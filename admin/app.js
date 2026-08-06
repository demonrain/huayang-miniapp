function createPageQuery(extra = {}) {
  return {
    page: 1,
    pageSize: 10,
    total: 0,
    pages: 1,
    loading: false,
    ...extra
  }
}

const state = {
  token: sessionStorage.getItem('huayang_admin_token') || '',
  data: null,
  users: [],
  transactions: [],
  jobs: [],
  templates: [],
  userQuery: createPageQuery({ query: '', status: 'all' }),
  transactionQuery: createPageQuery({ query: '', type: 'all' }),
  jobQuery: createPageQuery({ query: '', status: 'all', share: 'all', feedback: 'all' }),
  feedbackQuery: createPageQuery({ type: 'all', status: 'all' }),
  cdkQuery: createPageQuery({ query: '', status: 'all' }),
  templateQuery: createPageQuery({
    query: '',
    status: 'all',
    category: 'all'
  }),
  editingTemplateId: '',
  coverTemplateId: '',
  editingBannerId: '',
  bannerImageId: '',
  editingCategoryId: '',
  creditUserId: '',
  feedbacks: [],
  replyingFeedbackId: '',
  editingCdkId: '',
  cdkListCache: [],
  editingAnnouncementId: '',
  announcementListCache: [],
  levels: [],
  userLevelsEnabled: false,
  campaignTemplateOptions: [],
  campaigns: [],
  editingCampaignId: ''
}

const elements = {
  loginView: document.querySelector('#loginView'),
  appView: document.querySelector('#appView'),
  loginForm: document.querySelector('#loginForm'),
  loginError: document.querySelector('#loginError'),
  password: document.querySelector('#password'),
  pageTitle: document.querySelector('#pageTitle'),
  statsGrid: document.querySelector('#statsGrid'),
  settingsForm: document.querySelector('#settingsForm'),
  shareRewardForm: document.querySelector('#shareRewardForm'),
  userRows: document.querySelector('#userRows'),
  userFilterForm: document.querySelector('#userFilterForm'),
  userPagerInfo: document.querySelector('#userPagerInfo'),
  userPrevPage: document.querySelector('#userPrevPage'),
  userNextPage: document.querySelector('#userNextPage'),
  userPageSize: document.querySelector('#userPageSize'),
  userJumpPage: document.querySelector('#userJumpPage'),
  userJumpBtn: document.querySelector('#userJumpBtn'),
  transactionRows: document.querySelector('#transactionRows'),
  transactionFilterForm: document.querySelector('#transactionFilterForm'),
  transactionPagerInfo: document.querySelector('#transactionPagerInfo'),
  transactionPrevPage: document.querySelector('#transactionPrevPage'),
  transactionNextPage: document.querySelector('#transactionNextPage'),
  transactionPageSize: document.querySelector('#transactionPageSize'),
  transactionJumpPage: document.querySelector('#transactionJumpPage'),
  transactionJumpBtn: document.querySelector('#transactionJumpBtn'),
  jobRows: document.querySelector('#jobRows'),
  jobFilterForm: document.querySelector('#jobFilterForm'),
  jobPagerInfo: document.querySelector('#jobPagerInfo'),
  jobPrevPage: document.querySelector('#jobPrevPage'),
  jobNextPage: document.querySelector('#jobNextPage'),
  jobPageSize: document.querySelector('#jobPageSize'),
  jobJumpPage: document.querySelector('#jobJumpPage'),
  jobJumpBtn: document.querySelector('#jobJumpBtn'),
  jobShareSelect: document.querySelector('#jobShareSelect'),
  jobShareChips: document.querySelector('#jobShareChips'),
  jobFilterPublic: document.querySelector('#jobFilterPublic'),
  jobSummaryHint: document.querySelector('#jobSummaryHint'),
  feedbackRows: document.querySelector('#feedbackRows'),
  feedbackFilterForm: document.querySelector('#feedbackFilterForm'),
  feedbackPagerInfo: document.querySelector('#feedbackPagerInfo'),
  feedbackPrevPage: document.querySelector('#feedbackPrevPage'),
  feedbackNextPage: document.querySelector('#feedbackNextPage'),
  feedbackPageSize: document.querySelector('#feedbackPageSize'),
  feedbackJumpPage: document.querySelector('#feedbackJumpPage'),
  feedbackJumpBtn: document.querySelector('#feedbackJumpBtn'),
  cdkPagerInfo: document.querySelector('#cdkPagerInfo'),
  cdkPrevPage: document.querySelector('#cdkPrevPage'),
  cdkNextPage: document.querySelector('#cdkNextPage'),
  cdkPageSize: document.querySelector('#cdkPageSize'),
  cdkJumpPage: document.querySelector('#cdkJumpPage'),
  cdkJumpBtn: document.querySelector('#cdkJumpBtn'),
  feedbackReplyDialog: document.querySelector('#feedbackReplyDialog'),
  feedbackReplyForm: document.querySelector('#feedbackReplyForm'),
  feedbackReplyTitle: document.querySelector('#feedbackReplyTitle'),
  feedbackReplyMeta: document.querySelector('#feedbackReplyMeta'),
  feedbackReplyPreview: document.querySelector('#feedbackReplyPreview'),
  feedbackReplyInput: document.querySelector('#feedbackReplyInput'),
  bannerRows: document.querySelector('#bannerRows'),
  bannerCarouselForm: document.querySelector('#bannerCarouselForm'),
  bannerEnabledHint: document.querySelector('#bannerEnabledHint'),
  templateRows: document.querySelector('#templateRows'),
  templateFilterForm: document.querySelector('#templateFilterForm'),
  templateFilterCategory: document.querySelector('#templateFilterCategory'),
  templatePagerInfo: document.querySelector('#templatePagerInfo'),
  templatePrevPage: document.querySelector('#templatePrevPage'),
  templateNextPage: document.querySelector('#templateNextPage'),
  templatePageSize: document.querySelector('#templatePageSize'),
  templateJumpPage: document.querySelector('#templateJumpPage'),
  templateJumpBtn: document.querySelector('#templateJumpBtn'),
  categoryRows: document.querySelector('#categoryRows'),
  packageList: document.querySelector('#packageList'),
  templateDialog: document.querySelector('#templateDialog'),
  templateDialogTitle: document.querySelector('#templateDialogTitle'),
  templateForm: document.querySelector('#templateForm'),
  templateCategorySelect: document.querySelector('#templateCategorySelect'),
  bannerDialog: document.querySelector('#bannerDialog'),
  bannerDialogTitle: document.querySelector('#bannerDialogTitle'),
  bannerForm: document.querySelector('#bannerForm'),
  bannerJumpType: document.querySelector('#bannerJumpType'),
  bannerJumpTemplateField: document.querySelector('#bannerJumpTemplateField'),
  bannerJumpTemplateId: document.querySelector('#bannerJumpTemplateId'),
  bannerJumpJobField: document.querySelector('#bannerJumpJobField'),
  bannerJumpJobId: document.querySelector('#bannerJumpJobId'),
  bannerJumpCustomField: document.querySelector('#bannerJumpCustomField'),
  bannerJumpCustomPath: document.querySelector('#bannerJumpCustomPath'),
  bannerJumpPreview: document.querySelector('#bannerJumpPreview'),
  bannerTargetPath: document.querySelector('#bannerTargetPath'),
  categoryDialog: document.querySelector('#categoryDialog'),
  categoryDialogTitle: document.querySelector('#categoryDialogTitle'),
  categoryForm: document.querySelector('#categoryForm'),
  creditDialog: document.querySelector('#creditDialog'),
  creditForm: document.querySelector('#creditForm'),
  creditUserLabel: document.querySelector('#creditUserLabel'),
  packageDialog: document.querySelector('#packageDialog'),
  packageForm: document.querySelector('#packageForm'),
  cdkGenerateForm: document.querySelector('#cdkGenerateForm'),
  cdkFilterForm: document.querySelector('#cdkFilterForm'),
  cdkRows: document.querySelector('#cdkRows'),
  cdkSummaryHint: document.querySelector('#cdkSummaryHint'),
  cdkExpireType: document.querySelector('#cdkExpireType'),
  cdkCustomExpireField: document.querySelector('#cdkCustomExpireField'),
  cdkStatusSelect: document.querySelector('#cdkStatusSelect'),
  cdkStatusChips: document.querySelector('#cdkStatusChips'),
  cdkFilterUnused: document.querySelector('#cdkFilterUnused'),
  cdkEditDialog: document.querySelector('#cdkEditDialog'),
  cdkEditForm: document.querySelector('#cdkEditForm'),
  cdkEditCodeLabel: document.querySelector('#cdkEditCodeLabel'),
  cdkEditHint: document.querySelector('#cdkEditHint'),
  announcementForm: document.querySelector('#announcementForm'),
  announcementFormTitle: document.querySelector('#announcementFormTitle'),
  announcementFormSubmit: document.querySelector('#announcementFormSubmit'),
  announcementFormReset: document.querySelector('#announcementFormReset'),
  announcementCarouselForm: document.querySelector('#announcementCarouselForm'),
  announcementRows: document.querySelector('#announcementRows'),
  announcementContent: document.querySelector('#announcementContent'),
  announcementMdPreview: document.querySelector('#announcementMdPreview'),
  subscribeBroadcastForm: document.querySelector('#subscribeBroadcastForm'),
  subscribeStatsHint: document.querySelector('#subscribeStatsHint'),
  subscribeStatTemplate: document.querySelector('#subscribeStatTemplate'),
  subscribeStatEligible: document.querySelector('#subscribeStatEligible'),
  subscribeStatTotal: document.querySelector('#subscribeStatTotal'),
  coverInput: document.querySelector('#coverInput'),
  bannerImageInput: document.querySelector('#bannerImageInput'),
  shareStatsGrid: document.querySelector('#shareStatsGrid'),
  shareStatsHint: document.querySelector('#shareStatsHint'),
  shareEventRows: document.querySelector('#shareEventRows'),
  inviteRows: document.querySelector('#inviteRows'),
  shareEventFilterForm: document.querySelector('#shareEventFilterForm'),
  toast: document.querySelector('#toast')
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function shortId(value, length = 8) {
  const text = String(value || '')
  return text.length > length ? `${text.slice(0, length)}...` : text
}

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

function emptyRow(columns, message) {
  return `<tr><td class="empty-cell" colspan="${columns}">${escapeHtml(message)}</td></tr>`
}

function showToast(message, error = false) {
  elements.toast.textContent = message
  elements.toast.className = `toast is-visible${error ? ' is-error' : ''}`
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => { elements.toast.className = 'toast' }, 2600)
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (state.token) headers.authorization = `Bearer ${state.token}`
  if (options.json) headers['content-type'] = 'application/json'
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.json ? JSON.stringify(options.json) : options.body
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/admin/login') logout()
    throw new Error(result.message || '请求失败')
  }
  return result
}

function logout() {
  state.token = ''
  state.data = null
  sessionStorage.removeItem('huayang_admin_token')
  elements.appView.hidden = true
  elements.loginView.hidden = false
  elements.password.value = ''
}

async function loadOverview() {
  state.data = await api('/api/admin/overview')
  renderOverview()
  fillTemplateFilterCategories()
  renderBanners()
  renderCategories()
  renderPackages()
}

function fillTemplateFilterCategories() {
  if (!elements.templateFilterCategory) return
  const current = elements.templateFilterCategory.value || 'all'
  const options = ['<option value="all">全部分类</option>']
    .concat(categoryList().map(item => (
      `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}</option>`
    )))
  elements.templateFilterCategory.innerHTML = options.join('')
  if ([...elements.templateFilterCategory.options].some(option => option.value === current)) {
    elements.templateFilterCategory.value = current
  }
}

function syncPageSizeFromSelect(selectEl, query) {
  if (!selectEl) return
  const size = Number(selectEl.value) || 10
  query.pageSize = [10, 20, 50, 100].includes(size) ? size : 10
}

function applyPageResult(query, result) {
  query.total = Number(result.total) || 0
  query.page = Number(result.page) || query.page
  query.pageSize = Number(result.pageSize) || query.pageSize
  query.pages = Number(result.pages) || Math.max(1, Math.ceil(query.total / query.pageSize) || 1)
  if (query.page > query.pages) query.page = query.pages
  if (query.page < 1) query.page = 1
}

function listPagerUi(prefix) {
  return {
    infoEl: elements[`${prefix}PagerInfo`],
    prevEl: elements[`${prefix}PrevPage`],
    nextEl: elements[`${prefix}NextPage`],
    sizeEl: elements[`${prefix}PageSize`],
    jumpInputEl: elements[`${prefix}JumpPage`],
    jumpBtnEl: elements[`${prefix}JumpBtn`]
  }
}

function renderListPager({ infoEl, prevEl, nextEl, sizeEl, jumpInputEl, jumpBtnEl, query }) {
  if (infoEl) {
    if (!query.total) {
      infoEl.textContent = query.loading ? '加载中…' : '共 0 条'
    } else {
      const from = (query.page - 1) * query.pageSize + 1
      const to = Math.min(query.page * query.pageSize, query.total)
      infoEl.textContent = `第 ${query.page}/${query.pages} 页 · 显示 ${from}-${to} · 共 ${query.total} 条`
    }
  }
  if (prevEl) prevEl.disabled = query.loading || query.page <= 1
  if (nextEl) nextEl.disabled = query.loading || query.page >= query.pages || query.total === 0
  if (sizeEl && String(sizeEl.value) !== String(query.pageSize)) {
    sizeEl.value = String(query.pageSize)
  }
  if (jumpInputEl) {
    const maxPage = Math.max(1, Number(query.pages) || 1)
    jumpInputEl.min = '1'
    jumpInputEl.max = String(maxPage)
    jumpInputEl.placeholder = String(query.page || 1)
    jumpInputEl.disabled = Boolean(query.loading) || maxPage <= 1
    if (document.activeElement !== jumpInputEl) jumpInputEl.value = ''
  }
  if (jumpBtnEl) {
    jumpBtnEl.disabled = Boolean(query.loading) || !query.total || Number(query.pages) <= 1
  }
}

function wireListPager({ prevEl, nextEl, sizeEl, jumpInputEl, jumpBtnEl, getQuery, loadFn }) {
  prevEl?.addEventListener('click', async () => {
    const q = getQuery()
    if (q.page <= 1 || q.loading) return
    q.page -= 1
    await loadFn()
  })
  nextEl?.addEventListener('click', async () => {
    const q = getQuery()
    if (q.page >= q.pages || q.loading) return
    q.page += 1
    await loadFn()
  })
  sizeEl?.addEventListener('change', async () => {
    const q = getQuery()
    syncPageSizeFromSelect(sizeEl, q)
    q.page = 1
    await loadFn()
  })

  const jumpToPage = async () => {
    const q = getQuery()
    if (q.loading) return
    const raw = Number(jumpInputEl?.value)
    if (!Number.isFinite(raw) || String(jumpInputEl?.value || '').trim() === '') {
      showToast('请输入要跳转的页码', true)
      jumpInputEl?.focus()
      return
    }
    const maxPage = Math.max(1, Number(q.pages) || 1)
    const page = Math.min(Math.max(1, Math.floor(raw)), maxPage)
    if (page === q.page) {
      if (jumpInputEl) jumpInputEl.value = ''
      return
    }
    q.page = page
    if (jumpInputEl) jumpInputEl.value = ''
    await loadFn()
  }
  jumpBtnEl?.addEventListener('click', jumpToPage)
  jumpInputEl?.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault()
      jumpToPage()
    }
  })
}

async function loadTemplates({ resetPage = false } = {}) {
  if (!elements.templateRows) return
  const q = state.templateQuery
  if (resetPage) q.page = 1
  if (elements.templateFilterForm) {
    const values = new FormData(elements.templateFilterForm)
    q.query = String(values.get('query') || '').trim()
    q.status = String(values.get('status') || 'all')
    q.category = String(values.get('category') || 'all')
  }
  syncPageSizeFromSelect(elements.templatePageSize, q)

  q.loading = true
  elements.templateRows.innerHTML = emptyRow(8, '加载中...')
  renderListPager({
    ...listPagerUi('template'),
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      query: q.query,
      status: q.status,
      category: q.category
    })
    const result = await api(`/api/admin/templates?${params}`)
    state.templates = Array.isArray(result.templates) ? result.templates : []
    applyPageResult(q, result)
    if (state.data) state.data.templateCount = q.total
    renderTemplates()
  } catch (error) {
    elements.templateRows.innerHTML = emptyRow(8, error.message || '加载失败')
    showToast(error.message, true)
  } finally {
    q.loading = false
    renderListPager({
    ...listPagerUi('template'),
    query: q
  })
  }
}

function renderOverview() {
  const { settings, stats } = state.data
  const statItems = [
    ['用户总数', stats.users],
    ['生成任务', stats.jobs],
    ['完成作品', stats.completedJobs],
    ['支付订单', stats.paidOrders],
    ['累计充值积分', stats.rechargedCredits],
    ['累计消费积分', stats.consumedCredits]
  ]
  elements.statsGrid.innerHTML = statItems.map(([label, value]) => `
    <div class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(value)}</strong></div>
  `).join('')

  const form = elements.settingsForm.elements
  form.welcomeCredits.value = settings.welcomeCredits
  form.checkinCredits.value = settings.checkinCredits
  form.shareTitle.value = settings.shareTitle
  renderStreakBonusRows(settings.checkinStreakBonuses || [])
  fillCommunityForm(settings)
  fillShareRewardForm(settings)
  fillBannerCarouselForm()
}

function fillCommunityForm(settings = {}) {
  const form = document.querySelector('#communityForm')?.elements
  if (!form) return
  const community = settings.community || {}
  const wechat = community.wechat || {
    enabled: settings.communityWechatQrEnabled !== false,
    qrUrl: settings.communityWechatQrUrl || settings.communityQrUrl || ''
  }
  const qq = community.qq || {
    enabled: settings.communityQqQrEnabled === true,
    qrUrl: settings.communityQqQrUrl || ''
  }
  if (form.communityWechatQrEnabled) form.communityWechatQrEnabled.checked = wechat.enabled !== false
  if (form.communityQqQrEnabled) form.communityQqQrEnabled.checked = qq.enabled === true
  setCommunityQrPreview('communityWechatQrPreview', wechat.qrUrl || '')
  setCommunityQrPreview('communityQqQrPreview', qq.qrUrl || '')
}

function setCommunityQrPreview(id, qrUrl) {
  const preview = document.querySelector(`#${id}`)
  if (!preview) return
  if (qrUrl) {
    preview.src = qrUrl
    preview.hidden = false
  } else {
    preview.removeAttribute('src')
    preview.hidden = true
  }
}

function renderStreakBonusRows(list = []) {
  const host = document.querySelector('#streakBonusRows')
  if (!host) return
  const rows = (Array.isArray(list) && list.length ? list : [{ days: 3, bonus: 5 }, { days: 7, bonus: 15 }])
  host.innerHTML = rows.map((item, index) => `
    <div class="streak-bonus-row" data-index="${index}">
      <label>连续天数 <input class="streak-days" type="number" min="1" max="365" value="${Number(item.days) || 1}"></label>
      <label>额外积分 <input class="streak-bonus" type="number" min="0" max="100000" value="${Number(item.bonus) || 0}"></label>
      <button class="row-button" type="button" data-streak-remove="${index}">删除</button>
    </div>
  `).join('')
}

function collectStreakBonuses() {
  return [...document.querySelectorAll('#streakBonusRows .streak-bonus-row')].map(row => ({
    days: Number(row.querySelector('.streak-days')?.value || 0),
    bonus: Number(row.querySelector('.streak-bonus')?.value || 0)
  })).filter(item => item.days > 0 && item.bonus > 0)
}

function fillShareRewardForm(settings = {}) {
  const form = elements.shareRewardForm?.elements
  if (!form) return
  if (form.shareRewardEnabled) form.shareRewardEnabled.checked = settings.shareRewardEnabled !== false
  if (form.shareOpenCredits) form.shareOpenCredits.value = Number(settings.shareOpenCredits ?? 2)
  if (form.shareOpenDailyLimit) form.shareOpenDailyLimit.value = Number(settings.shareOpenDailyLimit ?? 5)
  if (form.inviteRewardEnabled) form.inviteRewardEnabled.checked = settings.inviteRewardEnabled !== false
  if (form.inviteLoginCredits) form.inviteLoginCredits.value = Number(settings.inviteLoginCredits ?? 5)
  if (form.inviteFirstJobCredits) form.inviteFirstJobCredits.value = Number(settings.inviteFirstJobCredits ?? 10)
  if (form.galleryPublishCredits) form.galleryPublishCredits.value = Number(settings.galleryPublishCredits ?? 5)
  if (form.galleryLikeLikerCredits) form.galleryLikeLikerCredits.value = Number(settings.galleryLikeLikerCredits ?? 1)
  if (form.galleryLikeAuthorCredits) form.galleryLikeAuthorCredits.value = Number(settings.galleryLikeAuthorCredits ?? 3)
}

async function loadShareGrowth() {
  if (!elements.shareStatsGrid) return
  fillShareRewardForm(state.data?.settings || {})
  const [statsResult, listResult] = await Promise.all([
    api('/api/admin/share-stats'),
    api(`/api/admin/share-events?${new URLSearchParams({
      query: elements.shareEventFilterForm?.elements?.query?.value || '',
      channel: elements.shareEventFilterForm?.elements?.channel?.value || 'all'
    })}`)
  ])
  const s = statsResult.summary || {}
  const cards = [
    ['今日好友分享', s.shareTodayFriend],
    ['今日朋友圈', s.shareTodayTimeline],
    ['今日分享发奖', s.shareTodayRewardCredits],
    ['累计分享次数', s.shareEventsTotal],
    ['累计邀请关系', s.invitesTotal],
    ['邀请登录已奖', s.inviteLoginRewarded],
    ['邀请首次创作已奖', s.inviteFirstJobRewarded],
    ['邀请发奖积分', Number(s.inviteLoginCredits || 0) + Number(s.inviteFirstJobCredits || 0)]
  ]
  elements.shareStatsGrid.innerHTML = cards.map(([label, value], index) => `
    <div class="stat-card stat-card--share"><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}</strong></div>
  `).join('')
  if (elements.shareStatsHint) {
    elements.shareStatsHint.textContent =
      `分享发奖累计 ${Number(s.shareRewardCredits || 0)} 积分 · 邀请登录奖 ${Number(s.inviteLoginCredits || 0)} · 首次创作奖 ${Number(s.inviteFirstJobCredits || 0)}`
  }
  if (elements.shareEventRows) {
    elements.shareEventRows.innerHTML = (listResult.events || []).map(item => `
      <tr>
        <td>${escapeHtml(item.createdTime)}</td>
        <td><strong>${escapeHtml(item.userNickname)}</strong><span class="cell-subtitle">${escapeHtml(item.userMaskedId)}</span></td>
        <td><span class="channel-pill channel-pill--${escapeHtml(item.channel)}">${escapeHtml(item.channelLabel || ({ friend: '微信好友', timeline: '朋友圈', open: '好友打开' }[item.channel] || item.channel))}</span></td>
        <td class="${item.reward > 0 ? 'amount-positive' : 'muted'}">${item.reward > 0 ? '+' : ''}${Number(item.reward)}</td>
        <td title="${escapeHtml(item.jobId)}">${escapeHtml(shortId(item.jobId, 10))}</td>
      </tr>
    `).join('') || emptyRow(5, '暂无分享记录')
  }
  if (elements.inviteRows) {
    elements.inviteRows.innerHTML = (listResult.invites || []).map(item => `
      <tr>
        <td>${escapeHtml(item.createdTime)}</td>
        <td><strong>${escapeHtml(item.inviterNickname)}</strong><span class="cell-subtitle">${escapeHtml(item.inviterMaskedId)}</span></td>
        <td><strong>${escapeHtml(item.inviteeNickname)}</strong><span class="cell-subtitle">${escapeHtml(item.inviteeMaskedId)}</span></td>
        <td>${item.loginRewarded ? '<span class="status-pill is-active">已发</span>' : '<span class="muted">—</span>'}</td>
        <td>${item.firstJobRewarded ? '<span class="status-pill is-active">已发</span>' : '<span class="muted">—</span>'}</td>
      </tr>
    `).join('') || emptyRow(5, '暂无邀请关系')
  }
}

function categoryList() {
  return Array.isArray(state.data?.templateCategories) ? state.data.templateCategories : []
}

function categoryLabel(categoryId) {
  const found = categoryList().find(item => item.id === categoryId)
  return found?.name || categoryId || '-'
}

function templateCategoryIds(template) {
  if (!template) return []
  if (Array.isArray(template.categories) && template.categories.length) {
    return template.categories.map(item => String(item || '').trim()).filter(Boolean)
  }
  const single = String(template.category || '').trim()
  return single ? [single] : []
}

function fillCategorySelect(selectedIds = []) {
  if (!elements.templateCategorySelect) return
  const categories = categoryList()
  const selected = new Set(
    (Array.isArray(selectedIds) ? selectedIds : [selectedIds])
      .map(item => String(item || '').trim())
      .filter(Boolean)
  )
  if (!categories.length) {
    elements.templateCategorySelect.innerHTML = '<span class="muted">请先创建分类</span>'
    return
  }
  // Default first enabled when creating
  if (!selected.size) {
    const enabled = categories.find(item => item.enabled !== false) || categories[0]
    if (enabled) selected.add(enabled.id)
  }
  elements.templateCategorySelect.innerHTML = categories.map(item => {
    const label = item.enabled === false ? `${item.name}（已停用）` : item.name
    const checked = selected.has(item.id) ? ' checked' : ''
    return `<label class="category-check">
      <input type="checkbox" name="categories" value="${escapeHtml(item.id)}"${checked}>
      <span>${escapeHtml(label)}</span>
    </label>`
  }).join('')
}

function selectedCategoryIds(form) {
  const boxes = form.querySelectorAll('input[name="categories"]:checked')
  return Array.from(boxes).map(input => String(input.value || '').trim()).filter(Boolean)
}

function fillBannerCarouselForm() {
  if (!elements.bannerCarouselForm || !state.data) return
  const settings = state.data.settings || {}
  const form = elements.bannerCarouselForm.elements
  form.bannerSwitchMode.value = settings.bannerSwitchMode === 'manual' ? 'manual' : 'auto'
  form.bannerSwitchIntervalMs.value = Number(settings.bannerSwitchIntervalMs) || 4500
  form.bannerCircular.checked = settings.bannerCircular !== false
  const enabledCount = (state.data.banners || []).filter(item => item.enabled).length
  if (elements.bannerEnabledHint) {
    elements.bannerEnabledHint.textContent = `当前启用 ${enabledCount} 张。仅当启用 ≥ 2 张时，切换方式与间隔才会在小程序生效。`
  }
}

function mediaThumbs(items, emptyText) {
  const list = Array.isArray(items) ? items.filter(item => item?.url || item?.thumbUrl) : []
  if (!list.length) return `<span class="muted">${escapeHtml(emptyText)}</span>`
  return `<div class="job-media-row">${list.map((item, index) => {
    const full = item.url || item.thumbUrl
    const thumb = item.thumbUrl || item.url
    return `<div class="job-thumb-cell"><a class="job-media-thumb" href="${escapeHtml(full)}" target="_blank" rel="noreferrer" title="打开大图 ${index + 1}"><img src="${escapeHtml(thumb)}" alt=""></a></div>`
  }).join('')}</div>`
}

function resultThumbsWithSample(job) {
  const list = Array.isArray(job.results) ? job.results.filter(item => item?.url || item?.thumbUrl) : []
  if (!list.length) return `<span class="muted">${job.status === 'succeeded' ? '无' : '未出'}</span>`
  const canAdd = job.status === 'succeeded'
  const feedbackByResult = new Map(
    (Array.isArray(job.myFeedbacks) ? job.myFeedbacks : []).map(item => [item.resultId, item])
  )
  return `<div class="job-media-row job-media-row--results">${list.map((item, index) => {
    const full = item.url || item.thumbUrl
    const thumb = item.thumbUrl || item.url
    const sampleBtn = canAdd
      ? (item.isSample
        ? `<button class="row-button sample-add-btn sample-add-btn--on" type="button" data-job-action="remove-sample" data-job-id="${escapeHtml(job.id)}" data-result-id="${escapeHtml(item.id)}">取消加入</button>`
        : `<button class="row-button sample-add-btn" type="button" data-job-action="add-sample" data-job-id="${escapeHtml(job.id)}" data-result-id="${escapeHtml(item.id)}">添加到更多效果</button>`)
      : ''
    const fb = feedbackByResult.get(item.id)
    const feedbackPill = fb
      ? `<span class="status-pill${fb.rating === 'satisfied' ? ' is-active' : (fb.rating === 'abnormal' || fb.rating === 'unlike_person' ? ' is-warn' : '')}" title="用户质量反馈">${escapeHtml(fb.ratingLabel || fb.rating)}</span>`
      : ''
    return `<div class="job-result-cell">
      <a class="job-media-thumb" href="${escapeHtml(full)}" target="_blank" rel="noreferrer" title="打开大图 ${index + 1}"><img src="${escapeHtml(thumb)}" alt=""></a>
      ${feedbackPill}
      ${sampleBtn}
    </div>`
  }).join('')}</div>`
}

function renderTemplates() {
  const list = state.templates || []
  elements.templateRows.innerHTML = list.map(template => `
    <tr>
      <td><div class="template-cell">
        <div class="cover-thumb" style="background:${escapeHtml(template.palette)}">${template.coverUrl ? `<img src="${escapeHtml(template.coverUrl)}" alt="">` : escapeHtml(template.shortName || template.name || '')}</div>
        <div><strong>${escapeHtml(template.name)}</strong><span>${escapeHtml(template.id)}</span></div>
      </div></td>
      <td><div class="tag-list">${
        (Array.isArray(template.categoryLabels) && template.categoryLabels.length
          ? template.categoryLabels
          : templateCategoryIds(template).map(id => categoryLabel(id))
        ).map(label => `<span class="tag">${escapeHtml(label)}</span>`).join('') || '<span class="muted">未分类</span>'
      }</div></td>
      <td><div class="tag-list">${(template.tags || []).length ? template.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '<span class="muted">未设置</span>'}</div></td>
      <td>${Number(template.popularity).toLocaleString('zh-CN')}</td>
      <td>${Number(template.cost)}</td>
      <td>${Number(template.sortOrder)}</td>
      <td><span class="status-pill${template.enabled ? ' is-active' : ''}">${template.enabled ? '已启用' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-template-action="edit" data-id="${escapeHtml(template.id)}">编辑</button>
        <button class="row-button" data-template-action="cover" data-id="${escapeHtml(template.id)}">上传封面</button>
        <button class="row-button" data-template-action="toggle" data-id="${escapeHtml(template.id)}">${template.enabled ? '停用' : '启用'}</button>
        <button class="row-button row-button--danger" data-template-action="delete" data-id="${escapeHtml(template.id)}">删除</button>
      </div></td>
    </tr>
  `).join('') || emptyRow(8, '暂无模板')
}

function renderBanners() {
  fillBannerCarouselForm()
  elements.bannerRows.innerHTML = state.data.banners.map(banner => {
    const jump = describeBannerJump(banner.targetPath)
    return `
    <tr>
      <td><div class="template-cell">
        <div class="banner-thumb" style="background:${escapeHtml(banner.palette)}">${(banner.imageFullUrl || banner.imageUrl) ? `<img src="${escapeHtml(banner.imageFullUrl || banner.imageUrl)}" alt="">` : '<span>无封面</span>'}</div>
        <div><strong>${escapeHtml(banner.badge || '首页推荐')}</strong><span>${shortId(banner.id, 12)}</span></div>
      </div></td>
      <td><strong>${escapeHtml(banner.title)}</strong><span class="cell-subtitle">${escapeHtml(banner.subtitle || '-')}</span></td>
      <td><strong>${escapeHtml(jump.label)}</strong><span class="path-cell cell-subtitle" title="${escapeHtml(banner.targetPath || '')}">${escapeHtml(banner.targetPath || '—')}</span></td>
      <td>${Number(banner.sortOrder)}</td>
      <td><span class="status-pill${banner.enabled ? ' is-active' : ''}">${banner.enabled ? '已启用' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-banner-action="edit" data-id="${escapeHtml(banner.id)}">编辑</button>
        <button class="row-button" data-banner-action="image" data-id="${escapeHtml(banner.id)}">上传图片</button>
        <button class="row-button" data-banner-action="toggle" data-id="${escapeHtml(banner.id)}">${banner.enabled ? '停用' : '启用'}</button>
        <button class="row-button row-button--danger" data-banner-action="delete" data-id="${escapeHtml(banner.id)}">删除</button>
      </div></td>
    </tr>`
  }).join('') || emptyRow(6, '暂无 Banner')
}

function renderCategories() {
  if (!elements.categoryRows || !state.data) return
  const counts = state.data.templateCategoryCounts || {}
  const categories = categoryList()
  elements.categoryRows.innerHTML = categories.map(category => `
    <tr>
      <td><strong>${escapeHtml(category.name)}</strong></td>
      <td><code class="mono-id">${escapeHtml(category.id)}</code></td>
      <td>${Number(category.sortOrder)}</td>
      <td>${Number(counts[category.id] || 0)}</td>
      <td><span class="status-pill${category.enabled ? ' is-active' : ''}">${category.enabled ? '已启用' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-category-action="edit" data-id="${escapeHtml(category.id)}">编辑</button>
        <button class="row-button" data-category-action="toggle" data-id="${escapeHtml(category.id)}">${category.enabled ? '停用' : '启用'}</button>
        <button class="row-button" data-category-action="delete" data-id="${escapeHtml(category.id)}">删除</button>
      </div></td>
    </tr>
  `).join('') || emptyRow(6, '还没有分类，请先新增')
}

function renderPackages() {
  elements.packageList.innerHTML = state.data.packages.map(item => `
    <form class="package-row" data-package-id="${escapeHtml(item.id)}">
      <div class="package-id"><strong>${escapeHtml(item.id)}</strong><span>${item.enabled ? '用户端可见' : '用户端隐藏'}</span></div>
      <label>到账积分<input name="credits" type="number" min="1" value="${Number(item.credits)}" required></label>
      <label>赠送积分<input name="bonus" type="number" min="0" value="${Number(item.bonus)}" required></label>
      <label>价格（元）<input name="priceYuan" type="number" min="0.01" step="0.01" value="${escapeHtml(item.priceYuan)}" required></label>
      <label>角标<input name="badge" maxlength="12" value="${escapeHtml(item.badge)}"></label>
      <div class="row-actions"><label class="inline-toggle"><input name="enabled" type="checkbox" ${item.enabled ? 'checked' : ''}>启用</label><button class="button button--quiet" type="submit">保存</button></div>
    </form>
  `).join('')
}

async function loadUsers({ resetPage = false } = {}) {
  const q = state.userQuery
  if (resetPage) q.page = 1
  if (elements.userFilterForm) {
    const values = new FormData(elements.userFilterForm)
    q.query = String(values.get('query') || '').trim()
    q.status = String(values.get('status') || 'all')
  }
  syncPageSizeFromSelect(elements.userPageSize, q)
  q.loading = true
  elements.userRows.innerHTML = emptyRow(9, '加载中...')
  renderListPager({
    ...listPagerUi('user'),
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      query: q.query,
      status: q.status
    })
    const result = await api(`/api/admin/users?${params}`)
    state.users = result.users || []
    applyPageResult(q, result)
    elements.userRows.innerHTML = state.users.map(user => {
      const openid = user.openid || ''
      const unionid = user.unionid || ''
      return `
    <tr>
      <td>
        <strong>${escapeHtml(user.nickname || '花漾用户')}</strong>
        <code class="uuid-code" title="点击复制完整 UUID" data-copy="${escapeHtml(user.id || '')}">${escapeHtml(user.id || '—')}</code>
      </td>
      <td class="openid-cell">
        ${openid
          ? `<code class="openid-code" title="点击复制 OpenID" data-copy="${escapeHtml(openid)}">${escapeHtml(openid)}</code>`
          : '<span class="muted">—</span>'}
        ${unionid
          ? `<code class="openid-code openid-code--sub" title="点击复制 unionid" data-copy="${escapeHtml(unionid)}">${escapeHtml(unionid)}</code>`
          : ''}
      </td>
      <td><strong>${Number(user.credits).toLocaleString('zh-CN')}</strong></td>
      <td>${Number(user.completedJobs)} / ${Number(user.jobCount)}</td>
      <td class="amount-positive">+${Number(user.rechargedCredits)}</td>
      <td class="amount-negative">-${Number(user.consumedCredits)}</td>
      <td>${formatDate(user.createdAt)}<span class="cell-subtitle">登录 ${formatDate(user.lastLoginAt)}</span></td>
      <td><span class="status-pill${user.enabled ? ' is-active' : ''}">${user.enabled ? '正常' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-user-action="credits" data-id="${escapeHtml(user.id)}">调积分</button>
        <button class="row-button" data-user-action="toggle" data-id="${escapeHtml(user.id)}">${user.enabled ? '停用' : '启用'}</button>
      </div></td>
    </tr>`
    }).join('') || emptyRow(9, '没有符合条件的用户')
  } catch (error) {
    elements.userRows.innerHTML = emptyRow(9, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
    ...listPagerUi('user'),
    query: q
  })
  }
}

async function loadTransactions({ resetPage = false } = {}) {
  const q = state.transactionQuery
  if (resetPage) q.page = 1
  if (elements.transactionFilterForm) {
    const values = new FormData(elements.transactionFilterForm)
    q.query = String(values.get('query') || '').trim()
    q.type = String(values.get('type') || 'all')
  }
  syncPageSizeFromSelect(elements.transactionPageSize, q)
  q.loading = true
  elements.transactionRows.innerHTML = emptyRow(8, '加载中...')
  renderListPager({
    ...listPagerUi('transaction'),
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      query: q.query,
      type: q.type
    })
    const result = await api(`/api/admin/transactions?${params}`)
    state.transactions = result.transactions || []
    applyPageResult(q, result)
    elements.transactionRows.innerHTML = state.transactions.map(item => `
    <tr>
      <td>${escapeHtml(item.displayTime)}</td>
      <td><strong>${escapeHtml(item.userNickname)}</strong><span class="cell-subtitle">${escapeHtml(item.userMaskedId)}</span></td>
      <td><span class="ledger-type ledger-type--${escapeHtml(item.type)}">${escapeHtml(item.typeLabel)}</span></td>
      <td>${escapeHtml(item.title)}</td>
      <td class="${item.amount >= 0 ? 'amount-positive' : 'amount-negative'}">${item.amount >= 0 ? '+' : ''}${Number(item.amount)}</td>
      <td>${Number(item.balanceAfter)}</td>
      <td>${item.orderAmountYuan ? `¥${escapeHtml(item.orderAmountYuan)}` : '-'}</td>
      <td>${item.externalRef
        ? `<code class="ref-copy-code" title="点击复制关联单号" data-copy="${escapeHtml(item.externalRef)}">${escapeHtml(shortId(item.externalRef, 12))}</code>`
        : '-'}</td>
    </tr>
  `).join('') || emptyRow(8, '没有符合条件的流水')
  } catch (error) {
    elements.transactionRows.innerHTML = emptyRow(8, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
    ...listPagerUi('transaction'),
    query: q
  })
  }
}

function syncJobShareChips(share) {
  if (!elements.jobShareChips) return
  elements.jobShareChips.querySelectorAll('[data-job-share]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.jobShare === share)
  })
  if (elements.jobShareSelect) elements.jobShareSelect.value = share
  if (elements.jobFilterForm?.elements?.share) {
    elements.jobFilterForm.elements.share.value = share
  }
}

function setJobShareFilter(share, { reload = true } = {}) {
  const next = share || 'all'
  state.jobQuery.share = next
  syncJobShareChips(next)
  if (reload) loadJobs({ resetPage: true }).catch(error => showToast(error.message, true))
}

async function loadJobs({ resetPage = false } = {}) {
  const q = state.jobQuery
  if (resetPage) q.page = 1
  if (elements.jobFilterForm) {
    const values = new FormData(elements.jobFilterForm)
    q.query = String(values.get('query') || '').trim()
    q.status = String(values.get('status') || 'all')
    q.share = String(values.get('share') || q.share || 'all')
    q.feedback = String(values.get('feedback') || q.feedback || 'all')
  }
  syncJobShareChips(q.share || 'all')
  syncPageSizeFromSelect(elements.jobPageSize, q)
  q.loading = true
  elements.jobRows.innerHTML = emptyRow(9, '加载中...')
  renderListPager({
    ...listPagerUi('job'),
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      query: q.query,
      status: q.status,
      share: q.share || 'all',
      feedback: q.feedback || 'all'
    })
    const result = await api(`/api/admin/jobs?${params}`)
    state.jobs = result.jobs || []
    applyPageResult(q, result)
    const summary = result.summary || {}
    if (elements.jobSummaryHint) {
      elements.jobSummaryHint.textContent =
        `共 ${Number(summary.total ?? q.total)} 条 · 用户已公开 ${Number(summary.public || 0)} · 其中含原图 ${Number(summary.publicWithOriginals || 0)} · 未公开 ${Number(summary.private || 0)} · 有质量反馈 ${Number(summary.withFeedback || 0)} 条任务（${Number(summary.feedbackTotal || 0)} 次评价）。生成图下方可直接看用户反馈。`
    }
    elements.jobRows.innerHTML = state.jobs.map(job => `
    <tr>
      <td>
        <div class="job-media">
          <div class="job-media-compare">
            <div class="job-media-col">
              <span class="job-media-label">原图</span>
              ${mediaThumbs(job.originals, '无')}
            </div>
            <span class="job-media-sep" aria-hidden="true">→</span>
            <div class="job-media-col">
              <span class="job-media-label">生成</span>
              ${resultThumbsWithSample(job)}
            </div>
          </div>
        </div>
        <div class="job-id-row">
          <code class="job-id-code" title="点击复制任务 ID" data-copy="${escapeHtml(job.id)}">${escapeHtml(job.id)}</code>
        </div>
      </td>
      <td><strong>${escapeHtml(job.userNickname)}</strong><span class="cell-subtitle">${escapeHtml(job.userMaskedId)}</span></td>
      <td>${escapeHtml(job.templateName)}</td>
      <td><span class="job-status job-status--${escapeHtml(job.status)}">${escapeHtml(job.statusLabel)}</span></td>
      <td>${(job.assetIds || []).length} 张 / ${Number(job.cost)} 积分</td>
      <td>${escapeHtml(job.createdTime)}</td>
      <td>${escapeHtml(job.completedTime || '-')}</td>
      <td>${job.durationSeconds === null ? '-' : `${Number(job.durationSeconds)} 秒`}</td>
      <td class="job-ops-cell">
        <div class="job-ops-stack">
          ${job.status === 'succeeded'
            ? ''
            : `<div class="job-error-text">${escapeHtml(job.error || '-')}</div>`}
          <div class="row-actions">
            ${job.status === 'succeeded'
              ? `<button class="row-button" data-job-action="banner" data-id="${escapeHtml(job.id)}" type="button">设为 Banner</button>
                ${job.publicShareEnabled
                  ? `<span class="status-pill job-share-pill is-active" title="${job.publicShareShowOriginals ? '公开且显示原图' : '公开不显示原图'}">已公开${job.publicShareShowOriginals ? '·含原图' : ''}</span>`
                  : '<span class="status-pill job-share-pill is-private">未公开</span>'}`
              : ''}
            <button class="row-button row-button--danger" data-job-action="delete" data-id="${escapeHtml(job.id)}" type="button">删除</button>
          </div>
        </div>
      </td>
    </tr>
  `).join('') || emptyRow(9, '没有符合条件的作品任务')
  } catch (error) {
    elements.jobRows.innerHTML = emptyRow(9, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
    ...listPagerUi('job'),
    query: q
  })
  }
}

async function loadFeedbacks({ resetPage = false } = {}) {
  if (!elements.feedbackRows) return
  const q = state.feedbackQuery
  if (resetPage) q.page = 1
  if (elements.feedbackFilterForm) {
    const values = new FormData(elements.feedbackFilterForm)
    q.type = String(values.get('type') || 'all')
    q.status = String(values.get('status') || 'all')
  }
  syncPageSizeFromSelect(elements.feedbackPageSize, q)
  q.loading = true
  elements.feedbackRows.innerHTML = emptyRow(8, '加载中...')
  renderListPager({
    ...listPagerUi('feedback'),
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      type: q.type,
      status: q.status
    })
    const result = await api(`/api/admin/feedbacks?${params}`)
    const list = result.feedbacks || []
    state.feedbacks = list
    applyPageResult(q, result)
    elements.feedbackRows.innerHTML = list.map(item => {
      const replied = item.status === 'replied' || Boolean(item.reply)
      return `
    <tr>
      <td>${escapeHtml(item.createdTime || formatDate(item.createdAt))}</td>
      <td><strong>${escapeHtml(item.userNickname)}</strong><span class="cell-subtitle">${escapeHtml(item.userMaskedId)}</span></td>
      <td><span class="status-pill is-active">${escapeHtml(item.typeLabel || item.type)}</span></td>
      <td><span class="status-pill${replied ? ' is-active' : ''}">${escapeHtml(item.statusLabel || (replied ? '已回复' : '待回复'))}</span></td>
      <td><div class="feedback-content">${escapeHtml(item.content)}</div></td>
      <td>${mediaThumbs(item.images, '无')}</td>
      <td><div class="feedback-content feedback-reply-cell">${item.reply ? escapeHtml(item.reply) : '<span class="muted">—</span>'}${item.repliedTime ? `<span class="cell-subtitle">${escapeHtml(item.repliedTime)}</span>` : ''}</div></td>
      <td class="row-actions">
        <button class="row-button" type="button" data-feedback-action="reply" data-id="${escapeHtml(item.id)}">${replied ? '修改回复' : '回复'}</button>
      </td>
    </tr>`
    }).join('') || emptyRow(8, '暂无用户反馈')
  } catch (error) {
    elements.feedbackRows.innerHTML = emptyRow(8, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
    ...listPagerUi('feedback'),
    query: q
  })
  }
}

function openFeedbackReplyDialog(feedback) {
  if (!elements.feedbackReplyDialog || !feedback) return
  state.replyingFeedbackId = feedback.id
  if (elements.feedbackReplyTitle) {
    elements.feedbackReplyTitle.textContent = feedback.reply ? '修改回复' : '回复反馈'
  }
  if (elements.feedbackReplyMeta) {
    elements.feedbackReplyMeta.textContent = `${feedback.userNickname || '用户'} · ${feedback.typeLabel || ''} · ${feedback.createdTime || ''}`
  }
  if (elements.feedbackReplyPreview) {
    elements.feedbackReplyPreview.innerHTML = `<div class="feedback-preview-label">用户反馈</div><div class="feedback-preview-text">${escapeHtml(feedback.content || '')}</div>`
  }
  if (elements.feedbackReplyInput) {
    elements.feedbackReplyInput.value = feedback.reply || ''
  }
  elements.feedbackReplyDialog.showModal()
}

async function switchView(name) {
  const titles = {
    overview: '概览与规则',
    users: '用户管理',
    transactions: '积分流水',
    jobs: '作品任务',
    shares: '分享与邀请',
    messages: '消息推送',
    feedbacks: '建议反馈',
    banners: '首页 Banner',
    templates: '模板管理',
    categories: '模板分类',
    packages: '充值套餐',
    levels: '用户等级',
    campaigns: '运营活动'
  }
  document.querySelectorAll('.view-panel').forEach(view => { view.hidden = view.id !== `${name}View` })
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.view === name))
  elements.pageTitle.textContent = titles[name] || name
  try {
    if (name === 'users') await loadUsers()
    if (name === 'transactions') await loadTransactions()
    if (name === 'jobs') await loadJobs()
    if (name === 'shares') await loadShareGrowth()
    if (name === 'messages') await loadMessagesPage()
    if (name === 'feedbacks') await loadFeedbacks()
    if (name === 'templates') await loadTemplates()
    if (name === 'categories') renderCategories()
    if (name === 'banners') fillBannerCarouselForm()
    if (name === 'packages') await loadCdks()
    if (name === 'levels') await loadUserLevels()
    if (name === 'campaigns') await loadCampaigns()
  } catch (error) {
    showToast(error.message, true)
  }
}

function syncCdkExpireFields() {
  if (!elements.cdkExpireType || !elements.cdkCustomExpireField) return
  const custom = elements.cdkExpireType.value === 'custom'
  elements.cdkCustomExpireField.hidden = !custom
  const input = document.querySelector('#cdkExpiresAt')
  if (input) input.required = custom
}

function syncCdkStatusChips(status) {
  if (!elements.cdkStatusChips) return
  elements.cdkStatusChips.querySelectorAll('[data-cdk-status]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.cdkStatus === status)
  })
  if (elements.cdkStatusSelect) elements.cdkStatusSelect.value = status
}

function setCdkStatusFilter(status, { reload = true } = {}) {
  const next = status || 'all'
  state.cdkQuery.status = next
  if (elements.cdkFilterForm?.elements?.status) {
    elements.cdkFilterForm.elements.status.value = next
  }
  syncCdkStatusChips(next)
  if (reload) loadCdks({ resetPage: true }).catch(error => showToast(error.message, true))
}

async function loadCdks({ resetPage = false } = {}) {
  if (!elements.cdkRows) return
  const q = state.cdkQuery
  if (resetPage) q.page = 1
  if (elements.cdkFilterForm) {
    const values = new FormData(elements.cdkFilterForm)
    q.query = String(values.get('query') || '').trim()
    q.status = String(values.get('status') || q.status || 'all')
  }
  syncCdkStatusChips(q.status)
  syncPageSizeFromSelect(elements.cdkPageSize, q)
  q.loading = true
  elements.cdkRows.innerHTML = emptyRow(8, '加载中...')
  renderListPager({
    ...listPagerUi('cdk'),
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      query: q.query,
      status: q.status
    })
    const result = await api(`/api/admin/cdks?${params}`)
    const summary = result.summary || {}
    if (elements.cdkSummaryHint) {
      elements.cdkSummaryHint.textContent =
        `共 ${Number(summary.total || 0)} 个 · 未使用 ${Number(summary.unused || 0)} · 使用中 ${Number(summary.active || 0)} · 已兑完 ${Number(summary.exhausted || 0)} · 已过期 ${Number(summary.expired || 0)} · 已撤销 ${Number(summary.revoked || 0)}`
    }
    applyPageResult(q, result)
    state.cdkListCache = result.cdks || []
    elements.cdkRows.innerHTML = (result.cdks || []).map(item => {
      const usesText = item.maxUses === 0
        ? `已兑 ${Number(item.redeemCount || 0)} / 不限`
        : `已兑 ${Number(item.redeemCount || 0)} / ${Number(item.maxUses)}`
      const actions = [
        `<button class="row-button" data-cdk-action="copy" data-code="${escapeHtml(item.code)}" type="button">复制</button>`
      ]
      if (item.canEdit) {
        actions.push(`<button class="row-button" data-cdk-action="edit" data-id="${escapeHtml(item.id)}" type="button">编辑</button>`)
      }
      if (item.canRevoke) {
        actions.push(`<button class="row-button row-button--danger" data-cdk-action="revoke" data-id="${escapeHtml(item.id)}" data-code="${escapeHtml(item.code)}" type="button">撤销</button>`)
      }
      if (item.redeemCount === 0 && item.status !== 'revoked') {
        actions.push(`<button class="row-button" data-cdk-action="delete" data-id="${escapeHtml(item.id)}" type="button">删除</button>`)
      }
      return `
    <tr>
      <td><code class="cdk-code">${escapeHtml(item.code)}</code></td>
      <td class="amount-positive">+${Number(item.credits)}</td>
      <td>${escapeHtml(usesText)}</td>
      <td>${escapeHtml(item.expiresLabel)}</td>
      <td><span class="status-pill cdk-status--${escapeHtml(item.status)}">${escapeHtml(item.statusLabel)}</span></td>
      <td>${escapeHtml(item.createdTime)}${item.note ? `<span class="cell-subtitle">${escapeHtml(item.note)}</span>` : ''}</td>
      <td>${item.redeemCount > 0
        ? `<strong>${escapeHtml(item.redeemerNickname || '用户')}</strong><span class="cell-subtitle">${escapeHtml(item.redeemedTime || '')}</span>`
        : '<span class="muted">—</span>'}</td>
      <td class="row-actions">${actions.join('')}</td>
    </tr>`
    }).join('') || emptyRow(8, '还没有 CDK，请先生成')
  } catch (error) {
    elements.cdkRows.innerHTML = emptyRow(8, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
    ...listPagerUi('cdk'),
    query: q
  })
  }
}

function openCdkEditDialog(item) {
  if (!elements.cdkEditDialog || !elements.cdkEditForm || !item) return
  state.editingCdkId = item.id
  if (elements.cdkEditCodeLabel) {
    elements.cdkEditCodeLabel.textContent = `兑换码 ${item.code} · 已兑 ${Number(item.redeemCount || 0)} 次`
  }
  if (elements.cdkEditHint) {
    elements.cdkEditHint.textContent = item.maxUses === 0
      ? `当前不限次数 · 已兑 ${Number(item.redeemCount || 0)} 次。次数填 0 表示不限。`
      : `可兑换次数不能小于已兑次数（${Number(item.redeemCount || 0)}）。填 0 表示不限。`
  }
  const form = elements.cdkEditForm.elements
  form.credits.value = Number(item.credits)
  form.maxUses.value = Number(item.maxUses)
  form.note.value = item.note || ''
  elements.cdkEditDialog.showModal()
}

const BANNER_JUMP_FIXED = {
  none: { path: '', label: '无跳转' },
  home: { path: '/pages/home/index', label: '首页（创作）' },
  history: { path: '/pages/history/index', label: '作品列表' },
  gallery: { path: '/pages/gallery/index', label: '花海' },
  profile: { path: '/pages/profile/index', label: '我的' },
  wallet: { path: '/pages/wallet/index', label: '钱包 / 充值' },
  redeem: { path: '/pages/redeem/index', label: '积分兑换' },
  guide: { path: '/pages/guide/index', label: '新手指引' },
  feedback: { path: '/pages/feedback/index', label: '建议反馈' }
}

function jobBannerPath(jobId) {
  const id = String(jobId || '').trim()
  if (!id) return ''
  return `/pages/job/index?id=${encodeURIComponent(id)}&showcase=1`
}

function templateBannerPath(templateId) {
  const id = String(templateId || '').trim()
  if (!id) return ''
  return `/pages/template/index?id=${encodeURIComponent(id)}`
}

function normalizePathForParse(raw) {
  let path = String(raw || '').trim()
  if (!path) return ''
  if (!path.startsWith('/')) path = `/${path}`
  return path
}

function parseQueryParam(path, key) {
  const qIndex = String(path || '').indexOf('?')
  if (qIndex < 0) return ''
  const params = new URLSearchParams(path.slice(qIndex + 1))
  return params.get(key) || ''
}

function parseBannerJump(path) {
  const full = normalizePathForParse(path)
  if (!full) return { type: 'none', templateId: '', jobId: '', customPath: '' }
  const pathOnly = full.split('?')[0]
  for (const [type, meta] of Object.entries(BANNER_JUMP_FIXED)) {
    if (type === 'none') continue
    if (pathOnly === meta.path) return { type, templateId: '', jobId: '', customPath: '' }
  }
  if (pathOnly === '/pages/template/index') {
    return {
      type: 'template',
      templateId: parseQueryParam(full, 'id'),
      jobId: '',
      customPath: ''
    }
  }
  if (pathOnly === '/pages/job/index') {
    return {
      type: 'job',
      templateId: '',
      jobId: parseQueryParam(full, 'id'),
      customPath: ''
    }
  }
  return { type: 'custom', templateId: '', jobId: '', customPath: full }
}

function describeBannerJump(path) {
  const parsed = parseBannerJump(path)
  if (parsed.type === 'none') return { type: 'none', label: '无跳转' }
  if (parsed.type === 'template') {
    const tpl = (state.templates || []).find(item => item.id === parsed.templateId)
      || (state.data?.templates || []).find?.(item => item.id === parsed.templateId)
    const name = tpl?.name || parsed.templateId || '未选模板'
    return { type: 'template', label: `模板：${name}` }
  }
  if (parsed.type === 'job') {
    return { type: 'job', label: parsed.jobId ? `作品展示 · ${shortId(parsed.jobId, 10)}` : '作品展示' }
  }
  if (parsed.type === 'custom') return { type: 'custom', label: '自定义路径' }
  return { type: parsed.type, label: BANNER_JUMP_FIXED[parsed.type]?.label || parsed.type }
}

function buildBannerTargetPathFromForm() {
  const form = elements.bannerForm?.elements
  if (!form) return ''
  const type = String(form.jumpType?.value || 'none')
  if (type === 'none') return ''
  if (BANNER_JUMP_FIXED[type]) return BANNER_JUMP_FIXED[type].path
  if (type === 'template') return templateBannerPath(form.jumpTemplateId?.value)
  if (type === 'job') return jobBannerPath(form.jumpJobId?.value)
  if (type === 'custom') {
    let p = String(form.jumpCustomPath?.value || '').trim()
    if (p && !p.startsWith('/')) p = `/${p}`
    return p
  }
  return ''
}

function updateBannerJumpUI() {
  if (!elements.bannerForm) return
  const form = elements.bannerForm.elements
  const type = String(form.jumpType?.value || 'none')
  if (elements.bannerJumpTemplateField) elements.bannerJumpTemplateField.hidden = type !== 'template'
  if (elements.bannerJumpJobField) elements.bannerJumpJobField.hidden = type !== 'job'
  if (elements.bannerJumpCustomField) elements.bannerJumpCustomField.hidden = type !== 'custom'
  const path = buildBannerTargetPathFromForm()
  if (form.targetPath) form.targetPath.value = path
  if (elements.bannerJumpPreview) {
    const desc = describeBannerJump(path)
    elements.bannerJumpPreview.textContent = path
      ? `当前跳转：${desc.label} → ${path}`
      : '当前跳转：无（点击 Banner 无反应）'
  }
}

async function fillBannerTemplateOptions(selectedId = '') {
  const select = elements.bannerJumpTemplateId
  if (!select) return
  let list = Array.isArray(state.templates) ? state.templates.slice() : []
  if (!list.length) {
    try {
      const result = await api('/api/admin/templates?page=1&pageSize=100&status=all')
      list = result.templates || []
      if (list.length) state.templates = list
    } catch (error) {
      /* keep empty */
    }
  }
  const enabled = list.filter(item => item.enabled !== false)
  const pool = enabled.length ? enabled : list
  select.innerHTML = '<option value="">请选择模板</option>' + pool.map(item =>
    `<option value="${escapeHtml(item.id)}">${escapeHtml(item.name)}（${escapeHtml(item.id)}）</option>`
  ).join('')
  if (selectedId) {
    if (![...select.options].some(opt => opt.value === selectedId)) {
      select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(selectedId)}">${escapeHtml(selectedId)}</option>`)
    }
    select.value = selectedId
  }
}

function applyBannerJumpToForm(path) {
  const parsed = parseBannerJump(path)
  const form = elements.bannerForm.elements
  if (form.jumpType) form.jumpType.value = parsed.type
  if (form.jumpJobId) form.jumpJobId.value = parsed.jobId || ''
  if (form.jumpCustomPath) form.jumpCustomPath.value = parsed.customPath || ''
  return parsed
}

async function openBannerFromJob(job) {
  if (!job || job.status !== 'succeeded') {
    showToast('仅已完成的作品可设为 Banner', true)
    return
  }
  const hasVisual = Boolean(
    (job.results && job.results.length)
    || job.coverUrl
    || job.coverFullUrl
    || (job.results && job.results[0] && (job.results[0].url || job.results[0].thumbUrl))
  )
  if (!hasVisual) {
    showToast('该作品没有可用的生成图', true)
    return
  }
  try {
    showToast('正在创建 Banner 并设置封面…')
    const result = await api(`/api/admin/jobs/${encodeURIComponent(job.id)}/banner`, {
      method: 'POST',
      json: {
        title: job.templateName || '精选作品',
        subtitle: '点击查看作品效果',
        badge: '作品',
        palette: job.templatePalette || '#e9f7f2',
        titleColor: '#ffffff',
        subtitleColor: '#f5f7f6',
        badgeColor: '#ffffff',
        showOriginals: false,
        enabled: true
      }
    })
    const banner = result.banner
    if (!banner?.imageUrl && !banner?.imageFullUrl) {
      throw new Error('Banner 已创建但封面未写入，请重试或手动上传图片')
    }
    await loadOverview()
    showToast(result.message || '已创建 Banner，封面已使用作品图')
    // Switch to banners view so admin can see the new entry with cover
    const bannersNav = document.querySelector('[data-view="banners"]')
    if (bannersNav) bannersNav.click()
  } catch (error) {
    showToast(error.message || '创建 Banner 失败', true)
  }
}

async function loadMessagesPage() {
  await Promise.all([loadAnnouncements(), loadSubscribeStats()])
}

function fillAnnouncementCarouselForm(carousel = {}) {
  if (!elements.announcementCarouselForm) return
  const form = elements.announcementCarouselForm.elements
  if (form.announcementSwitchIntervalMs) {
    form.announcementSwitchIntervalMs.value = Number(carousel.intervalMs) || 4500
  }
  if (form.announcementCircular) {
    form.announcementCircular.checked = carousel.circular !== false
  }
}

function updateAnnouncementMdPreview() {
  if (!elements.announcementMdPreview) return
  const source = elements.announcementContent?.value || ''
  const md = globalThis.HuayangMarkdown
  if (!source.trim()) {
    elements.announcementMdPreview.classList.add('muted')
    elements.announcementMdPreview.textContent = '输入内容后在此预览渲染效果'
    return
  }
  elements.announcementMdPreview.classList.remove('muted')
  if (md && typeof md.mdToHtml === 'function') {
    elements.announcementMdPreview.innerHTML = md.mdToHtml(source)
  } else {
    elements.announcementMdPreview.textContent = source
  }
}

function resetAnnouncementForm() {
  state.editingAnnouncementId = ''
  if (elements.announcementForm) elements.announcementForm.reset()
  if (elements.announcementForm?.elements?.enabled) {
    elements.announcementForm.elements.enabled.checked = true
  }
  if (elements.announcementForm?.elements?.displayMode) {
    elements.announcementForm.elements.displayMode.value = 'popup'
  }
  if (elements.announcementFormTitle) elements.announcementFormTitle.textContent = '发布新公告'
  if (elements.announcementFormSubmit) elements.announcementFormSubmit.textContent = '发布公告'
  if (elements.announcementFormReset) elements.announcementFormReset.hidden = true
  updateAnnouncementMdPreview()
}

function openAnnouncementEdit(item) {
  if (!item || !elements.announcementForm) return
  state.editingAnnouncementId = item.id
  const form = elements.announcementForm.elements
  form.title.value = item.title || ''
  form.content.value = item.content || ''
  if (form.displayMode) form.displayMode.value = item.displayMode === 'silent' ? 'silent' : 'popup'
  form.enabled.checked = item.enabled !== false
  if (elements.announcementFormTitle) elements.announcementFormTitle.textContent = '编辑公告'
  if (elements.announcementFormSubmit) elements.announcementFormSubmit.textContent = '保存修改'
  if (elements.announcementFormReset) elements.announcementFormReset.hidden = false
  updateAnnouncementMdPreview()
  elements.announcementForm.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
}

async function loadAnnouncements() {
  if (!elements.announcementRows) return
  elements.announcementRows.innerHTML = emptyRow(6, '加载中...')
  const result = await api('/api/admin/announcements')
  fillAnnouncementCarouselForm(result.carousel || {})
  state.announcementListCache = result.announcements || []
  const md = globalThis.HuayangMarkdown
  elements.announcementRows.innerHTML = (result.announcements || []).map(item => {
    const plain = md && md.mdToPlain ? md.mdToPlain(item.content || '') : String(item.content || '')
    return `
    <tr>
      <td class="col-time">${escapeHtml(item.createdTime)}</td>
      <td class="col-title">
        <strong>${escapeHtml(item.title)}</strong>
        ${item.source === 'campaign' ? '<span class="cell-subtitle">活动同步</span>' : ''}
      </td>
      <td class="col-content"><div class="messages-announce-content" title="${escapeHtml(plain)}">${escapeHtml(plain)}</div></td>
      <td class="col-status"><span class="status-pill${item.displayMode === 'silent' ? '' : ' is-active'}">${escapeHtml(item.displayModeLabel || (item.displayMode === 'silent' ? '静默' : '弹窗'))}</span></td>
      <td class="col-status"><span class="status-pill${item.enabled ? ' is-active' : ''}">${item.enabled ? '启用' : '停用'}</span></td>
      <td class="col-actions row-actions">
        <button class="row-button" data-announcement-action="edit" data-id="${escapeHtml(item.id)}" type="button">编辑</button>
        <button class="row-button" data-announcement-action="toggle" data-id="${escapeHtml(item.id)}" data-enabled="${item.enabled ? '1' : '0'}" type="button">${item.enabled ? '停用' : '启用'}</button>
        <button class="row-button" data-announcement-action="delete" data-id="${escapeHtml(item.id)}" type="button">删除</button>
      </td>
    </tr>
  `
  }).join('') || emptyRow(6, '暂无站内公告')
}

async function loadSubscribeStats() {
  const setStats = (template, eligible, total, hint) => {
    if (elements.subscribeStatTemplate) elements.subscribeStatTemplate.textContent = template
    if (elements.subscribeStatEligible) elements.subscribeStatEligible.textContent = eligible
    if (elements.subscribeStatTotal) elements.subscribeStatTotal.textContent = total
    if (elements.subscribeStatsHint) elements.subscribeStatsHint.textContent = hint
  }
  if (!elements.subscribeStatsHint && !elements.subscribeStatTemplate) return
  try {
    const result = await api('/api/admin/subscribe-stats')
    if (!result.subscribeConfigured) {
      setStats('未配置', '—', '—', '请设置 WECHAT_SUBSCRIBE_TEMPLATE_ID 等环境变量后再推送')
      return
    }
    const eligible = Number(result.eligibleUsers || 0)
    const total = Number(result.totalUsers || 0)
    setStats(
      '已配置',
      `${eligible} 人`,
      `${total} 人`,
      '可尝试推送 = 曾在生成时授权过订阅的用户；实际送达还受微信一次性授权限制'
    )
  } catch (error) {
    setStats('—', '—', '—', error.message || '无法加载订阅统计')
  }
}

function templateById(id) {
  return (state.templates || []).find(item => item.id === id)
}

function openTemplateDialog(template = null) {
  state.editingTemplateId = template?.id || ''
  elements.templateDialogTitle.textContent = template ? '编辑模板' : '新增模板'
  elements.templateForm.reset()
  const form = elements.templateForm.elements
  const idField = document.querySelector('#templateIdField')
  if (idField) idField.hidden = !template
  if (form.id) {
    form.id.readOnly = true
    form.id.required = false
  }
  fillCategorySelect(templateCategoryIds(template))
  if (template) {
    for (const key of ['id', 'name', 'shortName', 'cost', 'popularity', 'sortOrder', 'badge', 'palette', 'description', 'prompt']) {
      if (form[key]) form[key].value = template[key] ?? ''
    }
    form.tags.value = (template.tags || []).join('，')
    form.enabled.checked = template.enabled
  } else {
    if (form.id) form.id.value = ''
    form.enabled.checked = true
    form.cost.value = 2
    form.popularity.value = 0
    form.sortOrder.value = ((Number(state.data?.templateCount) || state.templateQuery.total || 0) + 1) * 10
    form.palette.value = 'linear-gradient(145deg, #f7b6c2, #f8dda0, #a8daca)'
    form.shortName.value = ''
  }
  if (!categoryList().length) {
    showToast('请先在「模板分类」中创建分类', true)
  }
  elements.templateDialog.showModal()
}

function categoryById(id) {
  return categoryList().find(item => item.id === id)
}

function openCategoryDialog(category = null) {
  state.editingCategoryId = category?.id || ''
  elements.categoryDialogTitle.textContent = category ? '编辑分类' : '新增分类'
  elements.categoryForm.reset()
  const form = elements.categoryForm.elements
  const idField = document.querySelector('#categoryIdField')
  if (category) {
    form.id.value = category.id
    form.id.readOnly = true
    form.id.required = false
    if (idField) idField.hidden = false
    form.name.value = category.name
    form.sortOrder.value = Number(category.sortOrder || 0)
    form.enabled.checked = category.enabled !== false
  } else {
    form.id.value = ''
    form.id.readOnly = false
    form.id.required = false
    if (idField) idField.hidden = false
    form.sortOrder.value = (categoryList().length + 1) * 10
    form.enabled.checked = true
  }
  elements.categoryDialog.showModal()
}

function templatePayload(form) {
  const values = new FormData(form)
  const categories = selectedCategoryIds(form)
  if (!categories.length) {
    throw new Error('请至少选择一个模板分类')
  }
  const payload = {
    name: String(values.get('name') || ''),
    shortName: String(values.get('shortName') || ''),
    categories,
    category: categories[0],
    cost: Number(values.get('cost')),
    popularity: Number(values.get('popularity')),
    sortOrder: Number(values.get('sortOrder')),
    badge: String(values.get('badge') || ''),
    tags: String(values.get('tags') || '').split(/[,，]/).map(item => item.trim()).filter(Boolean),
    palette: String(values.get('palette') || ''),
    description: String(values.get('description') || ''),
    prompt: String(values.get('prompt') || ''),
    enabled: form.elements.enabled.checked
  }
  // id only when editing display; create omits id so server auto-generates
  if (state.editingTemplateId) payload.id = state.editingTemplateId
  return payload
}

function bannerById(id) {
  return state.data.banners.find(item => item.id === id)
}

const BANNER_TEXT_DEFAULTS = {
  dark: { titleColor: '#385c54', subtitleColor: '#71857f', badgeColor: '#2f8f78' },
  light: { titleColor: '#ffffff', subtitleColor: '#f5f7f6', badgeColor: '#ffffff' }
}

function toColorPickerValue(raw, fallback = '#385c54') {
  const value = String(raw || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const r = value[1]
    const g = value[2]
    const b = value[3]
    return `#${r}${r}${g}${g}${b}${b}`
  }
  return fallback
}

function setBannerColorField(name, value, pickerFallback) {
  const form = elements.bannerForm?.elements
  if (!form?.[name]) return
  const text = String(value || '').trim()
  form[name].value = text
  const picker = form[`${name}Picker`]
  if (picker) picker.value = toColorPickerValue(text || pickerFallback, pickerFallback)
}

function applyBannerTextPreset(preset) {
  const form = elements.bannerForm?.elements
  if (!form) return
  if (preset === 'clear') {
    setBannerColorField('titleColor', '', '#385c54')
    setBannerColorField('subtitleColor', '', '#71857f')
    setBannerColorField('badgeColor', '', '#2f8f78')
  } else {
    const colors = BANNER_TEXT_DEFAULTS[preset]
    if (!colors) return
    setBannerColorField('titleColor', colors.titleColor, colors.titleColor)
    setBannerColorField('subtitleColor', colors.subtitleColor, colors.subtitleColor)
    setBannerColorField('badgeColor', colors.badgeColor, colors.badgeColor)
  }
  updateBannerTextPreview()
}

function updateBannerTextPreview() {
  const preview = document.querySelector('#bannerTextPreview')
  const form = elements.bannerForm?.elements
  if (!preview || !form) return
  const title = String(form.title?.value || '标题预览').trim() || '标题预览'
  const subtitle = String(form.subtitle?.value || '副标题预览').trim() || '副标题预览'
  const badge = String(form.badge?.value || '角标').trim() || '角标'
  const titleColor = String(form.titleColor?.value || '').trim() || '#385c54'
  const subtitleColor = String(form.subtitleColor?.value || '').trim() || '#71857f'
  const badgeColor = String(form.badgeColor?.value || '').trim() || '#2f8f78'
  const palette = String(form.palette?.value || '').trim() || 'linear-gradient(135deg, #dff3ec, #fff0f3)'
  preview.style.background = palette
  const badgeEl = preview.querySelector('.banner-text-preview__badge')
  const titleEl = preview.querySelector('.banner-text-preview__title')
  const subEl = preview.querySelector('.banner-text-preview__sub')
  if (badgeEl) {
    badgeEl.textContent = badge
    badgeEl.style.color = badgeColor
  }
  if (titleEl) {
    titleEl.textContent = title
    titleEl.style.color = titleColor
  }
  if (subEl) {
    subEl.textContent = subtitle
    subEl.style.color = subtitleColor
  }
}

function syncBannerColorPickersFromText() {
  const form = elements.bannerForm?.elements
  if (!form) return
  if (form.palettePicker) {
    const solid = String(form.palette?.value || '').trim()
    if (/^#[0-9a-fA-F]{3,8}$/.test(solid)) form.palettePicker.value = toColorPickerValue(solid, '#dff3ec')
  }
  if (form.titleColorPicker) form.titleColorPicker.value = toColorPickerValue(form.titleColor?.value, '#385c54')
  if (form.subtitleColorPicker) form.subtitleColorPicker.value = toColorPickerValue(form.subtitleColor?.value, '#71857f')
  if (form.badgeColorPicker) form.badgeColorPicker.value = toColorPickerValue(form.badgeColor?.value, '#2f8f78')
}

async function openBannerDialog(banner = null) {
  state.editingBannerId = banner?.id || ''
  elements.bannerDialogTitle.textContent = banner ? '编辑 Banner' : '新增 Banner'
  elements.bannerForm.reset()
  const form = elements.bannerForm.elements
  if (banner) {
    for (const key of ['title', 'subtitle', 'badge', 'palette', 'sortOrder']) form[key].value = banner[key] ?? ''
    form.enabled.checked = banner.enabled
    setBannerColorField('titleColor', banner.titleColor || '', '#385c54')
    setBannerColorField('subtitleColor', banner.subtitleColor || '', '#71857f')
    setBannerColorField('badgeColor', banner.badgeColor || '', '#2f8f78')
    const parsed = applyBannerJumpToForm(banner.targetPath)
    await fillBannerTemplateOptions(parsed.templateId)
  } else {
    form.enabled.checked = true
    form.sortOrder.value = ((state.data?.banners?.length || 0) + 1) * 10
    form.palette.value = 'linear-gradient(135deg, #dff3ec, #fff0f3)'
    if (form.jumpType) form.jumpType.value = 'none'
    // Default readable dark text for gradient / soft backgrounds
    applyBannerTextPreset('dark')
    await fillBannerTemplateOptions('')
  }
  syncBannerColorPickersFromText()
  updateBannerJumpUI()
  updateBannerTextPreview()
  elements.bannerDialog.showModal()
}

function bannerPayload(form) {
  updateBannerJumpUI()
  const values = new FormData(form)
  const type = String(values.get('jumpType') || 'none')
  let targetPath = buildBannerTargetPathFromForm()
  if (type === 'template' && !String(values.get('jumpTemplateId') || '').trim()) {
    throw new Error('请选择要跳转的模板')
  }
  if (type === 'job' && !String(values.get('jumpJobId') || '').trim()) {
    throw new Error('请填写作品任务 ID')
  }
  if (type === 'custom' && !targetPath) {
    throw new Error('请填写自定义跳转路径')
  }
  const payload = {
    title: String(values.get('title') || ''),
    subtitle: String(values.get('subtitle') || ''),
    badge: String(values.get('badge') || ''),
    palette: String(values.get('palette') || ''),
    titleColor: String(values.get('titleColor') || '').trim(),
    subtitleColor: String(values.get('subtitleColor') || '').trim(),
    badgeColor: String(values.get('badgeColor') || '').trim(),
    targetPath,
    sortOrder: Number(values.get('sortOrder')),
    enabled: form.elements.enabled.checked
  }
  // When linking to a job showcase, also use that job's result as banner cover
  if (type === 'job') {
    const jobId = String(values.get('jumpJobId') || '').trim()
    if (jobId) payload.coverJobId = jobId
  }
  return payload
}

elements.loginForm.addEventListener('submit', async event => {
  event.preventDefault()
  elements.loginError.textContent = ''
  try {
    const result = await api('/api/admin/login', { method: 'POST', json: { password: elements.password.value } })
    state.token = result.token
    sessionStorage.setItem('huayang_admin_token', state.token)
    await loadOverview()
    elements.loginView.hidden = true
    elements.appView.hidden = false
  } catch (error) {
    elements.loginError.textContent = error.message
  }
})

document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)))
document.querySelector('#logoutButton').addEventListener('click', logout)

elements.settingsForm.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.settingsForm)
  try {
    const result = await api('/api/admin/settings', {
      method: 'PATCH',
      json: {
        welcomeCredits: Number(values.get('welcomeCredits')),
        checkinCredits: Number(values.get('checkinCredits')),
        shareTitle: String(values.get('shareTitle')),
        checkinStreakBonuses: collectStreakBonuses()
      }
    })
    state.data.settings = result.settings
    renderStreakBonusRows(result.settings?.checkinStreakBonuses || [])
    showToast('规则已保存')
  } catch (error) { showToast(error.message, true) }
})

document.querySelector('#addStreakBonusButton')?.addEventListener('click', () => {
  const current = collectStreakBonuses()
  current.push({ days: 14, bonus: 30 })
  renderStreakBonusRows(current)
})

document.querySelector('#streakBonusRows')?.addEventListener('click', event => {
  const btn = event.target.closest('[data-streak-remove]')
  if (!btn) return
  const current = collectStreakBonuses()
  current.splice(Number(btn.dataset.streakRemove), 1)
  renderStreakBonusRows(current.length ? current : [{ days: 3, bonus: 5 }])
})

document.querySelector('#communityForm')?.addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.currentTarget.elements
  try {
    const result = await api('/api/admin/settings', {
      method: 'PATCH',
      json: {
        communityWechatQrEnabled: Boolean(form.communityWechatQrEnabled?.checked),
        communityQqQrEnabled: Boolean(form.communityQqQrEnabled?.checked)
      }
    })
    if (state.data) {
      state.data.settings = {
        ...state.data.settings,
        ...result.settings,
        community: result.community || state.data.settings.community
      }
    }
    fillCommunityForm(state.data?.settings || {})
    showToast('社群引导已保存')
  } catch (error) {
    showToast(error.message, true)
  }
})

async function uploadCommunityQr(file, platform) {
  const form = new FormData()
  form.append('image', file)
  const result = await api(`/api/admin/community-qr?platform=${encodeURIComponent(platform)}`, {
    method: 'POST',
    body: form
  })
  if (state.data) {
    state.data.settings = {
      ...state.data.settings,
      ...result.settings,
      community: result.community || state.data.settings.community
    }
  }
  fillCommunityForm(state.data?.settings || {})
  showToast(result.message || '二维码已上传')
}

document.querySelector('#communityWechatQrUploadButton')?.addEventListener('click', () => {
  document.querySelector('#communityWechatQrInput')?.click()
})
document.querySelector('#communityQqQrUploadButton')?.addEventListener('click', () => {
  document.querySelector('#communityQqQrInput')?.click()
})

document.querySelector('#communityWechatQrInput')?.addEventListener('change', async event => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    await uploadCommunityQr(file, 'wechat')
  } catch (error) {
    showToast(error.message, true)
  } finally {
    event.target.value = ''
  }
})

document.querySelector('#communityQqQrInput')?.addEventListener('change', async event => {
  const file = event.target.files?.[0]
  if (!file) return
  try {
    await uploadCommunityQr(file, 'qq')
  } catch (error) {
    showToast(error.message, true)
  } finally {
    event.target.value = ''
  }
})

elements.shareRewardForm?.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.shareRewardForm)
  const form = elements.shareRewardForm.elements
  try {
    const result = await api('/api/admin/settings', {
      method: 'PATCH',
      json: {
        shareRewardEnabled: Boolean(form.shareRewardEnabled?.checked),
        shareOpenCredits: Number(values.get('shareOpenCredits')),
        shareOpenDailyLimit: Number(values.get('shareOpenDailyLimit')),
        inviteRewardEnabled: Boolean(form.inviteRewardEnabled?.checked),
        inviteLoginCredits: Number(values.get('inviteLoginCredits')),
        inviteFirstJobCredits: Number(values.get('inviteFirstJobCredits')),
        galleryPublishCredits: Number(values.get('galleryPublishCredits')),
        galleryLikeLikerCredits: Number(values.get('galleryLikeLikerCredits')),
        galleryLikeAuthorCredits: Number(values.get('galleryLikeAuthorCredits'))
      }
    })
    if (state.data) state.data.settings = { ...state.data.settings, ...result.settings }
    fillShareRewardForm(state.data?.settings || result.settings)
    showToast('分享与邀请规则已保存')
    loadShareGrowth().catch(() => {})
  } catch (error) { showToast(error.message, true) }
})

document.querySelector('#refreshShareStats')?.addEventListener('click', () => {
  loadShareGrowth().then(() => showToast('分享数据已刷新')).catch(error => showToast(error.message, true))
})

elements.shareEventFilterForm?.addEventListener('submit', event => {
  event.preventDefault()
  loadShareGrowth().catch(error => showToast(error.message, true))
})

if (elements.bannerCarouselForm) {
  elements.bannerCarouselForm.addEventListener('submit', async event => {
    event.preventDefault()
    const values = new FormData(elements.bannerCarouselForm)
    try {
      const result = await api('/api/admin/settings', {
        method: 'PATCH',
        json: {
          bannerSwitchMode: String(values.get('bannerSwitchMode') || 'auto'),
          bannerSwitchIntervalMs: Number(values.get('bannerSwitchIntervalMs')),
          bannerCircular: elements.bannerCarouselForm.elements.bannerCircular.checked
        }
      })
      state.data.settings = result.settings
      fillBannerCarouselForm()
      showToast('Banner 轮播规则已保存')
    } catch (error) { showToast(error.message, true) }
  })
}

elements.userFilterForm.addEventListener('submit', event => {
  event.preventDefault()
  loadUsers({ resetPage: true }).catch(error => showToast(error.message, true))
})
elements.transactionFilterForm.addEventListener('submit', event => {
  event.preventDefault()
  loadTransactions({ resetPage: true }).catch(error => showToast(error.message, true))
})

elements.transactionRows?.addEventListener('click', async event => {
  const copyEl = event.target.closest('[data-copy]')
  if (!copyEl) return
  await copyText(copyEl.dataset.copy, '关联单号已复制')
})
elements.jobFilterForm.addEventListener('submit', event => {
  event.preventDefault()
  const values = new FormData(elements.jobFilterForm)
  setJobShareFilter(String(values.get('share') || 'all'), { reload: false })
  loadJobs({ resetPage: true }).catch(error => showToast(error.message, true))
})

elements.jobFilterPublic?.addEventListener('click', () => {
  setJobShareFilter('public')
})

elements.jobShareChips?.addEventListener('click', event => {
  const button = event.target.closest('[data-job-share]')
  if (!button) return
  setJobShareFilter(button.dataset.jobShare)
})

wireListPager({
  ...listPagerUi('user'),
  getQuery: () => state.userQuery,
  loadFn: () => loadUsers()
})
wireListPager({
  ...listPagerUi('transaction'),
  getQuery: () => state.transactionQuery,
  loadFn: () => loadTransactions()
})
wireListPager({
  ...listPagerUi('job'),
  getQuery: () => state.jobQuery,
  loadFn: () => loadJobs()
})
wireListPager({
  ...listPagerUi('feedback'),
  getQuery: () => state.feedbackQuery,
  loadFn: () => loadFeedbacks()
})
wireListPager({
  ...listPagerUi('cdk'),
  getQuery: () => state.cdkQuery,
  loadFn: () => loadCdks()
})
wireListPager({
  ...listPagerUi('template'),
  getQuery: () => state.templateQuery,
  loadFn: () => loadTemplates()
})

elements.jobRows?.addEventListener('click', async event => {
  const copyEl = event.target.closest('[data-copy]')
  if (copyEl?.dataset.copy) {
    await copyText(copyEl.dataset.copy, '任务 ID 已复制')
    return
  }
  const copyIdBtn = event.target.closest('[data-job-action="copy-id"]')
  if (copyIdBtn) {
    await copyText(copyIdBtn.dataset.id || '', '任务 ID 已复制')
    return
  }
  const bannerBtn = event.target.closest('[data-job-action="banner"]')
  if (bannerBtn) {
    const job = (state.jobs || []).find(item => item.id === bannerBtn.dataset.id)
    if (!job) {
      showToast('请刷新列表后重试', true)
      return
    }
    openBannerFromJob(job)
    return
  }
  const deleteBtn = event.target.closest('[data-job-action="delete"]')
  if (deleteBtn) {
    const job = (state.jobs || []).find(item => item.id === deleteBtn.dataset.id)
    if (!job) {
      showToast('请刷新列表后重试', true)
      return
    }
    const label = job.templateName ? `${job.templateName}（${shortId(job.id, 10)}）` : shortId(job.id, 12)
    if (!window.confirm(`确认删除作品「${label}」？此操作不可恢复。`)) return
    try {
      await api(`/api/admin/jobs/${encodeURIComponent(job.id)}`, { method: 'DELETE' })
      await loadJobs()
      showToast('作品已删除')
    } catch (error) { showToast(error.message, true) }
    return
  }
  const button = event.target.closest('[data-job-action="add-sample"], [data-job-action="remove-sample"]')
  if (!button) return
  const jobId = button.dataset.jobId
  const resultId = button.dataset.resultId
  const action = button.dataset.jobAction
  if (!jobId || !resultId) return
  button.disabled = true
  try {
    const removing = action === 'remove-sample'
    const result = await api(`/api/admin/jobs/${encodeURIComponent(jobId)}/samples`, {
      method: removing ? 'DELETE' : 'POST',
      json: { resultId }
    })
    showToast(result.message || (removing ? '已取消加入' : '已加入更多效果参考'))
    await loadJobs()
  } catch (error) {
    showToast(error.message, true)
    button.disabled = false
  }
})

elements.feedbackFilterForm?.addEventListener('submit', event => {
  event.preventDefault()
  loadFeedbacks({ resetPage: true }).catch(error => showToast(error.message, true))
})

elements.feedbackRows?.addEventListener('click', event => {
  const button = event.target.closest('[data-feedback-action="reply"]')
  if (!button) return
  const feedback = (state.feedbacks || []).find(item => item.id === button.dataset.id)
  if (!feedback) {
    showToast('反馈不存在或已刷新', true)
    return
  }
  openFeedbackReplyDialog(feedback)
})

elements.feedbackReplyForm?.addEventListener('submit', async event => {
  event.preventDefault()
  const id = state.replyingFeedbackId
  if (!id) return
  const reply = String(elements.feedbackReplyInput?.value || '').trim()
  if (!reply) {
    showToast('请填写回复内容', true)
    return
  }
  try {
    const result = await api(`/api/admin/feedbacks/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      json: { reply }
    })
    elements.feedbackReplyDialog?.close()
    state.replyingFeedbackId = ''
    showToast(result.message || '回复已保存')
    await loadFeedbacks()
  } catch (error) {
    showToast(error.message, true)
  }
})

elements.userRows.addEventListener('click', async event => {
  const copyEl = event.target.closest('[data-copy]')
  if (copyEl?.dataset.copy) {
    await copyText(copyEl.dataset.copy, 'OpenID 已复制')
    return
  }
  const button = event.target.closest('[data-user-action]')
  if (!button) return
  const user = state.users.find(item => item.id === button.dataset.id)
  if (!user) return
  if (button.dataset.userAction === 'credits') {
    state.creditUserId = user.id
    elements.creditForm.reset()
    elements.creditUserLabel.textContent = `${user.nickname} · 当前 ${user.credits} 积分`
    elements.creditDialog.showModal()
    return
  }
  if (button.dataset.userAction === 'toggle') {
    if (!window.confirm(`确认${user.enabled ? '停用' : '启用'}用户“${user.nickname}”？`)) return
    try {
      await api(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: 'PATCH', json: { enabled: !user.enabled } })
      await loadUsers()
      showToast(user.enabled ? '用户已停用' : '用户已启用')
    } catch (error) { showToast(error.message, true) }
  }
})

elements.creditForm.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.creditForm)
  try {
    await api(`/api/admin/users/${encodeURIComponent(state.creditUserId)}/credits`, {
      method: 'POST', json: { amount: Number(values.get('amount')), reason: String(values.get('reason') || '') }
    })
    elements.creditDialog.close()
    await Promise.all([loadUsers(), loadOverview()])
    showToast('用户积分已调整并记录流水')
  } catch (error) { showToast(error.message, true) }
})

document.querySelector('#addBannerButton').addEventListener('click', () => openBannerDialog())
elements.bannerRows.addEventListener('click', async event => {
  const button = event.target.closest('[data-banner-action]')
  if (!button) return
  const banner = bannerById(button.dataset.id)
  if (!banner) return
  if (button.dataset.bannerAction === 'edit') openBannerDialog(banner)
  if (button.dataset.bannerAction === 'image') {
    state.bannerImageId = banner.id
    elements.bannerImageInput.click()
  }
  if (button.dataset.bannerAction === 'toggle') {
    try {
      await api(`/api/admin/banners/${encodeURIComponent(banner.id)}`, { method: 'PATCH', json: { enabled: !banner.enabled } })
      await loadOverview()
      showToast(banner.enabled ? 'Banner 已停用' : 'Banner 已启用')
    } catch (error) { showToast(error.message, true) }
  }
  if (button.dataset.bannerAction === 'delete') {
    if (!window.confirm(`确认删除 Banner「${banner.title || banner.id}」？此操作不可恢复。`)) return
    try {
      await api(`/api/admin/banners/${encodeURIComponent(banner.id)}`, { method: 'DELETE' })
      await loadOverview()
      showToast('Banner 已删除')
    } catch (error) { showToast(error.message, true) }
  }
})

elements.bannerForm.addEventListener('submit', async event => {
  event.preventDefault()
  try {
    const payload = bannerPayload(elements.bannerForm)
    // If linking to a job showcase, ensure the job is publicly viewable
    const jumpType = String(elements.bannerForm.elements.jumpType?.value || '')
    const jobId = String(elements.bannerForm.elements.jumpJobId?.value || '').trim()
    if (jumpType === 'job' && jobId) {
      await api(`/api/admin/jobs/${encodeURIComponent(jobId)}/public-share`, {
        method: 'POST',
        json: { enabled: true, showOriginals: false }
      })
    }
    if (state.editingBannerId) await api(`/api/admin/banners/${encodeURIComponent(state.editingBannerId)}`, { method: 'PATCH', json: payload })
    else await api('/api/admin/banners', { method: 'POST', json: payload })
    elements.bannerDialog.close()
    await loadOverview()
    showToast(
      jumpType === 'job'
        ? 'Banner 已保存（作品已公开，封面已用生成图）'
        : 'Banner 已保存'
    )
  } catch (error) { showToast(error.message, true) }
})

function wireBannerJumpFields() {
  const form = elements.bannerForm
  if (!form) return
  const refresh = () => updateBannerJumpUI()
  elements.bannerJumpType?.addEventListener('change', refresh)
  elements.bannerJumpTemplateId?.addEventListener('change', refresh)
  elements.bannerJumpJobId?.addEventListener('input', refresh)
  elements.bannerJumpCustomPath?.addEventListener('input', refresh)
}
wireBannerJumpFields()

function wireBannerColorFields() {
  const form = elements.bannerForm
  if (!form) return
  const els = form.elements

  const bindPair = (textName, pickerName, onPicker) => {
    const text = els[textName]
    const picker = els[pickerName]
    picker?.addEventListener('input', () => {
      if (text) text.value = picker.value
      if (onPicker) onPicker(picker.value)
      updateBannerTextPreview()
    })
    text?.addEventListener('input', () => {
      const v = String(text.value || '').trim()
      if (picker && /^#[0-9a-fA-F]{6}$/.test(v)) picker.value = v
      else if (picker && /^#[0-9a-fA-F]{3}$/.test(v)) picker.value = toColorPickerValue(v)
      updateBannerTextPreview()
    })
  }

  // Palette picker only writes solid hex (gradient stays in text field)
  bindPair('palette', 'palettePicker', value => {
    if (els.palette) els.palette.value = value
  })
  bindPair('titleColor', 'titleColorPicker')
  bindPair('subtitleColor', 'subtitleColorPicker')
  bindPair('badgeColor', 'badgeColorPicker')

  form.querySelectorAll('[data-banner-text-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyBannerTextPreset(btn.dataset.bannerTextPreset))
  })

  ;['title', 'subtitle', 'badge'].forEach(name => {
    els[name]?.addEventListener('input', updateBannerTextPreview)
  })
}
wireBannerColorFields()

elements.bannerImageInput.addEventListener('change', async () => {
  const file = elements.bannerImageInput.files[0]
  if (!file || !state.bannerImageId) return
  const form = new FormData()
  form.append('image', file)
  try {
    await api(`/api/admin/banners/${encodeURIComponent(state.bannerImageId)}/image`, { method: 'POST', body: form })
    await loadOverview()
    showToast('Banner 图片已更新')
  } catch (error) { showToast(error.message, true) }
  elements.bannerImageInput.value = ''
})

document.querySelector('#addTemplateButton').addEventListener('click', () => openTemplateDialog())
document.querySelector('#addCategoryButton')?.addEventListener('click', () => openCategoryDialog())

if (elements.categoryRows) {
  elements.categoryRows.addEventListener('click', async event => {
    const button = event.target.closest('[data-category-action]')
    if (!button) return
    const category = categoryById(button.dataset.id)
    if (!category) return
    if (button.dataset.categoryAction === 'edit') {
      openCategoryDialog(category)
      return
    }
    if (button.dataset.categoryAction === 'toggle') {
      try {
        await api(`/api/admin/categories/${encodeURIComponent(category.id)}`, {
          method: 'PATCH',
          json: { enabled: !category.enabled }
        })
        await loadOverview()
        showToast(category.enabled ? '分类已停用' : '分类已启用')
      } catch (error) { showToast(error.message, true) }
      return
    }
    if (button.dataset.categoryAction === 'delete') {
      if (!window.confirm(`确认删除分类“${category.name}”？`)) return
      try {
        await api(`/api/admin/categories/${encodeURIComponent(category.id)}`, { method: 'DELETE' })
        await loadOverview()
        showToast('分类已删除')
      } catch (error) { showToast(error.message, true) }
    }
  })
}

if (elements.categoryForm) {
  elements.categoryForm.addEventListener('submit', async event => {
    event.preventDefault()
    const values = new FormData(elements.categoryForm)
    const payload = {
      name: String(values.get('name') || ''),
      sortOrder: Number(values.get('sortOrder')),
      enabled: elements.categoryForm.elements.enabled.checked
    }
    const idValue = String(values.get('id') || '').trim()
    if (!state.editingCategoryId && idValue) payload.id = idValue
    try {
      if (state.editingCategoryId) {
        await api(`/api/admin/categories/${encodeURIComponent(state.editingCategoryId)}`, {
          method: 'PATCH',
          json: payload
        })
      } else {
        await api('/api/admin/categories', { method: 'POST', json: payload })
      }
      elements.categoryDialog.close()
      await loadOverview()
      showToast('分类已保存')
    } catch (error) { showToast(error.message, true) }
  })
}

elements.templateRows.addEventListener('click', async event => {
  const button = event.target.closest('[data-template-action]')
  if (!button) return
  const template = templateById(button.dataset.id)
  if (!template) {
    showToast('模板不在当前页，请刷新列表', true)
    return
  }
  if (button.dataset.templateAction === 'edit') openTemplateDialog(template)
  if (button.dataset.templateAction === 'cover') {
    state.coverTemplateId = template.id
    elements.coverInput.click()
  }
  if (button.dataset.templateAction === 'toggle') {
    try {
      await api(`/api/admin/templates/${encodeURIComponent(template.id)}`, { method: 'PATCH', json: { enabled: !template.enabled } })
      await Promise.all([loadTemplates(), loadOverview()])
      showToast(template.enabled ? '模板已停用' : '模板已启用')
    } catch (error) { showToast(error.message, true) }
  }
  if (button.dataset.templateAction === 'delete') {
    if (!window.confirm(`确认删除模板「${template.name || template.id}」？此操作不可恢复。`)) return
    try {
      await api(`/api/admin/templates/${encodeURIComponent(template.id)}`, { method: 'DELETE' })
      await Promise.all([loadTemplates(), loadOverview()])
      showToast('模板已删除')
    } catch (error) { showToast(error.message, true) }
  }
})

elements.templateForm.addEventListener('submit', async event => {
  event.preventDefault()
  try {
    const payload = templatePayload(elements.templateForm)
    if (state.editingTemplateId) {
      delete payload.id
      await api(`/api/admin/templates/${encodeURIComponent(state.editingTemplateId)}`, { method: 'PATCH', json: payload })
    } else {
      delete payload.id
      await api('/api/admin/templates', { method: 'POST', json: payload })
    }
    elements.templateDialog.close()
    // Keep current page after create/edit so user stays on the list page they were viewing
    await Promise.all([loadTemplates(), loadOverview()])
    showToast('模板已保存')
  } catch (error) { showToast(error.message, true) }
})

elements.coverInput.addEventListener('change', async () => {
  const file = elements.coverInput.files[0]
  if (!file || !state.coverTemplateId) return
  const form = new FormData()
  form.append('image', file)
  try {
    await api(`/api/admin/templates/${encodeURIComponent(state.coverTemplateId)}/cover`, { method: 'POST', body: form })
    await loadTemplates()
    showToast('模板封面已更新')
  } catch (error) { showToast(error.message, true) }
  elements.coverInput.value = ''
})

if (elements.templateFilterForm) {
  elements.templateFilterForm.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      await loadTemplates({ resetPage: true })
    } catch (error) {
      showToast(error.message, true)
    }
  })
}

document.querySelector('#addPackageButton').addEventListener('click', () => {
  elements.packageForm.reset()
  elements.packageForm.elements.bonus.value = 0
  elements.packageForm.elements.sortOrder.value = (state.data.packages.length + 1) * 10
  elements.packageDialog.showModal()
})

elements.packageForm.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.packageForm)
  try {
    await api('/api/admin/packages', {
      method: 'POST',
      json: {
        id: String(values.get('id')), credits: Number(values.get('credits')), bonus: Number(values.get('bonus')),
        priceFen: Math.round(Number(values.get('priceYuan')) * 100), badge: String(values.get('badge') || ''),
        sortOrder: Number(values.get('sortOrder')), enabled: true
      }
    })
    elements.packageDialog.close()
    await loadOverview()
    showToast('充值套餐已添加')
  } catch (error) { showToast(error.message, true) }
})

elements.packageList.addEventListener('submit', async event => {
  const form = event.target.closest('[data-package-id]')
  if (!form) return
  event.preventDefault()
  const values = new FormData(form)
  try {
    await api(`/api/admin/packages/${encodeURIComponent(form.dataset.packageId)}`, {
      method: 'PATCH',
      json: {
        credits: Number(values.get('credits')), bonus: Number(values.get('bonus')),
        priceFen: Math.round(Number(values.get('priceYuan')) * 100), badge: String(values.get('badge') || ''),
        enabled: form.elements.enabled.checked
      }
    })
    await loadOverview()
    showToast('充值套餐已保存')
  } catch (error) { showToast(error.message, true) }
})

elements.cdkExpireType?.addEventListener('change', syncCdkExpireFields)
syncCdkExpireFields()

elements.cdkGenerateForm?.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.cdkGenerateForm)
  const expireType = String(values.get('expireType') || 'never')
  let expiresAt = ''
  if (expireType === 'custom') {
    const raw = String(values.get('expiresAt') || '').trim()
    if (!raw) {
      showToast('请选择自定义截止日期', true)
      return
    }
    expiresAt = new Date(raw).toISOString()
  }
  try {
    const result = await api('/api/admin/cdks', {
      method: 'POST',
      json: {
        credits: Number(values.get('credits')),
        count: Number(values.get('count')),
        maxUses: Number(values.get('maxUses')),
        customCode: String(values.get('customCode') || ''),
        expireType,
        expiresAt,
        note: String(values.get('note') || '')
      }
    })
    const codes = (result.cdks || []).map(item => item.code).join('\n')
    if (codes && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(codes).catch(() => {})
    }
    showToast(`已生成 ${result.count || 0} 个 CDK${codes ? '（已复制）' : ''}`)
    // New codes are newest-first; jump to page 1 so they are visible
    await loadCdks({ resetPage: true })
  } catch (error) { showToast(error.message, true) }
})

async function copyText(text, okMessage) {
  const value = String(text || '')
  if (!value) return
  try {
    if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value)
    else {
      const input = document.createElement('input')
      input.value = value
      document.body.appendChild(input)
      input.select()
      document.execCommand('copy')
      input.remove()
    }
    showToast(okMessage || '已复制')
  } catch (error) {
    showToast('复制失败，请手动选择', true)
  }
}

elements.cdkFilterForm?.addEventListener('submit', event => {
  event.preventDefault()
  const values = new FormData(elements.cdkFilterForm)
  setCdkStatusFilter(String(values.get('status') || 'all'), { reload: false })
  loadCdks({ resetPage: true }).catch(error => showToast(error.message, true))
})

elements.cdkFilterUnused?.addEventListener('click', () => {
  setCdkStatusFilter('unused')
})

elements.cdkStatusChips?.addEventListener('click', event => {
  const button = event.target.closest('[data-cdk-status]')
  if (!button) return
  setCdkStatusFilter(button.dataset.cdkStatus)
})

document.querySelector('#refreshCdkList')?.addEventListener('click', () => {
  loadCdks().then(() => showToast('CDK 列表已刷新')).catch(error => showToast(error.message, true))
})

elements.cdkRows?.addEventListener('click', async event => {
  const button = event.target.closest('[data-cdk-action]')
  if (!button) return
  if (button.dataset.cdkAction === 'copy') {
    await copyText(button.dataset.code || '', `已复制 ${button.dataset.code || ''}`)
    return
  }
  if (button.dataset.cdkAction === 'edit') {
    const item = state.cdkListCache.find(entry => entry.id === button.dataset.id)
    if (!item) {
      showToast('请刷新列表后重试', true)
      return
    }
    openCdkEditDialog(item)
    return
  }
  if (button.dataset.cdkAction === 'revoke') {
    const code = button.dataset.code || ''
    if (!window.confirm(`确认撤销兑换码 ${code}？\n撤销后不可再兑换，历史兑换记录保留。`)) return
    try {
      await api(`/api/admin/cdks/${encodeURIComponent(button.dataset.id)}/revoke`, { method: 'POST' })
      showToast('兑换码已撤销')
      await loadCdks()
    } catch (error) { showToast(error.message, true) }
    return
  }
  if (button.dataset.cdkAction === 'delete') {
    if (!window.confirm('确认删除该未使用的 CDK？')) return
    try {
      await api(`/api/admin/cdks/${encodeURIComponent(button.dataset.id)}`, { method: 'DELETE' })
      showToast('CDK 已删除')
      await loadCdks()
    } catch (error) { showToast(error.message, true) }
  }
})

elements.cdkEditForm?.addEventListener('submit', async event => {
  event.preventDefault()
  if (!state.editingCdkId) return
  const values = new FormData(elements.cdkEditForm)
  try {
    await api(`/api/admin/cdks/${encodeURIComponent(state.editingCdkId)}`, {
      method: 'PATCH',
      json: {
        credits: Number(values.get('credits')),
        maxUses: Number(values.get('maxUses')),
        note: String(values.get('note') || '')
      }
    })
    elements.cdkEditDialog.close()
    state.editingCdkId = ''
    showToast('兑换码已更新')
    await loadCdks()
  } catch (error) { showToast(error.message, true) }
})

elements.announcementCarouselForm?.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.announcementCarouselForm)
  try {
    await api('/api/admin/settings', {
      method: 'PATCH',
      json: {
        announcementSwitchIntervalMs: Number(values.get('announcementSwitchIntervalMs')),
        announcementCircular: Boolean(elements.announcementCarouselForm.elements.announcementCircular?.checked)
      }
    })
    showToast('公告滚动设置已保存')
  } catch (error) { showToast(error.message, true) }
})

elements.announcementFormReset?.addEventListener('click', () => {
  resetAnnouncementForm()
})

elements.announcementContent?.addEventListener('input', () => {
  updateAnnouncementMdPreview()
})

elements.announcementForm?.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.announcementForm)
  const payload = {
    title: String(values.get('title') || ''),
    content: String(values.get('content') || ''),
    displayMode: String(values.get('displayMode') || 'popup'),
    enabled: Boolean(elements.announcementForm.elements.enabled?.checked)
  }
  try {
    if (state.editingAnnouncementId) {
      await api(`/api/admin/announcements/${encodeURIComponent(state.editingAnnouncementId)}`, {
        method: 'PATCH',
        json: payload
      })
      showToast('公告已更新')
    } else {
      await api('/api/admin/announcements', {
        method: 'POST',
        json: payload
      })
      showToast('公告已发布')
    }
    resetAnnouncementForm()
    await loadAnnouncements()
  } catch (error) { showToast(error.message, true) }
})

elements.announcementRows?.addEventListener('click', async event => {
  const button = event.target.closest('[data-announcement-action]')
  if (!button) return
  const id = button.dataset.id
  if (button.dataset.announcementAction === 'edit') {
    const item = (state.announcementListCache || []).find(entry => entry.id === id)
    if (!item) {
      showToast('请刷新列表后重试', true)
      return
    }
    openAnnouncementEdit(item)
    return
  }
  if (button.dataset.announcementAction === 'toggle') {
    try {
      await api(`/api/admin/announcements/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        json: { enabled: button.dataset.enabled !== '1' }
      })
      showToast('公告状态已更新')
      await loadAnnouncements()
    } catch (error) { showToast(error.message, true) }
  }
  if (button.dataset.announcementAction === 'delete') {
    if (!window.confirm('确认删除该公告？')) return
    try {
      await api(`/api/admin/announcements/${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (state.editingAnnouncementId === id) resetAnnouncementForm()
      showToast('公告已删除')
      await loadAnnouncements()
    } catch (error) { showToast(error.message, true) }
  }
})

document.querySelector('#refreshSubscribeStats')?.addEventListener('click', () => {
  loadSubscribeStats().catch(error => showToast(error.message, true))
})

elements.subscribeBroadcastForm?.addEventListener('submit', async event => {
  event.preventDefault()
  if (!window.confirm('确认向可推送用户发送订阅消息？多数用户可能因未授权而失败。')) return
  const values = new FormData(elements.subscribeBroadcastForm)
  try {
    const result = await api('/api/admin/subscribe-broadcast', {
      method: 'POST',
      json: {
        style: String(values.get('style') || ''),
        status: String(values.get('status') || ''),
        tip: String(values.get('tip') || ''),
        page: String(values.get('page') || 'pages/home/index')
      }
    })
    showToast(result.message || '推送已提交')
    await loadSubscribeStats()
  } catch (error) { showToast(error.message, true) }
})

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => document.querySelector(`#${button.dataset.close}`).close())
})

function toLocalDateTimeInput(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = value => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalDateTimeInput(value) {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function campaignSummary(item) {
  if (item.type === 'template_promo') {
    const ids = (item.templateIds || []).length
    return `特惠 ${Number(item.costOverride)} 积分/张${ids ? ` · ${ids} 个模板` : ' · 全部模板'}`
  }
  if (item.type === 'checkin_boost') return `签到额外 +${Number(item.checkinBonus || 0)}`
  if (item.type === 'create_challenge') return `每完成创作 +${Number(item.createJobBonus || 0)}`
  if (item.type === 'invite_boost') return `邀请奖励 ×${Number(item.inviteBonusMultiplier || 1)}`
  if (item.type === 'gallery_boost') {
    return `花海发布 +${Number(item.galleryPublishBonus || 0)} · 送花 +${Number(item.galleryLikeBonus || 0)}`
  }
  return item.description || '—'
}

function syncCampaignFieldVisibility(type) {
  document.querySelectorAll('.campaign-field').forEach(field => {
    const keys = String(field.dataset.campaignFields || '').split(',').map(item => item.trim())
    field.hidden = !keys.includes(type)
  })
  if (type === 'template_promo') renderCampaignTemplatePicker()
}

async function ensureCampaignTemplateOptions() {
  if (Array.isArray(state.campaignTemplateOptions) && state.campaignTemplateOptions.length) {
    return state.campaignTemplateOptions
  }
  const result = await api('/api/admin/templates?page=1&pageSize=200&status=all')
  state.campaignTemplateOptions = (result.templates || []).map(item => ({
    id: item.id,
    name: item.name || item.id,
    cost: Number(item.originalCost ?? item.cost ?? 0),
    enabled: item.enabled !== false
  }))
  return state.campaignTemplateOptions
}

function getSelectedCampaignTemplateIds() {
  return [...document.querySelectorAll('#campaignTemplateList input[type="checkbox"]:checked')]
    .map(input => String(input.value || '').trim())
    .filter(Boolean)
}

function syncCampaignTemplateIdsInput() {
  const input = document.querySelector('#campaignTemplateIdsInput')
  if (input) input.value = getSelectedCampaignTemplateIds().join(',')
}

function renderCampaignTemplatePicker(selectedIds = null) {
  const host = document.querySelector('#campaignTemplateList')
  if (!host) return
  const selected = new Set(
    selectedIds == null
      ? getSelectedCampaignTemplateIds()
      : (selectedIds || []).map(String)
  )
  const list = state.campaignTemplateOptions || []
  host.innerHTML = list.map(item => `
    <label class="campaign-template-option">
      <input type="checkbox" value="${escapeHtml(item.id)}" ${selected.has(item.id) ? 'checked' : ''}>
      <span>
        <strong>${escapeHtml(item.name)}${item.enabled === false ? '（已停用）' : ''}</strong>
        <span>${escapeHtml(item.id)} · ${Number(item.cost || 0)} 积分</span>
      </span>
    </label>
  `).join('') || '<p class="muted">暂无模板，请先在「模板管理」创建</p>'
  syncCampaignTemplateIdsInput()
}

async function loadCampaigns() {
  const result = await api('/api/admin/campaigns')
  state.campaigns = result.campaigns || []
  renderCampaignRows()
}

function renderCampaignRows() {
  const host = document.querySelector('#campaignRows')
  if (!host) return
  host.innerHTML = (state.campaigns || []).map(item => `
    <tr>
      <td>
        <strong>${escapeHtml(item.name)}</strong>
        <span class="cell-subtitle">${escapeHtml(item.badge || '')}</span>
      </td>
      <td><span class="status-pill is-active">${escapeHtml(item.typeLabel || item.type)}</span></td>
      <td>${escapeHtml(formatDate(item.startAt))} ~ ${escapeHtml(formatDate(item.endAt))}</td>
      <td><span class="status-pill${item.active ? ' is-active' : ''}">${item.active ? '进行中' : (item.enabled === false ? '已停用' : '未开始/已结束')}</span></td>
      <td>${escapeHtml(campaignSummary(item))}</td>
      <td class="row-actions">
        <button class="row-button" type="button" data-campaign-action="edit" data-id="${escapeHtml(item.id)}">编辑</button>
        <button class="row-button row-button--danger" type="button" data-campaign-action="delete" data-id="${escapeHtml(item.id)}">删除</button>
      </td>
    </tr>
  `).join('') || emptyRow(6, '暂无活动，点击右上角新建')
}

async function openCampaignDialog(campaign = null) {
  const dialog = document.querySelector('#campaignDialog')
  const form = document.querySelector('#campaignForm')
  if (!dialog || !form) return
  state.editingCampaignId = campaign?.id || ''
  document.querySelector('#campaignDialogTitle').textContent = campaign ? '编辑活动' : '新建活动'
  form.reset()
  form.elements.name.value = campaign?.name || ''
  form.elements.type.value = campaign?.type || 'template_promo'
  form.elements.badge.value = campaign?.badge || ''
  form.elements.description.value = campaign?.description || ''
  form.elements.startAt.value = toLocalDateTimeInput(campaign?.startAt)
  form.elements.endAt.value = toLocalDateTimeInput(campaign?.endAt)
  form.elements.costOverride.value = Number(campaign?.costOverride ?? 1)
  form.elements.checkinBonus.value = Number(campaign?.checkinBonus ?? 2)
  form.elements.createJobBonus.value = Number(campaign?.createJobBonus ?? 5)
  form.elements.inviteBonusMultiplier.value = Number(campaign?.inviteBonusMultiplier ?? 2)
  form.elements.galleryPublishBonus.value = Number(campaign?.galleryPublishBonus ?? 3)
  form.elements.galleryLikeBonus.value = Number(campaign?.galleryLikeBonus ?? 1)
  form.elements.enabled.checked = campaign ? campaign.enabled !== false : true
  syncCampaignFieldVisibility(form.elements.type.value)
  try {
    await ensureCampaignTemplateOptions()
    renderCampaignTemplatePicker(campaign?.templateIds || [])
  } catch (error) {
    showToast(error.message || '加载模板列表失败', true)
  }
  dialog.showModal()
}

async function loadUserLevels() {
  const host = document.querySelector('#levelEditorList')
  if (!host) return
  const result = await api('/api/admin/user-levels')
  state.levels = result.levels || []
  state.userLevelsEnabled = Boolean(result.enabled)
  const toggle = document.querySelector('#userLevelsEnabledToggle')
  if (toggle) toggle.checked = state.userLevelsEnabled
  syncUserLevelsEnabledHint()
  renderLevelEditor()
}

function syncUserLevelsEnabledHint() {
  const hint = document.querySelector('#userLevelsEnabledHint')
  const toggle = document.querySelector('#userLevelsEnabledToggle')
  if (!hint) return
  const on = Boolean(toggle?.checked ?? state.userLevelsEnabled)
  hint.textContent = on
    ? '当前：已启用 — 小程序会按已启用的等级展示角标与称号。'
    : '当前：已停用 — 小程序不显示等级角标与称号。'
}

function renderLevelEditor() {
  const host = document.querySelector('#levelEditorList')
  if (!host) return
  const list = state.levels || []
  host.innerHTML = list.map((level, index) => {
    const c = level.conditions || {}
    return `
    <article class="level-card" data-level-index="${index}">
      <div class="level-card__head">
        <strong>${escapeHtml(level.name || `等级 ${index + 1}`)}</strong>
        <label class="toggle-field"><input type="checkbox" class="level-enabled" ${level.enabled !== false ? 'checked' : ''}><span>启用</span></label>
      </div>
      <div class="form-grid form-grid--dense">
        <label>等级 ID <input class="level-id" value="${escapeHtml(level.id || '')}" ${level.id ? 'readonly' : ''}></label>
        <label>名称 <input class="level-name" value="${escapeHtml(level.name || '')}" maxlength="40"></label>
        <label>称号 <input class="level-title" value="${escapeHtml(level.title || '')}" maxlength="40"></label>
        <label>角标文字 <input class="level-badge-text" value="${escapeHtml(level.badgeText || '芽')}" maxlength="2"></label>
        <label>角标色调
          <select class="level-badge-tone">
            ${['mint', 'coral', 'gold', 'rose', 'violet', 'sky'].map(tone =>
              `<option value="${tone}" ${level.badgeTone === tone ? 'selected' : ''}>${tone}</option>`
            ).join('')}
          </select>
        </label>
        <label>排序 <input class="level-sort" type="number" value="${Number(level.sortOrder || (index + 1) * 10)}"></label>
        <label>升级奖励积分 <input class="level-reward" type="number" min="0" value="${Number(level.rewardCredits || 0)}"></label>
        <label>最少签到天数 <input class="level-min-checkin" type="number" min="0" value="${Number(c.minCheckinDays || 0)}"></label>
        <label>最少完成创作 <input class="level-min-jobs" type="number" min="0" value="${Number(c.minCompletedJobs || 0)}"></label>
        <label>最少生成张数 <input class="level-min-images" type="number" min="0" value="${Number(c.minGeneratedImages || 0)}"></label>
        <label>最少分享次数 <input class="level-min-share" type="number" min="0" value="${Number(c.minShareCount || 0)}"></label>
        <label>最少邀请人数 <input class="level-min-invite" type="number" min="0" value="${Number(c.minInviteCount || 0)}"></label>
        <label>最少收到鲜花 <input class="level-min-flowers" type="number" min="0" value="${Number(c.minFlowersReceived || 0)}"></label>
        <label>最少活跃天数 <input class="level-min-active" type="number" min="0" value="${Number(c.minActiveDays || 0)}"></label>
      </div>
      <div class="row-actions">
        <button class="row-button row-button--danger" type="button" data-level-remove="${index}">删除此等级</button>
      </div>
    </article>`
  }).join('') || '<p class="muted">暂无等级，请点击「新增等级」</p>'
}

function collectLevelsFromEditor() {
  return [...document.querySelectorAll('#levelEditorList .level-card')].map((card, index) => ({
    id: String(card.querySelector('.level-id')?.value || `level-${index + 1}`).trim(),
    name: String(card.querySelector('.level-name')?.value || '').trim(),
    title: String(card.querySelector('.level-title')?.value || '').trim(),
    badgeText: String(card.querySelector('.level-badge-text')?.value || '芽').trim().slice(0, 2),
    badgeTone: String(card.querySelector('.level-badge-tone')?.value || 'mint'),
    sortOrder: Number(card.querySelector('.level-sort')?.value || (index + 1) * 10),
    rewardCredits: Number(card.querySelector('.level-reward')?.value || 0),
    enabled: Boolean(card.querySelector('.level-enabled')?.checked),
    conditions: {
      minCheckinDays: Number(card.querySelector('.level-min-checkin')?.value || 0),
      minCompletedJobs: Number(card.querySelector('.level-min-jobs')?.value || 0),
      minGeneratedImages: Number(card.querySelector('.level-min-images')?.value || 0),
      minShareCount: Number(card.querySelector('.level-min-share')?.value || 0),
      minInviteCount: Number(card.querySelector('.level-min-invite')?.value || 0),
      minFlowersReceived: Number(card.querySelector('.level-min-flowers')?.value || 0),
      minActiveDays: Number(card.querySelector('.level-min-active')?.value || 0)
    }
  }))
}

document.querySelector('#addLevelButton')?.addEventListener('click', () => {
  state.levels = collectLevelsFromEditor()
  state.levels.push({
    id: `level-${Date.now().toString(36)}`,
    name: '新等级',
    title: '新称号',
    badgeText: '新',
    badgeTone: 'mint',
    sortOrder: (state.levels.length + 1) * 10,
    rewardCredits: 0,
    enabled: true,
    conditions: {
      minCheckinDays: 0,
      minCompletedJobs: 0,
      minGeneratedImages: 0,
      minShareCount: 0,
      minInviteCount: 0,
      minFlowersReceived: 0,
      minActiveDays: 0
    }
  })
  renderLevelEditor()
})

document.querySelector('#saveLevelsButton')?.addEventListener('click', async () => {
  try {
    const levels = collectLevelsFromEditor()
    const enabled = Boolean(document.querySelector('#userLevelsEnabledToggle')?.checked)
    const result = await api('/api/admin/user-levels', {
      method: 'PUT',
      json: { enabled, levels }
    })
    state.levels = result.levels || []
    state.userLevelsEnabled = Boolean(result.enabled)
    const toggle = document.querySelector('#userLevelsEnabledToggle')
    if (toggle) toggle.checked = state.userLevelsEnabled
    syncUserLevelsEnabledHint()
    renderLevelEditor()
    showToast(result.message || '用户等级已保存')
  } catch (error) {
    showToast(error.message, true)
  }
})

document.querySelector('#userLevelsEnabledToggle')?.addEventListener('change', () => {
  syncUserLevelsEnabledHint()
})

document.querySelector('#levelEditorList')?.addEventListener('click', event => {
  const button = event.target.closest('[data-level-remove]')
  if (!button) return
  state.levels = collectLevelsFromEditor()
  state.levels.splice(Number(button.dataset.levelRemove), 1)
  renderLevelEditor()
})

document.querySelector('#addCampaignButton')?.addEventListener('click', () => openCampaignDialog())

document.querySelector('#campaignTypeSelect')?.addEventListener('change', event => {
  syncCampaignFieldVisibility(event.target.value)
})

document.querySelector('#campaignTemplateList')?.addEventListener('change', () => {
  syncCampaignTemplateIdsInput()
})

document.querySelector('#campaignTemplateClear')?.addEventListener('click', () => {
  renderCampaignTemplatePicker([])
})

document.querySelector('#campaignForm')?.addEventListener('submit', async event => {
  event.preventDefault()
  const form = event.currentTarget
  const values = new FormData(form)
  syncCampaignTemplateIdsInput()
  const payload = {
    name: String(values.get('name') || '').trim(),
    type: String(values.get('type') || 'template_promo'),
    badge: String(values.get('badge') || '').trim(),
    description: String(values.get('description') || '').trim(),
    startAt: fromLocalDateTimeInput(values.get('startAt')),
    endAt: fromLocalDateTimeInput(values.get('endAt')),
    templateIds: getSelectedCampaignTemplateIds(),
    costOverride: Number(values.get('costOverride') || 0),
    checkinBonus: Number(values.get('checkinBonus') || 0),
    createJobBonus: Number(values.get('createJobBonus') || 0),
    inviteBonusMultiplier: Number(values.get('inviteBonusMultiplier') || 1),
    galleryPublishBonus: Number(values.get('galleryPublishBonus') || 0),
    galleryLikeBonus: Number(values.get('galleryLikeBonus') || 0),
    enabled: Boolean(form.elements.enabled?.checked)
  }
  try {
    if (state.editingCampaignId) {
      await api(`/api/admin/campaigns/${encodeURIComponent(state.editingCampaignId)}`, {
        method: 'PATCH',
        json: payload
      })
      showToast('活动已更新')
    } else {
      await api('/api/admin/campaigns', { method: 'POST', json: payload })
      showToast('活动已创建')
    }
    document.querySelector('#campaignDialog')?.close()
    await loadCampaigns()
    // 活动同步公告会出现在消息推送列表
    if (typeof loadAnnouncements === 'function') {
      try { await loadAnnouncements() } catch (e) {}
    }
  } catch (error) {
    showToast(error.message, true)
  }
})

document.querySelector('#campaignRows')?.addEventListener('click', async event => {
  const button = event.target.closest('[data-campaign-action]')
  if (!button) return
  const id = button.dataset.id
  const campaign = (state.campaigns || []).find(item => item.id === id)
  if (button.dataset.campaignAction === 'edit') {
    openCampaignDialog(campaign)
    return
  }
  if (button.dataset.campaignAction === 'delete') {
    if (!window.confirm('确认删除该活动？关联的活动公告也会停用。')) return
    try {
      await api(`/api/admin/campaigns/${encodeURIComponent(id)}`, { method: 'DELETE' })
      showToast('活动已删除')
      await loadCampaigns()
      if (typeof loadAnnouncements === 'function') {
        try { await loadAnnouncements() } catch (e) {}
      }
    } catch (error) {
      showToast(error.message, true)
    }
  }
})

if (state.token) {
  loadOverview().then(() => {
    elements.loginView.hidden = true
    elements.appView.hidden = false
  }).catch(() => logout())
}
