import { config } from './config.mjs'
import { templates as defaultTemplates, creditPackages as defaultPackages } from './catalog.mjs'
import { thumbStoragePath } from './thumbs.mjs'

const statusLabels = { queued: '排队中', processing: '生成中', succeeded: '已完成', failed: '失败' }

export const DEFAULT_TEMPLATE_CATEGORIES = [
  { id: 'portrait', name: '人像', sortOrder: 10, enabled: true },
  { id: 'life', name: '生活', sortOrder: 20, enabled: true },
  { id: 'pet', name: '宠物', sortOrder: 30, enabled: true },
  { id: 'art', name: '艺术', sortOrder: 40, enabled: true }
]

export function listTemplateCategories(state, admin = false) {
  const source = Array.isArray(state.templateCategories) && state.templateCategories.length
    ? state.templateCategories
    : DEFAULT_TEMPLATE_CATEGORIES
  return source
    .filter(item => admin || item.enabled !== false)
    .slice()
    .sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    .map(item => ({
      id: item.id,
      name: item.name,
      sortOrder: Number(item.sortOrder || 0),
      enabled: item.enabled !== false
    }))
}

export function categoryLabelFromState(state, categoryId) {
  const found = listTemplateCategories(state, true).find(item => item.id === categoryId)
  return found?.name || categoryId || ''
}

export const DEFAULT_SHARE_REWARD_SETTINGS = {
  shareRewardEnabled: true,
  shareFriendCredits: 2,
  shareTimelineCredits: 1,
  shareFriendDailyLimit: 3,
  shareTimelineDailyLimit: 1,
  inviteRewardEnabled: true,
  inviteLoginCredits: 5,
  inviteFirstJobCredits: 10
}

export function publicShareRewardSettings(settings = {}) {
  return {
    shareRewardEnabled: settings.shareRewardEnabled !== false,
    shareFriendCredits: Number(settings.shareFriendCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.shareFriendCredits),
    shareTimelineCredits: Number(settings.shareTimelineCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.shareTimelineCredits),
    shareFriendDailyLimit: Number(settings.shareFriendDailyLimit ?? DEFAULT_SHARE_REWARD_SETTINGS.shareFriendDailyLimit),
    shareTimelineDailyLimit: Number(settings.shareTimelineDailyLimit ?? DEFAULT_SHARE_REWARD_SETTINGS.shareTimelineDailyLimit),
    inviteRewardEnabled: settings.inviteRewardEnabled !== false,
    inviteLoginCredits: Number(settings.inviteLoginCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.inviteLoginCredits),
    inviteFirstJobCredits: Number(settings.inviteFirstJobCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.inviteFirstJobCredits)
  }
}

