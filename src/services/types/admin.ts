export interface PendingVerification {
  id: string
  userId: string
  firstName: string | null
  createdAt: string
}

export interface AdminService {
  listPendingVerifications(): Promise<PendingVerification[]>
  /** A link that works for 5 minutes. */
  getSelfieUrl(verificationId: string): Promise<string>
  /** Approving verifies the person. Either way the selfie is deleted. */
  reviewVerification(verificationId: string, approved: boolean): Promise<void>
}
