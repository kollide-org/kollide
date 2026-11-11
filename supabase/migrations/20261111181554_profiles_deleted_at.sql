-- Marks the anonymised tombstone that delete_my_account() leaves behind, so other people's history
-- (tags, attendance, reviews) can keep pointing at a row without any personal data.
alter table public.profiles add column deleted_at timestamptz;
