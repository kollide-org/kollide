import { expect, test, type BrowserContext, type Page } from '@playwright/test'

import { finishOnboarding, serviceSelect, servicePatch, signInWithCode, uniqueEmail, userIdFor } from './helpers.ts'

test.setTimeout(240_000)
test.describe.configure({ retries: 0 })

// Every host that must stay silent until the visitor agrees. The dev server is built with dummy ids for all of them.
const WATCHED = /(posthog\.com|connect\.facebook\.net|facebook\.com\/tr|googletagmanager\.com|google-analytics\.com)/

/** A fresh visitor (no cookie yet) whose requests to the watched hosts are recorded and answered with empty stubs. */
async function visitor(browser: import('@playwright/test').Browser) {
  // (the config gives every context a rejected-cookies cookie by default: this one starts with none)
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const hits: string[] = []
  await context.route(WATCHED, (route) => {
    hits.push(route.request().url())
    return route.request().resourceType() === 'script'
      ? route.fulfill({ status: 200, contentType: 'application/javascript', body: '' })
      : route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  const page = await context.newPage()
  return { context, page, hits }
}

const consentCookie = async (context: BrowserContext) => {
  const cookie = (await context.cookies()).find((c) => c.name === 'kollide_consent')
  return cookie ? (JSON.parse(decodeURIComponent(cookie.value)) as { v: string; a: string; preferences: boolean; analytics: boolean; marketing: boolean }) : null
}

async function setCategories(page: Page, wanted: { preferences?: boolean; analytics?: boolean; marketing?: boolean }) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Cookie settings' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cookie settings' })
  for (const [name, label] of [['preferences', 'Preferences'], ['analytics', 'Analytics'], ['marketing', 'Marketing']] as const) {
    if (wanted[name] === undefined) continue
    const toggle = dialog.getByRole('switch', { name: label })
    if ((await toggle.getAttribute('aria-checked')) !== String(wanted[name])) await toggle.click()
  }
  await dialog.getByRole('button', { name: 'Save choices' }).click()
  await expect(dialog).toBeHidden()
}

const quiet = async (page: Page) => {
  await page.goto('/privacy')
  await page.goto('/sign-in')
  await page.goto('/')
  await page.waitForTimeout(1500)
}

test('nothing optional loads or is sent before consent, after rejecting, or after withdrawing', async ({ browser }) => {
  const { context, page, hits } = await visitor(browser)

  // ---------- before any choice: the banner, and silence
  await page.goto('/')
  await expect(page.getByTestId('consent-banner')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Accept all' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reject all' })).toBeVisible() // as prominent as Accept all
  await quiet(page)
  expect(hits, 'no request to PostHog, Meta or Google before a choice').toEqual([])
  expect(await consentCookie(context)).toBeNull()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ph_')))).toEqual([])

  // ---------- Reject all: still silent, the choice is remembered and recorded
  await page.goto('/')
  await page.getByRole('button', { name: 'Reject all' }).click()
  await expect(page.getByTestId('consent-banner')).toBeHidden()
  const rejected = await consentCookie(context)
  expect(rejected).toMatchObject({ v: 'v1', preferences: false, analytics: false, marketing: false })
  await quiet(page)
  expect(hits, 'nothing after Reject all').toEqual([])
  await page.reload()
  await expect(page.getByTestId('consent-banner')).toBeHidden() // remembered
  await expect
    .poll(async () => (await serviceSelect('consents', `anonymous_id=eq.${rejected!.a}&select=purpose,granted`)).length)
    .toBe(3)
  const rows = await serviceSelect('consents', `anonymous_id=eq.${rejected!.a}&select=purpose,granted`)
  expect(rows.every((r) => r.granted === false)).toBe(true)

  // the theme is not written to the browser without Preferences
  await page.getByRole('button', { name: 'Switch to dark mode' }).first().click()
  expect(await page.evaluate(() => localStorage.getItem('kollide:theme'))).toBeNull()
  await expect(page.locator('html')).toHaveClass(/dark/) // but it still works for this visit
  await page.getByRole('button', { name: 'Switch to light mode' }).first().click()

  // ---------- allow Analytics: PostHog starts
  await setCategories(page, { analytics: true })
  await expect.poll(() => hits.filter((h) => /posthog\.com/.test(h)).length).toBeGreaterThan(0)
  expect(hits.some((h) => /facebook|googletagmanager/.test(h)), 'but no advertising pixel').toBe(false)

  // ---------- withdraw Analytics: it stops at once
  await setCategories(page, { analytics: false })
  await page.waitForTimeout(1500)
  const afterWithdraw = hits.length
  await quiet(page)
  expect(hits.length, 'no PostHog request after withdrawing').toBe(afterWithdraw)
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ph_')))).toEqual([])

  // ---------- allow Marketing: the pixels load; withdraw: they are gone
  await setCategories(page, { marketing: true })
  await expect.poll(() => hits.filter((h) => /connect\.facebook\.net/.test(h)).length).toBeGreaterThan(0)
  await expect.poll(() => hits.filter((h) => /googletagmanager\.com/.test(h)).length).toBeGreaterThan(0)
  await setCategories(page, { marketing: false }) // reloads the page without the pixels
  await page.waitForTimeout(1500)
  const afterMarketing = hits.length
  await quiet(page)
  expect(hits.length, 'no pixel request after withdrawing').toBe(afterMarketing)

  // ---------- a new notice version asks again
  try {
    await servicePatch('app_config', 'key=eq.notice_version', { value: 'v2' })
    await page.goto('/')
    await expect(page.getByTestId('consent-banner')).toBeVisible()
  } finally {
    await servicePatch('app_config', 'key=eq.notice_version', { value: 'v1' })
  }
  await context.close()
})

