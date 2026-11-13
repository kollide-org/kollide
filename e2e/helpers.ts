import { expect, type Browser, type Page } from '@playwright/test'

import { pictureFile } from './fixtures.ts'

const MAILPIT = 'http://127.0.0.1:54324'

/** The cookie banner's "Reject all" choice, already made. Specs that are not about cookies start like this so the banner never covers a button. */
export const REJECTED_COOKIES = [{
  name: 'kollide_consent',
  value: encodeURIComponent(JSON.stringify({ v: 'v1', a: '00000000-0000-4000-8000-0000000000e2', preferences: false, analytics: false, marketing: false, t: 1 })),
  domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' as const,
}]

/** A browser context that has already rejected optional cookies. */
export async function newContext(browser: Browser) {
  return browser.newContext({ storageState: { cookies: REJECTED_COOKIES, origins: [] } })
}

/** Reads the 6-digit code from the newest email sent to `email` in the local Mailpit inbox. */
export async function readCode(email: string): Promise<string> {
  let code: string | undefined
  await expect
    .poll(
      async () => {
        const search = await fetch(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)
        const { messages } = (await search.json()) as { messages: { ID: string }[] }
        if (!messages?.length) return null
        const message = (await (await fetch(`${MAILPIT}/api/v1/message/${messages[0].ID}`)).json()) as { Text: string }
        code = message.Text.match(/\b(\d{6})\b/)?.[1]
        return code ?? null
      },
      { message: `no sign-in code arrived for ${email}`, timeout: 15_000 },
    )
    .not.toBeNull()
  return code as string
}

export async function signInWithCode(page: Page, email: string) {
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await expect(page.getByText('We sent a 6-digit code')).toBeVisible()
  await page.getByLabel('6-digit code').fill(await readCode(email))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@kollide.test`
}

/** Fills all five onboarding steps with valid answers. */
export async function finishOnboarding(page: Page, firstName: string) {
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel('First name').fill(firstName)
  await page.getByLabel(/Date of birth/).fill('1995-05-05')
  await page.getByLabel('Gender').selectOption('woman')
  await page.getByLabel('Your area in Bengaluru').selectOption({ label: 'Indiranagar' })
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('button', { name: 'Board games' }).click()
  await page.getByRole('button', { name: 'Hiking' }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByLabel('Answer 1').fill('Filter coffee, then a long walk.')
  await page.getByLabel('Answer 2').fill('Chai and a second chai.')
  await page.getByRole('button', { name: 'Continue' }).click()

  for (const n of [1, 2, 3]) {
    await page.getByLabel(`Choose photo ${n}`).setInputFiles(pictureFile(`photo-${n}.png`, n * 60))
    await expect(page.getByRole('img', { name: `Photo ${n}` })).toBeVisible()
  }
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByLabel('I accept the code of conduct').click()
  await page.getByLabel('I accept the privacy notice').click()
  await page.getByRole('button', { name: 'Finish' }).click()
}

/** Gives a signed-up local user the admin role, using the local service key (tests only). */
export async function promoteToAdmin(email: string) {
  const url = process.env.E2E_SUPABASE_URL
  const key = process.env.E2E_SERVICE_KEY
  if (!url || !key) throw new Error('E2E_SUPABASE_URL and E2E_SERVICE_KEY are set by playwright.config.ts')
  const headers = { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json' }
  const lookup = await fetch(`${url}/rest/v1/profile_private?email=eq.${encodeURIComponent(email)}&select=id`, { headers })
  const [row] = (await lookup.json()) as { id: string }[]
  if (!row) throw new Error(`no profile for ${email}`)
  const res = await fetch(`${url}/rest/v1/user_roles`, { method: 'POST', headers, body: JSON.stringify({ user_id: row.id, role: 'admin' }) })
  if (!res.ok) throw new Error(`could not grant admin: ${res.status}`)
}

/** The id of a signed-up local user (tests only). */
export async function userIdFor(email: string): Promise<string> {
  const res = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/profile_private?email=eq.${encodeURIComponent(email)}&select=id`, { headers: serviceHeaders() })
  const [row] = (await res.json()) as { id: string }[]
  if (!row) throw new Error(`no profile for ${email}`)
  return row.id
}

