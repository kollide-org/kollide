// Fails if the built frontend (dist/) contains anything that must never reach a browser: a service-role key, or the name of a
// server-side secret. Run after `npm run build` (CI does), and by hand on the production build before launch.
//   node scripts/check-bundle-secrets.mjs [dir]
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const dir = process.argv[2] ?? 'dist'
const FORBIDDEN_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'service_role_key', 'BREVO_API_KEY', 'R2_SECRET_ACCESS_KEY', 'R2_ACCESS_KEY_ID', 'JOB_SHARED_SECRET', 'POSTHOG_API_KEY', 'BACKUP_PASSPHRASE', 'BACKUP_DB_URL']
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
const SECRET_KEY_PREFIX = /sb_secret_[A-Za-z0-9_-]{10,}/g

function files(root) {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'))
    return typeof payload.role === 'string' ? payload.role : null
  } catch {
    return null
  }
}

let scanned = 0
const problems = []
for (const file of files(dir)) {
  if (!/\.(js|mjs|css|html|json|map|txt|webmanifest|svg)$/.test(file) && !file.endsWith('_headers')) continue
  const text = readFileSync(file, 'utf8')
  scanned++
  for (const token of text.match(JWT) ?? []) {
    const role = jwtRole(token)
    if (role === 'service_role') problems.push(`${file}: a service_role key`)
  }
  if (SECRET_KEY_PREFIX.test(text)) problems.push(`${file}: a Supabase secret key (sb_secret_…)`)
  SECRET_KEY_PREFIX.lastIndex = 0
  for (const name of FORBIDDEN_NAMES) if (text.includes(name)) problems.push(`${file}: the secret name ${name}`)
}

if (scanned === 0) {
  console.error(`[secrets] nothing to scan in ${dir}. Run npm run build first.`)
  process.exit(2)
}
if (problems.length > 0) {
  console.error(`[secrets] FAILED, ${problems.length} problem(s) in ${scanned} files:\n  ${[...new Set(problems)].join('\n  ')}`)
  process.exit(1)
}
console.log(`[secrets] OK: ${scanned} files in ${dir} contain no service-role key and no server secret names.`)
