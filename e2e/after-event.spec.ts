import { expect, test } from '@playwright/test'

import { newMember, promoteToAdmin, serviceInsert, userIdFor } from './helpers.ts'

test.setTimeout(240_000)
test.describe.configure({ retries: 0 })

test('check-in, count attendance, tags, reliability on the profile, a report puts someone on hold, an appeal', async ({ browser }) => {
  const stamp = Date.now()
  const title = `E2E after event ${stamp}`
  const host = await newMember(browser, 'afterhost', 'Hosty')
  const g1 = await newMember(browser, 'guesta', 'Guesta')
  const g2 = await newMember(browser, 'guestb', 'Guestb')
  const admin = await newMember(browser, 'afteradmin', 'Adminy')
  await promoteToAdmin(admin.email)
  const hostId = await userIdFor(host.email)
  await serviceInsert('user_roles', { user_id: hostId, role: 'host' })

  // An event that started 3 hours ago and ended an hour ago: check-in is still open (until 4 hours after the start).
  const event = await serviceInsert('events', {
    host_id: hostId, type: 'community', title, area_id: 1, category_id: 1,
    starts_at: new Date(Date.now() - 3 * 3_600_000).toISOString(), ends_at: new Date(Date.now() - 3_600_000).toISOString(),
    capacity: 10, approval_mode: 'instant', status: 'published', published_at: new Date().toISOString(),
  })
  for (const guest of [g1, g2]) await serviceInsert('bookings', { event_id: event.id, user_id: await userIdFor(guest.email), status: 'approved' })

  // ---------- a guest has a QR ticket
  await g1.page.goto('/app/plans')
  await g1.page.getByRole('button', { name: 'Show my ticket' }).click()
  await expect(g1.page.getByRole('dialog').locator('svg')).toBeVisible()

  // ---------- the host ticks both guests off the list
  await host.page.goto(`/app/host/events/${event.id}/checkin`)
  await expect(host.page.getByRole('heading', { name: '0 of 2 checked in' })).toBeVisible()
  for (const name of ['Guesta', 'Guestb']) {
    await host.page.locator('[data-slot="card"]', { hasText: name }).getByRole('button', { name: 'Check in' }).click()
  }
  await expect(host.page.getByRole('heading', { name: '2 of 2 checked in' })).toBeVisible()

  // ---------- an admin counts attendance now (it would happen 2 hours after the end)
  await admin.page.goto(`/app/host/events/${event.id}/checkin`)
  await admin.page.getByRole('button', { name: 'Count attendance now' }).click()
  await expect(admin.page.getByText('Attendance counted')).toBeVisible()

  // ---------- both guests tag each other, so the tags are revealed at once
  const tagEachOther = async (page: typeof g1.page, other: string) => {
    await page.goto('/app/plans')
    await expect(page.getByText('Attended')).toBeVisible()
    await page.getByRole('link', { name: 'Share feedback' }).click()
    const card = page.locator('[data-slot="card"]', { hasText: other })
    await card.getByRole('button', { name: 'Warm', exact: true }).click()
    await card.getByRole('button', { name: 'Send tags' }).click()
    await expect(card.getByText(`You sent ${other} your tags.`)).toBeVisible()
  }
  await tagEachOther(g1.page, 'Guestb')
  await tagEachOther(g2.page, 'Guesta')

  // The reputation numbers refresh every 15 minutes; an admin can refresh them now (the same button).
  await admin.page.getByRole('button', { name: 'Count attendance now' }).click()

  // ---------- reliability and tags show on the profile
  await g1.page.goto('/app/profile')
  await expect(g1.page.getByText('Shows up 1 of 1')).toBeVisible()
  await expect(g1.page.getByRole('list', { name: 'Top tags' }).getByText('Warm')).toBeVisible()

  // ---------- a report puts the other guest on hold instantly, and they can appeal
  await g1.page.goto(`/app/events/${event.id}/feedback`)
  const card = g1.page.locator('[data-slot="card"]', { hasText: 'Guestb' })
  await card.getByRole('button', { name: 'Report' }).click()
  await g1.page.getByLabel('What is this about?').selectOption('unsafe')
  await g1.page.getByRole('button', { name: 'Send report' }).click()
  await expect(g1.page.getByText('We have your report')).toBeVisible()

  await g2.page.goto('/app/profile')
  await expect(g2.page.getByText('Your account is on hold')).toBeVisible()
  await g2.page.goto('/app/appeals')
  await g2.page.getByRole('button', { name: 'Appeal this' }).click()
  await g2.page.getByLabel('Tell us what we should know').fill('I think this was a misunderstanding.')
  await g2.page.getByRole('button', { name: 'Send appeal' }).click()
  await expect(g2.page.getByText('We are looking at it')).toBeVisible()
})
