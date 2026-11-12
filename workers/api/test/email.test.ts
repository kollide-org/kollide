import { afterEach, describe, expect, it } from 'vitest'

import app from '../src/index'
import { renderEmail, type EmailRow } from '../src/emails/templates'
import { mockBackend, resetBackend, testEnv } from './helpers'

afterEach(resetBackend)

let nextId = 1
const row = (patch: Partial<EmailRow> = {}): EmailRow => ({
  id: nextId++, template: 'booking_approved', user_id: 'user-1', priority: 1, attempts: 1, to_email: 'meera@example.com',
  data: { event_id: '44444444-4444-4444-8444-444444444444', event_title: 'Sunday board games', starts_at: '2026-12-14T12:30:00Z', area_name: 'Indiranagar' },
  ...patch,
})

const flush = (secret: string | null, env = testEnv()) =>
  app.request('/jobs/flush-email', { method: 'POST', headers: secret === null ? {} : { 'x-job-secret': secret } }, env)

/** Fake database + Brevo. `brevo` decides what each send answers. */
function backend(opts: { sentToday?: number; rows?: EmailRow[]; brevo?: (body: any, index: number) => Response }) {
  const sends: { headers: Headers; body: any }[] = []
  const finished: any[] = []
  const records: any[] = []
  let claimLimit = -1
  const mock = mockBackend({
    rpc: {
      emails_sent_today: () => opts.sentToday ?? 0,
      claim_emails: (args) => {
        claimLimit = args.p_limit as number
        return opts.rows ?? []
      },
      finish_emails: (args) => void finished.push(...(args.p_results as any[])),
      record_job_run: (args) => void records.push(args),
    },
    external: async (_url, init) => {
      const body = JSON.parse(init?.body as string)
      sends.push({ headers: new Headers(init?.headers), body })
      return opts.brevo ? opts.brevo(body, sends.length - 1) : Response.json({ messageId: `<m${sends.length}@brevo>` }, { status: 201 })
    },
  })
  return { sends, finished, records, rpcCalls: mock.rpcCalls, claimLimit: () => claimLimit }
}