/** A new signed-in, onboarded member in their own browser context. */
export async function newMember(browser: Browser, prefix: string, firstName: string): Promise<{ page: Page; email: string }> {
  const context = await newContext(browser)
  const page = await context.newPage()
  const email = uniqueEmail(prefix)
  await signInWithCode(page, email)
  await finishOnboarding(page, firstName)
  await expect(page).toHaveURL(/\/app$/)
  return { page, email }
}

/** "2026-12-01T18:00" in the browser's local time, `days` from now. */
export function localInput(days: number, hour: number): string {
  const date = new Date(Date.now() + days * 86_400_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:00`
}

const serviceHeaders = () => {
  const key = process.env.E2E_SERVICE_KEY as string
  return { apikey: key, authorization: `Bearer ${key}`, 'content-type': 'application/json', prefer: 'return=representation' }
}

/** Inserts a row with the local service key (tests only) and returns it. */
export async function serviceInsert(table: string, row: Record<string, unknown>): Promise<Record<string, any>> {
  const res = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: serviceHeaders(), body: JSON.stringify(row) })
  if (!res.ok) throw new Error(`insert into ${table} failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as Record<string, any>[])[0]!
}

/** Reads rows with the local service key (tests only). `query` is a PostgREST query string such as `user_id=eq.<uuid>&select=event`. */
export async function serviceSelect(table: string, query: string): Promise<Record<string, any>[]> {
  const res = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/${table}?${query}`, { headers: serviceHeaders() })
  if (!res.ok) throw new Error(`read of ${table} failed: ${res.status} ${await res.text()}`)
  return (await res.json()) as Record<string, any>[]
}

/** Updates rows with the local service key (tests only). `filter` is a PostgREST filter such as `id=eq.<uuid>`. */
export async function servicePatch(table: string, filter: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${process.env.E2E_SUPABASE_URL}/rest/v1/${table}?${filter}`, { method: 'PATCH', headers: serviceHeaders(), body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`update of ${table} failed: ${res.status} ${await res.text()}`)
}

export const DEV_HOST_ID = '00000000-0000-4000-8000-000000000002'
export const DEV_HOST_EMAIL = 'dev.host@kollide.test'

/** A published community event hosted by the seeded host Dev, with a secret address. */
export async function publishedEvent(opts: { title: string; capacity: number; approvalMode: 'instant' | 'host_approval'; address: string }): Promise<string> {
  const event = await serviceInsert('events', {
    host_id: DEV_HOST_ID, type: 'community', title: opts.title, area_id: 1, category_id: 1,
    starts_at: new Date(Date.now() + 10 * 86_400_000).toISOString(), ends_at: new Date(Date.now() + 10 * 86_400_000 + 7_200_000).toISOString(),
    capacity: opts.capacity, approval_mode: opts.approvalMode, status: 'published', published_at: new Date().toISOString(),
  })
  await serviceInsert('event_private', { event_id: event.id, address: opts.address })
  return event.id as string
}

const WORKER = 'http://localhost:8787'

/** Runs the email flush by hand (pg_cron has no Worker address locally) until the queue is empty (it sends 20 a run, critical first). */
export async function flushEmail(): Promise<{ sent: number }> {
  let sent = 0
  for (let round = 0; round < 15; round++) {
    const res = await fetch(`${WORKER}/jobs/flush-email`, { method: 'POST', headers: { 'x-job-secret': 'local-job-secret' } })
    if (!res.ok) throw new Error(`flush failed: ${res.status}`)
    const body = (await res.json()) as { sent?: number; claimed?: number }
    sent += body.sent ?? 0
    if (!body.claimed) break
  }
  return { sent }
}

export interface DevMail { to: string; subject: string; template: string; html: string; text: string }

/** The emails the local Worker "sent" to this address, newest first. */
export async function devMail(email: string): Promise<DevMail[]> {
  const res = await fetch(`${WORKER}/dev/mail?to=${encodeURIComponent(email)}`)
  return ((await res.json()) as { mails: DevMail[] }).mails
}
