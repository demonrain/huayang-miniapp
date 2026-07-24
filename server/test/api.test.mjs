import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Blob } from 'node:buffer'
import { config } from '../src/config.mjs'
import { seedConfig } from '../src/domain.mjs'

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
)

test('migrates the legacy default share title without overwriting custom settings', () => {
  const base = {
    settings: { welcomeCredits: 20, checkinCredits: 3, shareTitle: '来看看我用画漾制作的作品' },
    templates: [{ id: 'custom', tags: [], popularity: 0 }],
    banners: [{ id: 'banner' }],
    packages: [{ id: 'package' }]
  }
  assert.equal(seedConfig(base), true)
  assert.equal(base.settings.shareTitle, '来看看我用花漾相绘制作的作品')

  const custom = structuredClone(base)
  custom.settings.shareTitle = '我的自定义分享标题'
  assert.equal(seedConfig(custom), false)
  assert.equal(custom.settings.shareTitle, '我的自定义分享标题')
})

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
    assert.ok(completed.body.job.results[0].url)
    assert.ok(completed.body.job.results[0].thumbUrl)
    assert.ok(completed.body.job.coverUrl)

    // Succeeded jobs cannot be deleted; only failed records can
    const deleteSucceeded = await api(`/api/jobs/${created.body.job.id}`, { method: 'DELETE', token })
    assert.equal(deleteSucceeded.response.status, 409)

    const failedJobId = 'test-failed-job-to-delete'
    await application.store.transaction(draft => {
      draft.jobs.push({
        id: failedJobId,
        clientRequestId: '',
        userId: login.body.user.id,
        templateId: 'film-diary',
        assetIds: [upload.body.asset.id],
        cost: 0,
        status: 'failed',
        results: [],
        error: '测试失败记录',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    })
    const deletedFailed = await api(`/api/jobs/${failedJobId}`, { method: 'DELETE', token })
    assert.equal(deletedFailed.response.status, 200)
    assert.equal(deletedFailed.body.ok, true)
    const missing = await api(`/api/jobs/${failedJobId}`, { token })
    assert.equal(missing.response.status, 404)

    const adminLogin = await api('/api/admin/login', {
      method: 'POST', json: { password: 'test-admin-password' }
    })
    assert.equal(adminLogin.response.status, 200)
    const adminToken = adminLogin.body.token

    const overview = await api('/api/admin/overview', { token: adminToken })
    assert.equal(overview.response.status, 200)
    assert.equal(overview.body.banners.length, 1)
    assert.ok(Number(overview.body.templateCount) >= 1)
    assert.equal(overview.body.settings.shareTitle, '来看看我用花漾相绘制作的作品')

    const adminTemplates = await api('/api/admin/templates?page=1&pageSize=20', { token: adminToken })
    assert.equal(adminTemplates.response.status, 200)
    assert.ok(adminTemplates.body.templates.length >= 1)
    assert.deepEqual(adminTemplates.body.templates[0].tags, ['人气', '热门'])
    assert.ok(Number(adminTemplates.body.total) >= 1)
    assert.equal(adminTemplates.body.page, 1)

    const settings = await api('/api/admin/settings', {
      method: 'PATCH', token: adminToken, json: { welcomeCredits: 25, checkinCredits: 7, shareTitle: '测试分享标题' }
    })
    assert.equal(settings.body.settings.checkinCredits, 7)

    const templateUpdate = await api('/api/admin/templates/film-diary', {
      method: 'PATCH', token: adminToken, json: { cost: 3, popularity: 12000, tags: ['热门', '推荐'] }
    })
    assert.equal(templateUpdate.body.template.cost, 3)
    assert.equal(templateUpdate.body.template.popularity, 12000)
    assert.deepEqual(templateUpdate.body.template.tags, ['热门', '推荐'])

    const coverForm = new FormData()
    coverForm.append('image', new Blob([tinyPng], { type: 'image/png' }), 'cover.png')
    const cover = await api('/api/admin/templates/film-diary/cover', {
      method: 'POST', token: adminToken, body: coverForm
    })
    assert.match(cover.body.template.coverUrl, /\/media\/covers\//)

    const users = await api('/api/admin/users?query=微信用户&status=enabled', { token: adminToken })
    assert.equal(users.body.users.length, 1)
    assert.equal(users.body.users[0].completedJobs, 1)

    const adjusted = await api(`/api/admin/users/${login.body.user.id}/credits`, {
      method: 'POST', token: adminToken, json: { amount: 5, reason: '测试补发' }
    })
    assert.equal(adjusted.body.user.credits, 23)

    const disabled = await api(`/api/admin/users/${login.body.user.id}`, {
      method: 'PATCH', token: adminToken, json: { enabled: false }
    })
    assert.equal(disabled.body.user.enabled, false)
    assert.equal((await api('/api/me', { token })).response.status, 403)
    await api(`/api/admin/users/${login.body.user.id}`, {
      method: 'PATCH', token: adminToken, json: { enabled: true }
    })

    const transactions = await api('/api/admin/transactions?type=job_charge', { token: adminToken })
    assert.equal(transactions.body.transactions.length, 1)
    assert.equal(transactions.body.transactions[0].amount, -2)

    const jobs = await api('/api/admin/jobs?status=succeeded', { token: adminToken })
    assert.equal(jobs.body.jobs.length, 1)
    assert.equal(jobs.body.jobs[0].userNickname, '微信用户')

    const banner = await api('/api/admin/banners', {
      method: 'POST',
      token: adminToken,
      json: {
        title: '春日上新',
        subtitle: '测试 Banner',
        badge: '上新',
        palette: '#dff3ec',
        titleColor: '#385c54',
        subtitleColor: '#71857f',
        badgeColor: '#2f8f78',
        targetPath: '',
        sortOrder: 20,
        enabled: true
      }
    })
    assert.equal(banner.response.status, 201)
    assert.equal(banner.body.banner.titleColor, '#385c54')
    assert.equal(banner.body.banner.subtitleColor, '#71857f')
    assert.equal(banner.body.banner.badgeColor, '#2f8f78')
    const bannerForm = new FormData()
    bannerForm.append('image', new Blob([tinyPng], { type: 'image/png' }), 'banner.png')
    const bannerImage = await api(`/api/admin/banners/${banner.body.banner.id}/image`, {
      method: 'POST', token: adminToken, body: bannerForm
    })
    assert.match(bannerImage.body.banner.imageUrl, /\/media\/banners\//)
    const publicBanners = await api('/api/banners')
    assert.equal(publicBanners.body.banners.length, 2)

    const packageUpdate = await api('/api/admin/packages/starter', {
      method: 'PATCH', token: adminToken, json: { credits: 35 }
    })
    assert.equal(packageUpdate.body.package.credits, 35)

    const checkin = await api('/api/checkins', { method: 'POST', token, json: {} })
    assert.equal(checkin.body.claimed, true)
    assert.equal(checkin.body.reward, 7)
    assert.equal(checkin.body.user.credits, 30)

    const repeatedCheckin = await api('/api/checkins', { method: 'POST', token, json: {} })
    assert.equal(repeatedCheckin.body.claimed, false)
    assert.equal(repeatedCheckin.body.user.credits, 30)

    const createdShare = await api(`/api/jobs/${created.body.job.id}/share`, {
      method: 'POST', token, json: {}
    })
    assert.equal(createdShare.response.status, 200)
    assert.equal(createdShare.body.share.title, '测试分享标题')

    const publicShare = await api(`/api/shares/${createdShare.body.share.token}`)
    assert.equal(publicShare.response.status, 200)
    assert.equal(publicShare.body.share.results.length, 1)
    assert.ok(publicShare.body.share.inviterId)

    // Share-for-credits: friend channel
    const shareReward = await api('/api/share-rewards', {
      method: 'POST',
      token,
      json: { jobId: created.body.job.id, channel: 'friend', clientRequestId: 'share-friend-1' }
    })
    assert.equal(shareReward.response.status, 200)
    assert.equal(shareReward.body.rewarded, true)
    assert.equal(shareReward.body.reward, 2)

    const shareRewardDup = await api('/api/share-rewards', {
      method: 'POST',
      token,
      json: { jobId: created.body.job.id, channel: 'friend', clientRequestId: 'share-friend-2' }
    })
    assert.equal(shareRewardDup.body.rewarded, false)
    assert.equal(shareRewardDup.body.reason, 'already_shared_job')

    // Invite login reward for inviter when new user registers via share token
    const inviteeLogin = await api('/api/auth/wechat', {
      method: 'POST',
      json: { code: 'invitee-user-code', inviteToken: createdShare.body.share.token }
    })
    assert.equal(inviteeLogin.response.status, 200)
    assert.equal(inviteeLogin.body.user.isNew, true)
    assert.ok(inviteeLogin.body.invite)
    assert.equal(inviteeLogin.body.invite.loginReward, 5)

    const inviterAfterInvite = await api('/api/me', { token })
    // 30 after checkin + 2 share + 5 invite login = 37
    assert.equal(inviterAfterInvite.body.user.credits, 37)

    // Invite first-job reward when invitee completes first succeeded job
    const inviteeToken = inviteeLogin.body.token
    const inviteeUploadForm = new FormData()
    inviteeUploadForm.append('image', new Blob([tinyPng], { type: 'image/png' }), 'pixel.png')
    const inviteeUpload = await api('/api/assets', { method: 'POST', token: inviteeToken, body: inviteeUploadForm })
    assert.equal(inviteeUpload.response.status, 201)
    const inviteeJob = await api('/api/jobs', {
      method: 'POST',
      token: inviteeToken,
      json: {
        templateId: 'film-diary',
        assetIds: [inviteeUpload.body.asset.id],
        clientRequestId: 'invitee-first-job'
      }
    })
    assert.equal(inviteeJob.response.status, 201)
    let inviteeCompleted
    for (let attempt = 0; attempt < 30; attempt += 1) {
      inviteeCompleted = await api(`/api/jobs/${inviteeJob.body.job.id}`, { token: inviteeToken })
      if (inviteeCompleted.body.job.status === 'succeeded') break
      await new Promise(resolve => setTimeout(resolve, 20))
    }
    assert.equal(inviteeCompleted.body.job.status, 'succeeded')

    const inviterAfterFirstJob = await api('/api/me', { token })
    // 37 + 10 first-job invite = 47
    assert.equal(inviterAfterFirstJob.body.user.credits, 47)

    const shareStats = await api('/api/admin/share-stats', { token: adminToken })
    assert.equal(shareStats.response.status, 200)
    assert.ok(shareStats.body.summary.shareEventsTotal >= 1)
    assert.ok(shareStats.body.summary.invitesTotal >= 1)

    const qrCode = await api(`/api/jobs/${created.body.job.id}/share/qrcode`, {
      method: 'POST', token, json: {}
    })
    assert.equal(qrCode.response.status, 409)
    assert.equal(qrCode.body.code, 'WECHAT_SHARE_NOT_CONFIGURED')

    // CDK generate + redeem
    const cdkBatch = await api('/api/admin/cdks', {
      method: 'POST',
      token: adminToken,
      json: { credits: 15, count: 2, maxUses: 1, expireType: 'never', note: 'test-batch' }
    })
    assert.equal(cdkBatch.response.status, 201)
    assert.equal(cdkBatch.body.count, 2)
    assert.equal(cdkBatch.body.cdks[0].credits, 15)
    assert.equal(cdkBatch.body.cdks[0].status, 'unused')
    assert.equal(cdkBatch.body.cdks[0].maxUses, 1)

    const redeem = await api('/api/cdks/redeem', {
      method: 'POST',
      token,
      json: { code: cdkBatch.body.cdks[0].code.toLowerCase().replace(/-/g, '') }
    })
    assert.equal(redeem.response.status, 200)
    assert.equal(redeem.body.credits, 15)
    assert.equal(redeem.body.user.credits, 62) // 47 + 15

    const redeemAgain = await api('/api/cdks/redeem', {
      method: 'POST',
      token,
      json: { code: cdkBatch.body.cdks[0].code }
    })
    assert.equal(redeemAgain.response.status, 409)

    // Multi-use universal CDK
    const multiCdk = await api('/api/admin/cdks', {
      method: 'POST',
      token: adminToken,
      json: { credits: 3, count: 1, maxUses: 2, customCode: 'TESTCODE2026', expireType: 'never' }
    })
    assert.equal(multiCdk.response.status, 201)
    assert.equal(multiCdk.body.cdks[0].maxUses, 2)
    const multiRedeem1 = await api('/api/cdks/redeem', {
      method: 'POST', token, json: { code: 'TESTCODE2026' }
    })
    assert.equal(multiRedeem1.response.status, 200)
    const multiRedeemDup = await api('/api/cdks/redeem', {
      method: 'POST', token, json: { code: 'TESTCODE2026' }
    })
    assert.equal(multiRedeemDup.response.status, 409)
    assert.equal(multiRedeemDup.body.code, 'CDK_ALREADY_USED')

    const inviteeToken2Login = await api('/api/auth/wechat', {
      method: 'POST', json: { code: 'cdk-user-two' }
    })
    const multiRedeem2 = await api('/api/cdks/redeem', {
      method: 'POST', token: inviteeToken2Login.body.token, json: { code: 'TESTCODE2026' }
    })
    assert.equal(multiRedeem2.response.status, 200)
    const multiRedeem3 = await api('/api/cdks/redeem', {
      method: 'POST', token: inviteeToken2Login.body.token, json: { code: 'TEST-CODE-EXTRA' }
    })
    // exhausted after 2 uses - create exhausted check with third different user
    const inviteeToken3 = await api('/api/auth/wechat', { method: 'POST', json: { code: 'cdk-user-three' } })
    const multiExhausted = await api('/api/cdks/redeem', {
      method: 'POST', token: inviteeToken3.body.token, json: { code: 'TESTCODE2026' }
    })
    assert.equal(multiExhausted.response.status, 409)
    assert.equal(multiExhausted.body.code, 'CDK_EXHAUSTED')

    const ann = await api('/api/admin/announcements', {
      method: 'POST', token: adminToken,
      json: { title: '测试公告', content: '欢迎使用花漾相绘', enabled: true }
    })
    assert.equal(ann.response.status, 201)
    const publicAnn = await api('/api/announcements')
    assert.equal(publicAnn.response.status, 200)
    assert.ok(publicAnn.body.announcements.some(item => item.title === '测试公告'))

    const cdkList = await api('/api/admin/cdks?status=unused', { token: adminToken })
    assert.equal(cdkList.response.status, 200)
    assert.ok(cdkList.body.summary.exhausted >= 1)
    assert.ok(cdkList.body.summary.unused >= 1)

    // Edit universal CDK credits / maxUses
    const editable = await api('/api/admin/cdks', {
      method: 'POST',
      token: adminToken,
      json: { credits: 8, count: 1, maxUses: 5, customCode: 'EDITABLE2026', expireType: 'never' }
    })
    assert.equal(editable.response.status, 201)
    const editId = editable.body.cdks[0].id
    const patched = await api(`/api/admin/cdks/${editId}`, {
      method: 'PATCH',
      token: adminToken,
      json: { credits: 12, maxUses: 10, note: 'raised quota' }
    })
    assert.equal(patched.response.status, 200)
    assert.equal(patched.body.cdk.credits, 12)
    assert.equal(patched.body.cdk.maxUses, 10)
    assert.equal(patched.body.cdk.note, 'raised quota')

    // Revoke blocks further redeem
    const revokeBatch = await api('/api/admin/cdks', {
      method: 'POST',
      token: adminToken,
      json: { credits: 9, count: 1, maxUses: 3, customCode: 'REVOKE2026', expireType: 'never' }
    })
    const revokeId = revokeBatch.body.cdks[0].id
    const revoked = await api(`/api/admin/cdks/${revokeId}/revoke`, {
      method: 'POST',
      token: adminToken
    })
    assert.equal(revoked.response.status, 200)
    assert.equal(revoked.body.cdk.status, 'revoked')
    const redeemRevoked = await api('/api/cdks/redeem', {
      method: 'POST',
      token,
      json: { code: 'REVOKE2026' }
    })
    assert.equal(redeemRevoked.response.status, 409)
    assert.equal(redeemRevoked.body.code, 'CDK_REVOKED')

    // Showcase requires author to publish first
    const showcaseBlocked = await api(`/api/showcase/jobs/${created.body.job.id}`)
    assert.equal(showcaseBlocked.response.status, 403)
    assert.equal(showcaseBlocked.body.code, 'JOB_NOT_PUBLIC')

    const publishJob = await api(`/api/jobs/${created.body.job.id}/public-share`, {
      method: 'POST',
      token,
      json: { enabled: true, showOriginals: false }
    })
    assert.equal(publishJob.response.status, 200)
    assert.equal(publishJob.body.job.publicShareEnabled, true)
    assert.equal(publishJob.body.job.publicShareShowOriginals, false)

    const showcaseOk = await api(`/api/showcase/jobs/${created.body.job.id}`)
    assert.equal(showcaseOk.response.status, 200)
    assert.equal(showcaseOk.body.job.status, 'succeeded')
    assert.equal(showcaseOk.body.job.originals.length, 0)
    assert.equal(showcaseOk.body.job.showcase, true)

    const publishWithOrig = await api(`/api/jobs/${created.body.job.id}/public-share`, {
      method: 'POST',
      token,
      json: { enabled: true, showOriginals: true }
    })
    assert.equal(publishWithOrig.body.job.publicShareShowOriginals, true)
    const showcaseOrig = await api(`/api/showcase/jobs/${created.body.job.id}`)
    assert.ok(showcaseOrig.body.job.originals.length >= 1)

    // Other user can open via private GET? no — but showcase works
    const otherUser = await api('/api/auth/wechat', { method: 'POST', json: { code: 'public-view-user' } })
    const otherPrivate = await api(`/api/jobs/${created.body.job.id}`, { token: otherUser.body.token })
    assert.equal(otherPrivate.response.status, 404)

    // Admin one-shot: job as banner with cover from result
    const asBanner = await api(`/api/admin/jobs/${created.body.job.id}/banner`, {
      method: 'POST',
      token: adminToken,
      json: { title: '作品 Banner', enabled: true }
    })
    assert.equal(asBanner.response.status, 201)
    assert.ok(asBanner.body.banner.imageUrl)
    assert.match(asBanner.body.banner.targetPath, /showcase=1/)

    // Admin users expose full openid
    const usersAdmin = await api('/api/admin/users?page=1&pageSize=10', { token: adminToken })
    assert.equal(usersAdmin.response.status, 200)
    assert.ok(usersAdmin.body.users.some(u => u.openid && u.openid.length > 8))

    // After multi redeem +15 +3, credits were 62 then +3 = 65 before recharge
    // Fix: multiRedeem1 adds 3 to main user token
    // inviter credits after first redeem 62, after multi 65

    const beforeRecharge = await api('/api/me', { token })
    // 62 after first cdk + 3 multi-use = 65
    assert.equal(beforeRecharge.body.user.credits, 65)

    const recharge = await api('/api/payments/orders', {
      method: 'POST', token, json: { packageId: 'popular' }
    })
    assert.equal(recharge.response.status, 201)
    assert.equal(recharge.body.payment.mode, 'mock')
    assert.equal(recharge.body.order.credits, 90)
    assert.equal(recharge.body.user.credits, 155)

    const wallet = await api('/api/wallet', { token })
    assert.equal(wallet.body.checkin.claimedToday, true)
    assert.equal(wallet.body.packages.find(item => item.id === 'popular').totalCredits, 90)
    // Newest first: recharge 90, multi cdk 3, cdk 15, invite first job 10, invite login 5, share friend 2, checkin 7, admin 5, job -2, welcome 20
    assert.deepEqual(wallet.body.transactions.map(item => item.amount), [90, 3, 15, 10, 5, 2, 7, 5, -2, 20])
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
