// Checks that a sending domain is set up for email: SPF, DKIM and DMARC. Uses DNS over HTTPS (Cloudflare), so it works anywhere.
//   node scripts/check-dns.mjs auth.example.com mail.example.com
// Pass the SENDING hostnames (auth.<domain> for Resend, mail.<domain> for Brevo). Exit code 1 if anything is missing.
// The exact record values come from the Resend and Brevo dashboards (see docs/backend/EMAIL_DNS.md); this only proves they are live.
const hosts = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (hosts.length === 0) {
  console.error('Usage: node scripts/check-dns.mjs <sending host> [more hosts]   e.g. auth.example.com mail.example.com')
  process.exit(2)
}

async function lookup(name, type) {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, { headers: { accept: 'application/dns-json' } })
  if (!res.ok) throw new Error(`DNS lookup failed for ${type} ${name}: ${res.status}`)
  const json = await res.json()
  return (json.Answer ?? []).filter((a) => a.type === { TXT: 16, CNAME: 5, MX: 15 }[type]).map((a) => a.data.replace(/^"|"$/g, '').replace(/"\s+"/g, ''))
}

// Selectors the two providers use. Resend: "resend"; Brevo: "brevo1" and "brevo2" (CNAMEs); a few common ones for other setups.
const DKIM_SELECTORS = ['resend', 'brevo1', 'brevo2', 'mail', 'default', 's1', 's2', 'google', 'k1']
const parent = (host) => host.split('.').slice(1).join('.')

let failed = false
const line = (ok, text) => console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${text}`)

for (const host of hosts) {
  console.log(`\n${host}`)
  // SPF: on the host itself, or on send.<host> (Resend puts its SPF and bounce MX there), or inherited from the parent.
  let spf = null
  for (const name of [host, `send.${host}`, parent(host)]) {
    const found = (await lookup(name, 'TXT')).find((t) => t.toLowerCase().startsWith('v=spf1'))
    if (found) { spf = { name, value: found }; break }
  }
  line(Boolean(spf), spf ? `SPF at ${spf.name}: ${spf.value}` : 'SPF: no v=spf1 TXT record on the host, send.<host> or its parent')
  if (spf && !/(~all|-all)\s*$/.test(spf.value)) { console.log('        note: the SPF record does not end in ~all or -all'); }
  if (!spf) failed = true

  const dkim = []
  for (const sel of DKIM_SELECTORS) {
    const name = `${sel}._domainkey.${host}`
    const txt = (await lookup(name, 'TXT')).find((t) => /v=DKIM1|p=/.test(t))
    const cname = (await lookup(name, 'CNAME'))[0]
    if (txt || cname) dkim.push(`${sel} (${txt ? 'TXT' : 'CNAME'})`)
  }
  line(dkim.length > 0, dkim.length ? `DKIM selectors found: ${dkim.join(', ')}` : 'DKIM: none of the usual selectors (resend, brevo1, brevo2, ...) has a record. Copy them from the provider dashboard')
  if (dkim.length === 0) failed = true

  let dmarc = null
  for (const name of [`_dmarc.${host}`, `_dmarc.${parent(host)}`]) {
    const found = (await lookup(name, 'TXT')).find((t) => t.toUpperCase().startsWith('V=DMARC1'))
    if (found) { dmarc = { name, value: found }; break }
  }
  line(Boolean(dmarc), dmarc ? `DMARC at ${dmarc.name}: ${dmarc.value}` : 'DMARC: no v=DMARC1 record at _dmarc.<host> or _dmarc.<parent>')
  if (dmarc) {
    const policy = dmarc.value.match(/;\s*p=(\w+)/i)?.[1]?.toLowerCase()
    console.log(`        policy p=${policy}${policy === 'none' ? ' (monitoring only: move to quarantine after two clean weeks)' : ''}`)
  } else failed = true
}

console.log(failed ? '\nFAILED: fix the records marked FAIL, wait for DNS to update, run again.' : '\nOK: SPF, DKIM and DMARC are present on every host. Now send a test email and check the headers say spf=pass dkim=pass dmarc=pass.')
process.exit(failed ? 1 : 0)
