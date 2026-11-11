import { ImageError, compressToWebp } from '@/lib/image'
import { ServiceError, services, type UploadPurpose } from '@/services'

/** Picked file in, stored key out: strips hidden data and shrinks to WebP, then uploads. */
export async function uploadImage(file: File, purpose: UploadPurpose): Promise<string> {
  let image: Blob
  try {
    image = await compressToWebp(file)
  } catch (error) {
    if (error instanceof ImageError) throw new ServiceError(error.code)
    throw error
  }
  return services.upload.upload(purpose, image)
}
