/** Escapes text before it goes into an HTML email. All user-written text (event titles, names) goes through this. */
export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const INDIGO = '#3B3B98'
const MARIGOLD = '#F2A93B'
const CREAM = '#FBF7F0'

export function button(url: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${esc(url)}" style="display:inline-block;background:${INDIGO};color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 24px;border-radius:12px;border-bottom:4px solid ${MARIGOLD};">${esc(label)}</a></p>`
}

/** The shared frame: indigo wordmark, a white card on cream, and a small footer. */
export function layout(opts: { heading: string; bodyHtml: string; footer: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:${CREAM};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
<tr><td style="padding:0 0 20px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:bold;color:${INDIGO};">Kollide</td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E8DFCF;border-radius:16px;padding:32px 28px;font-family:Helvetica,Arial,sans-serif;color:#2A2A3C;font-size:16px;line-height:24px;">
<h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:30px;color:${INDIGO};">${esc(opts.heading)}</h1>
${opts.bodyHtml}
</td></tr>
<tr><td style="padding:20px 8px 0 8px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#8A8AA0;text-align:center;">${esc(opts.footer)}<br>Kollide &middot; Social events in Bengaluru</td></tr>
</table></td></tr></table></body></html>`
}
