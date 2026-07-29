/**
 * 花漾相绘 · 活跃运营：连签、用户等级、活动
 */

export const DEFAULT_CHECKIN_STREAK_BONUSES = [
  { days: 3, bonus: 5 },
  { days: 7, bonus: 15 },
  { days: 14, bonus: 30 },
  { days: 30, bonus: 80 }
]

export const DEFAULT_USER_LEVELS = [
  {
    id: 'sprout',
    name: '花漾新芽',
    title: '花漾新芽',
    badgeText: '芽',
    badgeTone: 'mint',
    sortOrder: 10,
    rewardCredits: 0,
    enabled: false,
    conditions: {
      minCheckinDays: 0,
      minCompletedJobs: 0,
      minGeneratedImages: 0,
      minShareCount: 0,
      minInviteCount: 0,
      minFlowersReceived: 0,
      minActiveDays: 0
    }
  },
  {
    id: 'painter',
    name: '拾光画手',
    title: '拾光画手',
    badgeText: '画',
    badgeTone: 'coral',
    sortOrder: 20,
    rewardCredits: 8,
    enabled: false,
    conditions: {
      minCheckinDays: 3,
      minCompletedJobs: 1,
      minGeneratedImages: 1,
      minShareCount: 0,
      minInviteCount: 0,
      minFlowersReceived: 0,
      minActiveDays: 3
    }
  },
  {
    id: 'traveler',
    name: '心象旅人',
    title: '心象旅人',
    badgeText: '旅',
    badgeTone: 'gold',
    sortOrder: 30,
    rewardCredits: 20,
    enabled: false,
    conditions: {
      minCheckinDays: 7,
      minCompletedJobs: 5,
      minGeneratedImages: 8,
      minShareCount: 1,
      minInviteCount: 0,
      minFlowersReceived: 1,
      minActiveDays: 7
    }
  },
  {
    id: 'florist',
    name: '花间造像',
    title: '花间造像',
    badgeText: '花',
    badgeTone: 'rose',
    sortOrder: 40,
    rewardCredits: 50,
    enabled: false,
    conditions: {
      minCheckinDays: 14,
      minCompletedJobs: 15,
      minGeneratedImages: 30,
      minShareCount: 5,
      minInviteCount: 1,
      minFlowersReceived: 5,
      minActiveDays: 14
    }
  },
  {
    id: 'master',
    name: '相绘大师',
    title: '相绘大师',
    badgeText: '师',
    badgeTone: 'violet',
    sortOrder: 50,
    rewardCredits: 120,
    enabled: false,
    conditions: {
      minCheckinDays: 30,
      minCompletedJobs: 40,
      minGeneratedImages: 80,
      minShareCount: 15,
      minInviteCount: 3,
      minFlowersReceived: 20,
      minActiveDays: 30
    }
  }
]

export const CAMPAIGN_TYPE_LABELS = {
  template_promo: '风格特惠',
  checkin_boost: '签到加赠',
  create_challenge: '创作挑战',
  invite_boost: '邀请狂欢',
  gallery_boost: '花海嘉年华'
}

export function normalizeStreakBonuses(raw) {
  // 仅使用后台已保存的配置；空数组表示未配置任何连签档，不要回落到默认 14/30 天
  const list = Array.isArray(raw) ? raw : []
  return list
    .map(item => ({
      days: Math.max(1, Math.min(365, Math.floor(Number(item.days) || 0))),
      bonus: Math.max(0, Math.min(100000, Math.floor(Number(item.bonus) || 0)))
    }))
    .filter(item => item.days > 0 && item.bonus > 0)
    .sort((a, b) => a.days - b.days)
}

function chinaDateFromIso(iso) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(iso))
}

export function shiftChinaDateKey(dateKey, deltaDays) {
  const [y, m, d] = String(dateKey).split('-').map(Number)
  const utc = Date.UTC(y, m - 1, d) + deltaDays * 86400000
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date(utc))
}

export function listUserCheckinDateKeys(state, userId) {
  return [...new Set(
    (state.transactions || [])
      .filter(item => item.userId === userId && item.type === 'checkin' && item.externalRef)
      .map(item => String(item.externalRef))
  )].sort()
}

