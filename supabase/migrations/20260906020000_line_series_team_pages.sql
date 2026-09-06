-- ============================================================
-- Lede + content for Line, Series and Team detail pages
--
-- Each of lines/series/teams gets a public page: a lede, a content body, and
-- everything tagged with it (see build-dossiers.mjs renderLinePage /
-- renderSeriesPage / renderTeamPage). lines.description and series.description
-- already existed and become that rich content body; overview_lede is new on
-- all three, matching the releases.overview_lede / overview_text shape. teams
-- had no content field at all, so both columns are new there.
-- ============================================================
alter table lines  add column if not exists overview_lede text;
alter table series add column if not exists overview_lede text;
alter table teams  add column if not exists overview_lede text;
alter table teams  add column if not exists description   text;
