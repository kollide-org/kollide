import { expect, type Page } from '@playwright/test'

const MAILPIT = 'http://127.0.0.1:54324'

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

  await expect(page.getByText('Photo upload is coming very soon')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByLabel('I accept the code of conduct').click()
  await page.getByLabel('I accept the privacy notice').click()
  await page.getByRole('button', { name: 'Finish' }).click()
}
