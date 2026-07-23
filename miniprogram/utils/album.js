/**
 * Save image to album with permission handling.
 * Avoids raw WeChat errMsg like "please note album permission".
 */

function getSetting(scope) {
  return new Promise(resolve => {
    wx.getSetting({
      success: res => resolve(res.authSetting || {}),
      fail: () => resolve({})
    })
  })
}

function authorize(scope) {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope,
      success: resolve,
      fail: reject
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

function saveImageRaw(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

function isAuthError(error) {
  const msg = String(error?.errMsg || error?.message || error || '').toLowerCase()
  return msg.includes('auth') || msg.includes('authorize') || msg.includes('permission') || msg.includes('deny') || msg.includes('拒绝')
}

/**
 * Ensure writePhotosAlbum permission, then save.
 * @returns {Promise<void>}
 */
async function ensureAlbumPermission() {
  const scope = 'scope.writePhotosAlbum'
  const settings = await getSetting(scope)
  if (settings[scope] === true) return
  if (settings[scope] === false) {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '需要相册权限',
        content: '保存作品到手机需要开启相册权限，请在设置中允许访问相册。',
        confirmText: '去设置',
        cancelText: '取消',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) {
      const err = new Error('需要开启相册权限后才能保存')
      err.code = 'ALBUM_DENIED'
      throw err
    }
    const result = await openSetting()
    if (!(result.authSetting && result.authSetting[scope])) {
      const err = new Error('尚未开启相册权限，可稍后在设置中允许')
      err.code = 'ALBUM_DENIED'
      throw err
    }
    return
  }
  try {
    await authorize(scope)
  } catch (error) {
    const confirmed = await new Promise(resolve => {
      wx.showModal({
        title: '需要相册权限',
        content: '保存作品需要访问你的相册，请允许后重试。',
        confirmText: '去设置',
        cancelText: '取消',
        success: res => resolve(Boolean(res.confirm)),
        fail: () => resolve(false)
      })
    })
    if (!confirmed) {
      const err = new Error('需要开启相册权限后才能保存')
      err.code = 'ALBUM_DENIED'
      throw err
    }
    const result = await openSetting()
    if (!(result.authSetting && result.authSetting[scope])) {
      const err = new Error('尚未开启相册权限，可稍后在设置中允许')
      err.code = 'ALBUM_DENIED'
      throw err
    }
  }
}

async function saveImageToAlbum(filePath) {
  await ensureAlbumPermission()
  try {
    await saveImageRaw(filePath)
  } catch (error) {
    if (isAuthError(error)) {
      const err = new Error('保存失败，请在设置中开启相册权限后重试')
      err.code = 'ALBUM_DENIED'
      throw err
    }
    const err = new Error('保存到相册失败，请稍后重试')
    err.code = 'SAVE_FAILED'
    throw err
  }
}

module.exports = {
  ensureAlbumPermission,
  saveImageToAlbum,
  isAuthError
}
