import { describe, expect, it } from 'vitest'

import app from '../src/index'
import type { Env } from '../src/env'

const env = { ENVIRONMENT: 'local', KOLLIDE_DOMAIN: 'example.invalid', SUPABASE_URL: 'http://x' } as Env

describe('GET /health', () => {
  it('responds ok with the environment name', async () => {
    const res = await app.request('/health', {}, env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, env: 'local' })
  })
})