export function seedConfig(draft) {
  let changed = false
  if (!draft.settings) {
    draft.settings = {
      welcomeCredits: config.newUserCredits,
      checkinCredits: 3,
      shareTitle: '来看看我用花漾相绘制作的作品',
      bannerSwitchMode: 'auto',
      bannerSwitchIntervalMs: 4500,
      bannerCircular: true,
      ...DEFAULT_SHARE_REWARD_SETTINGS
    }
    changed = true
  } else {
    const defaults = {
      welcomeCredits: config.newUserCredits,
      checkinCredits: 3,
      shareTitle: '来看看我用花漾相绘制作的作品',
      bannerSwitchMode: 'auto',
      bannerSwitchIntervalMs: 4500,
      bannerCircular: true,
      ...DEFAULT_SHARE_REWARD_SETTINGS
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
  if (!Array.isArray(draft.shareEvents)) {
    draft.shareEvents = []
    changed = true
  }
  if (!Array.isArray(draft.invites)) {
    draft.invites = []
    changed = true
  }
  if (!Array.isArray(draft.templateCategories) || !draft.templateCategories.length) {
    draft.templateCategories = DEFAULT_TEMPLATE_CATEGORIES.map(item => ({ ...item }))
    changed = true
  }
  if (!draft.templates.length) {
    draft.templates = defaultTemplates.map((item, index) => ({
      ...item,
      enabled: true,
      coverAssetId: '',
      sampleRefs: [],
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
    if (!Array.isArray(template.sampleRefs)) {
      template.sampleRefs = []
      changed = true
    }
  }
  if (!Array.isArray(draft.feedbacks)) {
    draft.feedbacks = []
    changed = true
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

/** Thumbnail URL for list/grid; falls back to full image URL if no storage path. */
export function mediaThumbUrl(storagePath) {
  if (!storagePath) return ''
  const thumb = thumbStoragePath(storagePath)
  return thumb ? mediaUrl(thumb) : mediaUrl(storagePath)
}

export function assetUrl(asset) {
  return asset ? mediaUrl(asset.storagePath) : ''
}

export function assetThumbUrl(asset) {
  return asset ? mediaThumbUrl(asset.storagePath) : ''
}

export function findTemplate(state, templateId, includeDisabled = false) {
  return state.templates.find(item => item.id === templateId && (includeDisabled || item.enabled !== false))
}

export function publicTemplate(template, state, admin = false) {
  const cover = template.coverAssetId ? state.assets.find(item => item.id === template.coverAssetId) : null
  const fullCover = assetUrl(cover)
  const sampleRefs = Array.isArray(template.sampleRefs) ? template.sampleRefs : []
  const samples = sampleRefs
    .slice()
    .reverse()
    .slice(0, 12)
    .map(ref => {
      const full = mediaUrl(ref.storagePath)
      const thumb = mediaThumbUrl(ref.storagePath) || full
      return {
        id: ref.id || ref.resultId,
        url: full,
        thumbUrl: thumb,
        name: template.shortName || template.name || '效果参考'
      }
    })
    .filter(item => item.url)
  const value = {
    id: template.id,
    name: template.name,
    shortName: template.shortName || String(template.name || '').slice(0, 4),
    category: template.category,
    categoryLabel: categoryLabelFromState(state, template.category),
    description: template.description,
    cost: template.cost,
    badge: template.badge || '',
    tags: Array.isArray(template.tags) ? template.tags : [],
    popularity: Number(template.popularity || 0),
    palette: template.palette,
    // Lists load thumb first; full cover available for detail/preview
    coverUrl: assetThumbUrl(cover) || fullCover,
    coverFullUrl: fullCover,
    // Curated effect samples from admin (job results)
    samples,
    sampleCount: sampleRefs.length,
    enabled: template.enabled !== false,
    sortOrder: Number(template.sortOrder || 0)
  }
  if (admin) {
    value.prompt = template.prompt
    value.coverAssetId = template.coverAssetId || ''
    value.sampleRefs = sampleRefs
  }
  return value
}

export function publicBanner(item, state, admin = false) {
  const image = item.imageAssetId ? state.assets.find(asset => asset.id === item.imageAssetId) : null
  const fullImage = assetUrl(image)
  const imageUrl = assetThumbUrl(image) || fullImage
  // Empty color → client uses CSS defaults (image banners default to white in miniapp)
  const value = {
    id: item.id,
    title: item.title,
    subtitle: item.subtitle || '',
    badge: item.badge || '',
    palette: item.palette || '#e9f7f2',
    titleColor: String(item.titleColor || '').trim(),
    subtitleColor: String(item.subtitleColor || '').trim(),
    badgeColor: String(item.badgeColor || '').trim(),
    targetPath: item.targetPath || '',
    imageUrl,
    imageFullUrl: fullImage,
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
  const results = (job.results || []).map(result => {
    const full = mediaUrl(result.storagePath)
    const thumb = mediaThumbUrl(result.storagePath)
    return {
      id: result.id,
      mime: result.mime,
      url: full,
      thumbUrl: thumb || full
    }
  })
  const originals = (job.assetIds || []).map((assetId, index) => {
    const asset = state.assets.find(item => item.id === assetId)
    if (!asset) return null
    const full = assetUrl(asset)
    return {
      id: asset.id,
      mime: asset.mime,
      url: full,
      thumbUrl: assetThumbUrl(asset) || full,
      index: index + 1
    }
  }).filter(Boolean)
  const coverFull = results[0]?.url || originals[0]?.url || ''
  const coverThumb = results[0]?.thumbUrl || originals[0]?.thumbUrl || coverFull
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
    // List / grid uses thumb; keep full for preview / share
    coverUrl: coverThumb,
    coverFullUrl: coverFull,
    // Owner can publish for Banner / deep-link viewing by others
    publicShareEnabled: Boolean(job.publicShareEnabled),
    publicShareShowOriginals: Boolean(job.publicShareShowOriginals),
    publicShareAt: job.publicShareAt || ''
  }
}

/** Public view of a shared job (hides originals unless owner allowed). */
export function publicSharedJob(job, state) {
  const pub = publicJob(job, state)
  const showOriginals = Boolean(job.publicShareEnabled && job.publicShareShowOriginals)
  return {
    ...pub,
    originals: showOriginals ? pub.originals : [],
    assetIds: showOriginals ? pub.assetIds : [],
    showcase: true,
    isPublicView: true,
    publicShareEnabled: true,
    publicShareShowOriginals: showOriginals
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
    inviterId: share.userId || '',
    path: `/pages/share/index?token=${encodeURIComponent(share.token)}`,
    urlLink: share.urlLink || '',
    qrcodeUrl: mediaUrl(share.qrcodeStoragePath),
    templateName: template?.name || '花漾相绘作品',
    templatePalette: template?.palette || '#f2c5cc',
    results: (job.results || []).map(result => {
      const full = mediaUrl(result.storagePath)
      return {
        id: result.id,
        mime: result.mime,
        url: full,
        thumbUrl: mediaThumbUrl(result.storagePath) || full
      }
    })
  }
}
