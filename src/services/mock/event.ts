import { canSeeAddress, HOUSE_PARTY_MAX_GUESTS } from '@/domain/bookings'
import { AREA_PROBLEMS, resolveArea } from '@/domain/places'
import { bengaluruClock, fromBengaluru } from '@/domain/time'

import { ServiceError } from '../errors'
import type { EventService } from '../interfaces'
import type { EventDraft, EventFilters, User, Zone } from '../types'
import { OPEN_CITY } from '../types'

import { getDb, saveDb, type Db, type EventRecord } from './db'
import { notify, notifyAdmins } from './notify'
import { copy, currentUser, invalid, latency, newId, notFound, now, nowIso, requireRole } from './runtime'
import { eventListItem, publicEvent } from './views'

const DAY = 86_400_000

/** Listed events are ones people can still join, so an event leaves the feed once it starts. */
function isUpcoming(event: EventRecord, at: Date): boolean {
  return new Date(event.startsAt).getTime() > at.getTime()
}

function matchesDate(event: EventRecord, filter: EventFilters['date'], at: Date): boolean {
  if (!filter) return true
  // Days are Bengaluru days, so "today" means the same thing on every device.
  const start = new Date(event.startsAt)
  const today = bengaluruClock(at)
  const day = bengaluruClock(start)
  const midnight = fromBengaluru(today.year, today.month, today.day)
  const dayOffset = Math.floor((start.getTime() - midnight.getTime()) / DAY)
  switch (filter) {
    case 'today':
      return dayOffset === 0
    case 'this_week':
      return dayOffset >= 0 && dayOffset < 7
    case 'this_weekend': {
      const isWeekend = day.weekday === 0 || day.weekday === 6
      return isWeekend && dayOffset >= 0 && dayOffset < 7
    }
    case 'this_month':
      return day.year === today.year && day.month === today.month
  }
}

function matches(event: EventRecord, filters: EventFilters, at: Date): boolean {
  if (!matchesDate(event, filters.date, at)) return false
  if (filters.zones?.length && !filters.zones.includes(event.zone)) return false
  if (filters.categories?.length && !filters.categories.includes(event.category)) return false
  if (filters.womenOnly && !event.womenOnly) return false
  if (filters.hubId && event.hubId !== filters.hubId) return false
  if (filters.type && event.type !== filters.type) return false
  if (filters.price) {
    // "Free" means no entry cost: free events, and those where you only pay for what you order.
    const isFree = event.pricing.mode === 'free' || event.pricing.mode === 'pay_at_venue'
    if ((filters.price === 'free') !== isFree) return false
  }
  if (filters.groupSize) {
    const size = event.capacity <= 10 ? 'small' : event.capacity <= 25 ? 'medium' : 'large'
    if (size !== filters.groupSize) return false
  }
  return true
}

function findEvent(db: Db, idOrSlug: string): EventRecord {
  const event = db.events.find((candidate) => candidate.id === idOrSlug || candidate.slug === idOrSlug)
  if (!event) throw notFound('event')
  return event
}

