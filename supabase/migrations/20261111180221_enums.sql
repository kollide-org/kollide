-- Enums. Add values later with `alter type ... add value` in a new migration.

create type public.event_type as enum ('partner', 'community', 'kollide');

create type public.pricing_mode as enum ('free', 'pay_at_venue', 'cost_split', 'paid');
comment on type public.pricing_mode is
  '"paid" is reserved for P1 (payments). A check refuses it while app_config.payments_enabled is false.';

create type public.approval_mode as enum ('instant', 'host_approval');

create type public.event_status as enum ('draft', 'pending_review', 'published', 'cancelled', 'completed');

create type public.booking_status as enum (
  'requested', 'approved', 'waitlisted', 'declined', 'confirmed', 'attended', 'no_show', 'cancelled',
  -- RESERVED for P1 (payments). Never written in v1.
  'pending_payment', 'paid', 'expired', 'refunded'
);
comment on type public.booking_status is
  'pending_payment, paid, expired and refunded are RESERVED for P1 (payments) and are never written in v1.';

create type public.user_status as enum ('active', 'on_hold', 'suspended', 'banned');

create type public.app_role as enum ('admin', 'host');

create type public.report_status as enum ('open', 'reviewing', 'resolved', 'dismissed');

create type public.consent_purpose as enum ('terms', 'code_of_conduct', 'preferences', 'analytics', 'marketing');

-- Shared by host applications and selfie verifications.
create type public.review_status as enum ('pending', 'approved', 'rejected');

create type public.gender as enum ('woman', 'man', 'non_binary', 'prefer_not_to_say');
