import { findCollusionGroups } from '@/domain/collusion'

import { ServiceError } from '../errors'
import type { AdminService } from '../interfaces'
import type { Hub, HubInput, ID, PartnerLink } from '../types'

import { getDb, saveDb, type Db, type EventRecord } from './db'
import { notify } from './notify'
import { copy, invalid, latency, newId, notFound, now, nowIso, requireRole } from './runtime'
import { personPreview, publicEvent, reputationOf } from './views'

function eventOf(db: Db, eventId: ID): EventRecord {
  const event = db.events.find((candidate) => candidate.id === eventId)
  if (!event) throw notFound('event')
  return event
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function partnerLink(event: EventRecord): PartnerLink {
  return {
    eventId: event.id,
    eventTitle: event.title,
    partnerName: event.partner?.name ?? '',
    ticketUrl: event.partner?.ticketUrl ?? '',
    startsAt: event.startsAt,
  }
}

function validateHub(input: Partial<HubInput>, complete: boolean): void {
  if ((complete || input.title !== undefined) && !input.title?.trim()) throw invalid('Give the hub a title.')
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw invalid('The hub must end after it starts.')
  }
}

function assignHubEvents(db: Db, hubId: ID, eventIds: ID[]): void {
  for (const event of db.events) {
    if (eventIds.includes(event.id)) event.hubId = hubId
    else if (event.hubId === hubId) event.hubId = null
  }
}

/** A hold ends once no open report names the person any more. */
function releaseHoldIfClear(db: Db, userId: ID): void {
  const user = db.users.find((candidate) => candidate.id === userId)
  const stillOpen = db.safetyReports.some(
    (report) => report.subjectType === 'user' && report.subjectId === userId && (report.status === 'open' || report.status === 'reviewing'),
  )
  if (user?.status === 'on_hold' && !stillOpen) user.status = 'active'
}

