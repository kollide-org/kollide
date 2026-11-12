import { expect, test } from '@playwright/test'

import { DEV_HOST_ID, newMember, promoteToAdmin, serviceInsert, servicePatch, userIdFor } from './helpers.ts'

test.setTimeout(240_000)
test.describe.configure({ retries: 0 })

test('an admin moderates a report, answers an appeal, reads partner clicks, the audit log and job health', async ({ browser }) => {
  const stamp = Date.now()
  const tag = String(stamp).slice(-6) // first names are unique per run, so old runs on the same database cannot get in the way
  const adminName = `Admn${tag}`
  const subjectName = `Subj${tag}`
  const admin = await newMember(browser, 'modadmin', adminName)
  await promoteToAdmin(admin.email)
  const reporter = await newMember(browser, 'reporter', `Repo${tag}`)
  const subject = await newMember(browser, 'subject', subjectName)
  const reporterId = await userIdFor(reporter.email)
  const subjectId = await userIdFor(subject.email)

  // A report that already put the subject on hold (the hold itself is tested in the database tests).
  const report = await serviceInsert('safety_reports', {
    reporter_id: reporterId, subject_type: 'user', subject_id: subjectId, subject_user_id: subjectId, reason: 'harassment', details: `E2E report ${stamp}`, held: true,
  })
  await servicePatch('profile_private', `id=eq.${subjectId}`, { status: 'on_hold' })

  // ---------- the reports queue
  await admin.page.goto('/admin/reports')
  const card = admin.page.locator('[data-testid="report-card"]', { hasText: subjectName })
  await expect(card).toBeVisible()
  await expect(card).toContainText('Put on hold')
  await card.getByRole('button', { name: 'Open' }).click()
  await expect(card.getByText(`E2E report ${stamp}`)).toBeVisible()
  await expect(card.getByText('Who wrote them is never shown')).toBeVisible()
  await card.getByRole('button', { name: 'Start review' }).click()
  await expect(card.getByText(`Reviewing: ${adminName}`)).toBeVisible()
  await card.getByLabel('Outcome').selectOption('suspend')
  await card.getByLabel(/Internal note/).fill('Confirmed with the reporter')
  await card.getByLabel(/Message to the person/).fill('Please be kinder to other guests')
  await card.getByRole('button', { name: 'Save decision' }).click()
  await expect(admin.page.getByText('Decision saved.')).toBeVisible()

  // ---------- the suspended person sees it, and appeals
  await subject.page.goto('/app/profile')
  await expect(subject.page.getByText('Your account is on hold')).toBeVisible()
  await subject.page.goto('/app/appeals')
  await subject.page.getByRole('button', { name: 'Appeal this' }).click()
  await subject.page.getByLabel('Tell us what we should know').fill('I would like to explain what happened.')
  await subject.page.getByRole('button', { name: 'Send appeal' }).click()
  await expect(subject.page.getByText('We are looking at it')).toBeVisible()

  // ---------- the admin accepts the appeal
  await admin.page.goto('/admin/appeals')
  const appeal = admin.page.locator('[data-testid="appeal-card"]', { hasText: subjectName })
  await expect(appeal).toBeVisible()
  await appeal.getByLabel(/Answer/).fill('Thank you, we have looked again.')
  await appeal.getByRole('button', { name: 'Accept the appeal' }).click()
  await expect(admin.page.getByText('Appeal accepted.')).toBeVisible()
  await subject.page.goto('/app/appeals')
  await expect(subject.page.getByText('Accepted')).toBeVisible()
  await expect(subject.page.getByText('From our team: Thank you, we have looked again.')).toBeVisible()

  // ---------- users: search, hold with a reason, reactivate
  await admin.page.goto('/admin/users')
  await admin.page.getByLabel('Search').fill(subjectName)
  await admin.page.getByRole('button', { name: 'Search' }).click()
  const row = admin.page.locator('[data-testid="user-row"]', { hasText: subjectName })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Active')
  await row.getByRole('button', { name: 'Open' }).click()
  const panel = admin.page.getByLabel(`Details for ${subjectName}`)
  await expect(panel.getByText('suspend', { exact: false }).first()).toBeVisible() // the history of the decision above
  await panel.getByLabel('Action', { exact: true }).selectOption('hold')
  await panel.getByLabel(/Reason/).fill('Checking something else')
  await panel.getByRole('button', { name: 'Apply' }).click()
  await expect(admin.page.getByText('Done. It is in the audit log.')).toBeVisible()
  await expect(row).toContainText('On hold')
  await panel.getByLabel('Action', { exact: true }).selectOption('reactivate')
  await panel.getByLabel(/Reason/).fill('Checked, all fine')
  await panel.getByRole('button', { name: 'Apply' }).click()
  await expect(row).toContainText('Active')
  // an admin cannot be moderated from here
  await admin.page.getByLabel('Search').fill(adminName)
  await admin.page.getByRole('button', { name: 'Search' }).click()
  await admin.page.locator('[data-testid="user-row"]', { hasText: adminName }).getByRole('button', { name: 'Open' }).click()
  await expect(admin.page.getByText('Remove their admin role before moderating them.')).toBeVisible()

  // ---------- partner links and their click counts
  const partner = await serviceInsert('events', {
    host_id: DEV_HOST_ID, type: 'partner', title: `E2E partner ${stamp}`, area_id: 1, category_id: 1,
    starts_at: new Date(Date.now() + 9 * 86_400_000).toISOString(), ends_at: new Date(Date.now() + 9 * 86_400_000 + 7_200_000).toISOString(),
    status: 'published', published_at: new Date().toISOString(), partner_url: 'https://tickets.example.com/show', referral_code: 'KOL',
  })
  for (let i = 0; i < 2; i++) {
    const res = await fetch(`http://localhost:8787/go/${partner.id}`, { redirect: 'manual' })
    expect(res.status).toBe(302)
  }
  await admin.page.goto('/admin/partners')
  const pcard = admin.page.locator('[data-testid="partner-card"]', { hasText: `E2E partner ${stamp}` })
  await expect(pcard.getByTestId('partner-clicks')).toContainText('2 in the last 7 days')
  await pcard.getByLabel('Referral code').fill('KOL-2')
  await pcard.getByRole('button', { name: 'Save' }).click()
  await expect(admin.page.getByText('Link saved. It is in the audit log.')).toBeVisible()
  const location = (await fetch(`http://localhost:8787/go/${partner.id}`, { redirect: 'manual' })).headers.get('location')
  expect(location).toContain('ref=KOL-2')

  // ---------- the audit log shows all of it
  await admin.page.goto('/admin/audit')
  await expect(admin.page.getByTestId('audit-row').first()).toBeVisible()
  await admin.page.getByLabel('Table').selectOption('moderation_actions')
  await admin.page.getByRole('button', { name: 'Filter' }).click()
  await expect(admin.page.getByTestId('audit-row').first()).toContainText('moderation_actions')
  expect(await admin.page.getByTestId('audit-row').count()).toBeGreaterThanOrEqual(3) // suspend, hold, reactivate
  await expect(admin.page.getByTestId('audit-row').first()).toContainText(adminName)

  // ---------- flags, job health and the read-only config page
  await admin.page.goto('/admin/flags')
  await expect(admin.page.getByRole('heading', { name: 'Flags' })).toBeVisible()
  await admin.page.goto('/admin/jobs')
  await expect(admin.page.getByTestId('email-usage')).toContainText('of 280 sent')
  await admin.page.goto('/admin/config')
  await expect(admin.page.getByTestId('payments-status')).toHaveText('Payments: off — enabled in milestone P1')
  await expect(admin.page.getByRole('switch')).toHaveCount(0) // no toggle in v1
  expect(report.id).toBeTruthy()
})
