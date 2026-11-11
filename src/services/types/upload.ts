export type UploadPurpose = 'profile_photo' | 'selfie'

export interface UploadService {
  /**
   * Uploads an already-prepared WebP image and returns its key. The server decides whether this
   * person may upload, and the key must then be attached with a profile function (or onboarding).
   */
  upload(purpose: UploadPurpose, image: Blob): Promise<string>
}
