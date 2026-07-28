import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from '../server/src/config.mjs'
import { PostgresStore } from '../server/src/pg-store.mjs'

const root = path.join(fileURLToPath(new URL('.', import.meta.url)), '..')
const jsonPath = path.join(root, 'server', 'data', 'db.json')

async function main() {
  if (!config.databaseUrl) {
    console.error('Set DATABASE_URL before migrating')
    process.exit(1)
  }
  const raw = await readFile(jsonPath, 'utf8')
  const data = JSON.parse(raw)
  const store = new PostgresStore(config.databaseUrl)
  await store.init()
  await store.flush(data)
  console.log(`Migrated ${jsonPath} → postgres app_state`)
  await store.close()
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
