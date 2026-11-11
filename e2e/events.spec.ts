import { expect, test } from '@playwright/test'

import { pictureFile } from './fixtures.ts'
import { localInput, newMember, promoteToAdmin } from './helpers.ts'

const WORKER = 'http://localhost:8787'

test('host applies, admin approves, host creates an event, admin approves and features it; feed, filters, hub and the address rule', async ({ browser }) => {
  const title = `E2E picnic ${Date.now()}`
  const hubTitle = `E2E hub ${Date.now()}`

  // A member applies to host.
  const host = await newMember(browser, 'host', 'Hosty')
  await host.page.goto('/app/become-host')
  await host.page.getByLabel('What would you like to host?').fill('A monthly picnic for new people in Bengaluru.')
  await host.page.getByRole('button', { name: 'Send application' }).click()
  await expect(host.page.getByText('Your application is with our team')).toBeVisible()

  // An admin approves the application.
  const admin = await newMember(browser, 'admin', 'Adminy')
  await promoteToAdmin(admin.email)
  await admin.page.goto('/admin')
  const application = admin.page.locator('[data-slot="card"]', { hasText: 'Hosty' })
  await application.getByRole('button', { name: 'Approve' }).click()
  await expect(admin.page.getByText('Approved. They are now a host.')).toBeVisible()

  // The host creates an event. The price options never include "Paid" while payments are off.
  await host.page.goto('/app/host/events/new')
  await expect(host.page.getByLabel('Price type').locator('option', { hasText: /^Paid/ })).toHaveCount(0)
  await host.page.getByLabel('Title', { exact: true }).fill(title)
  await host.page.getByLabel('Description').fill('Bring a blanket and a snack.')
  await host.page.getByLabel('Area').selectOption({ label: 'Indiranagar' })
  await host.page.getByLabel('Category').selectOption({ label: 'Outdoors' })
  await host.page.getByLabel('Starts').fill(localInput(10, 17))
  await host.page.getByLabel('Ends').fill(localInput(10, 20))
  await host.page.getByLabel('Capacity').fill('12')
  await host.page.getByLabel('Price type').selectOption('pay_at_venue')
  await host.page.getByLabel(/What people will see/).fill('₹150 for snacks at the venue')
  await host.page.getByLabel('Address', { exact: true }).fill('Cubbon Park, near the Bandstand, Bengaluru')
  await host.page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(host.page).toHaveURL(/\/app\/host\/events\/[0-9a-f-]{36}$/)
  const eventId = host.page.url().split('/').pop() as string

  // Submitting needs a cover.
  await host.page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(host.page.getByRole('alert')).toContainText('cover')
  await host.page.getByLabel('Choose photo 1').setInputFiles(pictureFile('cover.png', 40))
  await expect(host.page.getByRole('img', { name: 'Photo 1' })).toBeVisible()
  await host.page.getByRole('button', { name: 'Submit for review' }).click()
  await expect(host.page).toHaveURL(/\/app\/host$/)
  await expect(host.page.getByText('Waiting for review')).toBeVisible()

  // Not visible in the feed yet.
  await host.page.goto('/app')
  await expect(host.page.getByRole('heading', { name: title })).toHaveCount(0)

  // The admin approves it and features it.
  await admin.page.goto('/admin/events')
  const pending = admin.page.locator('[data-slot="card"]', { hasText: title })
  await pending.getByRole('button', { name: 'Approve' }).click()
  await expect(admin.page.getByText('Approved and published.')).toBeVisible()
  const published = admin.page.locator('[data-slot="card"]', { hasText: title })
  await published.getByRole('button', { name: 'Feature', exact: true }).click()
  await expect(admin.page.getByText('Featured on the home page.')).toBeVisible()

  // Hub: the admin creates one and adds the event.
  await admin.page.goto('/admin/hubs')
  await admin.page.getByRole('button', { name: 'New hub' }).click()
  await admin.page.getByLabel('Title', { exact: true }).fill(hubTitle)
  await admin.page.getByLabel('Published', { exact: true }).check()
  await admin.page.getByLabel(title).check()
  await admin.page.getByRole('button', { name: 'Save hub' }).click()
  await expect(admin.page.getByText('Hub saved.')).toBeVisible()

  // The host sees it in the feed, featured, with filters that work and no "Paid" filter.
  await host.page.goto('/app')
  const feed = host.page.getByRole('region', { name: 'All events' })
  await expect(host.page.getByRole('region', { name: 'Featured' }).getByRole('heading', { name: title })).toBeVisible()
  await expect(feed.getByRole('heading', { name: title })).toBeVisible()
  await expect(feed.getByLabel('Price').locator('option', { hasText: /^Paid$/ })).toHaveCount(0)
  await feed.getByLabel('Area').selectOption({ label: 'Koramangala' })
  await expect(feed.getByRole('heading', { name: title })).toHaveCount(0)
  await feed.getByLabel('Area').selectOption({ label: 'Indiranagar' })
  await expect(feed.getByRole('heading', { name: title })).toBeVisible()
  await feed.getByLabel('Price').selectOption('free')
  await expect(feed.getByRole('heading', { name: title })).toHaveCount(0)
  await feed.getByLabel('Price').selectOption('pay_at_venue')
  await expect(feed.getByRole('heading', { name: title })).toBeVisible()
  await feed.getByLabel('Women-only events').check()
  await expect(feed.getByRole('heading', { name: title })).toHaveCount(0)
  await feed.getByRole('button', { name: 'Clear filters' }).click()

  // The hub lists the event.
  await host.page.getByRole('link', { name: new RegExp(hubTitle) }).click()
  await expect(host.page.getByRole('heading', { level: 1, name: hubTitle })).toBeVisible()
  await expect(host.page.getByRole('heading', { name: title })).toBeVisible()

  // The address rule: the host sees the exact address, another member does not.
  await host.page.goto(`/app/events/${eventId}`)
  await expect(host.page.getByTestId('exact-address')).toContainText('Cubbon Park')
  const other = await newMember(browser, 'other', 'Otto')
  await other.page.goto(`/app/events/${eventId}`)
  await expect(other.page.getByRole('heading', { name: title })).toBeVisible()
  await expect(other.page.getByTestId('exact-address')).toHaveCount(0)
  await expect(other.page.getByText('The exact address is shared once the host approves you.')).toBeVisible()
  await expect(other.page.getByText('Cubbon Park')).toHaveCount(0)

  // A partner event: "Get tickets" goes through our redirect, which adds the referral code.
  await other.page.goto('/app')
  await other.page.getByRole('link', { name: /Indie acoustic evening/ }).first().click()
  const tickets = other.page.getByRole('link', { name: 'Get tickets' })
  const href = (await tickets.getAttribute('href')) as string
  expect(href).toMatch(new RegExp(`^${WORKER}/go/[0-9a-f-]{36}$`))
  const redirect = await other.page.request.get(href, { maxRedirects: 0 })
  expect(redirect.status()).toBe(302)
  const location = new URL(redirect.headers()['location'] as string)
  expect(location.origin + location.pathname).toBe('https://example.com/tickets/acoustic')
  expect(location.searchParams.get('ref')).toBe('KOLLIDE')
  expect(location.searchParams.get('utm_source')).toBe('kollide')

  // An unpublished or unknown event does not redirect.
  const missing = await other.page.request.get(`${WORKER}/go/00000000-0000-4000-8000-0000000000ff`, { maxRedirects: 0 })
  expect(missing.status()).toBe(404)
})
