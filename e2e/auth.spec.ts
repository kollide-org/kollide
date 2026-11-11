import { expect, test } from '@playwright/test'

import { finishOnboarding, signInWithCode, uniqueEmail } from './helpers.ts'

test('a visitor is sent to sign in', async ({ page }) => {
  await page.goto('/app')
  await expect(page).toHaveURL(/\/sign-in$/)
  await expect(page.getByRole('heading', { name: 'Sign in to Kollide' })).toBeVisible()
})

test('a wrong code is refused with a clear message', async ({ page }) => {
  const email = uniqueEmail('wrong')
  await page.goto('/sign-in')
  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Send code' }).click()
  await page.getByLabel('6-digit code').fill('000000')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('wrong or has expired')
})

test('email code sign-in, onboarding, profile, export and account deletion', async ({ page }) => {
  const email = uniqueEmail('member')

  // Sign in with the 6-digit code from the local inbox. A new person must onboard first.
  await signInWithCode(page, email)
  await expect(page).toHaveURL(/\/onboarding$/)

  // A signed-in person who has not onboarded cannot open the app.
  await page.goto('/app')
  await expect(page).toHaveURL(/\/onboarding$/)

  await finishOnboarding(page, 'Zoya')
  await expect(page).toHaveURL(/\/app$/)

  // The profile shows what was entered.
  await page.goto('/app/profile')
  await expect(page.getByRole('heading', { name: 'Zoya' })).toBeVisible()
  await expect(page.getByText('Filter coffee, then a long walk.')).toBeVisible()
  await expect(page.getByText('Board games')).toBeVisible()

  // Edit it.
  await page.getByRole('button', { name: 'Edit profile' }).click()
  await page.getByLabel('First name').fill('Zoya K')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('heading', { name: 'Zoya K' })).toBeVisible()

  // The session survives a reload.
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Zoya K' })).toBeVisible()

  // Export my data.
  await page.goto('/app/settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export my data' }).click(),
  ])
  const text = await (await import('node:fs/promises')).readFile((await download.path()) as string, 'utf8')
  const exported = JSON.parse(text)
  expect(exported.private.email).toBe(email)
  expect(exported.consents).toHaveLength(2)

  // Delete the account.
  await page.getByRole('button', { name: 'Delete my account' }).first().click()
  const confirm = page.getByRole('button', { name: 'Delete forever' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Type DELETE').fill('DELETE')
  await confirm.click()
  await expect(page).toHaveURL(/\/$/)

  // Signed out: the app is closed again.
  await page.goto('/app')
  await expect(page).toHaveURL(/\/sign-in$/)

  // The old account is gone: the same email now starts a brand-new account at onboarding.
  await signInWithCode(page, email)
  await expect(page).toHaveURL(/\/onboarding$/)
})
