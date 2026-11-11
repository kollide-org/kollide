import { button, esc, layout } from './layout'

export interface EmailRow {
  id: number
  template: string
  user_id: string
  data: Record<string, unknown>
  priority: number
  attempts: number
  to_email: string | null
}

export interface Rendered {
  subject: string
  html: string
  text: string
}

interface Context {
  siteUrl: string
}

const FOOTER_ESSENTIAL = 'You are getting this because of something you did on Kollide.'
const FOOTER_OPTIONAL = 'You are getting this because you asked to join an event on Kollide.'

/** "Sat 14 Dec, 6:30 pm" in Bengaluru time. */
export function when(iso: unknown): string {
  const date = new Date(String(iso))
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  }).format(date)
}

function details(d: Record<string, unknown>): { html: string; text: string } {
  const parts = [when(d.starts_at), d.area_name ? String(d.area_name) : ''].filter(Boolean)
  return { html: `<p style="margin:0 0 8px 0;color:#5A5A70;">${esc(parts.join(' · '))}</p>`, text: parts.join(' · ') }
}

/** Plain text and HTML for every email we send. The exact address is never in an email: people see it in the app. */
export function renderEmail(row: EmailRow, ctx: Context): Rendered | null {
  const d = row.data ?? {}
  const title = String(d.event_title ?? 'your event')
  const eventUrl = `${ctx.siteUrl}/app/events/${encodeURIComponent(String(d.event_id ?? ''))}`
  const info = details(d)

  switch (row.template) {
    case 'request_received':
      return {
        subject: `We got your request: ${title}`,
        html: layout({
          heading: 'We got your request',
          footer: FOOTER_OPTIONAL,
          bodyHtml: `<p style="margin:0 0 12px 0;">Thanks for asking to join <strong>${esc(title)}</strong>.</p>${info.html}<p style="margin:12px 0 0 0;">The host will take a look. We will email you as soon as there is news.</p>${button(eventUrl, 'See the event')}`,
        }),
        text: `We got your request to join ${title}.\n${info.text}\n\nThe host will take a look. We will email you as soon as there is news.\n${eventUrl}`,
      }
    case 'booking_approved': {
      const promoted = d.promoted === true
      return {
        subject: promoted ? `A spot opened up: you're in for ${title}` : `You're in: ${title}`,
        html: layout({
          heading: promoted ? 'A spot opened up. You are in.' : 'You are in!',
          footer: FOOTER_ESSENTIAL,
          bodyHtml: `<p style="margin:0 0 12px 0;">You have a place at <strong>${esc(title)}</strong>.</p>${info.html}<p style="margin:12px 0 0 0;">The exact address is in the app, on the event page, where only people with a place can see it.</p>${button(eventUrl, 'Open the event')}`,
        }),
        text: `You have a place at ${title}.\n${info.text}\n\nThe exact address is in the app, on the event page.\n${eventUrl}`,
      }
    }
    case 'booking_waitlisted':
      return {
        subject: `You're on the waitlist for ${title}`,
        html: layout({
          heading: 'You are on the waitlist',
          footer: FOOTER_OPTIONAL,
          bodyHtml: `<p style="margin:0 0 12px 0;"><strong>${esc(title)}</strong> is full right now, so you are on the waitlist.</p>${info.html}<p style="margin:12px 0 0 0;">If a place opens up we will email you straight away.</p>${button(eventUrl, 'See the event')}`,
        }),
        text: `${title} is full right now, so you are on the waitlist.\n${info.text}\n\nIf a place opens up we will email you straight away.\n${eventUrl}`,
      }
    case 'booking_declined':
      return {
        subject: `An update on ${title}`,
        html: layout({
          heading: 'An update on your request',
          footer: FOOTER_OPTIONAL,
          bodyHtml: `<p style="margin:0 0 12px 0;">Thank you for asking to join <strong>${esc(title)}</strong>.</p><p style="margin:0 0 12px 0;">This one is not going to work out this time. That is often about numbers and mix rather than anything about you.</p><p style="margin:0;">There are plenty more events waiting for you.</p>${button(`${ctx.siteUrl}/app`, 'Find another event')}`,
        }),
        text: `Thank you for asking to join ${title}.\n\nThis one is not going to work out this time. That is often about numbers and mix rather than anything about you.\n\nThere are plenty more events waiting for you: ${ctx.siteUrl}/app`,
      }
    case 'still_coming': {
      const url = `${ctx.siteUrl}/reconfirm/${encodeURIComponent(String(d.reconfirm_token ?? ''))}`
      const by = d.reconfirm_by ? when(d.reconfirm_by) : ''
      return {
        subject: `Still coming to ${title}?`,
        html: layout({
          heading: 'Still coming?',
          footer: FOOTER_ESSENTIAL,
          bodyHtml: `<p style="margin:0 0 12px 0;">Your place at <strong>${esc(title)}</strong> is coming up.</p>${info.html}<p style="margin:12px 0 0 0;">Tap once to confirm${by ? ` before ${esc(by)}` : ''}. If we do not hear back, we give your place to someone on the waitlist.</p>${button(url, 'Yes, I am still coming')}<p style="margin:0;color:#5A5A70;">Can no longer make it? You can cancel from My plans in the app so someone else can come.</p>`,
        }),
        text: `Your place at ${title} is coming up.\n${info.text}\n\nConfirm that you are still coming${by ? ` before ${by}` : ''}: ${url}\n\nIf we do not hear back, we give your place to someone on the waitlist. Can no longer make it? Cancel from My plans in the app.`,
      }
    }
    case 'day_of_reminder':
      return {
        subject: `Today: ${title}`,
        html: layout({
          heading: 'See you today',
          footer: FOOTER_OPTIONAL,
          bodyHtml: `<p style="margin:0 0 12px 0;"><strong>${esc(title)}</strong> starts soon.</p>${info.html}<p style="margin:12px 0 0 0;">Open the event in the app for the address and details.</p>${button(eventUrl, 'Open the event')}`,
        }),
        text: `${title} starts soon.\n${info.text}\n\nOpen the event in the app for the address and details: ${eventUrl}`,
      }
    case 'event_cancelled':
      return {
        subject: `Cancelled: ${title}`,
        html: layout({
          heading: 'This event was cancelled',
          footer: FOOTER_ESSENTIAL,
          bodyHtml: `<p style="margin:0 0 12px 0;">We are sorry: <strong>${esc(title)}</strong> has been cancelled.</p>${info.html}<p style="margin:12px 0 0 0;">Nothing is owed and nothing was charged. There are more events waiting for you.</p>${button(`${ctx.siteUrl}/app`, 'Find another event')}`,
        }),
        text: `We are sorry: ${title} has been cancelled.\n${info.text}\n\nNothing is owed and nothing was charged. Find another event: ${ctx.siteUrl}/app`,
      }
    default:
      return null
  }
}
