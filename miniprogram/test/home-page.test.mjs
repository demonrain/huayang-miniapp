import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadHomePage() {
  const source = await readFile(new URL('../pages/home/index.js', import.meta.url), 'utf8')
  let definition
  const storage = new Map()
  const navigation = []
  const wx = {
    getStorageSync: key => storage.get(key) || '',
    setStorageSync: (key, value) => storage.set(key, value),
    navigateTo: options => navigation.push(options.url),
    showToast: () => {}
  }
  const context = vm.createContext({
    console,
    setInterval,
    clearInterval,
    wx,
    getApp: () => ({ isLoggedIn: () => false }),
    require: id => {
      if (id === '../../utils/api') return { get: async () => ({ announcements: [] }) }
      if (id === '../../utils/nav') return { getNavMetrics: () => ({ navSpacer: 176 }) }
      throw new Error(`Unexpected require: ${id}`)
    },
    Page: value => { definition = value }
  })
  new vm.Script(source, { filename: 'pages/home/index.js' }).runInContext(context)
  return { definition, storage, navigation }
}

function pageInstance(definition, data = {}) {
  return {
    ...definition,
    data: { ...definition.data, ...data },
    setData(update, callback) {
      Object.assign(this.data, update)
      if (callback) callback()
    }
  }
}

test('skipping the guest tour immediately opens the announcement flow', async () => {
  const { definition, storage } = await loadHomePage()
  const page = pageInstance(definition, { showOnboarding: true })
  let calls = 0
  page.maybeShowAnnouncement = () => { calls += 1 }

  page.skipOnboarding()

  assert.equal(storage.get('huayang_onboarding_done'), '1')
  assert.equal(page.data.showOnboarding, false)
  assert.equal(calls, 1)
})

test('guest tour enters the real template flow in demo mode', async () => {
  const { definition, navigation } = await loadHomePage()
  const page = pageInstance(definition, {
    templates: [
      { id: 'regular', tags: [] },
      { id: 'popular-template', tags: ['热门'] }
    ]
  })

  page.finishOnboarding()

  assert.equal(navigation[0], '/pages/template/index?id=popular-template&demo=1&tour=1')
})

test('active popup announcements remain available for automatic display', async () => {
  const { definition } = await loadHomePage()
  const item = { id: 'announcement-1', title: '测试公告', content: '公告内容', displayMode: 'popup' }
  const page = pageInstance(definition, {
    announcements: [item],
    latestAnnouncement: item,
    showOnboarding: false,
    showAnnouncement: false
  })

  await page.maybeShowAnnouncement()

  assert.equal(page.data.showAnnouncement, true)
  assert.deepEqual(page.data.announcement, item)
})

test('silent announcements do not auto popup', async () => {
  const { definition } = await loadHomePage()
  const item = { id: 'announcement-2', title: '静默公告', content: '仅条幅', displayMode: 'silent' }
  const page = pageInstance(definition, {
    announcements: [item],
    latestAnnouncement: item,
    showOnboarding: false,
    showAnnouncement: false
  })

  await page.maybeShowAnnouncement()

  assert.equal(page.data.showAnnouncement, false)
})
