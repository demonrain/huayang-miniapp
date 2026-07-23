/**
 * Track recent job failures locally. If a user fails often in a short window,
 * surface a "service may be unstable" hint instead of endless retries.
 */

const STORAGE_KEY = 'huayang_job_fail_times'
const WINDOW_MS = 30 * 60 * 1000 // 30 minutes
const THRESHOLD = 3

function readTimes() {
  try {
    const raw = wx.getStorageSync(STORAGE_KEY)
    const list = typeof raw === 'string' ? JSON.parse(raw || '[]') : raw
    return Array.isArray(list) ? list.map(Number).filter(n => Number.isFinite(n)) : []
  } catch (error) {
    return []
  }
}

function writeTimes(times) {
  try {
    wx.setStorageSync(STORAGE_KEY, JSON.stringify(times.slice(-20)))
  } catch (error) {}
}

function prune(times, now = Date.now()) {
  return times.filter(ts => now - ts <= WINDOW_MS)
}

/** Call when a job is observed as failed. Returns whether unstable tip should show. */
function recordJobFailure() {
  const now = Date.now()
  const times = prune(readTimes(), now)
  times.push(now)
  writeTimes(times)
  return times.length >= THRESHOLD
}

function isServiceUnstable() {
  const times = prune(readTimes())
  return times.length >= THRESHOLD
}

function recentFailureCount() {
  return prune(readTimes()).length
}

module.exports = {
  recordJobFailure,
  isServiceUnstable,
  recentFailureCount,
  WINDOW_MS,
  THRESHOLD
}
