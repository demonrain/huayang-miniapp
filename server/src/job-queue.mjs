import { randomUUID } from 'node:crypto'

/**
 * Durable-ish job runner.
 * - postgres store: uses job_queue table
 * - json store: in-process setTimeout with restart recovery from jobs status
 */
export function createJobRunner({ store, processJob }) {
  const workerId = `worker-${process.pid}-${randomUUID().slice(0, 8)}`
  let timer = null
  let stopped = false

  async function enqueue(jobId, payload = {}) {
    if (typeof store.enqueueJob === 'function') {
      await store.enqueueJob(jobId, payload)
      return
    }
    setTimeout(() => processJob(jobId, payload), 10)
  }

  async function tick() {
    if (stopped) return
    try {
      if (typeof store.claimJobs === 'function') {
        const claimed = await store.claimJobs(workerId, 3)
        for (const row of claimed) {
          try {
            await processJob(row.job_id, row.payload || {})
            await store.completeJob(row.job_id)
          } catch (error) {
            console.error(`[queue] job=${row.job_id}`, error)
            await store.failJob(row.job_id, error.message || error)
          }
        }
      }
    } catch (error) {
      console.error('[queue] tick failed', error)
    } finally {
      if (!stopped) timer = setTimeout(tick, 1500)
    }
  }

  function start() {
    stopped = false
    // Recover unfinished jobs from state for both drivers
    const pending = store.read(state =>
      (state.jobs || [])
        .filter(item => ['queued', 'processing'].includes(item.status))
        .map(item => item.id)
    )
    for (const id of pending) {
      enqueue(id).catch(error => console.error('[queue] requeue', id, error.message))
    }
    if (typeof store.claimJobs === 'function') tick()
  }

  function stop() {
    stopped = true
    if (timer) clearTimeout(timer)
  }

  return { enqueue, start, stop, workerId }
}
