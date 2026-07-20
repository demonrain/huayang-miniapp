const templates = [
  { id: 'film', name: '花影胶片', category: '人像', badge: '本周人气', cost: 2, popularity: '9.8k', image: 'assets/portrait-soft.jpg' },
  { id: 'garden', name: '春日花信', category: '生活', badge: '花漾精选', cost: 3, popularity: '8.2k', image: 'assets/portrait-sun.jpg' },
  { id: 'editorial', name: '轻奢杂志', category: '人像', badge: '编辑推荐', cost: 4, popularity: '7.3k', image: 'assets/portrait-editorial.jpg' },
  { id: 'city', name: '城市蓝调', category: '氛围', badge: '电影感', cost: 4, popularity: '5.4k', image: 'assets/portrait-city.jpg' },
  { id: 'pet', name: '毛茸画报', category: '萌宠', badge: '新上架', cost: 3, popularity: '6.5k', image: 'assets/pet.jpg' },
  { id: 'flower', name: '花园手记', category: '生活', badge: '治愈系', cost: 2, popularity: '4.9k', image: 'assets/flowers.jpg' }
]

const state = {
  view: 'home',
  category: '全部',
  selectedTemplate: templates[0],
  selectedPackage: 'bloom',
  credits: 128,
  checkedIn: false,
  favorite: false,
  uploadUrls: [],
  resultImage: 'assets/portrait-soft.jpg',
  generatingTimer: null
}

const screen = document.querySelector('#screen')
const tabbar = document.querySelector('#tabbar')
const photoInput = document.querySelector('#photoInput')
const toast = document.querySelector('#toast')

const icon = name => `<img src="assets/icons/${name}.svg" alt="">`

function header() {
  return `
    <header class="app-header">
      <div class="brand-lockup">
        <img src="assets/brand-avatar.png" alt="花漾相绘">
        <div><strong>花漾相绘</strong><span>让照片开出新的样子</span></div>
      </div>
      <button class="credit-chip" data-route="wallet" aria-label="查看积分">${icon('coins')}<span>${state.credits}</span></button>
    </header>`
}

function taskHeader(title, back = 'home', action = '') {
  return `
    <header class="task-header">
      <button class="icon-button" data-route="${back}" aria-label="返回">${icon('arrow-left')}</button>
      <h1>${title}</h1>
      ${action || '<span></span>'}
    </header>`
}

function homeView() {
  const categories = ['全部', '人像', '生活', '萌宠', '氛围']
  const visible = state.category === '全部' ? templates : templates.filter(item => item.category === state.category)
  return `
    <div class="screen-content">
      ${header()}
      <section class="hero-banner">
        <img src="assets/portrait-sun.jpg" alt="春日人像风格示例">
        <div class="hero-copy"><span>七月心动企划</span><h1>把这一刻，画成花开的样子</h1><p>春日花信系列 · 限时 3 积分</p></div>
        <button class="hero-action" data-template="garden" aria-label="查看春日花信">${icon('chevron-right')}</button>
      </section>

      <div class="quick-actions">
        <button data-action="choose-photo">${icon('image-plus')}从相册开始</button>
        <button data-action="camera">${icon('camera')}拍下这一刻</button>
      </div>

      <div class="section-heading"><div><h2>挑一款心动风格</h2><p>每一次创作，都有新的花期</p></div><span>${visible.length} 款</span></div>
      <div class="category-row">
        ${categories.map(item => `<button class="${state.category === item ? 'is-active' : ''}" data-category="${item}">${item}</button>`).join('')}
      </div>
      <div class="template-grid">
        ${visible.map(item => `
          <button class="template-card" data-template="${item.id}">
            <span class="cover"><img src="${item.image}" alt="${item.name}风格示例"><span class="badge">${item.badge}</span></span>
            <span class="template-info"><strong>${item.name}</strong><span class="template-meta"><span>人气 ${item.popularity}</span><span class="template-cost">${item.cost} 积分</span></span></span>
          </button>`).join('')}
      </div>
    </div>`
}

