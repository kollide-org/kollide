export type UploadPurpose = 'profile_photo' | 'selfie' | 'event_cover' | 'hub_art'

export interface UploadService {
  /**
   * Uploads an already-prepared WebP image and returns its key. The server decides whether this
   * person may upload, and the key must then be attached with a profile function (or onboarding).
   * Event covers need the event's id.
   */
  upload(purpose: UploadPurpose, image: Blob, options?: { eventId?: string }): Promise<string>
}