/** 连续签到天数：从今天（若已签）或昨天往前数 */
export function computeCheckinStreak(dateKeys, todayKey) {
  const set = new Set(dateKeys)
  let cursor = set.has(todayKey) ? todayKey : shiftChinaDateKey(todayKey, -1)
  if (!set.has(cursor)) return 0
  let streak = 0
  while (set.has(cursor)) {
    streak += 1
    cursor = shiftChinaDateKey(cursor, -1)
  }
  return streak
}

export function streakBonusForDay(bonuses, streakDays) {
  const hit = normalizeStreakBonuses(bonuses).find(item => item.days === streakDays)
  return hit ? hit.bonus : 0
}

export function nextStreakMilestone(bonuses, streakDays) {
  const list = normalizeStreakBonuses(bonuses)
  const next = list.find(item => item.days > streakDays)
  if (!next) return null
  return {
    days: next.days,
    bonus: next.bonus,
    remain: next.days - streakDays
  }
}

export function activeCheckinCampaignBonus(state) {
  return listActiveCampaigns(state)
    .filter(item => item.type === 'checkin_boost')
    .reduce((sum, item) => sum + Math.max(0, Number(item.checkinBonus) || 0), 0)
}

export function buildCheckinSummary(state, userId, todayKey) {
  const dateKeys = listUserCheckinDateKeys(state, userId)
  const claimedToday = dateKeys.includes(todayKey)
  const bonuses = normalizeStreakBonuses(state.settings?.checkinStreakBonuses)
  const baseReward = Number(state.settings?.checkinCredits || 0)
  const currentStreak = computeCheckinStreak(dateKeys, todayKey)
  const upcomingStreak = claimedToday
    ? currentStreak
    : (dateKeys.includes(shiftChinaDateKey(todayKey, -1)) ? currentStreak + 1 : 1)
  const streakBonus = streakBonusForDay(bonuses, upcomingStreak)
  const campaignBonus = activeCheckinCampaignBonus(state)
  const next = nextStreakMilestone(bonuses, claimedToday ? currentStreak : upcomingStreak)
  return {
    reward: baseReward + streakBonus + campaignBonus,
    baseReward,
    streakBonus,
    campaignBonus,
    totalToday: baseReward + streakBonus + campaignBonus,
    claimedToday,
    currentStreak,
    upcomingStreak,
    streakBonuses: bonuses,
    nextMilestone: next,
    tip: next
      ? `当前连签 ${claimedToday ? currentStreak : currentStreak} 天 · 再签 ${next.remain} 天额外 +${next.bonus}`
      : (currentStreak > 0
        ? `已连签 ${currentStreak} 天，继续保持花签习惯`
        : '坚持每日花签，连签可领额外积分')
  }
}

export function normalizeLevelConditions(raw = {}) {
  const num = (v) => Math.max(0, Math.min(1000000, Math.floor(Number(v) || 0)))
  return {
    minCheckinDays: num(raw.minCheckinDays),
    minCompletedJobs: num(raw.minCompletedJobs),
    minGeneratedImages: num(raw.minGeneratedImages),
    minShareCount: num(raw.minShareCount),
    minInviteCount: num(raw.minInviteCount),
    minFlowersReceived: num(raw.minFlowersReceived),
    minActiveDays: num(raw.minActiveDays)
  }
}

export function normalizeUserLevel(item = {}, index = 0) {
  return {
    id: String(item.id || `level-${index + 1}`),
    name: String(item.name || item.title || `等级${index + 1}`).slice(0, 40),
    title: String(item.title || item.name || `等级${index + 1}`).slice(0, 40),
    badgeText: String(item.badgeText || '芽').slice(0, 2),
    badgeTone: ['mint', 'coral', 'gold', 'rose', 'violet', 'sky'].includes(item.badgeTone) ? item.badgeTone : 'mint',
    sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : (index + 1) * 10,
    rewardCredits: Math.max(0, Math.min(100000, Math.floor(Number(item.rewardCredits) || 0))),
    enabled: item.enabled !== false,
    conditions: normalizeLevelConditions(item.conditions || {})
  }
}

export function isUserLevelsFeatureEnabled(state) {
  return Boolean(state?.settings?.userLevelsEnabled)
}

