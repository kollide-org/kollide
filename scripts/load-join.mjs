// Load sanity: 50 people ask for a seat on ONE event at the same moment. The event has 10 seats, instant approval, no overbooking.
// Passes only if exactly 10 are approved, the other 40 are waitlisted, nobody is booked twice and nothing errors.
//
//   Local (needs `npm run db:start`):   node scripts/load-join.mjs
//   Staging (a STAGING project only):   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/load-join.mjs --yes-this-is-staging
//
// It creates 50 throwaway users (@load.test), one host and one event, then deletes all of it. It uses the service key only to set up
// and clean up; the 50 join calls are made with each person's own sign-in, exactly like the app. Never run it against production.
import { execSync } from 'node:child_process'

const PEOPLE = 50
const SEATS = 10

function localKeys() {
  const out = execSync('npx supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  const read = (name) => out.match(new RegExp(`^${name}="?([^"\\n]+)"?$`, 'm'))?.[1]
  return { url: read('API_URL') ?? 'http://127.0.0.1:54321', anon: read('PUBLISHABLE_KEY') ?? read('ANON_KEY'), service: read('SERVICE_ROLE_KEY') }
}

const remote = Boolean(process.env.SUPABASE_URL)
const keys = remote
  ? { url: process.env.SUPABASE_URL.replace(/\/$/, ''), anon: process.env.SUPABASE_ANON_KEY, service: process.env.SUPABASE_SERVICE_ROLE_KEY }
  : localKeys()
if (!keys.anon || !keys.service) throw new Error('Missing keys: set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY (or start the local stack).')
if (remote && !process.argv.includes('--yes-this-is-staging')) throw new Error('Refusing to run against a remote project without --yes-this-is-staging. Never use production.')

const service = { apikey: keys.service, authorization: `Bearer ${keys.service}`, 'content-type': 'application/json', prefer: 'return=representation' }

async function api(path, { method = 'GET', headers = service, body } = {}) {
  const res = await fetch(`${keys.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

const stamp = Date.now()
const users = []
let hostId = null
let eventId = null

async function createUser(email, firstName) {
  const created = await api('/auth/v1/admin/users', { method: 'POST', body: { email, email_confirm: true } })
  await api(`/rest/v1/profile_private?id=eq.${created.id}`, { method: 'PATCH', body: { date_of_birth: '1990-01-01', gender: 'man' } })
  await api(`/rest/v1/profiles?id=eq.${created.id}`, { method: 'PATCH', body: { first_name: firstName, onboarding_completed_at: new Date().toISOString() } })
  return created.id
}

// A session without email: an admin-made one-time code, exchanged for a normal access token.
// One person at a time, and a pause when Supabase Auth says "too many requests" (staging has verification limits per IP).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function signIn(email) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const link = await api('/auth/v1/admin/generate_link', { method: 'POST', body: { type: 'magiclink', email } })
    const code = link.email_otp ?? link.properties?.email_otp
    const res = await fetch(`${keys.url}/auth/v1/verify`, {
      method: 'POST', headers: { apikey: keys.anon, 'content-type': 'application/json' }, body: JSON.stringify({ type: 'email', email, token: code }),
    })
    if (res.ok) return (await res.json()).access_token
    if (res.status === 429 && attempt < 6) {
      const wait = Math.min(Number(res.headers.get('retry-after')) || 15 * attempt, 90)
      console.log(`[load] Auth rate limit (429) while signing in; waiting ${wait} s (attempt ${attempt}/6). If this keeps happening, raise the verification limit on STAGING (docs/backend/RATE_LIMITS.md) for the test and put it back.`)
      await sleep(wait * 1000)
      continue
    }
    throw new Error(`sign-in failed for ${email}: ${res.status} ${(await res.text()).slice(0, 200)}${res.status === 429 ? ' (rate limited: raise the Auth verification limit on staging for this test)' : ''}`)
  }
}

// Returns true only when nothing is left behind.
async function cleanup() {
  const problems = []
  const attempt = async (what, fn) => { try { await fn() } catch (error) { problems.push(`${what}: ${error.message.slice(0, 120)}`) } }
  if (eventId) {
    await attempt('bookings', () => api(`/rest/v1/bookings?event_id=eq.${eventId}`, { method: 'DELETE' }))
    await attempt('event', () => api(`/rest/v1/events?id=eq.${eventId}`, { method: 'DELETE' }))
  }
  for (const u of [...users, ...(hostId ? [{ id: hostId }] : [])]) {
    for (const table of ['notifications', 'email_outbox', 'analytics_outbox', 'rate_limits']) await attempt(table, () => api(`/rest/v1/${table}?user_id=eq.${u.id}`, { method: 'DELETE' }))
    await attempt('user', () => api(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' }))
  }
  // Count what is really left, instead of trusting that the deletes worked.
  let leftoverUsers = '?'
  let leftoverEvents = '?'
  try {
    const list = await api('/auth/v1/admin/users?per_page=1000')
    leftoverUsers = (list.users ?? []).filter((u) => u.email?.endsWith('@load.test') && u.email.includes(String(stamp))).length
    leftoverEvents = (await api(`/rest/v1/events?title=eq.${encodeURIComponent(`Load test ${stamp}`)}&select=id`)).length
  } catch (error) {
    problems.push(`could not count leftovers: ${error.message.slice(0, 120)}`)
  }
  if (problems.length > 0 || leftoverUsers !== 0 || leftoverEvents !== 0) {
    console.error(`[load] CLEAN-UP INCOMPLETE: ${leftoverUsers} @load.test users and ${leftoverEvents} events left (stamp ${stamp}). Delete users whose email ends in @load.test by hand.`)
    for (const p of problems.slice(0, 5)) console.error(`[load]   ${p}`)
    return false
  }
  console.log('[load] cleaned up: 0 test users and 0 test events left')
  return true
}

let exitCode = 0
try {
  console.log(`[load] setting up ${PEOPLE} people and an event with ${SEATS} seats on ${keys.url}`)
  hostId = await createUser(`load-host-${stamp}@load.test`, 'Loadhost')
  for (let i = 0; i < PEOPLE; i++) {
    const email = `load-${stamp}-${i}@load.test`
    users.push({ email, id: await createUser(email, `Load${i}`) })
  }
  const [event] = await api('/rest/v1/events', {
    method: 'POST',
    body: {
      host_id: hostId, type: 'community', title: `Load test ${stamp}`, area_id: 1, category_id: 1, capacity: SEATS, overbook_pct: 0, approval_mode: 'instant',
      status: 'published', published_at: new Date().toISOString(), starts_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      ends_at: new Date(Date.now() + 5 * 86_400_000 + 7_200_000).toISOString(), pricing_mode: 'free',
    },
  })
  eventId = event.id
  for (const u of users) u.token = await signIn(u.email) // sequential on purpose: only the join calls are concurrent
  console.log('[load] everyone is signed in; firing all join requests at once')

  const started = Date.now()
  const results = await Promise.all(
    users.map(async (u) => {
      const t0 = Date.now()
      const res = await fetch(`${keys.url}/rest/v1/rpc/request_to_join`, {
        method: 'POST', headers: { apikey: keys.anon, authorization: `Bearer ${u.token}`, 'content-type': 'application/json' }, body: JSON.stringify({ p_event: eventId }),
      })
      const body = await res.json().catch(() => ({}))
      return { ms: Date.now() - t0, ok: res.ok, status: res.ok ? body.status : body.message ?? res.status }
    }),
  )
  const wall = Date.now() - started

  const bookings = await api(`/rest/v1/bookings?event_id=eq.${eventId}&select=user_id,status`)
  const count = (s) => bookings.filter((b) => b.status === s).length
  const approved = count('approved')
  const waitlisted = count('waitlisted')
  const duplicates = bookings.length - new Set(bookings.map((b) => b.user_id)).size
  const errors = results.filter((r) => !r.ok)
  const times = results.map((r) => r.ms).sort((a, b) => a - b)
  console.log(`[load] ${wall} ms for all ${PEOPLE} calls (median ${times[Math.floor(times.length / 2)]} ms, slowest ${times.at(-1)} ms)`)
  console.log(`[load] answers: ${JSON.stringify(results.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] ?? 0) + 1 }), {}))}`)
  console.log(`[load] in the database: ${approved} approved, ${waitlisted} waitlisted, ${bookings.length} bookings, ${duplicates} duplicates, ${errors.length} errors`)

  const failures = []
  if (approved > SEATS) failures.push(`OVERBOOKED: ${approved} approved for ${SEATS} seats`)
  if (approved !== SEATS) failures.push(`expected exactly ${SEATS} approved, got ${approved}`)
  if (waitlisted !== PEOPLE - SEATS) failures.push(`expected ${PEOPLE - SEATS} waitlisted, got ${waitlisted}`)
  if (bookings.length !== PEOPLE) failures.push(`expected ${PEOPLE} bookings, got ${bookings.length}`)
  if (duplicates > 0) failures.push(`${duplicates} people booked twice`)
  if (errors.length > 0) failures.push(`${errors.length} calls failed: ${JSON.stringify(errors.slice(0, 3))}`)
  if (failures.length > 0) {
    console.error(`[load] FAILED:\n  ${failures.join('\n  ')}`)
    exitCode = 1
  } else {
    console.log(`[load] OK: ${SEATS} seats, ${PEOPLE} simultaneous requests, exactly ${SEATS} approved, no overbooking.`)
  }
} catch (error) {
  console.error('[load] error:', error.message)
  exitCode = 1
} finally {
  if (!(await cleanup())) exitCode = 1
}
process.exit(exitCode)
