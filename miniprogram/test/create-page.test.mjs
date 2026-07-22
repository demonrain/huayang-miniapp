import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'

async function loadCreatePage() {
  const source = await readFile(new URL('../pages/create/index.js', import.meta.url), 'utf8')
  let definition
  let loginCalls = 0
  const template = {
    id: 'film-diary',
    name: '花影胶片',
    shortName: '胶片',
    description: '示例模板',
    palette: '#fff0f3',
    cost: 2
  }
  const app = {
    ensureSession: async () => null,
    isLoggedIn: () => false,
    requireLogin: async () => { loginCalls += 1 }
  }
  const context = vm.createContext({
    console,
    wx: { showModal: () => {}, navigateBack: () => {}, switchTab: () => {} },
    getApp: () => app,
    require: id => {
      if (id === '../../utils/api') {
        return {
          get: async path => path === '/api/templates' ? { templates: [template] } : {}
        }
      }
      if (id === '../../utils/nav') return { getNavMetrics: () => ({ navSpacer: 176 }) }
      if (id === '../../utils/demo') {
        return {
          isDemoQuery: query => query.demo === '1',
          buildDemoJob: () => ({}),
          saveDemoJob: () => {},
          delay: async () => {}
        }
      }
      throw new Error(`Unexpected require: ${id}`)
    },
    Page: value => { definition = value }
  })
  new vm.Script(source, { filename: 'pages/create/index.js' }).runInContext(context)
  return { definition, getLoginCalls: () => loginCalls }
}

test('demo creation works as a guest and starts with a local sample photo', async () => {
  const { definition, getLoginCalls } = await loadCreatePage()
  const page = {
    ...definition,
    data: { ...definition.data },
    setData(update) { Object.assign(this.data, update) }
  }

  await page.onLoad({ templateId: 'film-diary', demo: '1' })

  assert.equal(getLoginCalls(), 0)
  assert.equal(page.data.demo, true)
  assert.equal(page.data.files.length, 1)
  assert.equal(page.data.files[0].path, '/assets/demo/demo-photo.jpg')
  assert.equal(page.data.totalCost, 2)
})
