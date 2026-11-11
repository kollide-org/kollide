import { AwsClient } from 'aws4fetch'

import type { Env } from '../env'

export const URL_LIFETIME_SECONDS = 300 // 5 minutes

type PresignEnv = Pick<Env, 'R2_ACCOUNT_ID' | 'R2_ACCESS_KEY_ID' | 'R2_SECRET_ACCESS_KEY'>

/**
 * A presigned R2 link (S3 compatible), valid for 5 minutes. For uploads the content type and size are part
 * of the signature, so R2 itself refuses a different type or size.
 */
export async function presign(
  env: PresignEnv,
  method: 'PUT' | 'GET',
  bucket: string,
  key: string,
  headers: Record<string, string> = {},
): Promise<string> {
  const client = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })
  const url = new URL(`https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${bucket}/${key}`)
  url.searchParams.set('X-Amz-Expires', String(URL_LIFETIME_SECONDS))
  const signed = await client.sign(new Request(url, { method, headers }), { aws: { signQuery: true, allHeaders: true } })
  return signed.url
}
