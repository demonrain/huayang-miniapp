const state = {
  token: sessionStorage.getItem('huayang_admin_token') || '',
  data: null,
  users: [],
  transactions: [],
  jobs: [],
  editingTemplateId: '',
  coverTemplateId: '',
  editingBannerId: '',
  bannerImageId: '',
  editingCategoryId: '',
  creditUserId: ''
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
  userRows: document.querySelector('#userRows'),
  userFilterForm: document.querySelector('#userFilterForm'),
  transactionRows: document.querySelector('#transactionRows'),
  transactionFilterForm: document.querySelector('#transactionFilterForm'),
  jobRows: document.querySelector('#jobRows'),
  jobFilterForm: document.querySelector('#jobFilterForm'),
  bannerRows: document.querySelector('#bannerRows'),
  bannerCarouselForm: document.querySelector('#bannerCarouselForm'),
  bannerEnabledHint: document.querySelector('#bannerEnabledHint'),
  templateRows: document.querySelector('#templateRows'),
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
  coverInput: document.querySelector('#coverInput'),
  bannerImageInput: document.querySelector('#bannerImageInput'),
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
  renderTemplates()
  renderBanners()
  renderCategories()
  renderPackages()
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

  elements.settingsForm.elements.welcomeCredits.value = settings.welcomeCredits
  elements.settingsForm.elements.checkinCredits.value = settings.checkinCredits
  elements.settingsForm.elements.shareTitle.value = settings.shareTitle
  fillBannerCarouselForm()
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

function renderTemplates() {
  elements.templateRows.innerHTML = state.data.templates.map(template => `
    <tr>
      <td><div class="template-cell">
        <div class="cover-thumb" style="background:${escapeHtml(template.palette)}">${template.coverUrl ? `<img src="${escapeHtml(template.coverUrl)}" alt="">` : escapeHtml(template.shortName || template.name || '')}</div>
        <div><strong>${escapeHtml(template.name)}</strong><span>${escapeHtml(template.id)}</span></div>
      </div></td>
      <td><span class="tag">${escapeHtml(template.categoryLabel || categoryLabel(template.category))}</span></td>
      <td><div class="tag-list">${template.tags.length ? template.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('') : '<span class="muted">未设置</span>'}</div></td>
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
  const counts = {}
  for (const template of state.data.templates || []) {
    counts[template.category] = (counts[template.category] || 0) + 1
  }
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

async function loadUsers() {
  elements.userRows.innerHTML = emptyRow(8, '加载中...')
  const values = new FormData(elements.userFilterForm)
  const params = new URLSearchParams({ query: String(values.get('query') || ''), status: String(values.get('status') || 'all') })
  const result = await api(`/api/admin/users?${params}`)
  state.users = result.users
  elements.userRows.innerHTML = state.users.map(user => `
    <tr>
      <td><strong>${escapeHtml(user.nickname)}</strong><span class="cell-subtitle">${escapeHtml(shortId(user.id))} · ${escapeHtml(user.maskedOpenid)}</span></td>
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
    </tr>
  `).join('') || emptyRow(8, '没有符合条件的用户')
}

async function loadTransactions() {
  elements.transactionRows.innerHTML = emptyRow(8, '加载中...')
  const values = new FormData(elements.transactionFilterForm)
  const params = new URLSearchParams({ query: String(values.get('query') || ''), type: String(values.get('type') || 'all') })
  const result = await api(`/api/admin/transactions?${params}`)
  state.transactions = result.transactions
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
}

async function loadJobs() {
  elements.jobRows.innerHTML = emptyRow(9, '加载中...')
  const values = new FormData(elements.jobFilterForm)
  const params = new URLSearchParams({ query: String(values.get('query') || ''), status: String(values.get('status') || 'all') })
  const result = await api(`/api/admin/jobs?${params}`)
  state.jobs = result.jobs
  elements.jobRows.innerHTML = state.jobs.map(job => `
    <tr>
      <td>
        <div class="job-media">
          <div class="job-media-group">
            <span class="job-media-label">原图</span>
            ${mediaThumbs(job.originals, '无原图')}
          </div>
          <div class="job-media-group">
            <span class="job-media-label">生成</span>
            ${mediaThumbs(job.results, job.status === 'succeeded' ? '无结果' : '未生成')}
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
      <td class="error-cell" title="${escapeHtml(job.error)}">${escapeHtml(job.error || '-')}</td>
    </tr>
  `).join('') || emptyRow(9, '没有符合条件的作品任务')
}

async function switchView(name) {
  const titles = {
    overview: '概览与规则', users: '用户管理', transactions: '积分流水', jobs: '作品任务',
    banners: '首页 Banner', templates: '模板管理', categories: '模板分类', packages: '充值套餐'
  }
  document.querySelectorAll('.view-panel').forEach(view => { view.hidden = view.id !== `${name}View` })
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.view === name))
  elements.pageTitle.textContent = titles[name]
  try {
    if (name === 'users') await loadUsers()
    if (name === 'transactions') await loadTransactions()
    if (name === 'jobs') await loadJobs()
    if (name === 'categories') renderCategories()
    if (name === 'banners') fillBannerCarouselForm()
  } catch (error) {
    showToast(error.message, true)
  }
}

function templateById(id) {
  return state.data.templates.find(item => item.id === id)
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
    form.sortOrder.value = (state.data.templates.length + 1) * 10
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
  } else {
    form.enabled.checked = true
    form.sortOrder.value = (state.data.banners.length + 1) * 10
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

elements.userFilterForm.addEventListener('submit', event => { event.preventDefault(); loadUsers().catch(error => showToast(error.message, true)) })
elements.transactionFilterForm.addEventListener('submit', event => { event.preventDefault(); loadTransactions().catch(error => showToast(error.message, true)) })
elements.jobFilterForm.addEventListener('submit', event => { event.preventDefault(); loadJobs().catch(error => showToast(error.message, true)) })

elements.userRows.addEventListener('click', async event => {
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
  if (button.dataset.templateAction === 'edit') openTemplateDialog(template)
  if (button.dataset.templateAction === 'cover') {
    state.coverTemplateId = template.id
    elements.coverInput.click()
  }
  if (button.dataset.templateAction === 'toggle') {
    try {
      await api(`/api/admin/templates/${encodeURIComponent(template.id)}`, { method: 'PATCH', json: { enabled: !template.enabled } })
      await loadOverview()
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
    await loadOverview()
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
    await loadOverview()
    showToast('模板封面已更新')
  } catch (error) { showToast(error.message, true) }
  elements.coverInput.value = ''
})

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

document.querySelectorAll('[data-close]').forEach(button => {
  button.addEventListener('click', () => document.querySelector(`#${button.dataset.close}`).close())
})

if (state.token) {
  loadOverview().then(() => {
    elements.loginView.hidden = true
    elements.appView.hidden = false
  }).catch(() => logout())
}
