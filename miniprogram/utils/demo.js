/** Practice / onboarding demo mode helpers (no real upload or job API). */

const DEMO_JOB_KEY = 'huayang_demo_job'
const ONBOARDING_KEY = 'huayang_onboarding_done'

function isDemoQuery(query) {
  if (!query) return false
  return query.demo === '1' || query.demo === 'true' || query.demo === true
}

function isDemoJobId(id) {
  return typeof id === 'string' && id.indexOf('demo-') === 0
}

function markOnboardingDone() {
  try {
    wx.setStorageSync(ONBOARDING_KEY, '1')
  } catch (error) {}
}

function saveDemoJob(job) {
  try {
    wx.setStorageSync(DEMO_JOB_KEY, JSON.stringify(job))
  } catch (error) {}
}

function loadDemoJob(id) {
  try {
    const raw = wx.getStorageSync(DEMO_JOB_KEY)
    if (!raw) return null
    const job = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!job || !job.id) return null
    if (id && job.id !== id) return null
    return job
  } catch (error) {
    return null
  }
}

/**
 * Build a local fake job. Fake "generated" images use the style cover
 * (or the user's photo as last resort) so results look like real work cards.
 */
function buildDemoJob({ template, files }) {
  const id = `demo-${Date.now()}`
  const cover = (template && (template.coverFullUrl || template.coverUrl)) || ''
  const cost = (files.length || 0) * (Number(template && template.cost) || 0)
  const originals = (files || []).map((file, index) => ({
    id: `demo-orig-${index}`,
    url: file.path,
    thumbUrl: file.path,
    index: index + 1
  }))
  const pendingResults = (files || []).map((file, index) => {
    const url = cover || file.path
    return {
      id: `demo-result-${index}`,
      url,
      thumbUrl: url
    }
  })
  return {
    id,
    demo: true,
    status: 'queued',
    templateId: template.id,
    templateName: template.name,
    assetIds: (files || []).map((_, index) => `demo-asset-${index}`),
    cost,
    results: [],
    originals,
    _pendingResults: pendingResults,
    error: null
  }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  isDemoQuery,
  isDemoJobId,
  markOnboardingDone,
  saveDemoJob,
  loadDemoJob,
  buildDemoJob,
  delay
}
