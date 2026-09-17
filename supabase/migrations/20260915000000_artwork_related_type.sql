-- Add artwork to the curated "Related (see also)" system, now that it's
-- getting public pages (the artwork gallery). Same pattern as
-- 20260729000000_related_types_merch_interview.sql: artwork is fully
-- linkable (it has detail pages), so it works as both a source and a target.
insert into entity_types (slug, name, sort_order) values
  ('artwork', 'Artwork', 8)
on conflict (slug) do nothing;