describe('POST /jobs/flush-email', () => {
  it('refuses a missing or wrong secret and does nothing', async () => {
    const b = backend({})
    expect((await flush(null)).status).toBe(401)
    expect((await flush('wrong')).status).toBe(401)
    expect(b.rpcCalls).toHaveLength(0)
  })

  it('does nothing (and says so) when Brevo is not configured', async () => {
    const b = backend({})
    const res = await flush('job-secret', testEnv({ BREVO_API_KEY: '' }))
    expect(res.status).toBe(200)
    expect(b.rpcCalls.map((c) => c.name)).toEqual(['record_job_run'])
    expect(b.records[0]).toMatchObject({ p_job: 'flush-email', p_status: 'skipped' })
  })

  it('sends each email through Brevo with the right request and reports the results in one call', async () => {
    const rows = [row({ id: 1 }), row({ id: 2, template: 'request_received', priority: 2, to_email: 'kabir@example.com' })]
    const b = backend({ rows })
    const res = await flush('job-secret')
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ claimed: 2, sent: 2, retry: 0, failed: 0 })

    expect(b.sends).toHaveLength(2)
    expect(b.sends[0]!.headers.get('api-key')).toBe('brevo-test-key')
    expect(b.sends[0]!.body.sender).toEqual({ name: 'Kollide', email: 'mail@mail.example.invalid' })
    expect(b.sends[0]!.body.to).toEqual([{ email: 'meera@example.com' }])
    expect(b.sends[0]!.body.subject).toBe("You're in: Sunday board games")
    expect(b.sends[0]!.body.htmlContent).toContain('https://site.test/app/events/44444444-4444-4444-8444-444444444444')
    expect(b.sends[0]!.body.textContent).toContain('Sunday board games')
    expect(b.finished).toEqual([
      { id: 1, outcome: 'sent', message_id: '<m1@brevo>' },
      { id: 2, outcome: 'sent', message_id: '<m2@brevo>' },
    ])
    expect(b.records.at(-1)).toMatchObject({ p_status: 'ok' })
  })

  it('keeps the database order, so critical emails go out first', async () => {
    const rows = [row({ id: 10, template: 'booking_approved', priority: 1 }), row({ id: 11, template: 'still_coming', priority: 1, data: { event_title: 'X', reconfirm_token: 't' } }), row({ id: 12, template: 'day_of_reminder', priority: 2 })]
    const b = backend({ rows })
    await flush('job-secret')
    expect(b.sends.map((s) => s.body.subject)).toEqual(["You're in: Sunday board games", 'Still coming to X?', 'Today: Sunday board games'])
  })

  it('asks the database to retry a server error and a network failure, and gives up on a bad request', async () => {
    const rows = [row({ id: 1 }), row({ id: 2 }), row({ id: 3 })]
    const b = backend({ rows, brevo: (_body, i) => (i === 0 ? new Response('', { status: 503 }) : i === 1 ? new Response('', { status: 429 }) : new Response('', { status: 400 })) })
    const res = await flush('job-secret')
    expect(await res.json()).toMatchObject({ sent: 0, retry: 2, failed: 1 })
    expect(b.finished.map((r) => r.outcome).sort()).toEqual(['failed', 'retry', 'retry'])
    expect(b.finished.find((r) => r.id === 3)).toMatchObject({ outcome: 'failed', error: 'Brevo answered 400' })
  })

  it('stops for the day at 280 emails', async () => {
    const b = backend({ sentToday: 280, rows: [row()] })
    const res = await flush('job-secret')
    expect(await res.json()).toMatchObject({ sent: 0, capped: true })
    expect(b.rpcCalls.map((c) => c.name)).not.toContain('claim_emails')
    expect(b.sends).toHaveLength(0)
    expect(b.records.at(-1)).toMatchObject({ p_status: 'warning' })
    // the admin page reads the cap from here, so it must be there on this path too
    expect(b.records.at(-1)?.p_detail).toMatchObject({ sent_today: 280, daily_cap: 280 })
  })

  it('claims only what is left of the daily budget, and at most 20 a run', async () => {
    const near = backend({ sentToday: 275 })
    await flush('job-secret')
    expect(near.claimLimit()).toBe(5)
    resetBackend()
    const fresh = backend({ sentToday: 0 })
    await flush('job-secret')
    expect(fresh.claimLimit()).toBe(20)
  })

  it('warns at 80% of the daily cap', async () => {
    const b = backend({ sentToday: 223, rows: [row({ id: 1 }), row({ id: 2 })] })
    await flush('job-secret')
    expect(b.records.at(-1)).toMatchObject({ p_status: 'warning' })
    expect(b.records.at(-1).p_detail).toMatchObject({ sent_today: 225 })
  })

  it('fails an email with no recipient or an unknown template, without calling Brevo', async () => {
    const b = backend({ rows: [row({ id: 1, to_email: null }), row({ id: 2, template: 'mystery' })] })
    await flush('job-secret')
    expect(b.sends).toHaveLength(0)
    expect(b.finished.map((r) => r.outcome)).toEqual(['failed', 'failed'])
  })

  it('on staging only sends to the allow-list', async () => {
    const rows = [row({ id: 1, to_email: 'team@example.com' }), row({ id: 2, to_email: 'stranger@example.com' })]
    const b = backend({ rows })
    await flush('job-secret', testEnv({ ENVIRONMENT: 'staging', EMAIL_ALLOWLIST: 'Team@Example.com, other@example.com' }))
    expect(b.sends.map((s) => s.body.to[0].email)).toEqual(['team@example.com'])
    expect(b.finished).toEqual([
      { id: 1, outcome: 'sent', message_id: '<m1@brevo>' },
      { id: 2, outcome: 'skipped', error: 'not on the staging allow-list' },
    ])
  })

  it('locally writes to the dev mailbox instead of Brevo', async () => {
    const b = backend({ rows: [row({ id: 7, to_email: 'local@example.com' })] })
    const env = testEnv({ ENVIRONMENT: 'local', BREVO_API_KEY: '' })
    const res = await flush('job-secret', env)
    expect(await res.json()).toMatchObject({ sent: 1 })
    expect(b.sends).toHaveLength(0)
    const mail = await app.request('/dev/mail?to=local@example.com', {}, env)
    const { mails } = (await mail.json()) as { mails: { to: string; subject: string }[] }
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ to: 'local@example.com', subject: "You're in: Sunday board games" })
    expect((await app.request('/dev/mail', {}, testEnv())).status).toBe(404)
  })

  it('records an error and returns 500 when the database fails', async () => {
    const records: any[] = []
    mockBackend({
      rpc: {
        emails_sent_today: () => { throw new Error('boom') },
        record_job_run: (args) => void records.push(args),
      },
    })
    const res = await flush('job-secret')
    expect(res.status).toBe(500)
    expect(records.at(-1)).toMatchObject({ p_status: 'error' })
  })
})

