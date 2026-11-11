import { registerLocalImage } from '@/lib/media'

import type { UploadService } from '../types/upload'

export const mockUpload: UploadService = {
  async upload(purpose, image) {
    const key = `mock/${purpose}-${crypto.randomUUID()}.webp`
    registerLocalImage(key, image)
    return key
  },
}
