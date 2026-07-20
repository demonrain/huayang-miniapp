import { config } from './config.mjs'
import { templates as defaultTemplates, creditPackages as defaultPackages } from './catalog.mjs'

const statusLabels = { queued: '排队中', processing: '生成中', succeeded: '已完成', failed: '失败' }

export function seedConfig(draft) {
  let changed = false
  if (!draft.settings) {
    draft.settings = {
      welcomeCredits: config.newUserCredits,
      checkinCredits: 3,
      shareTitle: '来看看我用画漾制作的作品'
    }
    changed = true
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
  return {
    id: job.id,
    templateId: job.templateId,
    assetIds: job.assetIds,
    cost: job.cost,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || '',
    templateName: template?.name || '已下架模板',
    templateShortName: template?.shortName || '作品',
    templatePalette: template?.palette || '#f2c5cc',
    statusLabel: statusLabels[job.status] || job.status,
    results,
    coverUrl: results[0]?.url || ''
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
    templateName: template?.name || '画漾作品',
    templatePalette: template?.palette || '#f2c5cc',
    results: (job.results || []).map(result => ({ id: result.id, mime: result.mime, url: mediaUrl(result.storagePath) }))
  }
}
