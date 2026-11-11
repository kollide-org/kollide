import { ServiceError } from '../types/errors'
import type { UploadService } from '../types/upload'
import { api } from './api'

interface SignResponse {
  url: string
  key: string
  headers: Record<string, string>
}

export const realUpload: UploadService = {
  async upload(purpose, image, options) {
    const signed = await api<SignResponse>('/uploads/sign', {
      method: 'POST',
      body: JSON.stringify({ purpose, contentType: image.type, size: image.size, eventId: options?.eventId }),
    })
    // The link is signed for exactly this type and size. The browser adds Content-Length itself.
    const res = await fetch(signed.url, { method: 'PUT', headers: signed.headers, body: image })
    if (!res.ok) throw new ServiceError('upload_failed')
    return signed.key
  },
}
