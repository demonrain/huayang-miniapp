const state = {
  token: sessionStorage.getItem('huayang_admin_token') || '',
  data: null,
  editingTemplateId: '',
  coverTemplateId: ''
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
  templateRows: document.querySelector('#templateRows'),
  packageList: document.querySelector('#packageList'),
  templateDialog: document.querySelector('#templateDialog'),
  templateDialogTitle: document.querySelector('#templateDialogTitle'),
  templateForm: document.querySelector('#templateForm'),
  packageDialog: document.querySelector('#packageDialog'),
  packageForm: document.querySelector('#packageForm'),
  coverInput: document.querySelector('#coverInput'),
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
  renderAll()
}

function renderAll() {
  const { settings, templates, packages, stats } = state.data
  const statItems = [
    ['用户总数', stats.users],
    ['生成任务', stats.jobs],
    ['完成作品', stats.completedJobs],
    ['支付订单', stats.paidOrders]
  ]
  elements.statsGrid.innerHTML = statItems.map(([label, value]) => `
    <div class="stat-card"><span>${escapeHtml(label)}</span><strong>${Number(value)}</strong></div>
  `).join('')

  elements.settingsForm.elements.welcomeCredits.value = settings.welcomeCredits
  elements.settingsForm.elements.checkinCredits.value = settings.checkinCredits
  elements.settingsForm.elements.shareTitle.value = settings.shareTitle

  elements.templateRows.innerHTML = templates.map(template => `
    <tr>
      <td><div class="template-cell">
        <div class="cover-thumb" style="background:${escapeHtml(template.palette)}">${template.coverUrl ? `<img src="${escapeHtml(template.coverUrl)}" alt="">` : escapeHtml(template.shortName)}</div>
        <div><strong>${escapeHtml(template.name)}</strong><span>${escapeHtml(template.id)}</span></div>
      </div></td>
      <td>${escapeHtml(template.category)}</td>
      <td>${Number(template.cost)}</td>
      <td>${Number(template.sortOrder)}</td>
      <td><span class="status-pill${template.enabled ? ' is-active' : ''}">${template.enabled ? '已启用' : '已停用'}</span></td>
      <td><div class="row-actions">
        <button class="row-button" data-template-action="edit" data-id="${escapeHtml(template.id)}">编辑</button>
        <button class="row-button" data-template-action="cover" data-id="${escapeHtml(template.id)}">上传封面</button>
        <button class="row-button" data-template-action="toggle" data-id="${escapeHtml(template.id)}">${template.enabled ? '停用' : '启用'}</button>
      </div></td>
    </tr>
  `).join('')

  elements.packageList.innerHTML = packages.map(item => `
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

function switchView(name) {
  const titles = { overview: '概览与规则', templates: '模板管理', packages: '充值套餐' }
  document.querySelectorAll('.view-panel').forEach(view => { view.hidden = view.id !== `${name}View` })
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('is-active', item.dataset.view === name))
  elements.pageTitle.textContent = titles[name]
}

function templateById(id) {
  return state.data.templates.find(item => item.id === id)
}

function openTemplateDialog(template = null) {
  state.editingTemplateId = template?.id || ''
  elements.templateDialogTitle.textContent = template ? '编辑模板' : '新增模板'
  elements.templateForm.reset()
  const form = elements.templateForm.elements
  form.id.disabled = Boolean(template)
  if (template) {
    for (const key of ['id', 'name', 'shortName', 'category', 'cost', 'sortOrder', 'badge', 'palette', 'description', 'prompt']) {
      form[key].value = template[key] ?? ''
    }
    form.enabled.checked = template.enabled
  } else {
    form.enabled.checked = true
    form.cost.value = 2
    form.sortOrder.value = (state.data.templates.length + 1) * 10
    form.palette.value = 'linear-gradient(145deg, #f7b6c2, #f8dda0, #a8daca)'
  }
  elements.templateDialog.showModal()
}

function templatePayload(form) {
  const values = new FormData(form)
  return {
    id: String(values.get('id') || ''),
    name: String(values.get('name') || ''),
    shortName: String(values.get('shortName') || ''),
    category: String(values.get('category') || ''),
    cost: Number(values.get('cost')),
    sortOrder: Number(values.get('sortOrder')),
    badge: String(values.get('badge') || ''),
    palette: String(values.get('palette') || ''),
    description: String(values.get('description') || ''),
    prompt: String(values.get('prompt') || ''),
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

document.querySelector('#addTemplateButton').addEventListener('click', () => openTemplateDialog())
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
        id: String(values.get('id')),
        credits: Number(values.get('credits')),
        bonus: Number(values.get('bonus')),
        priceFen: Math.round(Number(values.get('priceYuan')) * 100),
        badge: String(values.get('badge') || ''),
        sortOrder: Number(values.get('sortOrder')),
        enabled: true
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
        credits: Number(values.get('credits')),
        bonus: Number(values.get('bonus')),
        priceFen: Math.round(Number(values.get('priceYuan')) * 100),
        badge: String(values.get('badge') || ''),
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