export const mockAdminService: AdminService = {
  async listHostApplications() {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    const at = now()
    return copy(
      db.hosts
        .filter((host) => host.status === 'pending')
        .sort((a, b) => a.appliedAt.localeCompare(b.appliedAt))
        .map((host) => ({ host, applicant: personPreview(db, host.userId), reputation: reputationOf(db, host.userId, at) })),
    )
  },

  async decideHostApplication(userId, decision) {
    await latency(0.7)
    const db = getDb()
    requireRole('admin', db)
    const host = db.hosts.find((candidate) => candidate.userId === userId)
    const user = db.users.find((candidate) => candidate.id === userId)
    if (!host || !user) throw notFound('application')
    if (host.status !== 'pending') throw new ServiceError('conflict', 'This application has already been decided.')
    host.status = decision === 'approve' ? 'approved' : 'declined'
    host.decidedAt = nowIso()
    if (decision === 'approve') {
      if (user.role === 'member') user.role = 'host'
      notify(db, userId, 'host_application', 'You can now host on Kollide', 'Create your first event whenever you’re ready.', '/app/host')
    } else {
      notify(db, userId, 'host_application', 'About your host application', 'We can’t approve it just yet. You’re welcome to apply again later.', null)
    }
    saveDb()
    return copy(host)
  },

  async listEventsForReview() {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    return copy(
      db.events
        .filter((event) => event.status === 'pending_review')
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((event) => ({ event: publicEvent(event), host: event.hostId ? personPreview(db, event.hostId) : null })),
    )
  },

  async decideEvent(eventId, decision) {
    await latency(0.7)
    const db = getDb()
    requireRole('admin', db)
    const event = eventOf(db, eventId)
    if (event.status !== 'pending_review') throw new ServiceError('conflict', 'This event has already been reviewed.')
    event.status = decision === 'approve' ? 'published' : 'declined'
    if (event.hostId) {
      notify(
        db,
        event.hostId,
        'event_review',
        decision === 'approve' ? 'Your event is live' : 'Your event needs changes',
        event.title,
        '/app/host',
      )
    }
    saveDb()
    return copy(publicEvent(event))
  },

  async setEventFeatured(eventId, featured) {
    await latency(0.5)
    const db = getDb()
    requireRole('admin', db)
    const event = eventOf(db, eventId)
    event.featured = featured
    saveDb()
    return copy(publicEvent(event))
  },

  async createHub(input) {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    validateHub(input, true)
    const { eventIds, ...fields } = input
    const id = newId('hub')
    const hub: Hub = { ...fields, id, slug: `${slugify(input.title)}-${id.slice(-4)}`, active: false }
    db.hubs.push(hub)
    assignHubEvents(db, hub.id, eventIds)
    saveDb()
    return copy(hub)
  },

  async updateHub(hubId, patch) {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    const hub = db.hubs.find((candidate) => candidate.id === hubId)
    if (!hub) throw notFound('hub')
    validateHub({ startsAt: hub.startsAt, endsAt: hub.endsAt, ...patch }, false)
    const { eventIds, ...fields } = patch
    Object.assign(hub, fields)
    if (eventIds) assignHubEvents(db, hub.id, eventIds)
    saveDb()
    return copy(hub)
  },

  async setActiveHub(hubId) {
    await latency(0.5)
    const db = getDb()
    requireRole('admin', db)
    if (hubId && !db.hubs.some((hub) => hub.id === hubId)) throw notFound('hub')
    for (const hub of db.hubs) hub.active = hub.id === hubId
    saveDb()
    return copy(db.hubs)
  },

  async listReports() {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    const order = { open: 0, reviewing: 1, resolved: 2, dismissed: 3 }
    return copy(
      db.safetyReports
        .slice()
        .sort((a, b) => order[a.status] - order[b.status] || b.createdAt.localeCompare(a.createdAt))
        .map((report) => ({
          report,
          reporter: personPreview(db, report.reporterId),
          subjectPerson: report.subjectType === 'user' ? personPreview(db, report.subjectId) : null,
          subjectEventTitle:
            db.events.find((event) => event.id === (report.subjectType === 'event' ? report.subjectId : report.eventId))?.title ?? null,
          otherReportsAboutSubject: db.safetyReports.filter(
            (other) => other.id !== report.id && other.subjectType === report.subjectType && other.subjectId === report.subjectId,
          ).length,
        })),
    )
  },

  async updateReport(reportId, change) {
    await latency(0.7)
    const db = getDb()
    requireRole('admin', db)
    const report = db.safetyReports.find((candidate) => candidate.id === reportId)
    if (!report) throw notFound('report')
    const closing = change.status === 'resolved' || change.status === 'dismissed'
    if (closing && !change.resolution?.trim() && !report.resolution) throw invalid('Add a note on how this was handled.')
    report.status = change.status
    report.resolution = change.resolution?.trim() || report.resolution
    report.resolvedAt = closing ? nowIso() : null
    if (report.subjectType === 'user') releaseHoldIfClear(db, report.subjectId)
    saveDb()
    return copy(report)
  },

  async listUsers(search) {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    const at = now()
    const term = search?.trim().toLowerCase()
    return copy(
      db.users
        .filter((user) => db.profiles.some((profile) => profile.userId === user.id))
        .map((user) => ({
          user: { id: user.id, role: user.role, status: user.status, email: user.email, createdAt: user.createdAt },
          person: personPreview(db, user.id),
          reputation: reputationOf(db, user.id, at),
          openReports: db.safetyReports.filter(
            (report) => report.subjectType === 'user' && report.subjectId === user.id && (report.status === 'open' || report.status === 'reviewing'),
          ).length,
        }))
        .filter((row) => !term || row.person.firstName.toLowerCase().includes(term) || row.user.email.includes(term))
        .sort((a, b) => b.openReports - a.openReports || a.person.firstName.localeCompare(b.person.firstName)),
    )
  },

  async setUserStatus(userId, status, reason) {
    await latency(0.7)
    const db = getDb()
    const admin = requireRole('admin', db)
    const user = db.users.find((candidate) => candidate.id === userId)
    if (!user) throw notFound('user')
    if (user.id === admin.id) throw invalid('You cannot change your own account’s status.')
    if (status !== 'active' && reason.trim().length < 5) throw invalid('Add a short reason. The member can appeal, and will be shown it.')
    user.status = status
    const titles = {
      active: 'Your account is active again',
      on_hold: 'Your account is on hold',
      suspended: 'Your account is suspended',
      banned: 'Your account has been closed',
    }
    notify(db, user.id, 'account', titles[status], reason.trim() || 'Thank you for your patience.', '/app/settings')
    saveDb()
    return copy(user)
  },

  async decideVerification(userId, decision) {
    await latency(0.7)
    const db = getDb()
    requireRole('admin', db)
    const profile = db.profiles.find((candidate) => candidate.userId === userId)
    if (!profile) throw notFound('profile')
    profile.verification = {
      status: decision === 'verify' ? 'verified' : 'rejected',
      submittedAt: profile.verification.submittedAt,
      reviewedAt: nowIso(),
    }
    saveDb()
  },

  async listAppeals() {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    return copy(
      db.appeals
        .slice()
        .sort((a, b) => Number(a.status !== 'under_review') - Number(b.status !== 'under_review') || b.createdAt.localeCompare(a.createdAt))
        .map((appeal) => ({ appeal, person: personPreview(db, appeal.userId) })),
    )
  },

  async decideAppeal(appealId, decision) {
    await latency(0.7)
    const db = getDb()
    requireRole('admin', db)
    const appeal = db.appeals.find((candidate) => candidate.id === appealId)
    if (!appeal) throw notFound('appeal')
    if (appeal.status !== 'under_review') throw new ServiceError('conflict', 'This appeal has already been decided.')
    appeal.status = decision
    appeal.decidedAt = nowIso()
    const user = db.users.find((candidate) => candidate.id === appeal.userId)
    if (decision === 'overturned' && appeal.about === 'suspension' && user?.status === 'suspended') user.status = 'active'
    notify(
      db,
      appeal.userId,
      'account',
      decision === 'overturned' ? 'Your appeal was successful' : 'About your appeal',
      decision === 'overturned' ? 'We have reversed the decision.' : 'We looked again and the decision stands.',
      '/app/settings',
    )
    saveDb()
    return copy(appeal)
  },

  async listCollusionFlags() {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    return copy(
      findCollusionGroups(db.tagReviews).map((group) => ({
        people: group.userIds.map((userId) => personPreview(db, userId)),
        reviewsBetweenThem: group.reviewCount,
        eventIds: group.eventIds,
      })),
    )
  },

  async listPartnerLinks() {
    await latency()
    const db = getDb()
    requireRole('admin', db)
    return copy(
      db.events
        .filter((event) => event.type === 'partner' && event.partner)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map(partnerLink),
    )
  },

  async updatePartnerLink(eventId, ticketUrl) {
    await latency(0.7)
    const db = getDb()
    requireRole('admin', db)
    const event = eventOf(db, eventId)
    if (!event.partner) throw invalid('This is not a partner event.')
    let url: URL
    try {
      url = new URL(ticketUrl.trim())
    } catch {
      throw invalid('Enter a full link, starting with https://.')
    }
    if (url.protocol !== 'https:') throw invalid('Ticket links must start with https://.')
    event.partner.ticketUrl = url.toString()
    saveDb()
    return copy(partnerLink(event))
  },
}