function detailView() {
  const item = state.selectedTemplate
  return `
    <div class="screen-content is-task">
      <section class="detail-cover">
        <img src="${item.image}" alt="${item.name}效果预览">
        ${taskHeader('', 'home', `<button class="icon-button" data-action="favorite" aria-label="收藏模板">${icon(state.favorite ? 'heart' : 'bookmark')}</button>`)}
      </section>
      <section class="detail-body">
        <div class="detail-eyebrow">XIANGHUI STYLE · ${item.category}</div>
        <h1>${item.name}</h1>
        <p>柔和自然光与细腻胶片颗粒，让人物保留真实神态，也多一点花园般轻盈的呼吸感。</p>
        <div class="tag-row"><span>${item.badge}</span><span>保留五官</span><span>高清输出</span></div>
        <div class="section-heading" style="margin-left:0;margin-right:0"><div><h2>更多效果参考</h2><p>同一风格会根据原图自然变化</p></div></div>
        <div class="sample-strip">
          <img src="assets/portrait-soft.jpg" alt="效果参考一">
          <img src="assets/portrait-sun.jpg" alt="效果参考二">
          <img src="assets/flowers.jpg" alt="效果参考三">
        </div>
      </section>
      <div class="detail-action"><div><span>每张消耗</span><strong>${item.cost} 积分</strong></div><button class="primary-button" data-route="upload">${icon('sparkles')}用这个风格</button></div>
    </div>`
}

function uploadView() {
  const preview = state.uploadUrls[0]
  return `
    <div class="screen-content is-task">
      ${taskHeader('上传照片', 'detail')}
      <div class="step-line"><span class="is-active">选择照片</span><span>确认效果</span><span>生成作品</span></div>
      <section class="upload-zone">
        ${preview
          ? `<img class="upload-preview" src="${preview}" alt="已选择的照片"><strong>已选择 ${state.uploadUrls.length} 张照片</strong><button data-action="choose-photo">重新选择</button>`
          : `${icon('image-plus')}<strong>放入你喜欢的照片</strong><span>支持 JPG、PNG，最多选择 6 张</span><button data-action="choose-photo">选择照片</button>`}
      </section>
      <div class="upload-note">${icon('shield-check')}<div><strong>照片仅用于本次创作</strong><span>原图与生成结果由你管理，不会出现在公开广场。</span></div></div>
      <div class="section-heading"><div><h2>本次创作</h2><p>${state.selectedTemplate.name} · ${state.selectedTemplate.cost} 积分/张</p></div><span>${Math.max(1, state.uploadUrls.length)} 张</span></div>
      <div class="task-actions"><button class="primary-button is-wide" data-action="start-generate">${icon('wand-sparkles')}确认生成 · ${state.selectedTemplate.cost * Math.max(1, state.uploadUrls.length)} 积分</button></div>
    </div>`
}

function generatingView() {
  return `
    <div class="screen-content is-task generating">
      <img class="generating-bg" src="${state.resultImage}" alt="">
      <div class="generating-content">
        <div class="progress-flower"><span></span><span></span><span></span><span></span><i></i></div>
        <h1>正在让照片开花</h1>
        <p>AI 正在保留人物细节，并为画面调出<br>${state.selectedTemplate.name}的光影与色彩</p>
        <div class="progress-track"><span></span></div>
      </div>
    </div>`
}

function resultView() {
  return `
    <div class="screen-content is-task">
      <section class="result-stage">
        <img src="${state.resultImage}" alt="生成完成的作品">
        ${taskHeader('作品已完成', 'works', `<button class="icon-button" data-action="favorite" aria-label="收藏作品">${icon('heart')}</button>`)}
        <span class="result-number">01 / 01</span>
      </section>
      <section class="result-body">
        <div class="result-title"><h2>${state.selectedTemplate.name}</h2><span>高清作品</span></div>
        <div class="result-actions">
          <button data-action="download">${icon('download')}保存图片</button>
          <button data-action="share">${icon('share-2')}分享</button>
          <button data-action="regenerate">${icon('refresh-cw')}再生成</button>
        </div>
      </section>
    </div>`
}