describe('email templates', () => {
  const ctx = { siteUrl: 'https://site.test' }
  const base = row()

  it('renders every template with a subject, HTML and plain text', () => {
    for (const template of ['request_received', 'booking_approved', 'booking_waitlisted', 'booking_declined', 'still_coming', 'day_of_reminder', 'event_cancelled',
      'feedback_prompt', 'safety_report_ack', 'admin_alert', 'account_on_hold', 'moderation_notice']) {
      const mail = renderEmail({ ...base, template, data: { ...base.data, reconfirm_token: 'tok', action: 'warn' } }, ctx)
      expect(mail, template).not.toBeNull()
      expect(mail!.subject.length).toBeGreaterThan(5)
      expect(mail!.html).toContain('#3B3B98')
      expect(mail!.text.length).toBeGreaterThan(20)
    }
    expect(renderEmail({ ...base, template: 'nope' }, ctx)).toBeNull()
  })

  it('still coming has the one-tap reconfirm link', () => {
    const mail = renderEmail({ ...base, template: 'still_coming', data: { ...base.data, reconfirm_token: 'abc-123', reconfirm_by: '2026-12-14T06:30:00Z' } }, ctx)!
    expect(mail.html).toContain('https://site.test/reconfirm/abc-123')
    expect(mail.text).toContain('https://site.test/reconfirm/abc-123')
  })

  it('declining is gentle: it never says rejected or denied', () => {
    const mail = renderEmail({ ...base, template: 'booking_declined' }, ctx)!
    expect(`${mail.subject} ${mail.html} ${mail.text}`.toLowerCase()).not.toMatch(/reject|denied|refused|unfortunately/)
  })

  it('escapes anything a person wrote', () => {
    const mail = renderEmail({ ...base, data: { ...base.data, event_title: '<script>alert("x")</script> & friends' } }, ctx)!
    expect(mail.html).not.toContain('<script>')
    expect(mail.html).toContain('&lt;script&gt;')
    expect(mail.html).toContain('&amp; friends')
  })

  it('the feedback prompt links to the feedback flow and says when it closes', () => {
    const mail = renderEmail({ ...base, template: 'feedback_prompt', data: { ...base.data, event_id: 'ev-1', closes_at: '2026-12-17T06:30:00Z' } }, ctx)!
    expect(mail.html).toContain('https://site.test/app/events/ev-1/feedback')
    expect(mail.text).toContain('Open until')
  })

  it('safety emails never carry names, reasons or notes', () => {
    const data = { ...base.data, kind: 'safety_report', held: true, report_id: 'r-1', reason: 'harassment', details: 'SECRET DETAILS', subject_name: 'Asha' }
    for (const template of ['safety_report_ack', 'admin_alert', 'account_on_hold']) {
      const mail = renderEmail({ ...base, template, data }, ctx)!
      const all = `${mail.subject} ${mail.html} ${mail.text}`
      expect(all, template).not.toContain('SECRET DETAILS')
      expect(all.toLowerCase(), template).not.toContain('harassment')
      expect(all, template).not.toContain('Asha')
    }
    const held = renderEmail({ ...base, template: 'account_on_hold' }, ctx)!
    expect(held.html + held.text).toContain('/app/appeals')
  })

  it('admin alerts say what happened for each kind', () => {
    const text = (kind: string, held?: boolean) => renderEmail({ ...base, template: 'admin_alert', data: { kind, held } }, ctx)!.text
    expect(text('safety_report', true)).toContain('on hold')
    expect(text('appeal')).toContain('48 hours')
    expect(text('appeal_overdue')).toContain('past its 48-hour target')
  })

  it('moderation notices use fixed wording plus the admin\'s note, escaped', () => {
    for (const action of ['note', 'warn', 'hold', 'suspend', 'ban', 'reactivate']) {
      const mail = renderEmail({ ...base, template: 'moderation_notice', data: { action, note: '<b>Please</b> read & reply' } }, ctx)!
      expect(mail, action).not.toBeNull()
      expect(mail.html, action).not.toContain('<b>Please</b>')
      expect(mail.html, action).toContain('&lt;b&gt;Please&lt;/b&gt; read &amp; reply')
      expect(`${mail.subject} ${mail.html} ${mail.text}`.toLowerCase(), action).not.toMatch(/report|reporter|harass/)
    }
    expect(renderEmail({ ...base, template: 'moderation_notice', data: { action: 'nope' } }, ctx)).toBeNull()
  })

  it('a ban email has no appeal link (they cannot sign in) and a suspension has one', () => {
    const ban = renderEmail({ ...base, template: 'moderation_notice', data: { action: 'ban' } }, ctx)!
    expect(ban.html + ban.text).not.toContain('/app/appeals')
    const suspend = renderEmail({ ...base, template: 'moderation_notice', data: { action: 'suspend' } }, ctx)!
    expect(suspend.html + suspend.text).toContain('https://site.test/app/appeals')
  })

  it('never contains an address', () => {
    const mail = renderEmail({ ...base, template: 'day_of_reminder', data: { ...base.data, address: '1 Secret Lane' } }, ctx)!
    expect(mail.html + mail.text).not.toContain('Secret Lane')
  })

  it('shows the time in Bengaluru time', () => {
    const mail = renderEmail({ ...base, template: 'booking_approved' }, ctx)!
    expect(mail.text).toMatch(/6:00 pm/)
  })
})
