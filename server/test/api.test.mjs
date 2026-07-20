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
    paymentMode: config.payment.mode
  }

  config.dataDir = path.join(sandbox, 'data')
  config.mediaDir = path.join(sandbox, 'media')
  config.publicBaseUrl = 'http://127.0.0.1:8787'
  config.wechat.mockLogin = true
  config.image.provider = 'mock'
  config.image.mockDelayMs = 10
  config.payment.mode = 'mock'

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

    const recharge = await api('/api/payments/orders', {
      method: 'POST', token, json: { packageId: 'starter' }
    })
    assert.equal(recharge.response.status, 201)
    assert.equal(recharge.body.payment.mode, 'mock')
    assert.equal(recharge.body.user.credits, 48)

    const wallet = await api('/api/wallet', { token })
    assert.deepEqual(wallet.body.transactions.map(item => item.amount), [30, -2, 20])
  } finally {
    await new Promise(resolve => application.server.close(resolve))
    config.dataDir = original.dataDir
    config.mediaDir = original.mediaDir
    config.publicBaseUrl = original.publicBaseUrl
    config.wechat.mockLogin = original.mockLogin
    config.image.provider = original.imageProvider
    config.image.mockDelayMs = original.imageDelay
    config.payment.mode = original.paymentMode
    await rm(sandbox, { recursive: true, force: true })
  }
})

