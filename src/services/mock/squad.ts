import { ServiceError } from '../errors'
import type { SquadService } from '../interfaces'
import { SQUAD_MAX_SIZE, SQUAD_MIN_SIZE } from '../types'
import type { ID, Squad, SquadWithMembers } from '../types'

import { getDb, saveDb, type Db } from './db'
import { notify } from './notify'
import { copy, currentUser, invalid, latency, newId, notFound, now, nowIso, requireActiveMember, requireUser } from './runtime'
import { personPreview, squadSpotsLeft } from './views'

function squadOf(db: Db, squadId: ID): Squad {
  const squad = db.squads.find((candidate) => candidate.id === squadId)
  if (!squad) throw notFound('squad')
  return squad
}

function isUpcoming(db: Db, squad: Squad, at: Date): boolean {
  const event = db.events.find((candidate) => candidate.id === squad.eventId)
  return Boolean(event && event.status === 'published' && new Date(event.startsAt) > at)
}

function squadView(db: Db, squad: Squad, viewerId: ID | null): SquadWithMembers {
  const event = db.events.find((candidate) => candidate.id === squad.eventId)
  if (!event) throw notFound('event')
  const records = db.squadMembers.filter((member) => member.squadId === squad.id)
  const viewerIsCreator = viewerId === squad.creatorId
  return {
    ...squad,
    event: { id: event.id, slug: event.slug, title: event.title, startsAt: event.startsAt, area: event.area, coverUrl: event.coverUrl },
    members: records
      .filter((member) => member.status === 'approved')
      .sort((a, b) => Number(b.role === 'creator') - Number(a.role === 'creator') || a.requestedAt.localeCompare(b.requestedAt))
      .map((member) => personPreview(db, member.userId)),
    // Only the creator sees who is waiting.
    pendingRequests: viewerIsCreator
      ? records.filter((member) => member.status === 'requested').map((member) => personPreview(db, member.userId))
      : [],
    spotsLeft: squadSpotsLeft(db, squad.id),
    viewerStatus: records.find((member) => member.userId === viewerId && member.status !== 'left')?.status ?? null,
    viewerIsCreator,
  }
}

function byEventDate(db: Db) {
  const startOf = (squad: Squad) => db.events.find((event) => event.id === squad.eventId)?.startsAt ?? ''
  return (a: Squad, b: Squad) => startOf(a).localeCompare(startOf(b))
}

