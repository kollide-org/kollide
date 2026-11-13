import { holdsPlace, spotsLeft } from '@/domain/bookings'
import { buildReputation } from '@/domain/reliability'
import { isReviewRevealed, topTags } from '@/domain/reviews'
import { ageFromDateOfBirth } from '@/domain/time'

import type {
  EventListItem,
  HostRatingSummary,
  HostSummary,
  ID,
  PersonPreview,
  Profile,
  ProfileCard,
  Reputation,
  SharedEvent,
  TagReview,
} from '../types'

import type { Db, EventRecord } from './db'
import { notFound } from './runtime'

/**
 * Builders for everything a service returns that is calculated rather than
 * stored. Reliability, tag counts, spots left and ratings all come from here,
 * always worked out from source records.
 */

export function profileOf(db: Db, userId: ID, at: Date): Profile {
  const record = db.profiles.find((profile) => profile.userId === userId)
  const user = db.users.find((candidate) => candidate.id === userId)
  if (!record || !user) throw notFound('profile')
  return { ...record, age: user.dateOfBirth ? ageFromDateOfBirth(user.dateOfBirth, at) : 18 }
}

export function personPreview(db: Db, userId: ID): PersonPreview {
  const record = db.profiles.find((profile) => profile.userId === userId)
  return {
    userId,
    firstName: record?.firstName ?? 'Member',
    photoUrl: record?.photos.find((photo) => photo.position === 0)?.url ?? record?.photos[0]?.url ?? null,
    verified: record?.verification.status === 'verified',
  }
}

function eventEndsAt(db: Db, eventId: ID): string {
  return db.events.find((event) => event.id === eventId)?.endsAt ?? new Date(0).toISOString()
}

/** Reviews about a person that have passed the double-blind rule. */
export function revealedReviewsAbout(db: Db, userId: ID, at: Date): TagReview[] {
  return db.tagReviews.filter(
    (review) => review.subjectId === userId && isReviewRevealed(review, db.tagReviews, eventEndsAt(db, review.eventId), at),
  )
}

export function reputationOf(db: Db, userId: ID, at: Date): Reputation {
  const statuses = db.bookings.filter((booking) => booking.userId === userId).map((booking) => booking.status)
  return buildReputation(statuses, topTags(revealedReviewsAbout(db, userId, at)))
}

export function hostRatingSummary(db: Db, hostId: ID): HostRatingSummary | null {
  const ratings = db.hostRatings.filter((rating) => rating.hostId === hostId)
  if (ratings.length === 0) return null
  const share = (pick: (rating: (typeof ratings)[number]) => boolean) =>
    Math.round((ratings.filter(pick).length / ratings.length) * 100) / 100
  return {
    ratings: ratings.length,
    asDescribed: share((rating) => rating.asDescribed),
    feltSafe: share((rating) => rating.feltSafe),
    wellOrganised: share((rating) => rating.wellOrganised),
  }
}

export function hostSummary(db: Db, hostId: ID): HostSummary {
  return {
    ...personPreview(db, hostId),
    eventsHosted: db.events.filter(
      (event) => event.hostId === hostId && (event.status === 'published' || event.status === 'completed'),
    ).length,
    rating: hostRatingSummary(db, hostId),
  }
}

/** Events both people checked in to. */
export function eventsInCommon(db: Db, userId: ID, viewerId: ID | null): SharedEvent[] {
  if (!viewerId || viewerId === userId) return []
  const mine = new Set(db.checkIns.filter((checkIn) => checkIn.userId === viewerId).map((checkIn) => checkIn.eventId))
  return db.checkIns
    .filter((checkIn) => checkIn.userId === userId && mine.has(checkIn.eventId))
    .map((checkIn) => db.events.find((event) => event.id === checkIn.eventId))
    .filter((event): event is EventRecord => Boolean(event))
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((event) => ({ eventId: event.id, title: event.title }))
}

export function profileCard(db: Db, userId: ID, viewerId: ID | null, at: Date): ProfileCard {
  const user = db.users.find((candidate) => candidate.id === userId)
  if (!user) throw notFound('profile')
  const isHost = db.hosts.some((host) => host.userId === userId && host.status === 'approved')
  return {
    ...profileOf(db, userId, at),
    reputation: reputationOf(db, userId, at),
    eventsInCommon: eventsInCommon(db, userId, viewerId),
    host: isHost ? hostSummary(db, userId) : null,
    onHold: user.status === 'on_hold',
  }
}

/** Removes the private fields, so an address can never leak through an event. */
export function publicEvent(record: EventRecord) {
  const { exactAddress: _address, directions: _directions, cancelledByKollide: _cancelled, ...event } = record
  return event
}

export function squadSpotsLeft(db: Db, squadId: ID): number {
  const squad = db.squads.find((candidate) => candidate.id === squadId)
  if (!squad) return 0
  const approved = db.squadMembers.filter((member) => member.squadId === squadId && member.status === 'approved').length
  return Math.max(0, squad.size - approved)
}

export function eventListItem(db: Db, record: EventRecord): EventListItem {
  const holding = db.bookings.filter((booking) => booking.eventId === record.id && holdsPlace(booking.status))
  const squads = db.squads.filter((squad) => squad.eventId === record.id)
  const squadPeople = db.squadMembers
    .filter((member) => member.status === 'approved' && squads.some((squad) => squad.id === member.squadId))
    .map((member) => member.userId)

  // Partner tickets are bought elsewhere, so the people we know about are those in squads.
  const goingIds = [...new Set([...holding.map((booking) => booking.userId), ...squadPeople])]
  const attendeePreview = goingIds
    .map((userId) => personPreview(db, userId))
    .filter((person) => person.verified)
    .slice(0, 5)

  return {
    ...publicEvent(record),
    spotsLeft: spotsLeft(record.capacity, holding.length),
    goingCount: goingIds.length,
    host: record.hostId ? hostSummary(db, record.hostId) : null,
    attendeePreview,
    squadsForming: squads.filter((squad) => squadSpotsLeft(db, squad.id) > 0).length,
  }
}