function worksView() {
  const works = [
    ['assets/portrait-soft.jpg', '花影胶片'],
    ['assets/portrait-editorial.jpg', '轻奢杂志'],
    ['assets/portrait-sun.jpg', '春日花信'],
    ['assets/pet.jpg', '毛茸画报'],
    ['assets/portrait-city.jpg', '城市蓝调'],
    ['assets/flowers.jpg', '花园手记']
  ]
  return `
    <div class="screen-content">
      ${header()}
      <div class="page-title"><span>MY GARDEN</span><h1>我的作品花园</h1></div>
      <div class="works-filter"><button class="is-active">全部</button><button>写真</button><button>生活</button><button>收藏</button></div>
      <div class="works-grid">
        ${works.map(([image, name], index) => `<button class="work-item" data-work="${index}" data-image="${image}"><img src="${image}" alt="${name}作品"><span>${name} · 7月${18 - index}日</span></button>`).join('')}
      </div>
    </div>`
}

function walletView() {
  const packages = [
    { id: 'bud', name: '初芽包', credits: 30, bonus: 0, price: '6.00' },
    { id: 'bloom', name: '盛花包', credits: 90, bonus: 10, price: '15.00' },
    { id: 'garden', name: '花园包', credits: 210, bonus: 30, price: '30.00' }
  ]
  return `
    <div class="screen-content">
      ${header()}
      <section class="wallet-hero"><span>我的灵感积分</span><div class="wallet-balance"><strong>${state.credits}</strong><i>积分</i></div><div class="wallet-foot"><span>每张作品约需 2–5 积分</span>${icon('flower-2')}</div></section>
      <div class="checkin-row"><div><strong>${state.checkedIn ? '今日花签已领取' : '每日花签'}</strong><span>${state.checkedIn ? '明天再来收集新的灵感' : '今天可领取 3 积分'}</span></div><button data-action="checkin" ${state.checkedIn ? 'disabled' : ''}>${state.checkedIn ? '已签到' : '+3 领取'}</button></div>
      <div class="section-heading"><div><h2>补充灵感积分</h2><p>支付后即时到账</p></div></div>
      <div class="package-list">
        ${packages.map(item => `<button class="package-option ${state.selectedPackage === item.id ? 'is-active' : ''}" data-package="${item.id}"><span><strong>${item.name} · ${item.credits} 积分</strong><span>${item.bonus ? `含赠送 ${item.bonus} 积分` : '适合初次体验'}</span></span><b>¥${item.price}</b>${icon('check')}</button>`).join('')}
      </div>
      <div class="task-actions"><button class="primary-button is-wide" data-action="recharge">微信支付</button></div>
    </div>`
}

function profileView() {
  return `
    <div class="screen-content">
      ${header()}
      <section class="profile-head">
        <div class="profile-avatar"><img src="assets/portrait-sun.jpg" alt="用户头像"><span>${icon('camera')}</span></div>
        <div><h1>花间小满</h1><p>花漾相绘用户 · A7F2</p></div>
      </section>
      <div class="profile-stats"><div><strong>${state.credits}</strong><span>可用积分</span></div><div><strong>26</strong><span>完成创作</span></div><div><strong>8</strong><span>收藏风格</span></div></div>
      <div class="section-heading"><div><h2>我的花园</h2><p>作品与账号管理</p></div></div>
      <div class="profile-menu">
        <button data-route="works"><span class="menu-label">${icon('images')}我的作品</span>${icon('chevron-right')}</button>
        <button data-route="wallet"><span class="menu-label">${icon('gift')}积分与花签</span>${icon('chevron-right')}</button>
        <button data-action="notice"><span class="menu-label">${icon('settings')}创作偏好</span>${icon('chevron-right')}</button>
        <button data-action="notice"><span class="menu-label">${icon('shield-check')}隐私与安全</span>${icon('chevron-right')}</button>
        <button data-action="notice"><span class="menu-label">${icon('circle-help')}帮助与反馈</span>${icon('chevron-right')}</button>
      </div>
    </div>`
}