export const mockSquadService: SquadService = {
  async listSquadsForming() {
    await latency()
    const db = getDb()
    const at = now()
    const viewerId = currentUser(db)?.id ?? null
    return copy(
      db.squads
        .filter((squad) => isUpcoming(db, squad, at) && squadSpotsLeft(db, squad.id) > 0)
        .sort(byEventDate(db))
        .map((squad) => squadView(db, squad, viewerId)),
    )
  },

  async listSquadsForEvent(eventId) {
    await latency()
    const db = getDb()
    const viewerId = currentUser(db)?.id ?? null
    return copy(db.squads.filter((squad) => squad.eventId === eventId).map((squad) => squadView(db, squad, viewerId)))
  },

  async listMySquads() {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const mine = new Set(
      db.squadMembers
        .filter((member) => member.userId === user.id && (member.status === 'approved' || member.status === 'requested'))
        .map((member) => member.squadId),
    )
    return copy(db.squads.filter((squad) => mine.has(squad.id)).sort(byEventDate(db)).map((squad) => squadView(db, squad, user.id)))
  },

  async getSquad(squadId) {
    await latency()
    const db = getDb()
    return copy(squadView(db, squadOf(db, squadId), currentUser(db)?.id ?? null))
  },

  async createSquad(draft) {
    await latency()
    const db = getDb()
    const user = requireActiveMember(db)
    const event = db.events.find((candidate) => candidate.id === draft.eventId)
    if (!event || event.status !== 'published' || new Date(event.startsAt) <= now()) {
      throw invalid('Squads can only be started for upcoming events.')
    }
    if (draft.size < SQUAD_MIN_SIZE || draft.size > SQUAD_MAX_SIZE) {
      throw invalid(`A squad is ${SQUAD_MIN_SIZE} to ${SQUAD_MAX_SIZE} people.`)
    }
    if (!draft.name.trim()) throw invalid('Give your squad a name.')
    if (!draft.meetingPoint.place.trim()) throw invalid('Add a public place to meet before the event.')
    const gender = db.profiles.find((profile) => profile.userId === user.id)?.gender
    if ((draft.womenOnly || event.womenOnly) && gender !== 'woman') {
      throw new ServiceError('forbidden', 'Women-only squads can only be started by women.')
    }
    const already = db.squads.some(
      (squad) =>
        squad.eventId === event.id &&
        db.squadMembers.some((member) => member.squadId === squad.id && member.userId === user.id && member.status === 'approved'),
    )
    if (already) throw new ServiceError('conflict', 'You are already in a squad for this event.')

    const squad: Squad = {
      id: newId('sq'),
      eventId: event.id,
      creatorId: user.id,
      name: draft.name.trim(),
      meetingPoint: { place: draft.meetingPoint.place.trim(), minutesBefore: draft.meetingPoint.minutesBefore },
      size: draft.size,
      womenOnly: draft.womenOnly || event.womenOnly,
      createdAt: nowIso(),
    }
    db.squads.push(squad)
    db.squadMembers.push({ squadId: squad.id, userId: user.id, role: 'creator', status: 'approved', requestedAt: squad.createdAt, decidedAt: squad.createdAt })
    saveDb()
    return copy(squadView(db, squad, user.id))
  },

  async requestToJoin(squadId) {
    await latency()
    const db = getDb()
    const user = requireActiveMember(db)
    const squad = squadOf(db, squadId)
    if (!isUpcoming(db, squad, now())) throw new ServiceError('conflict', 'This squad’s event has passed.')
    if (squadSpotsLeft(db, squad.id) === 0) throw new ServiceError('conflict', 'This squad is full.')
    const profile = db.profiles.find((candidate) => candidate.userId === user.id)
    if (squad.womenOnly && profile?.gender !== 'woman') throw new ServiceError('forbidden', 'This squad is for women only.')
    const existing = db.squadMembers.find((member) => member.squadId === squadId && member.userId === user.id)
    if (existing && (existing.status === 'approved' || existing.status === 'requested')) {
      throw new ServiceError('conflict', 'You have already asked to join this squad.')
    }
    db.squadMembers = db.squadMembers.filter((member) => member !== existing)
    const member = { squadId, userId: user.id, role: 'member' as const, status: 'requested' as const, requestedAt: nowIso(), decidedAt: null }
    db.squadMembers.push(member)
    notify(db, squad.creatorId, 'squad_request', `${profile?.firstName ?? 'Someone'} asked to join your squad`, squad.name, '/app/squads')
    saveDb()
    return copy(member)
  },

  async decideRequest(squadId, userId, decision) {
    await latency(0.7)
    const db = getDb()
    const user = requireUser(db)
    const squad = squadOf(db, squadId)
    if (squad.creatorId !== user.id) throw new ServiceError('forbidden', 'Only the squad’s creator can decide.')
    const member = db.squadMembers.find((candidate) => candidate.squadId === squadId && candidate.userId === userId)
    if (!member || member.status !== 'requested') throw new ServiceError('conflict', 'This request has already been answered.')
    if (decision === 'approve') {
      if (squadSpotsLeft(db, squadId) === 0) throw new ServiceError('conflict', 'Your squad is full.')
      member.status = 'approved'
      notify(db, userId, 'squad_approved', 'You’re in the squad', `${personPreview(db, user.id).firstName} added you to “${squad.name}”.`, '/app/squads')
    } else {
      member.status = 'declined'
    }
    member.decidedAt = nowIso()
    saveDb()
    return copy(member)
  },

  async leaveSquad(squadId) {
    await latency()
    const db = getDb()
    const user = requireUser(db)
    const squad = squadOf(db, squadId)
    const member = db.squadMembers.find((candidate) => candidate.squadId === squadId && candidate.userId === user.id)
    if (!member || member.status === 'left' || member.status === 'declined') return
    member.status = 'left'
    member.decidedAt = nowIso()

    if (squad.creatorId === user.id) {
      // The longest-standing member takes over. An empty squad is removed.
      const heir = db.squadMembers
        .filter((candidate) => candidate.squadId === squadId && candidate.status === 'approved')
        .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt))[0]
      if (heir) {
        heir.role = 'creator'
        squad.creatorId = heir.userId
        member.role = 'member'
      } else {
        db.squads = db.squads.filter((candidate) => candidate.id !== squadId)
        db.squadMembers = db.squadMembers.filter((candidate) => candidate.squadId !== squadId)
      }
    }
    saveDb()
  },
}
