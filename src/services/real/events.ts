import type { Database, Json } from '@/types/database'

import { ServiceError } from '../types/errors'
import type {
  EventAddress, EventCard, EventFilters, EventForEdit, EventInput, EventsService, HubCard, MyEvent,
} from '../types/events'

const client = () => import('./client').then((module) => module.supabase)

type CardRow = Database['public']['Views']['event_cards']['Row']
type HubRow = Database['public']['Views']['hub_cards']['Row']

function fail(error: { message: string }): never {
  throw new ServiceError(/^[a-z0-9_]+$/.test(error.message) ? error.message : 'unknown', error.message)
}

function toCard(row: CardRow): EventCard {
  return {
    id: row.id!, type: row.type!, title: row.title!, description: row.description ?? '', houseRules: row.house_rules,
    categoryId: row.category_id, categoryName: row.category_name, areaId: row.area_id!, areaName: row.area_name ?? '',
    startsAt: row.starts_at!, endsAt: row.ends_at!, capacity: row.capacity, overbookPct: row.overbook_pct ?? 0,
    approvalMode: row.approval_mode!, womenOnly: row.women_only ?? false, minAge: row.min_age ?? 18, maxAge: row.max_age,
    pricingMode: row.pricing_mode!, priceLabel: row.price_label, houseParty: row.house_party ?? false, coverKey: row.cover_key,
    hostId: row.host_id!, hostFirstName: row.host_first_name, hostIsVerified: row.host_is_verified ?? false,
    hasPartnerLink: row.has_partner_link ?? false, spotsLeft: row.spots_left, attendeeAvatars: row.attendee_avatars ?? [],
  }
}

function toHub(row: HubRow): HubCard {
  return {
    id: row.id!, slug: row.slug!, title: row.title!, subtitle: row.subtitle, artKey: row.art_key,
    accentColor: row.accent_color ?? '#A63A50', startsOn: row.starts_on, endsOn: row.ends_on, eventCount: row.event_count ?? 0,
  }
}

const nonEmpty = (value: string | undefined | null) => (value && value.trim() !== '' ? value.trim() : null)

/** The camelCase form fields as the snake_case keys that create_event and update_event read. */
function toRpcInput(input: Partial<EventInput>): Json {
  const map: Record<string, unknown> = {
    type: input.type, title: input.title, description: input.description, category_id: input.categoryId,
    area_id: input.areaId, starts_at: input.startsAt, ends_at: input.endsAt, capacity: input.capacity,
    women_only: input.womenOnly, min_age: input.minAge, max_age: input.maxAge, house_rules: nonEmpty(input.houseRules),
    pricing_mode: input.pricingMode, price_label: nonEmpty(input.priceLabel), house_party: input.houseParty,
    address: nonEmpty(input.address), directions_note: nonEmpty(input.directionsNote), host_notes: nonEmpty(input.hostNotes),
    partner_url: nonEmpty(input.partnerUrl), referral_code: nonEmpty(input.referralCode),
  }
  return Object.fromEntries(Object.entries(map).filter(([, value]) => value !== undefined)) as Json
}

export const realEvents: EventsService = {
  async search(filters: EventFilters, page = { limit: 20, offset: 0 }) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('search_events', {
      p_from: filters.from, p_to: filters.to, p_area_ids: filters.areaIds?.length ? filters.areaIds : undefined,
      p_category_ids: filters.categoryIds?.length ? filters.categoryIds : undefined,
      p_pricing: filters.pricing?.length ? filters.pricing : undefined, p_women_only: filters.womenOnly || undefined,
      p_group_size: filters.groupSize, p_types: filters.types?.length ? filters.types : undefined,
      p_limit: page.limit, p_offset: page.offset,
    })
    if (error) fail(error)
    return (data ?? []).map(toCard)
  },

  async featured() {
    const supabase = await client()
    const { data, error } = await supabase.rpc('featured_event_cards')
    if (error) fail(error)
    return (data ?? []).map(toCard)
  },

  async hubs() {
    const supabase = await client()
    const { data, error } = await supabase.from('hub_cards').select('*').order('sort_order')
    if (error) fail(error)
    return (data ?? []).map(toHub)
  },

  async getHub(slug) {
    const supabase = await client()
    const { data, error } = await supabase.from('hub_cards').select('*').eq('slug', slug).maybeSingle()
    if (error) fail(error)
    if (!data) return null
    const events = await supabase.rpc('hub_event_cards', { p_hub: data.id! })
    if (events.error) fail(events.error)
    return { hub: toHub(data), events: (events.data ?? []).map(toCard) }
  },

  async getEvent(id) {
    const supabase = await client()
    const { data, error } = await supabase.from('event_cards').select('*').eq('id', id).maybeSingle()
    if (error) fail(error)
    return data ? toCard(data) : null
  },

  async getAddress(id): Promise<EventAddress | null> {
    const supabase = await client()
    const { data, error } = await supabase.rpc('get_event_address', { p_event: id })
    if (error) {
      if (error.message === 'not_allowed') return null
      fail(error)
    }
    const row = (data ?? {}) as { address?: string | null; directions_note?: string | null }
    return { address: row.address ?? null, directionsNote: row.directions_note ?? null }
  },

  async myEvents(): Promise<MyEvent[]> {
    const supabase = await client()
    const { data, error } = await supabase.rpc('my_events')
    if (error) fail(error)
    return (data ?? []).map((row) => ({
      id: row.id, title: row.title, type: row.type, status: row.status, startsAt: row.starts_at,
      coverKey: row.cover_key, reviewNote: row.review_note,
    }))
  },

  async getForEdit(id): Promise<EventForEdit> {
    const supabase = await client()
    const { data, error } = await supabase.rpc('get_event_for_edit', { p_event: id })
    if (error) fail(error)
    const r = (data ?? {}) as Record<string, any>
    return {
      id: r.id, type: r.type, title: r.title, description: r.description ?? '', categoryId: r.category_id ?? null,
      areaId: r.area_id ?? null, startsAt: r.starts_at, endsAt: r.ends_at, capacity: r.capacity ?? null,
      womenOnly: r.women_only ?? false, minAge: r.min_age ?? 18, maxAge: r.max_age ?? null, houseRules: r.house_rules ?? '',
      pricingMode: r.pricing_mode, priceLabel: r.price_label ?? '', houseParty: r.house_party ?? false,
      address: r.address ?? '', directionsNote: r.directions_note ?? '', hostNotes: r.host_notes ?? '',
      partnerUrl: r.partner_url ?? '', referralCode: r.referral_code ?? '', status: r.status, coverKey: r.cover_key ?? null,
      reviewNote: r.review_note ?? null, overbookPct: r.overbook_pct ?? 0,
    }
  },

  async create(input) {
    const supabase = await client()
    const { data, error } = await supabase.rpc('create_event', { p_input: toRpcInput(input) })
    if (error) fail(error)
    return data as string
  },

  async update(id, input) {
    const supabase = await client()
    const { error } = await supabase.rpc('update_event', { p_event: id, p_input: toRpcInput(input) })
    if (error) fail(error)
  },

  async submit(id) {
    const supabase = await client()
    const { error } = await supabase.rpc('submit_event_for_review', { p_event: id })
    if (error) fail(error)
  },

  async cancel(id, reason) {
    const supabase = await client()
    const { error } = await supabase.rpc('cancel_event', { p_event: id, p_reason: reason })
    if (error) fail(error)
  },

  async setCover(eventId, key) {
    const supabase = await client()
    const { error } = await supabase.rpc('set_event_cover', { p_event_id: eventId, p_key: key })
    if (error) fail(error)
  },
}
