# Email deliverability: the DNS records

Two sending domains, kept apart on purpose so trouble with one cannot hurt the other:

| Subdomain | Provider | Sends | Cap |
|---|---|---|---|
| `auth.<domain>` | **Resend** (as Supabase Auth's SMTP) | 6-digit sign-in codes | 100 a day |
| `mail.<domain>` | **Brevo** (called by the Worker) | everything else | 300 a day (we stop at 280) |

## The records you need
The **exact names and values are different for every account**, so copy them from the provider and paste them into Cloudflare DNS
(**DNS only / grey cloud**, never proxied). This page tells you what to expect and where each one comes from.

### `auth.<domain>`: Resend dashboard → Domains → Add `auth.<domain>`
| Type | Name (as Resend shows it) | Value | Purpose |
|---|---|---|---|
| TXT | `resend._domainkey.auth` | `p=MIGf…` (a long public key Resend gives you) | **DKIM** |
| MX | `send.auth` | `feedback-smtp.<region>.amazonses.com` priority 10 | bounces |
| TXT | `send.auth` | `v=spf1 include:amazonses.com ~all` | **SPF** |
| TXT | `_dmarc.auth` | `v=DMARC1; p=none; rua=mailto:<your address>` | **DMARC** (you add this one) |

### `mail.<domain>`: Brevo → Senders, Domains & Dedicated IPs → Domains → Add `mail.<domain>`
| Type | Name (as Brevo shows it) | Value | Purpose |
|---|---|---|---|
| TXT | `mail` | `brevo-code:<hash>` | proves you own the domain |
| CNAME | `brevo1._domainkey.mail` | `b1.mail-<yourdomain>.dkim.brevo.com` | **DKIM** |
| CNAME | `brevo2._domainkey.mail` | `b2.mail-<yourdomain>.dkim.brevo.com` | **DKIM** (second key) |
| TXT | `mail` | `v=spf1 include:spf.brevo.com ~all` (only if Brevo asks for it; keep one SPF record per name) | **SPF** |
| TXT | `_dmarc.mail` | `v=DMARC1; p=none; rua=mailto:<your address>` | **DMARC** (you add this one) |

Rules that trip people up:
- **One SPF record per name.** If a name already has `v=spf1 …`, add the provider's `include:` to it; do not add a second record.
- Cloudflare shows names relative to your domain: enter `resend._domainkey.auth`, not the full name.
- The DMARC `rua` address receives daily reports: use a mailbox you read (or a free DMARC report service).
- Start with `p=none` (monitor). After **two clean weeks** (reports show only your own mail passing), change to `p=quarantine`, later `p=reject`.

## Check it
1. Wait for DNS (usually minutes, up to an hour), then click **Verify** in Resend and Brevo until both say Verified.
2. Run the checker for both sending hosts:
   ```bash
   npm run check:dns -- auth.<domain> mail.<domain>
   ```
   Every line should say PASS (SPF, DKIM, DMARC). It looks up the records over DNS-over-HTTPS from anywhere.
3. **Send a real test** to a Gmail address you own, open it, **⋮ → Show original**, and read the top: you want
   `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS` for the sending domain. A sign-in code email proves `auth.<domain>`; a booking email (staging allow-list aside) proves `mail.<domain>`.
4. Optional second opinion: send to the address shown at https://www.mail-tester.com and aim for 9 or 10 out of 10.

If DKIM or SPF fail in the headers while the DNS check passes, the provider is signing with a different domain than the one in the From address: the From address must be on the verified subdomain (`auth@auth.<domain>`, `mail@mail.<domain>`) and the Worker's `EMAIL_FROM` must match.
