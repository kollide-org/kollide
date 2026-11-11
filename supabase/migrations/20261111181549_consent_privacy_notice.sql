-- The privacy notice is recorded as its own consent purpose (code_of_conduct already exists).
-- Kept alone in this file: a new enum value cannot be used in the transaction that adds it.
alter type public.consent_purpose add value if not exists 'privacy_notice';
