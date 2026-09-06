-- ============================================================
-- Release variation fields
--
-- A variation can differ from its parent release along the same axes a
-- release itself does — line/manufacturer, series, year, action feature,
-- accessories, card type. Nullable overrides: null means "same as the
-- release." `region` doubles as the country picker for variation_type =
-- 'country' (Hong Kong vs Mexico stamp) — the admin only shows it then.
-- ============================================================
alter table release_variations add column if not exists line_id        uuid references lines(id)  on delete set null;
alter table release_variations add column if not exists series_id      uuid references series(id) on delete set null;
alter table release_variations add column if not exists release_year   smallint;
alter table release_variations add column if not exists region         text;
alter table release_variations add column if not exists action_feature text;
alter table release_variations add column if not exists accessories    text[] default '{}';
alter table release_variations add column if not exists card_type      text;

create index if not exists release_variations_line_id_idx   on release_variations (line_id);
create index if not exists release_variations_series_id_idx on release_variations (series_id);
