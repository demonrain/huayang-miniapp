import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Blob } from 'node:buffer'
import { config } from '../src/config.mjs'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

test('complete login, generation, idempotency and recharge flow', async () => {
  const sandbox = await mkdtemp(path.join(tmpdir(), 'huayang-test-'))
  const original = {
    dataDir: config.dataDir,
    mediaDir: config.mediaDir,
    publicBaseUrl: config.publicBaseUrl,
    mockLogin: config.wechat.mockLogin,
    imageProvider: config.image.provider,
    imageDelay: config.image.mockDelayMs,
    paymentMode: config.payment.mode,
    adminPassword: config.admin.password
  }

  config.dataDir = path.join(sandbox, 'data')
  config.mediaDir = path.join(sandbox, 'media')
  config.publicBaseUrl = 'http://127.0.0.1:8787'
  config.wechat.mockLogin = true
  config.image.provider = 'mock'
  config.image.mockDelayMs = 10
  config.payment.mode = 'mock'
  config.admin.password = 'test-admin-password'

  const { createApplication } = await import('../src/index.mjs')
  const application = await createApplication()
  await new Promise((resolve, reject) => {
    application.server.once('error', reject)
    application.server.listen(0, '127.0.0.1', resolve)
  })
  const address = application.server.address()
  const base = `http://127.0.0.1:${address.port}`

  async function api(pathname, options = {}) {
    const headers = { ...(options.headers || {}) }
    if (options.token) headers.authorization = `Bearer ${options.token}`
    if (options.json) headers['content-type'] = 'application/json'
    const response = await fetch(`${base}${pathname}`, {
      method: options.method || 'GET',
      headers,
      body: options.json ? JSON.stringify(options.json) : options.body
    })
    const body = await response.json()
    return { response, body }
  }

  try {
    const unauthenticated = await api('/api/me')
    assert.equal(unauthenticated.response.status, 401)

    const login = await api('/api/auth/wechat', { method: 'POST', json: { code: 'test-code' } })
    assert.equal(login.response.status, 200)
    assert.equal(login.body.user.credits, 20)
    const token = login.body.token

    const form = new FormData()
    form.append('image', new Blob([tinyPng], { type: 'image/png' }), 'pixel.png')
    const upload = await api('/api/assets', { method: 'POST', token, body: form })
    assert.equal(upload.response.status, 201)
    assert.equal(upload.body.asset.mime, 'image/png')

    const request = {
      templateId: 'film-diary',
      assetIds: [upload.body.asset.id],
      clientRequestId: 'fixed-client-request'
    }
    const created = await api('/api/jobs', { method: 'POST', token, json: request })
    assert.equal(created.response.status, 201)
    assert.equal(created.body.user.credits, 18)

    const duplicate = await api('/api/jobs', { method: 'POST', token, json: request })
    assert.equal(duplicate.response.status, 200)
    assert.equal(duplicate.body.job.id, created.body.job.id)
    assert.equal(duplicate.body.user.credits, 18)

    let completed
    for (let attempt = 0; attempt < 30; attempt += 1) {
      completed = await api(`/api/jobs/${created.body.job.id}`, { token })
      if (completed.body.job.status === 'succeeded') break
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.equal(completed.body.job.status, 'succeeded')
    assert.equal(completed.body.job.results.length, 1)

    const adminLogin = await api('/api/admin/login', {
      method: 'POST', json: { password: 'test-admin-password' }
    })
    assert.equal(adminLogin.response.status, 200)
    const adminToken = adminLogin.body.token

    const settings = await api('/api/admin/settings', {
      method: 'PATCH', token: adminToken, json: { welcomeCredits: 25, checkinCredits: 7, shareTitle: '测试分享标题' }
    })
    assert.equal(settings.body.settings.checkinCredits, 7)

    const templateUpdate = await api('/api/admin/templates/film-diary', {
      method: 'PATCH', token: adminToken, json: { cost: 3 }
    })
    assert.equal(templateUpdate.body.template.cost, 3)

    const coverForm = new FormData()
    coverForm.append('image', new Blob([tinyPng], { type: 'image/png' }), 'cover.png')
    const cover = await api('/api/admin/templates/film-diary/cover', {
      method: 'POST', token: adminToken, body: coverForm
    })
    assert.match(cover.body.template.coverUrl, /\/media\/covers\//)

    const packageUpdate = await api('/api/admin/packages/starter', {
      method: 'PATCH', token: adminToken, json: { credits: 35 }
    })
    assert.equal(packageUpdate.body.package.credits, 35)

    const checkin = await api('/api/checkins', { method: 'POST', token, json: {} })
    assert.equal(checkin.body.claimed, true)
    assert.equal(checkin.body.reward, 7)
    assert.equal(checkin.body.user.credits, 25)

    const repeatedCheckin = await api('/api/checkins', { method: 'POST', token, json: {} })
    assert.equal(repeatedCheckin.body.claimed, false)
    assert.equal(repeatedCheckin.body.user.credits, 25)

    const createdShare = await api(`/api/jobs/${created.body.job.id}/share`, {
      method: 'POST', token, json: {}
    })
    assert.equal(createdShare.response.status, 200)
    assert.equal(createdShare.body.share.title, '测试分享标题')

    const publicShare = await api(`/api/shares/${createdShare.body.share.token}`)
    assert.equal(publicShare.response.status, 200)
    assert.equal(publicShare.body.share.results.length, 1)

    const qrCode = await api(`/api/jobs/${created.body.job.id}/share/qrcode`, {
      method: 'POST', token, json: {}
    })
    assert.equal(qrCode.response.status, 409)
    assert.equal(qrCode.body.code, 'WECHAT_SHARE_NOT_CONFIGURED')

    const recharge = await api('/api/payments/orders', {
      method: 'POST', token, json: { packageId: 'starter' }
    })
    assert.equal(recharge.response.status, 201)
    assert.equal(recharge.body.payment.mode, 'mock')
    assert.equal(recharge.body.user.credits, 60)

    const wallet = await api('/api/wallet', { token })
    assert.equal(wallet.body.checkin.claimedToday, true)
    assert.deepEqual(wallet.body.transactions.map(item => item.amount), [35, 7, -2, 20])
  } finally {
    await new Promise(resolve => application.server.close(resolve))
    config.dataDir = original.dataDir
    config.mediaDir = original.mediaDir
    config.publicBaseUrl = original.publicBaseUrl
    config.wechat.mockLogin = original.mockLogin
    config.image.provider = original.imageProvider
    config.image.mockDelayMs = original.imageDelay
    config.payment.mode = original.paymentMode
    config.admin.password = original.adminPassword
    await rm(sandbox, { recursive: true, force: true })
  }
})
