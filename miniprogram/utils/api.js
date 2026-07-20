function baseUrl() {
  return getApp().globalData.apiBase
}

function request(path, options = {}) {
  const token = wx.getStorageSync('huayang_token')
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${baseUrl()}${path}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'content-type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data)
          return
        }
        const error = new Error(response.data?.message || '请求失败，请稍后重试')
        error.statusCode = response.statusCode
        error.code = response.data?.code
        reject(error)
      },
      fail: reject
    })
  })
}

function upload(filePath) {
  const token = wx.getStorageSync('huayang_token')
  return new Promise((resolve, reject) => {
    const task = wx.uploadFile({
      url: `${baseUrl()}/api/assets`,
      filePath,
      name: 'image',
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success(response) {
        let body
        try {
          body = JSON.parse(response.data)
        } catch (error) {
          reject(new Error('上传响应格式异常'))
          return
        }
        if (response.statusCode >= 200 && response.statusCode < 300) resolve(body)
        else reject(new Error(body.message || '图片上传失败'))
      },
      fail: reject
    })
    task.onProgressUpdate(options => options)
  })
}

module.exports = {
  get: path => request(path),
  post: (path, data) => request(path, { method: 'POST', data }),
  patch: (path, data) => request(path, { method: 'PATCH', data }),
  upload
}

