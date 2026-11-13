import { expect, test } from '@playwright/test'

import { newMember, publishedEvent, serviceSelect, userIdFor } from './helpers.ts'

test.setTimeout(240_000)
test.describe.configure({ retries: 0 })

test('a person joins an event, exports their data, deletes their account, and the seat goes back', async ({ browser }) => {
  const stamp = Date.now()
  const eventId = await publishedEvent({ title: `E2E erase ${stamp}`, capacity: 2, approvalMode: 'instant', address: '3 Quiet Lane, Indiranagar, Bengaluru' })
  const leaver = await newMember(browser, 'leaver', 'Leavea')
  const staying = await newMember(browser, 'staying', 'Stayinga')
  const waiting = await newMember(browser, 'waiting', 'Waitinga')
  const leaverId = await userIdFor(leaver.email)

  // Two people fill the event, a third is waitlisted.
  for (const person of [leaver, staying]) {
    await person.page.goto(`/app/events/${eventId}`)
    await person.page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(person.page.getByText('You are in!')).toBeVisible()
  }
  await waiting.page.goto(`/app/events/${eventId}`)
  await waiting.page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(waiting.page.getByText(/You are on the waitlist/)).toBeVisible()

  // ---------- export: everything we hold about the person, and nothing about others
  await leaver.page.goto('/app/settings')
  const [download] = await Promise.all([leaver.page.waitForEvent('download'), leaver.page.getByRole('button', { name: 'Export my data' }).click()])
  const exported = JSON.parse(await (await import('node:fs/promises')).readFile((await download.path()) as string, 'utf8'))
  for (const section of ['profile', 'private', 'photos', 'consents', 'bookings', 'notifications', 'checkins', 'tags_given']) expect(exported, section).toHaveProperty(section)
  expect(exported.private.email).toBe(leaver.email)
  expect(exported.bookings).toHaveLength(1)
  expect(JSON.stringify(exported)).not.toContain(staying.email) // no one else's data

  // ---------- delete
  await leaver.page.getByRole('button', { name: 'Delete my account' }).first().click()
  await leaver.page.getByLabel('Type DELETE').fill('DELETE')
  await leaver.page.getByRole('button', { name: 'Delete forever' }).click()
  await expect(leaver.page).toHaveURL(/\/$/)

  // ---------- what is left: nothing readable about the person, and the seat is free
  const profile = await serviceSelect('profiles', `id=eq.${leaverId}&select=first_name,is_verified`)
  expect(profile[0]).toMatchObject({ first_name: 'Former member', is_verified: false })
  expect(await serviceSelect('profile_private', `id=eq.${leaverId}&select=id`)).toEqual([])
  expect(await serviceSelect('profile_photos', `user_id=eq.${leaverId}&select=r2_key`)).toEqual([])
  expect(await serviceSelect('notifications', `user_id=eq.${leaverId}&select=id`)).toEqual([])
  const seat = await serviceSelect('bookings', `event_id=eq.${eventId}&user_id=eq.${leaverId}&select=status,cancel_reason`)
  expect(seat[0]).toMatchObject({ status: 'cancelled', cancel_reason: 'account_deleted' })
  // the waitlisted person got the seat
  await waiting.page.reload()
  await expect(waiting.page.getByText('You are in!')).toBeVisible()
  // the deleted person's photos are queued for removal from R2 (the clean-up job deletes them)
  expect((await serviceSelect('storage_deletions', 'select=key&limit=1')).length).toBeGreaterThan(0)
})
