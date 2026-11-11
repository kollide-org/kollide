export interface BrevoMessage {
  fromEmail: string
  fromName: string
  to: string
  subject: string
  html: string
  text: string
}

export type BrevoResult = { ok: true; messageId: string } | { ok: false; retry: boolean; error: string }

/**
 * Sends one transactional email through Brevo's API. Server errors, rate limits and network failures can be
 * retried; other client errors (a bad address, a bad key) cannot.
 */
export async function sendBrevo(apiKey: string, message: BrevoMessage): Promise<BrevoResult> {
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { name: message.fromName, email: message.fromEmail },
        to: [{ email: message.to }],
        subject: message.subject,
        htmlContent: message.html,
        textContent: message.text,
      }),
    })
    if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { messageId?: string }
      return { ok: true, messageId: body.messageId ?? '' }
    }
    return { ok: false, retry: res.status === 429 || res.status >= 500, error: `Brevo answered ${res.status}` }
  } catch {
    return { ok: false, retry: true, error: 'Network error talking to Brevo' }
  }
}