export function listUserLevels(state, { includeDisabled = false } = {}) {
  // 总开关关闭时，对小程序/发奖侧视为无等级（管理端用 includeDisabled 仍可编辑）
  if (!includeDisabled && !isUserLevelsFeatureEnabled(state)) return []
  // 已初始化为空数组 = 未配置等级；仅未初始化时用默认档
  const raw = Array.isArray(state.userLevels)
    ? state.userLevels
    : DEFAULT_USER_LEVELS
  return raw
    .map((item, index) => normalizeUserLevel(item, index))
    .filter(item => includeDisabled || item.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh'))
}

export function computeUserLevelMetrics(state, userId, { flowersReceived = 0 } = {}) {
  const jobs = (state.jobs || []).filter(item => item.userId === userId && ['succeeded', 'partial'].includes(item.status))
  const checkinDays = listUserCheckinDateKeys(state, userId).length
  const shareCount = (state.shareEvents || []).filter(
    item => item.userId === userId && ['friend', 'timeline'].includes(item.channel)
  ).length
  const inviteCount = (state.invites || []).filter(item => item.inviterId === userId).length
  const activeSet = new Set()
  for (const tx of state.transactions || []) {
    if (tx.userId !== userId || !tx.createdAt) continue
    activeSet.add(chinaDateFromIso(tx.createdAt))
  }
  for (const job of jobs) {
    if (job.createdAt) activeSet.add(chinaDateFromIso(job.createdAt))
  }
  return {
    checkinDays,
    completedJobs: jobs.length,
    generatedImages: jobs.reduce((sum, item) => sum + (item.results || []).length, 0),
    shareCount,
    inviteCount,
    flowersReceived: Number(flowersReceived || 0),
    activeDays: activeSet.size
  }
}

export function levelMeetsConditions(level, metrics) {
  const c = level.conditions || {}
  return metrics.checkinDays >= (c.minCheckinDays || 0)
    && metrics.completedJobs >= (c.minCompletedJobs || 0)
    && metrics.generatedImages >= (c.minGeneratedImages || 0)
    && metrics.shareCount >= (c.minShareCount || 0)
    && metrics.inviteCount >= (c.minInviteCount || 0)
    && metrics.flowersReceived >= (c.minFlowersReceived || 0)
    && metrics.activeDays >= (c.minActiveDays || 0)
}

export function resolveUserLevel(state, userId, metrics) {
  const levels = listUserLevels(state)
  if (!levels.length) return { current: null, next: null, levels: [] }
  let current = levels[0]
  for (const level of levels) {
    if (levelMeetsConditions(level, metrics)) current = level
  }
  const next = levels.find(item => item.sortOrder > current.sortOrder)
  return { current, next, levels }
}

export function publicLevel(level) {
  if (!level) return null
  return {
    id: level.id,
    name: level.name,
    title: level.title,
    badgeText: level.badgeText,
    badgeTone: level.badgeTone,
    sortOrder: level.sortOrder,
    rewardCredits: level.rewardCredits,
    conditions: level.conditions
  }
}

export function isCampaignActive(campaign, nowMs = Date.now()) {
  if (!campaign || campaign.enabled === false) return false
  const start = campaign.startAt ? new Date(campaign.startAt).getTime() : 0
  const end = campaign.endAt ? new Date(campaign.endAt).getTime() : Number.POSITIVE_INFINITY
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false
  return nowMs >= start && nowMs <= end
}

export function listActiveCampaigns(state, nowMs = Date.now()) {
  return (Array.isArray(state.campaigns) ? state.campaigns : [])
    .filter(item => isCampaignActive(item, nowMs))
    .sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')))
}

export function sumActiveCampaignField(state, field) {
  return listActiveCampaigns(state).reduce((sum, item) => sum + Math.max(0, Number(item[field]) || 0), 0)
}

export function resolveTemplateUnitCost(template, state) {
  const base = Number(template?.cost || 0)
  const promos = listActiveCampaigns(state).filter(item => item.type === 'template_promo')
  let best = base
  let applied = null
  for (const campaign of promos) {
    const ids = Array.isArray(campaign.templateIds) ? campaign.templateIds : []
    if (ids.length && !ids.includes(template.id)) continue
    const override = Number(campaign.costOverride)
    if (!Number.isFinite(override) || override < 0) continue
    if (override < best) {
      best = Math.floor(override)
      applied = campaign
    }
  }
  return {
    cost: best,
    originalCost: base,
    discounted: best < base,
    campaignId: applied?.id || '',
    campaignName: applied?.name || '',
    campaignBadge: applied?.badge || '',
    promoStartAt: applied?.startAt || '',
    promoEndAt: applied?.endAt || ''
  }
}

export function inviteRewardMultiplier(state) {
  const boosts = listActiveCampaigns(state).filter(item => item.type === 'invite_boost')
  let mult = 1
  for (const item of boosts) {
    const m = Number(item.inviteBonusMultiplier)
    if (Number.isFinite(m) && m > mult) mult = m
  }
  return mult
}

export function galleryRewardBoost(state) {
  return {
    publishExtra: sumActiveCampaignField(
      { campaigns: listActiveCampaigns(state).filter(item => item.type === 'gallery_boost') },
      'galleryPublishBonus'
    ),
    likeExtra: sumActiveCampaignField(
      { campaigns: listActiveCampaigns(state).filter(item => item.type === 'gallery_boost') },
      'galleryLikeBonus'
    )
  }
}

export function createChallengeBonus(state) {
  return sumActiveCampaignField(
    { campaigns: listActiveCampaigns(state).filter(item => item.type === 'create_challenge') },
    'createJobBonus'
  )
}

export function normalizeCampaign(item = {}, index = 0) {
  const type = CAMPAIGN_TYPE_LABELS[item.type] ? item.type : 'template_promo'
  return {
    id: String(item.id || `campaign-${index + 1}`),
    name: String(item.name || '未命名活动').slice(0, 60),
    type,
    typeLabel: CAMPAIGN_TYPE_LABELS[type],
    description: String(item.description || '').slice(0, 500),
    badge: String(item.badge || CAMPAIGN_TYPE_LABELS[type]).slice(0, 20),
    enabled: item.enabled !== false,
    startAt: item.startAt || '',
    endAt: item.endAt || '',
    templateIds: Array.isArray(item.templateIds) ? item.templateIds.map(String) : [],
    costOverride: Math.max(0, Math.floor(Number(item.costOverride) || 0)),
    checkinBonus: Math.max(0, Math.floor(Number(item.checkinBonus) || 0)),
    createJobBonus: Math.max(0, Math.floor(Number(item.createJobBonus) || 0)),
    inviteBonusMultiplier: Math.max(1, Math.min(10, Number(item.inviteBonusMultiplier) || 1)),
    galleryPublishBonus: Math.max(0, Math.floor(Number(item.galleryPublishBonus) || 0)),
    galleryLikeBonus: Math.max(0, Math.floor(Number(item.galleryLikeBonus) || 0)),
    announcementId: String(item.announcementId || ''),
    createdAt: item.createdAt || '',
    updatedAt: item.updatedAt || item.createdAt || ''
  }
}

export function publicCampaign(item, nowMs = Date.now()) {
  const campaign = normalizeCampaign(item)
  return {
    ...campaign,
    active: isCampaignActive(campaign, nowMs)
  }
}

export function ensureEngagementCollections(draft) {
  let changed = false
  if (!Array.isArray(draft.userLevels)) {
    draft.userLevels = DEFAULT_USER_LEVELS.map(item => ({ ...item, conditions: { ...item.conditions } }))
    changed = true
  }
  if (!Array.isArray(draft.campaigns)) {
    draft.campaigns = []
    changed = true
  }
  if (draft.settings) {
    if (!Array.isArray(draft.settings.checkinStreakBonuses)) {
      draft.settings.checkinStreakBonuses = DEFAULT_CHECKIN_STREAK_BONUSES.map(item => ({ ...item }))
      changed = true
    }
    if (draft.settings.userLevelsEnabled === undefined) {
      draft.settings.userLevelsEnabled = false
      changed = true
    }
    // 等级为可选功能：一次性将默认档改为停用，避免「未启用」时仍展示角标
    if (draft.settings.userLevelOptInApplied !== true && Array.isArray(draft.userLevels)) {
      const defaultIds = new Set(DEFAULT_USER_LEVELS.map(item => item.id))
      for (const level of draft.userLevels) {
        if (defaultIds.has(level.id)) level.enabled = false
      }
      draft.settings.userLevelOptInApplied = true
      changed = true
    }
  }
  return changed
}
