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
  jobQuery: createPageQuery({ query: '', status: 'all' }),
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
  cdkListCache: []
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
  transactionRows: document.querySelector('#transactionRows'),
  transactionFilterForm: document.querySelector('#transactionFilterForm'),
  transactionPagerInfo: document.querySelector('#transactionPagerInfo'),
  transactionPrevPage: document.querySelector('#transactionPrevPage'),
  transactionNextPage: document.querySelector('#transactionNextPage'),
  transactionPageSize: document.querySelector('#transactionPageSize'),
  jobRows: document.querySelector('#jobRows'),
  jobFilterForm: document.querySelector('#jobFilterForm'),
  jobPagerInfo: document.querySelector('#jobPagerInfo'),
  jobPrevPage: document.querySelector('#jobPrevPage'),
  jobNextPage: document.querySelector('#jobNextPage'),
  jobPageSize: document.querySelector('#jobPageSize'),
  feedbackRows: document.querySelector('#feedbackRows'),
  feedbackFilterForm: document.querySelector('#feedbackFilterForm'),
  feedbackPagerInfo: document.querySelector('#feedbackPagerInfo'),
  feedbackPrevPage: document.querySelector('#feedbackPrevPage'),
  feedbackNextPage: document.querySelector('#feedbackNextPage'),
  feedbackPageSize: document.querySelector('#feedbackPageSize'),
  cdkPagerInfo: document.querySelector('#cdkPagerInfo'),
  cdkPrevPage: document.querySelector('#cdkPrevPage'),
  cdkNextPage: document.querySelector('#cdkNextPage'),
  cdkPageSize: document.querySelector('#cdkPageSize'),
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
  categoryRows: document.querySelector('#categoryRows'),
  packageList: document.querySelector('#packageList'),
  templateDialog: document.querySelector('#templateDialog'),
  templateDialogTitle: document.querySelector('#templateDialogTitle'),
  templateForm: document.querySelector('#templateForm'),
  templateCategorySelect: document.querySelector('#templateCategorySelect'),
  bannerDialog: document.querySelector('#bannerDialog'),
  bannerDialogTitle: document.querySelector('#bannerDialogTitle'),
  bannerForm: document.querySelector('#bannerForm'),
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
  bannerFillJobPath: document.querySelector('#bannerFillJobPath'),
  announcementForm: document.querySelector('#announcementForm'),
  announcementRows: document.querySelector('#announcementRows'),
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

function renderListPager({ infoEl, prevEl, nextEl, sizeEl, query }) {
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
}

function wireListPager({ prevEl, nextEl, sizeEl, getQuery, loadFn }) {
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
    infoEl: elements.templatePagerInfo,
    prevEl: elements.templatePrevPage,
    nextEl: elements.templateNextPage,
    sizeEl: elements.templatePageSize,
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
      infoEl: elements.templatePagerInfo,
      prevEl: elements.templatePrevPage,
      nextEl: elements.templateNextPage,
      sizeEl: elements.templatePageSize,
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
  fillShareRewardForm(settings)
  fillBannerCarouselForm()
}

