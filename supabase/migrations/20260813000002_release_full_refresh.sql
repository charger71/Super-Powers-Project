-- Refresh release_full so it exposes releases.overview_lede / overview_text.
--
-- Nothing is wrong with the view's TEXT — it is `select r.*, …` and has been
-- since the initial schema. The problem is when that `*` was expanded: Postgres
-- resolves it once, at CREATE VIEW time, and freezes the resulting column list.
-- The view was last recreated in 20260727000000_vocab_lookups.sql; the two
-- overview columns were added to `releases` afterwards, in
-- 20260807000001_release_overview_and_line_manufacturer.sql. Columns added to a
-- table after a view is created never appear in that view, so release_full has
-- been two columns behind ever since.
--
-- schema.sql does not show the drift because it creates the view at the end of
-- the file, by which point `releases` is already complete — which is exactly why
-- the two definitions look identical yet produce different views.
--
-- The definition below is therefore unchanged from the existing one. Recreating
-- it is the entire fix: it re-expands `*` against the current table.
--
-- Precedent: 20260726000001 and 20260727000000 both drop and recreate this view
-- for the same underlying reason (they alter columns it depends on).
--
-- Nothing selects from release_full in build/, admin/, or js/ today, so this is
-- a correctness fix ahead of first use rather than a live bug.

drop view if exists release_full;

create view release_full with (security_invoker = true) as
select
  r.*,
  l.name  as line_name,
  l.slug  as line_slug,
  s.name  as series_name,
  s.slug  as series_slug,
  c.name  as character_name,
  c.slug  as character_slug
from releases r
join lines l       on l.id = r.line_id
left join series s on s.id = r.series_id
left join characters c on c.id = r.character_id;
