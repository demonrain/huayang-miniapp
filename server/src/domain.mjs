import { randomBytes } from 'node:crypto'
import { config } from './config.mjs'
import { templates as defaultTemplates, creditPackages as defaultPackages } from './catalog.mjs'
import { thumbStoragePath } from './thumbs.mjs'
import {
  DEFAULT_CHECKIN_STREAK_BONUSES,
  DEFAULT_USER_LEVELS,
  ensureEngagementCollections,
  resolveTemplateUnitCost
} from './engagement.mjs'

const statusLabels = {
  queued: '排队中',
  processing: '生成中',
  succeeded: '已完成',
  partial: '部分完成',
  failed: '失败'
}

const RESULT_FEEDBACK_LABELS = {
  satisfied: '很满意',
  unlike_person: '不像本人',
  abnormal: '画面异常',
  style_mismatch: '风格不符'
}

/** 微信隐私策略下无法静默拿到真实昵称时的占位名（含历史产品占位） */
export const DEFAULT_WECHAT_NICKNAMES = new Set(['', '微信用户', 'WeChat User', '微信网友', '花漾用户'])

export function isDefaultWechatNickname(nickname) {
  return DEFAULT_WECHAT_NICKNAMES.has(String(nickname || '').trim())
}

/**
 * 花漾相绘风格随机昵称，例如「温柔画手·A3F2」。
 */
export function generateStyledNickname() {
  const adjectives = ['温柔', '清新', '暖光', '轻盈', '拾光', '心光', '花间', '微风', '晴空', '暮色']
  const nouns = ['画手', '旅人', '相友', '造像', '花客', '相绘', '拾花', '小满', '画报', '心象']
  const adj = adjectives[randomBytes(1)[0] % adjectives.length]
  const noun = nouns[randomBytes(1)[0] % nouns.length]
  const suffix = randomBytes(2).toString('hex').toUpperCase()
  return `${adj}${noun}·${suffix}`
}

/** 对外展示昵称：真实名优先，占位名用账号短码区分，避免全员同名 */
export function displayNickname(user) {
  const raw = String(user?.nickname || '').trim()
  if (raw && !isDefaultWechatNickname(raw)) return raw
  const id = String(user?.id || '').replace(/-/g, '').slice(0, 4).toUpperCase()
  return id ? `花漾旅人·${id}` : '花漾旅人'
}

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

/** Normalize template categories: prefer categories[], fall back to single category. */
export function normalizeTemplateCategories(template = {}) {
  const fromArray = Array.isArray(template.categories)
    ? template.categories.map(item => String(item || '').trim()).filter(Boolean)
    : []
  if (fromArray.length) return [...new Set(fromArray)]
  const single = String(template.category || '').trim()
  return single ? [single] : []
}

export function templateHasCategory(template, categoryId) {
  const id = String(categoryId || '').trim()
  if (!id) return false
  return normalizeTemplateCategories(template).includes(id)
}

export const DEFAULT_SHARE_REWARD_SETTINGS = {
  shareRewardEnabled: true,
  // 分享动作本身不再直接发分；以下分值用于「好友打开」奖励与后台展示
  shareFriendCredits: 0,
  shareTimelineCredits: 0,
  shareFriendDailyLimit: 3,
  shareTimelineDailyLimit: 1,
  shareOpenCredits: 2,
  shareOpenDailyLimit: 5,
  inviteRewardEnabled: true,
  inviteLoginCredits: 5,
  inviteFirstJobCredits: 10,
  // Gallery / public-share rewards
  galleryPublishCredits: 5,
  galleryLikeLikerCredits: 1,
  galleryLikeAuthorCredits: 3
}

export function publicShareRewardSettings(settings = {}) {
  return {
    shareRewardEnabled: settings.shareRewardEnabled !== false,
    shareFriendCredits: Number(settings.shareFriendCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.shareFriendCredits),
    shareTimelineCredits: Number(settings.shareTimelineCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.shareTimelineCredits),
    shareFriendDailyLimit: Number(settings.shareFriendDailyLimit ?? DEFAULT_SHARE_REWARD_SETTINGS.shareFriendDailyLimit),
    shareTimelineDailyLimit: Number(settings.shareTimelineDailyLimit ?? DEFAULT_SHARE_REWARD_SETTINGS.shareTimelineDailyLimit),
    shareOpenCredits: Number(settings.shareOpenCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.shareOpenCredits),
    shareOpenDailyLimit: Number(settings.shareOpenDailyLimit ?? DEFAULT_SHARE_REWARD_SETTINGS.shareOpenDailyLimit),
    inviteRewardEnabled: settings.inviteRewardEnabled !== false,
    inviteLoginCredits: Number(settings.inviteLoginCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.inviteLoginCredits),
    inviteFirstJobCredits: Number(settings.inviteFirstJobCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.inviteFirstJobCredits),
    galleryPublishCredits: Number(settings.galleryPublishCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.galleryPublishCredits),
    galleryLikeLikerCredits: Number(settings.galleryLikeLikerCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.galleryLikeLikerCredits),
    galleryLikeAuthorCredits: Number(settings.galleryLikeAuthorCredits ?? DEFAULT_SHARE_REWARD_SETTINGS.galleryLikeAuthorCredits)
  }
}