test('a choice made before signing in is linked to the account; a rejecting user produces no analytics events', async ({ browser }) => {
  // ---------- accepts first, then signs up
  const yes = await visitor(browser)
  await yes.page.goto('/')
  await yes.page.getByRole('button', { name: 'Accept all' }).click()
  const accepted = (await consentCookie(yes.context))!
  expect(accepted).toMatchObject({ preferences: true, analytics: true, marketing: true })
  await yes.page.getByRole('button', { name: 'Switch to dark mode' }).first().click()
  expect(await yes.page.evaluate(() => localStorage.getItem('kollide:theme'))).toBe('dark') // Preferences allowed: saved
  await yes.page.getByRole('button', { name: 'Switch to light mode' }).first().click()

  const email = uniqueEmail('consent-yes')
  await signInWithCode(yes.page, email)
  await finishOnboarding(yes.page, 'Consenta')
  await expect(yes.page).toHaveURL(/\/app$/)
  const userId = await userIdFor(email)
  await expect.poll(async () => (await serviceSelect('consents', `user_id=eq.${userId}&purpose=in.(preferences,analytics,marketing)&select=anonymous_id,granted`)).length).toBe(3)
  const linked = await serviceSelect('consents', `user_id=eq.${userId}&purpose=in.(preferences,analytics,marketing)&select=anonymous_id,granted`)
  expect(linked.every((r) => r.anonymous_id === accepted.a && r.granted === true)).toBe(true) // the link
  await expect
    .poll(async () => (await serviceSelect('analytics_outbox', `user_id=eq.${userId}&select=event`)).map((r) => r.event).sort())
    .toEqual(['profile_completed', 'signed_up'])
  const queued = await serviceSelect('analytics_outbox', `user_id=eq.${userId}&select=properties`)
  expect(JSON.stringify(queued)).not.toMatch(/@|Consenta/) // never an email or a name
  await yes.context.close()

  // ---------- rejects first, then signs up: nothing is queued
  const no = await visitor(browser)
  await no.page.goto('/')
  await no.page.getByRole('button', { name: 'Reject all' }).click()
  const email2 = uniqueEmail('consent-no')
  await signInWithCode(no.page, email2)
  await finishOnboarding(no.page, 'Rejecta')
  await expect(no.page).toHaveURL(/\/app$/)
  const userId2 = await userIdFor(email2)
  await no.page.waitForTimeout(1500)
  expect(await serviceSelect('analytics_outbox', `user_id=eq.${userId2}&select=event`)).toEqual([])
  expect(no.hits, 'and nothing sent to PostHog or the pixels').toEqual([])
  await no.context.close()
})
