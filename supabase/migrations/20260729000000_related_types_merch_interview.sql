-- Add merchandise + interviews to the curated "Related (see also)" system.
--
-- related_items.source_type / target_type reference entity_types(slug), so a
-- record can only carry curated related links once its type exists here.
--
--   merchandise — fully linkable: it has public detail pages, so it works as
--                 both a source (curate "see also" from a merch record) and a
--                 target (other pages can point at it).
--   interview   — source-only for now: interviews can curate related links, but
--                 there are no public interview pages yet, so nothing points TO
--                 an interview. Add it as a type so the source-side FK is valid.
insert into entity_types (slug, name, sort_order) values
  ('merchandise', 'Merchandise', 5),
  ('interview',   'Interview',   6)
on conflict (slug) do nothing;
