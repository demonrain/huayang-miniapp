import pg from 'pg'
import { JsonStore } from './store.mjs'

const { Pool } = pg

/**
 * Postgres-backed store with the same API as JsonStore.
 * Persists the whole app state as JSONB (fast migration path).
 * Also owns job_queue for durable workers.
 */
export class PostgresStore {
  constructor(databaseUrl) {
    this.pool = new Pool({ connectionString: databaseUrl })
    this.state = null
    this.queue = Promise.resolve()
    this._inner = new JsonStore(':memory:')
  }

  async init() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_state (
        id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS job_queue (
        id BIGSERIAL PRIMARY KEY,
        job_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'queued',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        attempts INT NOT NULL DEFAULT 0,
        available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        locked_at TIMESTAMPTZ,
        locked_by TEXT,
        last_error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS job_queue_claim_idx ON job_queue (status, available_at);
    `)
    const existing = await this.pool.query('SELECT data FROM app_state WHERE id = 1')
    if (existing.rows[0]?.data) {
      this.state = existing.rows[0].data
    } else {
      await this._inner.init()
      this.state = this._inner.read()
      await this.flush(this.state)
    }
    // Ensure new collection keys exist after upgrades
    for (const key of ['jobResultFeedbacks', 'templateFavorites', 'templateRecents', 'userLevels', 'campaigns']) {
      if (!Array.isArray(this.state[key])) this.state[key] = []
    }
  }

  read(selector = state => state) {
    return structuredClone(selector(this.state))
  }

  transaction(mutator) {
    const work = this.queue.then(async () => {
      const client = await this.pool.connect()
      try {
        await client.query('BEGIN')
        await client.query('SELECT pg_advisory_xact_lock(8723641)')
        const draft = structuredClone(this.state)
        const result = await mutator(draft)
        await client.query(
          `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1::jsonb, NOW())
           ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [JSON.stringify(draft)]
        )
        await client.query('COMMIT')
        this.state = draft
        return structuredClone(result)
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    })
    this.queue = work.catch(() => {})
    return work
  }

  async flush(state) {
    await this.pool.query(
      `INSERT INTO app_state (id, data, updated_at) VALUES (1, $1::jsonb, NOW())
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
      [JSON.stringify(state)]
    )
  }

  async enqueueJob(jobId, payload = {}) {
    await this.pool.query(
      `INSERT INTO job_queue (job_id, status, payload, available_at, updated_at)
       VALUES ($1, 'queued', $2::jsonb, NOW(), NOW())
       ON CONFLICT (job_id) DO UPDATE SET
         status = 'queued',
         payload = EXCLUDED.payload,
         available_at = NOW(),
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()`,
      [jobId, JSON.stringify(payload)]
    )
  }

  async claimJobs(workerId, limit = 5) {
    const result = await this.pool.query(
      `WITH cte AS (
         SELECT id FROM job_queue
         WHERE status = 'queued' AND available_at <= NOW()
         ORDER BY id
         FOR UPDATE SKIP LOCKED
         LIMIT $1
       )
       UPDATE job_queue q SET
         status = 'processing',
         locked_at = NOW(),
         locked_by = $2,
         attempts = q.attempts + 1,
         updated_at = NOW()
       FROM cte WHERE q.id = cte.id
       RETURNING q.job_id, q.payload, q.attempts`,
      [limit, workerId]
    )
    return result.rows
  }

  async completeJob(jobId) {
    await this.pool.query(
      `UPDATE job_queue SET status = 'done', updated_at = NOW(), locked_at = NULL, locked_by = NULL WHERE job_id = $1`,
      [jobId]
    )
  }

  async failJob(jobId, errorMessage, { retryDelayMs = 15000, maxAttempts = 8 } = {}) {
    await this.pool.query(
      `UPDATE job_queue SET
         status = CASE WHEN attempts >= $3 THEN 'dead' ELSE 'queued' END,
         last_error = $2,
         available_at = NOW() + ($4 || ' milliseconds')::interval,
         locked_at = NULL,
         locked_by = NULL,
         updated_at = NOW()
       WHERE job_id = $1`,
      [jobId, String(errorMessage || '').slice(0, 500), maxAttempts, String(retryDelayMs)]
    )
  }

  async close() {
    await this.pool.end()
  }
}

export async function createStore(config) {
  if (config.storageDriver === 'postgres') {
    if (!config.databaseUrl) throw new Error('DATABASE_URL is required when STORAGE_DRIVER=postgres')
    const store = new PostgresStore(config.databaseUrl)
    await store.init()
    return store
  }
  const { JsonStore } = await import('./store.mjs')
  const store = new JsonStore(config.dataDir)
  await store.init()
  return store
}
