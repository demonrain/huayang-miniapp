import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

const initialState = {
  version: 5,
  users: [],
  transactions: [],
  assets: [],
  jobs: [],
  orders: [],
  templates: [],
  templateCategories: [],
  banners: [],
  packages: [],
  shares: [],
  shareEvents: [],
  invites: [],
  settings: null
}

export class JsonStore {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.filename = path.join(dataDir, 'db.json')
    this.state = structuredClone(initialState)
    this.queue = Promise.resolve()
  }

  async init() {
    await mkdir(this.dataDir, { recursive: true })
    try {
      const saved = JSON.parse(await readFile(this.filename, 'utf8'))
      this.state = { ...structuredClone(initialState), ...saved, version: initialState.version }
      for (const key of ['users', 'transactions', 'assets', 'jobs', 'orders', 'templates', 'templateCategories', 'banners', 'packages', 'shares', 'shareEvents', 'invites']) {
        if (!Array.isArray(this.state[key])) this.state[key] = []
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error
      await this.flush(this.state)
    }
  }

  read(selector = state => state) {
    return structuredClone(selector(this.state))
  }

  transaction(mutator) {
    const work = this.queue.then(async () => {
      const draft = structuredClone(this.state)
      const result = await mutator(draft)
      await this.flush(draft)
      this.state = draft
      return structuredClone(result)
    })
    this.queue = work.catch(() => {})
    return work
  }

  async flush(state) {
    const temp = `${this.filename}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(state, null, 2), 'utf8')
    await rename(temp, this.filename)
  }
}
