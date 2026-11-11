import type { AdminHub, AdminService, HostApplication, PendingVerification } from '../types/admin'

let applications: HostApplication[] = [
  { id: 'mock-application-1', userId: 'mock-user-2', firstName: 'Noor', message: 'I run a monthly pottery meetup.', createdAt: '2026-11-10T10:00:00Z' },
]
let hubs: AdminHub[] = []
let pending: PendingVerification[] = [
  { id: 'mock-verification-1', userId: 'mock-user-1', firstName: 'Meera', createdAt: '2026-11-11T10:00:00Z' },
]

export const mockAdmin: AdminService = {
  async listPendingVerifications() {
    return pending
  },
  async getSelfieUrl() {
    return 'about:blank'
  },
  async reviewVerification(id) {
    pending = pending.filter((item) => item.id !== id)
  },
  async listHostApplications() {
    return applications
  },
  async reviewHostApplication(id) {
    applications = applications.filter((item) => item.id !== id)
  },
  async listEvents(status) {
    return status === 'pending_review'
      ? [{ id: 'mock-pending', title: 'Pending sample event', type: 'community', status: 'pending_review', startsAt: new Date().toISOString(), hostFirstName: 'Dev', featuredPosition: null }]
      : [{ id: 'mock-published', title: 'Published sample event', type: 'community', status: 'published', startsAt: new Date().toISOString(), hostFirstName: 'Dev', featuredPosition: 1 }]
  },
  async approveEvent() {},
  async rejectEvent() {},
  async featureEvent() {},
  async unfeatureEvent() {},
  async listHubs() {
    return hubs
  },
  async saveHub(input) {
    return input.id ?? 'mock-hub'
  },
  async setHubEvents() {},
  async deleteHub(id) {
    hubs = hubs.filter((hub) => hub.id !== id)
  },
}