const renderers = { home: homeView, detail: detailView, upload: uploadView, generating: generatingView, result: resultView, works: worksView, wallet: walletView, profile: profileView }

function route(view) {
  if (!renderers[view]) return
  clearTimeout(state.generatingTimer)
  state.view = view
  screen.innerHTML = renderers[view]()
  screen.scrollTop = 0
  const taskView = ['detail', 'upload', 'generating', 'result'].includes(view)
  tabbar.hidden = taskView

  document.querySelectorAll('[data-route]').forEach(button => {
    button.classList.toggle('is-active', button.dataset.route === view)
  })
  const railCredits = document.querySelector('.rail-account strong')
  if (railCredits) railCredits.textContent = `${state.credits} 积分`

  if (view === 'generating') {
    state.generatingTimer = setTimeout(() => route('result'), 1800)
  }
}

function showToast(message) {
  toast.textContent = message
  toast.classList.add('is-visible')
  clearTimeout(showToast.timer)
  showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200)
}

function chooseFiles(camera = false) {
  if (camera) photoInput.setAttribute('capture', 'environment')
  else photoInput.removeAttribute('capture')
  photoInput.click()
}

document.addEventListener('click', async event => {
  const routeButton = event.target.closest('[data-route]')
  if (routeButton) {
    route(routeButton.dataset.route)
    return
  }

  const templateButton = event.target.closest('[data-template]')
  if (templateButton) {
    state.selectedTemplate = templates.find(item => item.id === templateButton.dataset.template) || templates[0]
    state.resultImage = state.selectedTemplate.image
    route('detail')
    return
  }

  const categoryButton = event.target.closest('[data-category]')
  if (categoryButton) {
    state.category = categoryButton.dataset.category
    route('home')
    return
  }

  const workButton = event.target.closest('[data-work]')
  if (workButton) {
    state.resultImage = workButton.dataset.image
    state.selectedTemplate = templates[Number(workButton.dataset.work) % templates.length]
    route('result')
    return
  }

  const packageButton = event.target.closest('[data-package]')
  if (packageButton) {
    state.selectedPackage = packageButton.dataset.package
    route('wallet')
    return
  }

  const actionButton = event.target.closest('[data-action]')
  if (!actionButton) return
  const action = actionButton.dataset.action

  if (action === 'choose-photo') chooseFiles(false)
  if (action === 'camera') chooseFiles(true)
  if (action === 'start-generate') {
    if (state.uploadUrls[0]) state.resultImage = state.uploadUrls[0]
    state.credits -= state.selectedTemplate.cost * Math.max(1, state.uploadUrls.length)
    route('generating')
  }
  if (action === 'favorite') {
    state.favorite = !state.favorite
    showToast(state.favorite ? '已收藏到我的花园' : '已取消收藏')
    route(state.view)
  }
  if (action === 'regenerate') route('generating')
  if (action === 'download') {
    const link = document.createElement('a')
    link.href = state.resultImage
    link.download = `花漾相绘-${state.selectedTemplate.name}.jpg`
    link.click()
    showToast('作品已开始保存')
  }
  if (action === 'share') {
    if (navigator.share) {
      try { await navigator.share({ title: '我的花漾相绘作品', text: `这是我制作的${state.selectedTemplate.name}作品` }) } catch (error) {}
    } else showToast('分享面板已准备好')
  }
  if (action === 'checkin' && !state.checkedIn) {
    state.checkedIn = true
    state.credits += 3
    route('wallet')
    showToast('签到成功，获得 3 积分')
  }
  if (action === 'recharge') showToast('已创建积分充值订单')
  if (action === 'notice') showToast('该页面正在花园里生长')
})

photoInput.addEventListener('change', () => {
  state.uploadUrls.forEach(url => { if (url.startsWith('blob:')) URL.revokeObjectURL(url) })
  state.uploadUrls = [...photoInput.files].slice(0, 6).map(file => URL.createObjectURL(file))
  route('upload')
  if (state.uploadUrls.length) showToast(`已选择 ${state.uploadUrls.length} 张照片`)
})

route('home')