function communityAssetUrl(state, assetId) {
  const id = String(assetId || '').trim()
  if (!id) return ''
  const asset = (state.assets || []).find(item => item.id === id)
  return asset ? assetUrl(asset) : ''
}

/** 管理端：微信 / QQ 社群二维码配置快照 */
export function adminCommunitySettings(settings = {}, state = { assets: [] }) {
  const wechatAssetId = String(settings.communityWechatQrAssetId || settings.communityQrAssetId || '')
  const qqAssetId = String(settings.communityQqQrAssetId || '')
  return {
    wechat: {
      enabled: settings.communityWechatQrEnabled !== false,
      qrAssetId: wechatAssetId,
      qrUrl: communityAssetUrl(state, wechatAssetId)
    },
    qq: {
      enabled: settings.communityQqQrEnabled === true,
      qrAssetId: qqAssetId,
      qrUrl: communityAssetUrl(state, qqAssetId)
    }
  }
}

/** 小程序：仅返回已启用且已上传二维码的平台 */
export function publicCommunityChannels(settings = {}, state = { assets: [] }) {
  const admin = adminCommunitySettings(settings, state)
  const channels = []
  if (admin.wechat.enabled && admin.wechat.qrUrl) {
    channels.push({ id: 'wechat', label: '微信群', qrUrl: admin.wechat.qrUrl })
  }
  if (admin.qq.enabled && admin.qq.qrUrl) {
    channels.push({ id: 'qq', label: 'QQ群', qrUrl: admin.qq.qrUrl })
  }
  return channels
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
      announcementSwitchIntervalMs: 4500,
      announcementCircular: true,
      ...DEFAULT_SHARE_REWARD_SETTINGS,
      checkinStreakBonuses: DEFAULT_CHECKIN_STREAK_BONUSES.map(item => ({ ...item })),
      communityWechatId: 'demonrain',
      communityQrAssetId: '',
      communityWechatQrEnabled: true,
      communityWechatQrAssetId: '',
      communityQqQrEnabled: false,
      communityQqQrAssetId: '',
      userLevelsEnabled: false
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
      announcementSwitchIntervalMs: 4500,
      announcementCircular: true,
      ...DEFAULT_SHARE_REWARD_SETTINGS,
      checkinStreakBonuses: DEFAULT_CHECKIN_STREAK_BONUSES.map(item => ({ ...item })),
      communityWechatId: 'demonrain',
      communityQrAssetId: '',
      communityWechatQrEnabled: true,
      communityWechatQrAssetId: '',
      communityQqQrEnabled: false,
      communityQqQrAssetId: '',
      userLevelsEnabled: false
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
    // 历史后台把「分享到好友积分」当成打开奖励；若打开积分仍为默认且好友积分被改过，则同步一次
    if (draft.settings.shareOpenCreditsMigratedFromFriend !== true) {
      const friendCredits = Number(draft.settings.shareFriendCredits)
      const openCredits = Number(draft.settings.shareOpenCredits)
      if (
        Number.isFinite(friendCredits)
        && friendCredits > 0
        && (!Number.isFinite(openCredits) || openCredits === DEFAULT_SHARE_REWARD_SETTINGS.shareOpenCredits)
        && friendCredits !== openCredits
      ) {
        draft.settings.shareOpenCredits = friendCredits
        changed = true
      }
      draft.settings.shareOpenCreditsMigratedFromFriend = true
      changed = true
    }
    // 旧版单二维码迁移到微信群字段
    if (!draft.settings.communityWechatQrAssetId && draft.settings.communityQrAssetId) {
      draft.settings.communityWechatQrAssetId = draft.settings.communityQrAssetId
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
  if (!Array.isArray(draft.jobLikes)) {
    draft.jobLikes = []
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
  if (ensureEngagementCollections(draft)) changed = true
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
  const categories = normalizeTemplateCategories(template)
  const categoryLabels = categories.map(id => categoryLabelFromState(state, id))
  const pricing = resolveTemplateUnitCost(template, state)
  const value = {
    id: template.id,
    name: template.name,
    shortName: template.shortName || String(template.name || '').slice(0, 4),
    // Primary category kept for backward compatibility (first selected)
    category: categories[0] || '',
    categories,
    categoryLabel: categoryLabels[0] || '',
    categoryLabels,
    description: template.description,
    cost: pricing.cost,
    originalCost: pricing.originalCost,
    costDiscounted: pricing.discounted,
    campaignName: pricing.campaignName || '',
    campaignBadge: pricing.campaignBadge || '',
    promoStartAt: pricing.promoStartAt || '',
    promoEndAt: pricing.promoEndAt || '',
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
  const thumbImage = assetThumbUrl(image)
  // Prefer full image for Banner display: thumb may not exist yet right after create,
  // and missing thumbs previously caused "no cover" even when imageAssetId was set.
  const imageUrl = fullImage || thumbImage
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
    imageThumbUrl: thumbImage || fullImage,
    enabled: item.enabled !== false,
    sortOrder: Number(item.sortOrder || 0)
  }
  if (admin) {
    value.imageAssetId = item.imageAssetId || ''
    value.coverJobId = item.coverJobId || ''
  }
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
  const templateCategories = normalizeTemplateCategories(template || {})
  const results = (job.results || []).map(result => {
    const full = mediaUrl(result.storagePath)
    const thumb = mediaThumbUrl(result.storagePath)
    return {
      id: result.id,
      assetId: result.assetId || '',
      mime: result.mime,
      url: full,
      thumbUrl: thumb || full,
      status: 'succeeded'
    }
  })
  const failures = (job.failures || []).map(item => ({
    assetId: item.assetId || '',
    error: item.error || '生图失败',
    status: 'failed'
  }))
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
  const feedbacks = (Array.isArray(state.jobResultFeedbacks) ? state.jobResultFeedbacks : [])
    .filter(item => item.jobId === job.id)
    .map(item => ({
      ...item,
      ratingLabel: RESULT_FEEDBACK_LABELS[item.rating] || item.rating
    }))
  return {
    id: job.id,
    templateId: job.templateId,
    assetIds: job.assetIds,
    cost: job.cost,
    unitCost: job.assetIds?.length ? Math.round(job.cost / job.assetIds.length) : job.cost,
    status: job.status,
    error: job.error,
    createdAt: job.createdAt,
    startedAt: job.startedAt || '',
    updatedAt: job.updatedAt,
    completedAt: job.completedAt || '',
    templateName: template?.name || '已下架模板',
    templateShortName: template?.shortName || '作品',
    templatePalette: template?.palette || '#f2c5cc',
    templateCategory: templateCategories[0] || '',
    templateCategories,
    statusLabel: statusLabels[job.status] || job.status,
    results,
    failures,
    originals,
    // List / grid uses thumb; keep full for preview / share
    coverUrl: coverThumb,
    coverFullUrl: coverFull,
    // Owner can publish for Banner / deep-link / gallery
    publicShareEnabled: Boolean(job.publicShareEnabled),
    publicShareShowOriginals: Boolean(job.publicShareShowOriginals),
    publicShareAt: job.publicShareAt || '',
    publicSharePublishRewarded: Boolean(job.publicSharePublishRewarded),
    likeCount: (Array.isArray(state.jobLikes) ? state.jobLikes : []).filter(item => item.jobId === job.id).length,
    // Alias for product language「送花」
    flowerCount: (Array.isArray(state.jobLikes) ? state.jobLikes : []).filter(item => item.jobId === job.id).length,
    myFeedbacks: feedbacks
  }
}

/** Public view of a shared job (hides originals unless owner allowed). */
export function publicSharedJob(job, state, { viewerUserId = '' } = {}) {
  const pub = publicJob(job, state)
  const showOriginals = Boolean(job.publicShareEnabled && job.publicShareShowOriginals)
  const likes = (Array.isArray(state.jobLikes) ? state.jobLikes : []).filter(item => item.jobId === job.id)
  return {
    ...pub,
    originals: showOriginals ? pub.originals : [],
    assetIds: showOriginals ? pub.assetIds : [],
    showcase: true,
    isPublicView: true,
    publicShareEnabled: true,
    publicShareShowOriginals: showOriginals,
    likeCount: likes.length,
    flowerCount: likes.length,
    likedByMe: viewerUserId ? likes.some(item => item.userId === viewerUserId) : false,
    publicSharePublishRewarded: Boolean(job.publicSharePublishRewarded)
  }
}

export function publicShare(share, state) {
  const job = state.jobs.find(item => item.id === share.jobId)
  if (!job || !['succeeded', 'partial'].includes(job.status) || !(job.results || []).length) return null
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
        url: full,
        thumbUrl: mediaThumbUrl(result.storagePath) || full
      }
    })
  }
}
