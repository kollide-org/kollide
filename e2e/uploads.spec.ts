import { expect, test } from '@playwright/test'

import { pictureFile, GPS_MARKER } from './fixtures.ts'
import { finishOnboarding, signInWithCode, uniqueEmail } from './helpers.ts'

const WORKER = 'http://localhost:8787'

test('photos: stripped of location, shrunk to WebP, replaced and removed; selfie reviewed and deleted', async ({ page, browser, request }) => {
  const input = pictureFile('check.png').buffer
  expect(input.includes(GPS_MARKER)).toBe(true) // the picture we upload really carries a location tag

  await signInWithCode(page, uniqueEmail('photos'))
  await finishOnboarding(page, 'Zoya')
  await expect(page).toHaveURL(/\/app$/)

  // The three photos load from the image host.
  await page.goto('/app/profile')
  for (const n of [1, 2, 3]) {
    await expect(page.getByRole('img', { name: `Photo ${n}` })).toBeVisible()
    expect(await page.getByRole('img', { name: `Photo ${n}` }).evaluate((el) => (el as unknown as { naturalWidth: number }).naturalWidth)).toBeGreaterThan(0)
  }

  // What was stored is a small WebP with no location data.
  const src1 = (await page.getByRole('img', { name: 'Photo 1' }).getAttribute('src')) as string
  expect(src1).toMatch(/\/media\/profiles\/[0-9a-f-]{36}\.webp$/)
  const stored = await request.get(src1)
  expect(stored.headers()['content-type']).toBe('image/webp')
  const bytes = await stored.body()
  expect(bytes.subarray(0, 4).toString()).toBe('RIFF')
  expect(bytes.subarray(8, 12).toString()).toBe('WEBP')
  expect(bytes.length).toBeLessThanOrEqual(150 * 1024)
  expect(bytes.includes(GPS_MARKER)).toBe(false)
  expect(bytes.includes('Exif')).toBe(false)

  // Replace photo 2: the picture changes and the old file is queued for deletion.
  const oldSrc2 = (await page.getByRole('img', { name: 'Photo 2' }).getAttribute('src')) as string
  await page.getByLabel('Choose photo 2').setInputFiles(pictureFile('new.png', 200))
  await expect(page.getByRole('img', { name: 'Photo 2' })).not.toHaveAttribute('src', oldSrc2)

  // Remove photo 3. The last photo cannot be removed.
  await page.getByRole('button', { name: 'Remove photo 3' }).click()
  await expect(page.getByText('Add photo 3')).toBeVisible()
  await page.getByRole('button', { name: 'Remove photo 2' }).click()
  await expect(page.getByText('Add photo 2')).toBeVisible()
  await page.getByRole('button', { name: 'Remove photo 1' }).click()
  await expect(page.getByText('Your profile needs at least one photo.')).toBeVisible()

  // Send a selfie for verification.
  await page.getByLabel('Choose selfie').setInputFiles(pictureFile('selfie.png', 100))
  await expect(page.getByText('Your selfie is waiting for review')).toBeVisible()

  // An admin views the selfie and approves it.
  const adminContext = await browser.newContext()
  const admin = await adminContext.newPage()
  await signInWithCode(admin, 'asha.admin@kollide.test')
  await expect(admin).toHaveURL(/\/app$/)
  await admin.goto('/admin/verifications')
  const card = admin.locator('div', { hasText: 'Zoya' }).filter({ has: admin.getByRole('button', { name: 'View selfie' }) }).last()
  const [popup] = await Promise.all([adminContext.waitForEvent('page'), card.getByRole('button', { name: 'View selfie' }).click()])
  await popup.waitForLoadState()
  expect(popup.url()).toMatch(/\/dev\/private\/selfies\/[0-9a-f-]{36}\.webp$/)
  const selfieUrl = popup.url()
  await popup.close()
  await card.getByRole('button', { name: 'Approve' }).click()
  await expect(admin.getByText('Nothing is waiting for review.')).toBeVisible()

  // The person is now verified.
  await page.reload()
  await expect(page.getByText('You are verified')).toBeVisible()
  await expect(page.getByText('Verified', { exact: true })).toBeVisible()

  // The cleanup job deletes the reviewed selfie and the replaced photo from storage.
  expect((await request.get(selfieUrl)).status()).toBe(200) // still there until the job runs
  const refused = await request.post(`${WORKER}/jobs/r2-cleanup`, { headers: { 'x-job-secret': 'wrong' } })
  expect(refused.status()).toBe(401)
  const run = await request.post(`${WORKER}/jobs/r2-cleanup`, { headers: { 'x-job-secret': 'local-job-secret' } })
  expect(run.status()).toBe(200)
  expect(((await run.json()) as { deletedQueued: number }).deletedQueued).toBeGreaterThanOrEqual(3)
  expect((await request.get(selfieUrl)).status()).toBe(404)
  expect((await request.get(oldSrc2)).status()).toBe(404)
  await adminContext.close()
})

test('a visitor cannot get an upload link', async ({ request }) => {
  const res = await request.post(`${WORKER}/uploads/sign`, { data: { purpose: 'profile_photo', contentType: 'image/webp', size: 1000 } })
  expect(res.status()).toBe(401)
})
