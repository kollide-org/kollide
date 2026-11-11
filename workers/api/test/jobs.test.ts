import { afterEach, describe, expect, it, vi } from 'vitest'

import app from '../src/index'
import { mockBackend, resetBackend, testEnv } from './helpers'

afterEach(resetBackend)

const HOUR = 3600_000
const old = new Date(Date.now() - 30 * HOUR)
const fresh = new Date(Date.now() - 1 * HOUR)

/** A fake R2 bucket whose objects have chosen upload times (the simulator always uses "now"). */
function fakeBucket(objects: { key: string; uploaded: Date }[]) {
  const deleted: string[] = []
  return {
    deleted,
    bucket: {
      list: async () => ({ objects, truncated: false }),
      delete: async (keys: string | string[]) => void deleted.push(...(Array.isArray(keys) ? keys : [keys])),
    } as unknown as R2Bucket,
  }
}

function run(secret: string | null, env = testEnv()) {
  return app.request('/jobs/r2-cleanup', { method: 'POST', headers: secret === null ? {} : { 'x-job-secret': secret } }, env)
}

describe('POST /jobs/r2-cleanup', () => {
  it('refuses a missing or wrong secret', async () => {
    const { rpcCalls } = mockBackend({})
    expect((await run(null)).status).toBe(401)
    expect((await run('wrong')).status).toBe(401)
    expect(rpcCalls).toHaveLength(0)
  })

  it('refuses everything when the Worker has no secret configured', async () => {
    mockBackend({})
    expect((await run('', testEnv({ JOB_SHARED_SECRET: '' }))).status).toBe(401)
  })

  it('deletes queued objects, and old unreferenced objects, but keeps fresh and referenced ones', async () => {
    const media = fakeBucket([
      { key: 'profiles/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.webp', uploaded: old }, // old, in use
      { key: 'profiles/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp', uploaded: old }, // old, orphan
      { key: 'profiles/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp', uploaded: fresh }, // fresh orphan: keep
      { key: 'other/readme.txt', uploaded: old }, // not ours: never touched
    ])
    const priv = fakeBucket([{ key: 'selfies/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp', uploaded: old }]) // old orphan
    const offered: string[] = []
    const { rpcCalls } = mockBackend({
      rpc: {
        claim_deletions: () => [{ id: 7, bucket: 'private', key: 'selfies/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.webp' }],
        mark_deletions_done: () => undefined,
        unreferenced_keys: (args) => {
          const keys = args.p_keys as string[]
          offered.push(...keys)
          return keys.filter((k) => !k.startsWith('profiles/aaaaaaaa'))
        },
        purge_old_upload_keys: () => 4,
      },
    })

    const res = await run('job-secret', testEnv({ MEDIA: media.bucket, PRIVATE: priv.bucket }))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ deletedQueued: 1, deletedOrphans: { media: 1, private: 1 }, purged: 4 })

    expect(media.deleted).toEqual(['profiles/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.webp'])
    expect(priv.deleted).toEqual([
      'selfies/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.webp', // the queued, reviewed selfie
      'selfies/dddddddd-dddd-4ddd-8ddd-dddddddddddd.webp', // the orphan
    ])
    // Fresh files and files outside our prefixes are never even offered for deletion.
    expect(offered).not.toContain('profiles/cccccccc-cccc-4ccc-8ccc-cccccccccccc.webp')
    expect(offered).not.toContain('other/readme.txt')
    expect(rpcCalls.find((c) => c.name === 'mark_deletions_done')?.args).toEqual({ p_ids: [7] })
  })

  it('does nothing harmful when there is nothing to do', async () => {
    const media = fakeBucket([])
    const priv = fakeBucket([])
    const spy = vi.fn()
    mockBackend({
      rpc: { claim_deletions: () => [], unreferenced_keys: spy, purge_old_upload_keys: () => 0 },
    })
    const res = await run('job-secret', testEnv({ MEDIA: media.bucket, PRIVATE: priv.bucket }))
    expect(res.status).toBe(200)
    expect(spy).not.toHaveBeenCalled()
  })
})