function fillShareRewardForm(settings = {}) {
  const form = elements.shareRewardForm?.elements
  if (!form) return
  if (form.shareRewardEnabled) form.shareRewardEnabled.checked = settings.shareRewardEnabled !== false
  if (form.shareFriendCredits) form.shareFriendCredits.value = Number(settings.shareFriendCredits ?? 2)
  if (form.shareFriendDailyLimit) form.shareFriendDailyLimit.value = Number(settings.shareFriendDailyLimit ?? 3)
  if (form.shareTimelineCredits) form.shareTimelineCredits.value = Number(settings.shareTimelineCredits ?? 1)
  if (form.shareTimelineDailyLimit) form.shareTimelineDailyLimit.value = Number(settings.shareTimelineDailyLimit ?? 1)
  if (form.inviteRewardEnabled) form.inviteRewardEnabled.checked = settings.inviteRewardEnabled !== false
  if (form.inviteLoginCredits) form.inviteLoginCredits.value = Number(settings.inviteLoginCredits ?? 5)
  if (form.inviteFirstJobCredits) form.inviteFirstJobCredits.value = Number(settings.inviteFirstJobCredits ?? 10)
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
    ['邀请首作已奖', s.inviteFirstJobRewarded],
    ['邀请发奖积分', Number(s.inviteLoginCredits || 0) + Number(s.inviteFirstJobCredits || 0)]
  ]
  elements.shareStatsGrid.innerHTML = cards.map(([label, value], index) => `
    <div class="stat-card stat-card--share"><span>${escapeHtml(label)}</span><strong>${Number(value || 0)}</strong></div>
  `).join('')
  if (elements.shareStatsHint) {
    elements.shareStatsHint.textContent =
      `分享发奖累计 ${Number(s.shareRewardCredits || 0)} 积分 · 邀请登录奖 ${Number(s.inviteLoginCredits || 0)} · 首作奖 ${Number(s.inviteFirstJobCredits || 0)}`
  }
  if (elements.shareEventRows) {
    elements.shareEventRows.innerHTML = (listResult.events || []).map(item => `
      <tr>
        <td>${escapeHtml(item.createdTime)}</td>
        <td><strong>${escapeHtml(item.userNickname)}</strong><span class="cell-subtitle">${escapeHtml(item.userMaskedId)}</span></td>
        <td><span class="channel-pill channel-pill--${escapeHtml(item.channel)}">${escapeHtml(item.channelLabel)}</span></td>
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

function fillCategorySelect(selectedId = '') {
  const categories = categoryList()
  const options = categories.length
    ? categories.map(item => {
      const label = item.enabled === false ? `${item.name}（已停用）` : item.name
      return `<option value="${escapeHtml(item.id)}">${escapeHtml(label)}</option>`
    }).join('')
    : '<option value="">请先创建分类</option>'
  elements.templateCategorySelect.innerHTML = options
  if (selectedId && categories.some(item => item.id === selectedId)) {
    elements.templateCategorySelect.value = selectedId
  } else if (categories.length) {
    const enabled = categories.find(item => item.enabled !== false) || categories[0]
    elements.templateCategorySelect.value = enabled.id
  }
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
    return `<a class="job-media-thumb" href="${escapeHtml(full)}" target="_blank" rel="noreferrer" title="打开大图 ${index + 1}"><img src="${escapeHtml(thumb)}" alt=""></a>`
  }).join('')}</div>`
}

function resultThumbsWithSample(job) {
  const list = Array.isArray(job.results) ? job.results.filter(item => item?.url || item?.thumbUrl) : []
  if (!list.length) return `<span class="muted">${job.status === 'succeeded' ? '无' : '未出'}</span>`
  const canAdd = job.status === 'succeeded'
  return `<div class="job-media-row job-media-row--results">${list.map((item, index) => {
    const full = item.url || item.thumbUrl
    const thumb = item.thumbUrl || item.url
    const sampleBtn = canAdd
      ? (item.isSample
        ? `<button class="row-button sample-add-btn sample-add-btn--on" type="button" data-job-action="remove-sample" data-job-id="${escapeHtml(job.id)}" data-result-id="${escapeHtml(item.id)}">取消加入</button>`
        : `<button class="row-button sample-add-btn" type="button" data-job-action="add-sample" data-job-id="${escapeHtml(job.id)}" data-result-id="${escapeHtml(item.id)}">添加到更多效果</button>`)
      : ''
    return `<div class="job-result-cell">
      <a class="job-media-thumb" href="${escapeHtml(full)}" target="_blank" rel="noreferrer" title="打开大图 ${index + 1}"><img src="${escapeHtml(thumb)}" alt=""></a>
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
      <td><span class="tag">${escapeHtml(template.categoryLabel || categoryLabel(template.category))}</span></td>
      <td><div class="tag-list">${(template.tags || []).length ? template.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '<span class="muted">未设置</span>'}</div></td>
      <td>${Number(template.popularity).toLocaleString('zh-CN')}</td>
      <td>${Number(template.cost)}</td>
      <td>${Number(template.sortOrder)}</td>
      <td><span class="status-pill${template.enabled ? ' is-active' : ''}">${template.enabled ? '已启用' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-template-action="edit" data-id="${escapeHtml(template.id)}">编辑</button>
        <button class="row-button" data-template-action="cover" data-id="${escapeHtml(template.id)}">上传封面</button>
        <button class="row-button" data-template-action="toggle" data-id="${escapeHtml(template.id)}">${template.enabled ? '停用' : '启用'}</button>
      </div></td>
    </tr>
  `).join('') || emptyRow(8, '暂无模板')
}

function renderBanners() {
  fillBannerCarouselForm()
  elements.bannerRows.innerHTML = state.data.banners.map(banner => `
    <tr>
      <td><div class="template-cell">
        <div class="banner-thumb" style="background:${escapeHtml(banner.palette)}">${banner.imageUrl ? `<img src="${escapeHtml(banner.imageUrl)}" alt="">` : '<span>Banner</span>'}</div>
        <div><strong>${escapeHtml(banner.badge || '首页推荐')}</strong><span>${shortId(banner.id, 12)}</span></div>
      </div></td>
      <td><strong>${escapeHtml(banner.title)}</strong><span class="cell-subtitle">${escapeHtml(banner.subtitle || '-')}</span></td>
      <td><span class="path-cell" title="${escapeHtml(banner.targetPath)}">${escapeHtml(banner.targetPath || '无跳转')}</span></td>
      <td>${Number(banner.sortOrder)}</td>
      <td><span class="status-pill${banner.enabled ? ' is-active' : ''}">${banner.enabled ? '已启用' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-banner-action="edit" data-id="${escapeHtml(banner.id)}">编辑</button>
        <button class="row-button" data-banner-action="image" data-id="${escapeHtml(banner.id)}">上传图片</button>
        <button class="row-button" data-banner-action="toggle" data-id="${escapeHtml(banner.id)}">${banner.enabled ? '停用' : '启用'}</button>
      </div></td>
    </tr>
  `).join('') || emptyRow(6, '暂无 Banner')
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
    infoEl: elements.userPagerInfo,
    prevEl: elements.userPrevPage,
    nextEl: elements.userNextPage,
    sizeEl: elements.userPageSize,
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
      <td><strong>${escapeHtml(user.nickname || '微信用户')}</strong><span class="cell-subtitle">UID ${escapeHtml(shortId(user.id, 12))}</span></td>
      <td class="openid-cell">
        ${openid
          ? `<code class="openid-code" title="点击复制 OpenID" data-copy="${escapeHtml(openid)}">${escapeHtml(openid)}</code>`
          : '<span class="muted">—</span>'}
        ${unionid
          ? `<span class="cell-subtitle" title="unionid">union ${escapeHtml(shortId(unionid, 16))}</span>`
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
      infoEl: elements.userPagerInfo,
      prevEl: elements.userPrevPage,
      nextEl: elements.userNextPage,
      sizeEl: elements.userPageSize,
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
    infoEl: elements.transactionPagerInfo,
    prevEl: elements.transactionPrevPage,
    nextEl: elements.transactionNextPage,
    sizeEl: elements.transactionPageSize,
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
      <td title="${escapeHtml(item.externalRef)}">${escapeHtml(shortId(item.externalRef, 12) || '-')}</td>
    </tr>
  `).join('') || emptyRow(8, '没有符合条件的流水')
  } catch (error) {
    elements.transactionRows.innerHTML = emptyRow(8, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
      infoEl: elements.transactionPagerInfo,
      prevEl: elements.transactionPrevPage,
      nextEl: elements.transactionNextPage,
      sizeEl: elements.transactionPageSize,
      query: q
    })
  }
}