function canManage(event: EventRecord, user: User | null): boolean {
  return Boolean(user && (user.role === 'admin' || event.hostId === user.id))
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function validateDraft(draft: Partial<EventDraft>, complete: boolean): void {
  const need = <K extends keyof EventDraft>(key: K) => complete || draft[key] !== undefined
  if (need('title') && !draft.title?.trim()) throw invalid('Give your event a title.')
  if (need('capacity')) {
    if (!draft.capacity || draft.capacity < 2) throw invalid('An event needs room for at least two guests.')
    if (draft.category === 'house_party' && draft.capacity > HOUSE_PARTY_MAX_GUESTS) {
      throw invalid(`House parties are capped at ${HOUSE_PARTY_MAX_GUESTS} guests.`)
    }
  }
  if (draft.startsAt && draft.endsAt && new Date(draft.endsAt) <= new Date(draft.startsAt)) {
    throw invalid('The end time must be after the start time.')
  }
  if (complete && new Date(draft.startsAt!).getTime() <= now().getTime()) throw invalid('Choose a start time in the future.')
  if (need('exactAddress') && !draft.exactAddress?.trim()) throw invalid('Add the address. Guests only see it once approved.')
  if (need('houseRules') && !draft.houseRules?.length) throw invalid('Add at least one house rule.')
  if (draft.pricing?.mode === 'paid' || draft.pricing?.mode === 'partner_ticket') {
    throw invalid('Community events are free, pay at venue, or cost-split.')
  }
}

export const mockEventService: EventService = {
  async listEvents(filters = {}) {
    await latency()
    const db = getDb()
    const at = now()
    return copy(
      db.events
        .filter((event) => event.status === 'published' && isUpcoming(event, at) && matches(event, filters, at))
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.startsAt.localeCompare(b.startsAt))
        .map((event) => eventListItem(db, event)),
    )
  },

  async getEvent(idOrSlug) {
    await latency()
    const db = getDb()
    const viewer = currentUser(db)
    const event = findEvent(db, idOrSlug)
    const isPublic = event.status === 'published' || event.status === 'completed' || event.status === 'cancelled'
    if (!isPublic && !canManage(event, viewer)) throw notFound('event')

    const booking =
      db.bookings
        .filter((candidate) => candidate.eventId === event.id && candidate.userId === viewer?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
    const squadIds = db.squads.filter((squad) => squad.eventId === event.id).map((squad) => squad.id)
    const membership = db.squadMembers.find(
      (member) => member.userId === viewer?.id && squadIds.includes(member.squadId) && member.status !== 'left' && member.status !== 'declined',
    )
    return copy({
      ...eventListItem(db, event),
      viewer: {
        booking,
        canSeeAddress: canManage(event, viewer) || Boolean(booking && canSeeAddress(booking.status)),
        isHost: Boolean(viewer && event.hostId === viewer.id),
        squadId: membership?.squadId ?? null,
      },
    })
  },

  async getEventAddress(eventId) {
    await latency(0.6)
    const db = getDb()
    const viewer = currentUser(db)
    const event = findEvent(db, eventId)
    const allowed =
      canManage(event, viewer) ||
      db.bookings.some((booking) => booking.eventId === event.id && booking.userId === viewer?.id && canSeeAddress(booking.status))
    if (!allowed) throw new ServiceError('forbidden', 'The address is shared once your booking is approved or paid.')
    return { eventId: event.id, exactAddress: event.exactAddress, directions: event.directions }
  },

  async listSimilarEvents(eventId) {
    await latency()
    const db = getDb()
    const at = now()
    const source = findEvent(db, eventId)
    return copy(
      db.events
        .filter((event) => event.id !== source.id && event.status === 'published' && isUpcoming(event, at))
        .map((event) => ({
          item: eventListItem(db, event),
          score: (event.category === source.category ? 2 : 0) + (event.area === source.area ? 1 : 0) + (event.type === source.type ? 1 : 0),
        }))
        .filter(({ item, score }) => score > 0 && item.spotsLeft > 0)
        .sort((a, b) => b.score - a.score || a.item.startsAt.localeCompare(b.item.startsAt))
        .slice(0, 3)
        .map(({ item }) => item),
    )
  },

  async listHubs() {
    await latency()
    return copy(getDb().hubs)
  },

  async getActiveHub() {
    await latency()
    const db = getDb()
    const at = now()
    // The chosen hub shows only between its dates.
    const hub = db.hubs.find(
      (candidate) => candidate.active && new Date(candidate.startsAt) <= at && at <= new Date(candidate.endsAt),
    )
    if (!hub) return null
    return copy({
      ...hub,
      events: db.events
        .filter((event) => event.hubId === hub.id && event.status === 'published' && isUpcoming(event, at))
        .sort((a, b) => Number(b.featured) - Number(a.featured) || a.startsAt.localeCompare(b.startsAt))
        .map((event) => eventListItem(db, event)),
    })
  },

  async listHostedEvents() {
    await latency()
    const db = getDb()
    const host = requireRole('host', db)
    return copy(
      db.events
        .filter((event) => event.hostId === host.id)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .map((event) => {
          const count = (status: string) =>
            db.bookings.filter((booking) => booking.eventId === event.id && booking.status === status).length
          return { ...eventListItem(db, event), requested: count('requested'), waitlisted: count('waitlisted') }
        }),
    )
  },

  async createEvent(draft) {
    await latency(1.2)
    const db = getDb()
    const host = requireRole('host', db)
    if (host.status !== 'active') throw new ServiceError('forbidden', 'Your account cannot create events right now.')
    validateDraft(draft, true)
    const place = resolveArea(OPEN_CITY, draft.area, draft.zone)
    if (!place.ok) throw invalid(AREA_PROBLEMS[place.problem])

    const id = newId('ev')
    const { exactAddress, directions, ...rest } = draft
    const record: EventRecord = {
      ...rest,
      city: place.city,
      area: place.area,
      zone: place.zone,
      id,
      slug: `${slugify(draft.title)}-${id.slice(-4)}`,
      // Kollide's own events are created by the team. Everything else is a community event.
      type: host.role === 'admin' ? 'kollide' : 'community',
      status: 'pending_review',
      hostId: host.id,
      partner: null,
      hubId: null,
      approvalMode: 'host_approval',
      featured: false,
      createdAt: nowIso(),
      exactAddress: exactAddress.trim(),
      directions: directions?.trim() || null,
      cancelledByKollide: false,
      closedOutAt: null,
    }
    db.events.push(record)
    notifyAdmins(db, 'event_review', 'An event is waiting for approval', record.title, '/admin/events')
    saveDb()
    return copy(publicEvent(record))
  },

  async updateEvent(eventId, patch) {
    await latency()
    const db = getDb()
    const user = requireRole('host', db)
    const event = findEvent(db, eventId)
    if (!canManage(event, user)) throw new ServiceError('forbidden', 'Only the host can change this event.')
    validateDraft({ category: event.category, ...patch }, false)
    let place: { area: string; zone: Zone } | null = null
    if (patch.area !== undefined) {
      const resolved = resolveArea(event.city, patch.area, patch.zone)
      if (!resolved.ok) throw invalid(AREA_PROBLEMS[resolved.problem])
      place = { area: resolved.area, zone: resolved.zone }
    }
    Object.assign(event, patch, place ?? {}, {
      exactAddress: patch.exactAddress?.trim() ?? event.exactAddress,
      directions: patch.directions === undefined ? event.directions : patch.directions?.trim() || null,
    })
    saveDb()
    return copy(publicEvent(event))
  },

  async cancelEvent(eventId) {
    await latency()
    const db = getDb()
    const user = requireRole('host', db)
    const event = findEvent(db, eventId)
    if (!canManage(event, user)) throw new ServiceError('forbidden', 'Only the host can cancel this event.')
    if (event.status === 'cancelled') return copy(publicEvent(event))

    event.status = 'cancelled'
    event.cancelledByKollide = event.type === 'kollide'
    for (const booking of db.bookings.filter((candidate) => candidate.eventId === event.id)) {
      const payment = db.payments.find((candidate) => candidate.id === booking.paymentId)
      if (booking.status === 'paid' && payment) {
        // When Kollide cancels, every payment is refunded in full without anyone asking.
        payment.status = 'refunded'
        booking.status = 'refunded'
        const refundId = newId('rf')
        db.refunds.push({
          id: refundId,
          paymentId: payment.id,
          bookingId: booking.id,
          userId: booking.userId,
          kind: 'cancelled_by_kollide',
          amountInr: payment.amountInr + payment.creditAppliedInr,
          createdAt: nowIso(),
        })
        // Any credit that was used comes back as credit.
        if (payment.creditAppliedInr > 0) {
          db.credits.push({
            id: newId('cr'),
            userId: booking.userId,
            amountInr: payment.creditAppliedInr,
            reason: `Credit you used on “${event.title}”, returned`,
            refundId,
            createdAt: nowIso(),
            usedAt: null,
          })
        }
        notify(db, booking.userId, 'refund', `${event.title} was cancelled`, 'Everything you paid is coming back to you in full.', '/app/plans')
      } else if (['requested', 'approved', 'waitlisted', 'confirmed', 'pending_payment'].includes(booking.status)) {
        booking.status = 'cancelled'
        notify(db, booking.userId, 'account', `${event.title} was cancelled`, 'The host had to cancel. Here are similar events.', '/app')
      }
      booking.updatedAt = nowIso()
    }
    saveDb()
    return copy(publicEvent(event))
  },
}
