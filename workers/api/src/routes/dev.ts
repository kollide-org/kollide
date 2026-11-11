import { Hono } from 'hono'

import type { AppEnv } from '../lib/http'

/**
 * Local development only (ENVIRONMENT=local). There is no real R2 on a laptop, so uploads and image
 * reads go to this Worker's simulated buckets. Every route is a 404 in staging and production.
 */
export const dev = new Hono<AppEnv>()

const KEY = /^(profiles|events|hubs|selfies)\/[0-9a-f-]{36}\.webp$/

dev.use('*', async (c, next) => {
  if (c.env.ENVIRONMENT !== 'local') return c.notFound()
  await next()
})

dev.put('/upload/:bucket/*', async (c) => {
  const bucket = c.req.param('bucket') === 'private' ? c.env.PRIVATE : c.req.param('bucket') === 'media' ? c.env.MEDIA : null
  const key = c.req.path.split('/').slice(4).join('/')
  if (!bucket || !KEY.test(key)) return c.json({ error: 'invalid_key' }, 400)
  const body = await c.req.arrayBuffer()
  if (body.byteLength > 512_000) return c.json({ error: 'too_large' }, 400)
  await bucket.put(key, body, { httpMetadata: { contentType: c.req.header('content-type') ?? 'application/octet-stream' } })
  return c.body(null, 200)
})

dev.get('/private/*', async (c) => {
  const object = await c.env.PRIVATE.get(c.req.path.replace('/dev/private/', ''))
  if (!object) return c.notFound()
  return new Response(object.body, { headers: { 'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream' } })
})

/** Stands in for img.<domain> locally. */
export const media = new Hono<AppEnv>()
media.get('/*', async (c) => {
  if (c.env.ENVIRONMENT !== 'local') return c.notFound()
  const object = await c.env.MEDIA.get(c.req.path.replace(/^\/media\//, ''))
  if (!object) return c.notFound()
  return new Response(object.body, {
    headers: { 'content-type': object.httpMetadata?.contentType ?? 'application/octet-stream', 'cache-control': 'no-store' },
  })
})