async function loadJobs({ resetPage = false } = {}) {
  const q = state.jobQuery
  if (resetPage) q.page = 1
  if (elements.jobFilterForm) {
    const values = new FormData(elements.jobFilterForm)
    q.query = String(values.get('query') || '').trim()
    q.status = String(values.get('status') || 'all')
  }
  syncPageSizeFromSelect(elements.jobPageSize, q)
  q.loading = true
  elements.jobRows.innerHTML = emptyRow(9, '加载中...')
  renderListPager({
    infoEl: elements.jobPagerInfo,
    prevEl: elements.jobPrevPage,
    nextEl: elements.jobNextPage,
    sizeEl: elements.jobPageSize,
    query: q
  })
  try {
    const params = new URLSearchParams({
      page: String(q.page),
      pageSize: String(q.pageSize),
      query: q.query,
      status: q.status
    })
    const result = await api(`/api/admin/jobs?${params}`)
    state.jobs = result.jobs || []
    applyPageResult(q, result)
    elements.jobRows.innerHTML = state.jobs.map(job => `
    <tr>
      <td>
        <div class="job-media">
          <div class="job-media-line">
            <div class="job-media-group">
              <span class="job-media-label">原图</span>
              ${mediaThumbs(job.originals, '无')}
            </div>
            <span class="job-media-sep">→</span>
            <div class="job-media-group">
              <span class="job-media-label">生成</span>
              ${resultThumbsWithSample(job)}
            </div>
          </div>
        </div>
        <span class="cell-subtitle">${escapeHtml(shortId(job.id, 12))}</span>
      </td>
      <td><strong>${escapeHtml(job.userNickname)}</strong><span class="cell-subtitle">${escapeHtml(job.userMaskedId)}</span></td>
      <td>${escapeHtml(job.templateName)}</td>
      <td><span class="job-status job-status--${escapeHtml(job.status)}">${escapeHtml(job.statusLabel)}</span></td>
      <td>${(job.assetIds || []).length} 张 / ${Number(job.cost)} 积分</td>
      <td>${escapeHtml(job.createdTime)}</td>
      <td>${escapeHtml(job.completedTime || '-')}</td>
      <td>${job.durationSeconds === null ? '-' : `${Number(job.durationSeconds)} 秒`}</td>
      <td class="error-cell" title="${escapeHtml(job.error)}">
        ${job.status === 'succeeded'
          ? `<div class="row-actions"><button class="row-button" data-job-action="banner" data-id="${escapeHtml(job.id)}" type="button">设为 Banner</button></div>${job.error ? `<span class="cell-subtitle">${escapeHtml(job.error)}</span>` : ''}`
          : escapeHtml(job.error || '-')}
      </td>
    </tr>
  `).join('') || emptyRow(9, '没有符合条件的作品任务')
  } catch (error) {
    elements.jobRows.innerHTML = emptyRow(9, error.message || '加载失败')
    throw error
  } finally {
    q.loading = false
    renderListPager({
      infoEl: elements.jobPagerInfo,
      prevEl: elements.jobPrevPage,
      nextEl: elements.jobNextPage,
      sizeEl: elements.jobPageSize,
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
    infoEl: elements.feedbackPagerInfo,
    prevEl: elements.feedbackPrevPage,
    nextEl: elements.feedbackNextPage,
    sizeEl: elements.feedbackPageSize,
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
      infoEl: elements.feedbackPagerInfo,
      prevEl: elements.feedbackPrevPage,
      nextEl: elements.feedbackNextPage,
      sizeEl: elements.feedbackPageSize,
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
    packages: '充值套餐'
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
    infoEl: elements.cdkPagerInfo,
    prevEl: elements.cdkPrevPage,
    nextEl: elements.cdkNextPage,
    sizeEl: elements.cdkPageSize,
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
      infoEl: elements.cdkPagerInfo,
      prevEl: elements.cdkPrevPage,
      nextEl: elements.cdkNextPage,
      sizeEl: elements.cdkPageSize,
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

function jobBannerPath(jobId) {
  return `/pages/job/index?id=${encodeURIComponent(jobId)}&showcase=1`
}

function openBannerFromJob(job) {
  if (!job || job.status !== 'succeeded') {
    showToast('仅已完成的作品可设为 Banner', true)
    return
  }
  openBannerDialog(null)
  const form = elements.bannerForm.elements
  form.title.value = `${job.templateName || '精选作品'}`
  form.subtitle.value = '点击查看作品效果'
  form.badge.value = form.badge.value || '作品'
  form.palette.value = form.palette.value || job.templatePalette || '#e9f7f2'
  form.targetPath.value = jobBannerPath(job.id)
  if (form.jobIdHelper) form.jobIdHelper.value = job.id
  form.sortOrder.value = ((state.data?.banners?.length || 0) + 1) * 10
  form.enabled.checked = true
  showToast('已填入作品跳转路径，保存后记得上传 Banner 图')
}

async function loadMessagesPage() {
  await Promise.all([loadAnnouncements(), loadSubscribeStats()])
}

async function loadAnnouncements() {
  if (!elements.announcementRows) return
  elements.announcementRows.innerHTML = emptyRow(5, '加载中...')
  const result = await api('/api/admin/announcements')
  elements.announcementRows.innerHTML = (result.announcements || []).map(item => `
    <tr>
      <td class="col-time">${escapeHtml(item.createdTime)}</td>
      <td class="col-title"><strong>${escapeHtml(item.title)}</strong></td>
      <td class="col-content"><div class="messages-announce-content" title="${escapeHtml(item.content)}">${escapeHtml(item.content)}</div></td>
      <td class="col-status"><span class="status-pill${item.enabled ? ' is-active' : ''}">${item.enabled ? '启用' : '停用'}</span></td>
      <td class="col-actions row-actions">
        <button class="row-button" data-announcement-action="toggle" data-id="${escapeHtml(item.id)}" data-enabled="${item.enabled ? '1' : '0'}" type="button">${item.enabled ? '停用' : '启用'}</button>
        <button class="row-button" data-announcement-action="delete" data-id="${escapeHtml(item.id)}" type="button">删除</button>
      </td>
    </tr>
  `).join('') || emptyRow(5, '暂无站内公告')
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
  fillCategorySelect(template?.category || '')
  if (template) {
    for (const key of ['id', 'name', 'shortName', 'cost', 'popularity', 'sortOrder', 'badge', 'palette', 'description', 'prompt']) {
      if (form[key]) form[key].value = template[key] ?? ''
    }
    form.tags.value = (template.tags || []).join('，')
    form.enabled.checked = template.enabled
    if (template.category) elements.templateCategorySelect.value = template.category
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
  const payload = {
    name: String(values.get('name') || ''),
    shortName: String(values.get('shortName') || ''),
    category: String(values.get('category') || ''),
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

function openBannerDialog(banner = null) {
  state.editingBannerId = banner?.id || ''
  elements.bannerDialogTitle.textContent = banner ? '编辑 Banner' : '新增 Banner'
  elements.bannerForm.reset()
  const form = elements.bannerForm.elements
  if (banner) {
    for (const key of ['title', 'subtitle', 'badge', 'palette', 'targetPath', 'sortOrder']) form[key].value = banner[key] ?? ''
    form.enabled.checked = banner.enabled
    const match = String(banner.targetPath || '').match(/[?&]id=([^&]+)/)
    if (form.jobIdHelper && match && String(banner.targetPath).includes('/pages/job/')) {
      form.jobIdHelper.value = decodeURIComponent(match[1])
    }
  } else {
    form.enabled.checked = true
    form.sortOrder.value = ((state.data?.banners?.length || 0) + 1) * 10
    form.palette.value = 'linear-gradient(135deg, #dff3ec, #fff0f3)'
  }
  elements.bannerDialog.showModal()
}

function bannerPayload(form) {
  const values = new FormData(form)
  return {
    title: String(values.get('title') || ''), subtitle: String(values.get('subtitle') || ''),
    badge: String(values.get('badge') || ''), palette: String(values.get('palette') || ''),
    targetPath: String(values.get('targetPath') || ''), sortOrder: Number(values.get('sortOrder')),
    enabled: form.elements.enabled.checked
  }
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
        shareTitle: String(values.get('shareTitle'))
      }
    })
    state.data.settings = result.settings
    showToast('规则已保存')
  } catch (error) { showToast(error.message, true) }
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
        shareFriendCredits: Number(values.get('shareFriendCredits')),
        shareFriendDailyLimit: Number(values.get('shareFriendDailyLimit')),
        shareTimelineCredits: Number(values.get('shareTimelineCredits')),
        shareTimelineDailyLimit: Number(values.get('shareTimelineDailyLimit')),
        inviteRewardEnabled: Boolean(form.inviteRewardEnabled?.checked),
        inviteLoginCredits: Number(values.get('inviteLoginCredits')),
        inviteFirstJobCredits: Number(values.get('inviteFirstJobCredits'))
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
elements.jobFilterForm.addEventListener('submit', event => {
  event.preventDefault()
  loadJobs({ resetPage: true }).catch(error => showToast(error.message, true))
})

wireListPager({
  prevEl: elements.userPrevPage,
  nextEl: elements.userNextPage,
  sizeEl: elements.userPageSize,
  getQuery: () => state.userQuery,
  loadFn: () => loadUsers()
})
wireListPager({
  prevEl: elements.transactionPrevPage,
  nextEl: elements.transactionNextPage,
  sizeEl: elements.transactionPageSize,
  getQuery: () => state.transactionQuery,
  loadFn: () => loadTransactions()
})
wireListPager({
  prevEl: elements.jobPrevPage,
  nextEl: elements.jobNextPage,
  sizeEl: elements.jobPageSize,
  getQuery: () => state.jobQuery,
  loadFn: () => loadJobs()
})
wireListPager({
  prevEl: elements.feedbackPrevPage,
  nextEl: elements.feedbackNextPage,
  sizeEl: elements.feedbackPageSize,
  getQuery: () => state.feedbackQuery,
  loadFn: () => loadFeedbacks()
})
wireListPager({
  prevEl: elements.cdkPrevPage,
  nextEl: elements.cdkNextPage,
  sizeEl: elements.cdkPageSize,
  getQuery: () => state.cdkQuery,
  loadFn: () => loadCdks()
})
wireListPager({
  prevEl: elements.templatePrevPage,
  nextEl: elements.templateNextPage,
  sizeEl: elements.templatePageSize,
  getQuery: () => state.templateQuery,
  loadFn: () => loadTemplates()
})

elements.jobRows?.addEventListener('click', async event => {
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
})

elements.bannerForm.addEventListener('submit', async event => {
  event.preventDefault()
  const payload = bannerPayload(elements.bannerForm)
  try {
    if (state.editingBannerId) await api(`/api/admin/banners/${encodeURIComponent(state.editingBannerId)}`, { method: 'PATCH', json: payload })
    else await api('/api/admin/banners', { method: 'POST', json: payload })
    elements.bannerDialog.close()
    await loadOverview()
    showToast('Banner 已保存')
  } catch (error) { showToast(error.message, true) }
})

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
})

elements.templateForm.addEventListener('submit', async event => {
  event.preventDefault()
  const payload = templatePayload(elements.templateForm)
  try {
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

elements.bannerFillJobPath?.addEventListener('click', () => {
  const form = elements.bannerForm.elements
  const jobId = String(form.jobIdHelper?.value || '').trim()
  if (!jobId) {
    showToast('请先粘贴作品任务 ID', true)
    return
  }
  form.targetPath.value = jobBannerPath(jobId)
  showToast('已填入作品展示路径')
})

elements.announcementForm?.addEventListener('submit', async event => {
  event.preventDefault()
  const values = new FormData(elements.announcementForm)
  try {
    await api('/api/admin/announcements', {
      method: 'POST',
      json: {
        title: String(values.get('title') || ''),
        content: String(values.get('content') || ''),
        enabled: Boolean(elements.announcementForm.elements.enabled?.checked)
      }
    })
    elements.announcementForm.reset()
    if (elements.announcementForm.elements.enabled) elements.announcementForm.elements.enabled.checked = true
    showToast('公告已发布')
    await loadAnnouncements()
  } catch (error) { showToast(error.message, true) }
})

elements.announcementRows?.addEventListener('click', async event => {
  const button = event.target.closest('[data-announcement-action]')
  if (!button) return
  const id = button.dataset.id
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

if (state.token) {
  loadOverview().then(() => {
    elements.loginView.hidden = true
    elements.appView.hidden = false
  }).catch(() => logout())
}
