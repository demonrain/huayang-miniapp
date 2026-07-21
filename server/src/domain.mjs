import { config } from './config.mjs'
import { templates as defaultTemplates, creditPackages as defaultPackages } from './catalog.mjs'

const statusLabels = { queued: '排队中', processing: '生成中', succeeded: '已完成', failed: '失败' }

export function seedConfig(draft) {
  let changed = false
  if (!draft.settings) {
    draft.settings = {
      welcomeCredits: config.newUserCredits,
      checkinCredits: 3,
      shareTitle: '来看看我用花漾相绘制作的作品'
    }
    changed = true
  } else {
    const defaults = {
      welcomeCredits: config.newUserCredits,
      checkinCredits: 3,
      shareTitle: '来看看我用花漾相绘制作的作品'
    }
    for (const [key, value] of Object.entries(defaults)) {
      if (draft.settings[key] === undefined) {
        draft.settings[key] = value
        changed = true
      }
    }
    if (draft.settings.shareTitle === '来看看我用画漾制作的作品') {
      draft.settings.shareTitle = '来看看我用花漾相绘制作的作品'
      changed = true
    }
  }
  if (!draft.templates.length) {
    draft.templates = defaultTemplates.map((item, index) => ({
      ...item,
      enabled: true,
      coverAssetId: '',
      sortOrder: (index + 1) * 10
    }))
    changed = true
  }
  for (const template of draft.templates) {
    const catalogTemplate = defaultTemplates.find(item => item.id === template.id)
    if (!Array.isArray(template.tags)) {
      template.tags = catalogTemplate?.tags || (template.badge ? [template.badge] : [])
      changed = true
    }
    if (!Number.isFinite(Number(template.popularity))) {
      template.popularity = Number(catalogTemplate?.popularity || 0)
      changed = true
    }
  }
  if (!draft.banners.length) {
    draft.banners = [
      {
        id: 'daily-inspiration',
        title: '把喜欢的瞬间，做成专属画报',
        subtitle: '上传照片，一键收藏今天的心动',
        badge: '今日灵感',
        palette: 'linear-gradient(135deg, #dff3ec, #fff0f3)',
        targetPath: '',
        imageAssetId: '',
        enabled: true,
        sortOrder: 10
      }
    ]
    changed = true
  }
  if (!draft.packages.length) {
    draft.packages = defaultPackages.map((item, index) => ({
      ...item,
      enabled: true,
      sortOrder: (index + 1) * 10
    }))
    changed = true
  }
  return changed
}

export function mediaUrl(storagePath) {
  if (!storagePath) return ''
  return `${config.publicBaseUrl}/media/${storagePath.split('/').map(encodeURIComponent).join('/')}`
}

export function assetUrl(asset) {
  return asset ? mediaUrl(asset.storagePath) : ''
}

export function findTemplate(state, templateId, includeDisabled = false) {
  return state.templates.find(item => item.id === templateId && (includeDisabled || item.enabled !== false))
}

export function publicTemplate(template, state, admin = false) {
  const cover = template.coverAssetId ? state.assets.find(item => item.id === template.coverAssetId) : null
  const value = {
    id: template.id,
    name: template.name,
    shortName: template.shortName,
    category: template.category,
    description: template.description,
    cost: template.cost,
    badge: template.badge || '',
    tags: Array.isArray(template.tags) ? template.tags : [],
    popularity: Number(template.popularity || 0),
    palette: template.palette,
    coverUrl: assetUrl(cover),
    enabled: template.enabled !== false,
    sortOrder: Number(template.sortOrder || 0)
  }
  if (admin) {
    value.prompt = template.prompt
    value.coverAssetId = template.coverAssetId || ''
  }
  return value
}

export function publicBanner(item, state, admin = false) {
  const image = item.imageAssetId ? state.assets.find(asset => asset.id === item.imageAssetId) : null
  const value = {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle || '',
    badge: item.badge || '',
    palette: item.palette || '#e9f7f2',
    targetPath: item.targetPath || '',
    imageUrl: assetUrl(image),
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || 0)
  }
  if (admin) value.imageAssetId = item.imageAssetId || ''
  return value
}

export function publicBanners(state, admin = false) {
  return state.banners
    .filter(item => admin || item.enabled !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map(item => publicBanner(item, state, admin))
}

export function publicTemplates(state, admin = false) {
  return state.templates
    .filter(item => admin || item.enabled !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map(item => publicTemplate(item, state, admin))
}

export function publicPackage(item) {
  return {
    id: item.id,
    credits: Number(item.credits),
    bonus: Number(item.bonus || 0),
    totalCredits: Number(item.credits) + Number(item.bonus || 0),
    priceFen: Number(item.priceFen),
    priceYuan: (Number(item.priceFen) / 100).toFixed(2),
    badge: item.badge || '',
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || 0)
  }
}

export function publicPackages(state, admin = false) {
  return state.packages
    .filter(item => admin || item.enabled !== false)
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map(publicPackage)
}

export function publicJob(job, state) {
  const template = findTemplate(state, job.templateId, true)
  const results = (job.results || []).map(result => ({
    id: result.id,
    mime: result.mime,
    url: mediaUrl(result.storagePath)
  }))
  const originals = (job.assetIds || []).map((assetId, index) => {
    const asset = state.assets.find(item => item.id === assetId)
    if (!asset) return null
    return {
      id: asset.id,
      mime: asset.mime,
      url: assetUrl(asset),
      index: index + 1
    }
  }).filter(Boolean)
  return {
    id: job.id,
    templateId: job.templateId,
    assetIds: job.assetIds,
    cost: job.cost,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt || '',
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || '',
    templateName: template?.name || '已下架模板',
    templateShortName: template?.shortName || '作品',
    templatePalette: template?.palette || '#f2c5cc',
    statusLabel: statusLabels[job.status] || job.status,
    results,
    originals,
    coverUrl: results[0]?.url || originals[0]?.url || ''
  }
}

export function publicShare(share, state) {
  const job = state.jobs.find(item => item.id === share.jobId)
  if (!job || job.status !== 'succeeded') return null
  const template = findTemplate(state, job.templateId, true)
  return {
    token: share.token,
    title: share.title || state.settings.shareTitle,
    createdAt: share.createdAt,
    path: `/pages/share/index?token=${encodeURIComponent(share.token)}`,
    urlLink: share.urlLink || '',
    qrcodeUrl: mediaUrl(share.qrcodeStoragePath),
    templateName: template?.name || '花漾相绘作品',
    templatePalette: template?.palette || '#f2c5cc',
    results: (job.results || []).map(result => ({ id: result.id, mime: result.mime, url: mediaUrl(result.storagePath) }))
  }
}
