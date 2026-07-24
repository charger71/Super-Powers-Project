-- ============================================================
-- Free-text card-back "Enemies" line for the powers card.
--
-- Separate from the character_enemies join table (migration 0007), which drives
-- the linked "Known Enemies" section. The powers card is curated, constant prose
-- (the fixed 1984 card); the section is cross-linked data.
-- ============================================================
alter table characters add column if not exists enemies text;

-- Nudge PostgREST to refresh its schema cache so the new column is queryable
-- immediately (otherwise: "could not find 'enemies' column in schema cache").
notify pgrst, 'reload schema';
