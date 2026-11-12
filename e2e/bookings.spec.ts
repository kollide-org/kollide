import { expect, test } from '@playwright/test'

import { DEV_HOST_EMAIL, devMail, flushEmail, newMember, promoteToAdmin, publishedEvent, signInWithCode } from './helpers.ts'

test.setTimeout(240_000)
// The host signs in with a one-minute limit per address, so a retry of this test would be refused.
test.describe.configure({ retries: 0 })

test('request, host approves, email, address; waitlist promotion; reconfirmation by hand; notifications', async ({ browser }) => {
  const stamp = Date.now()
  const approvalTitle = `E2E approval ${stamp}`
  const instantTitle = `E2E instant ${stamp}`
  const approvalId = await publishedEvent({ title: approvalTitle, capacity: 5, approvalMode: 'host_approval', address: '7 Secret Lane, Indiranagar, Bengaluru' })
  const instantId = await publishedEvent({ title: instantTitle, capacity: 2, approvalMode: 'instant', address: '9 Hidden Road, Koramangala, Bengaluru' })

  // ---------- request -> host approves -> email -> the address appears
  const m1 = await newMember(browser, 'guest1', 'Guesta')
  await m1.page.goto(`/app/events/${approvalId}`)
  await expect(m1.page.getByTestId('exact-address')).toHaveCount(0)
  await m1.page.getByRole('button', { name: 'Request to join' }).click()
  await expect(m1.page.getByText('Your request is with the host')).toBeVisible()
  await expect(m1.page.getByTestId('exact-address')).toHaveCount(0)

  const hostContext = await browser.newContext()
  const host = await hostContext.newPage()
  await signInWithCode(host, DEV_HOST_EMAIL)
  await expect(host).toHaveURL(/\/app$/)
  await host.goto(`/app/host/events/${approvalId}/inbox`)
  const card = host.locator('[data-slot="card"]', { hasText: 'Guesta' })
  await expect(card).toBeVisible()
  await expect(card).not.toContainText('+91') // no phone number
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(host.getByText('Approved.')).toBeVisible()

  await m1.page.reload()
  await expect(m1.page.getByText('You are in!')).toBeVisible()
  await expect(m1.page.getByTestId('exact-address')).toContainText('7 Secret Lane')

  await flushEmail()
  const mails = await devMail(m1.email)
  const approved = mails.find((m) => m.template === 'booking_approved')!
  expect(approved.subject).toBe(`You're in: ${approvalTitle}`)
  expect(approved.html).toContain(`/app/events/${approvalId}`)
  expect(approved.html + approved.text).not.toContain('Secret Lane') // emails never carry the address
  expect(mails.some((m) => m.template === 'request_received')).toBe(true)

  // ---------- waitlist promotion on cancel (instant event with 2 seats)
  const a = await newMember(browser, 'seat1', 'Seata')
  const b = await newMember(browser, 'seat2', 'Seatb')
  const c = await newMember(browser, 'wait1', 'Waita')
  for (const person of [a, b]) {
    await person.page.goto(`/app/events/${instantId}`)
    await person.page.getByRole('button', { name: 'Join', exact: true }).click()
    await expect(person.page.getByText('You are in!')).toBeVisible()
  }
  await c.page.goto(`/app/events/${instantId}`)
  await c.page.getByRole('button', { name: 'Join', exact: true }).click()
  await expect(c.page.getByText(/You are on the waitlist/)).toBeVisible()
  await expect(c.page.getByTestId('exact-address')).toHaveCount(0)

  await a.page.reload()
  await a.page.getByRole('button', { name: 'Cancel my place' }).click()
  await expect(a.page.getByRole('button', { name: 'Join', exact: true })).toBeVisible()

  await c.page.reload()
  await expect(c.page.getByText('You are in!')).toBeVisible()
  await expect(c.page.getByTestId('exact-address')).toContainText('9 Hidden Road')
  await flushEmail()
  const promoted = (await devMail(c.email)).find((m) => m.template === 'booking_approved')!
  expect(promoted.subject).toContain('A spot opened up')

  // ---------- "Still coming?" sent by hand by an admin, then the one-tap link
  const admin = await newMember(browser, 'admin', 'Adminy')
  await promoteToAdmin(admin.email)
  await admin.page.goto(`/app/host/events/${approvalId}/inbox`)
  const guestCard = admin.page.locator('[data-slot="card"]', { hasText: 'Guesta' })
  await guestCard.getByRole('button', { name: /Still coming/ }).click()
  await expect(admin.page.getByText(/email queued/)).toBeVisible()
  await flushEmail()
  const still = (await devMail(m1.email)).find((m) => m.template === 'still_coming')!
  expect(still.subject).toBe(`Still coming to ${approvalTitle}?`)
  const link = still.html.match(/href="(http:\/\/localhost:5173\/reconfirm\/[0-9a-f-]{36})"/)![1]!
  const visitor = await (await browser.newContext()).newPage() // not signed in: one tap is enough
  await visitor.goto(link)
  await expect(visitor.getByRole('heading', { name: /see you there/ })).toBeVisible()
  await m1.page.goto('/app/plans')
  await expect(m1.page.getByText('Confirmed')).toBeVisible()

  // ---------- notifications
  await m1.page.goto('/app')
  await expect(m1.page.getByRole('link', { name: /Notifications, \d+ unread/ })).toBeVisible()
  await m1.page.goto('/app/notifications')
  await expect(m1.page.getByText('You are in')).toBeVisible()
  await m1.page.getByRole('button', { name: 'Mark all as read' }).click()
  // Wait until the page shows nothing unread, so the request has finished before we leave (navigating early could cancel it).
  await expect(m1.page.getByText('(unread)')).toHaveCount(0)
  await m1.page.goto('/app')
  await expect(m1.page.getByRole('link', { name: 'Notifications', exact: true })).toBeVisible()

  // ---------- the host sees the notifications about requests, and the admin sees the job status
  await admin.page.goto('/admin/jobs')
  await expect(admin.page.getByRole('heading', { name: 'flush-email' })).toBeVisible()
})
