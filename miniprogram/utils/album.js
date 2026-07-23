/**
 * Save image to album with robust permission handling for WeChat mini program.
 *
 * Common pitfalls fixed:
 * - Do not keep wx.showLoading(mask) while showing authorize / openSetting
 * - Prefer saveImageToPhotosAlbum to trigger system dialog; fall back to authorize + openSetting
 * - Handle privacy agreement API when available
 * - Map WeChat errMsg to clear Chinese tips (avoid "please note album permission")
 */

const SCOPE = 'scope.writePhotosAlbum'

function hideLoadingQuiet() {
  try {
    wx.hideLoading({ fail: () => {} })
  } catch (error) {}
}

function getSetting() {
  return new Promise(resolve => {
    wx.getSetting({
      success: res => resolve((res && res.authSetting) || {}),
      fail: () => resolve({})
    })
  })
}

function openSetting() {
  return new Promise((resolve, reject) => {
    wx.openSetting({
      success: resolve,
      fail: reject
    })
  })
}

function authorizeScope() {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope: SCOPE,
      success: resolve,
      fail: reject
    })
  })
}

function saveImageRaw(filePath) {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      reject(Object.assign(new Error('图片路径无效'), { errMsg: 'invalid filePath' }))
      return
    }
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

function isAuthError(error) {
  if (!error) return false
  const msg = String(error.errMsg || error.message || error || '')
  const lower = msg.toLowerCase()
  // WeChat: "saveImageToPhotosAlbum:fail auth deny" / "authorize:fail" / errno
  if (
    lower.includes('auth')
    || lower.includes('authorize')
    || lower.includes('permission')
    || lower.includes('deny')
    || lower.includes('denied')
    || lower.includes('privacy')
    || msg.includes('拒绝')
    || msg.includes('未授权')
    || msg.includes('权限')
    || msg.includes('相册')
  ) return true
  const code = Number(error.errno != null ? error.errno : error.errCode)
  // Common auth-related codes on various base libraries
  if ([102, 103, 104, 112, 10403].includes(code)) return true
  return false
}

function albumDeniedError(message) {
  const err = new Error(message || '需要开启相册权限后才能保存')
  err.code = 'ALBUM_DENIED'
  return err
}

function saveFailedError(message) {
  const err = new Error(message || '保存到相册失败，请稍后重试')
  err.code = 'SAVE_FAILED'
  return err
}

/** Privacy agreement (base library ≥ 2.32.3 when privacy check is on). */
function requirePrivacyIfNeeded() {
  return new Promise(resolve => {
    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      resolve(true)
      return
    }
    wx.requirePrivacyAuthorize({
      success: () => resolve(true),
      fail: () => resolve(false)
    })
  })
}

function confirmOpenSetting(content) {
  hideLoadingQuiet()
  return new Promise(resolve => {
    wx.showModal({
      title: '需要相册权限',
      content: content || '保存作品到手机相册需要你的授权，请在设置中开启「添加到相册」。',
      confirmText: '去设置',
      cancelText: '取消',
      success: res => resolve(Boolean(res.confirm)),
      fail: () => resolve(false)
    })
  })
}

/**
 * Ensure writePhotosAlbum is granted.
 * Hides loading only when about to show permission UI (modal / openSetting),
 * so progress loading during multi-save is not cleared early.
 * @returns {Promise<void>}
 */
async function ensureAlbumPermission() {
  const privacyOk = await requirePrivacyIfNeeded()
  if (!privacyOk) {
    hideLoadingQuiet()
    throw albumDeniedError('请先同意隐私保护指引后再保存到相册')
  }

  const settings = await getSetting()
  const flag = settings[SCOPE]

  // Already granted
  if (flag === true) return

  // Previously denied — only openSetting can re-enable
  if (flag === false) {
    hideLoadingQuiet()
    const go = await confirmOpenSetting('你之前拒绝了相册权限。请在设置中开启「添加到相册」，才能保存作品。')
    if (!go) throw albumDeniedError('需要开启相册权限后才能保存')
    const result = await openSetting().catch(() => null)
    if (!(result && result.authSetting && result.authSetting[SCOPE])) {
      throw albumDeniedError('尚未开启相册权限，可稍后在设置中允许')
    }
    return
  }

  // Never asked: try authorize (system dialog) — hide loading so dialog is not blocked
  hideLoadingQuiet()
  try {
    await authorizeScope()
    return
  } catch (error) {
    // authorize failed (user cancel or privacy) — guide to settings
    const go = await confirmOpenSetting('保存作品需要访问相册。若未弹出授权，请在设置中开启「添加到相册」。')
    if (!go) throw albumDeniedError('需要开启相册权限后才能保存')
    const result = await openSetting().catch(() => null)
    if (!(result && result.authSetting && result.authSetting[SCOPE])) {
      throw albumDeniedError('尚未开启相册权限，可稍后在设置中允许')
    }
  }
}

/**
 * Save one local image file to album. Requests permission if needed.
 * Callers should avoid showLoading(mask) while this runs for first-time auth.
 */
async function saveImageToAlbum(filePath) {
  // Always resolve permission first (hides loading internally when showing modals)
  await ensureAlbumPermission()

  try {
    await saveImageRaw(filePath)
  } catch (error) {
    if (!isAuthError(error)) {
      throw saveFailedError('保存到相册失败，请检查网络后重试')
    }

    // Permission became invalid mid-way: re-guide and retry once
    hideLoadingQuiet()
    const settings = await getSetting()
    if (settings[SCOPE] === false || settings[SCOPE] !== true) {
      const go = await confirmOpenSetting('保存失败：未获得相册权限。请在设置中开启「添加到相册」后重试。')
      if (!go) throw albumDeniedError('需要开启相册权限后才能保存')
      const result = await openSetting().catch(() => null)
      if (!(result && result.authSetting && result.authSetting[SCOPE])) {
        throw albumDeniedError('尚未开启相册权限，可稍后在设置中允许')
      }
    }

    try {
      await saveImageRaw(filePath)
    } catch (retryError) {
      if (isAuthError(retryError)) {
        throw albumDeniedError('保存失败，请在设置中开启相册权限后重试')
      }
      throw saveFailedError('保存到相册失败，请稍后重试')
    }
  }
}

module.exports = {
  ensureAlbumPermission,
  saveImageToAlbum,
  isAuthError,
  hideLoadingQuiet
}
