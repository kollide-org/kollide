import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { admin } from './routes/admin'
import { dev, media } from './routes/dev'
import { jobs } from './routes/jobs'
import { uploads } from './routes/uploads'
import type { AppEnv } from './lib/http'

const app = new Hono<AppEnv>()

// Browsers on our own sites may call the API. Anyone else gets no CORS headers.
app.use(
  '*',
  cors({
    origin: (origin, c) =>
      (c.env.ALLOWED_ORIGINS ?? '').split(',').map((o: string) => o.trim()).includes(origin) ? origin : '',
    allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowHeaders: ['authorization', 'content-type', 'x-job-secret'],
    maxAge: 600,
  }),
)

app.get('/health', (c) => c.json({ ok: true, env: c.env.ENVIRONMENT }))
app.route('/uploads', uploads)
app.route('/admin', admin)
app.route('/jobs', jobs)
app.route('/dev', dev)
app.route('/media', media)

export default app
