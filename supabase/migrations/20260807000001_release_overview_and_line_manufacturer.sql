-- ============================================================
-- Release overview + line manufacturer branding
--
-- releases: an Overview lede + rich body, shown ABOVE the photography on the
--   release detail page (mirrors the character dossier's Overview).
-- lines: a manufacturer website, plus a manufacturer logo image (via a
--   media_lines join). The release page renders the logo + manufacturer name
--   (NOT the line name) under the specifications.
-- ============================================================

alter table releases add column if not exists overview_lede text;  -- short enlarged intro
alter table releases add column if not exists overview_text text;  -- rich body under the lede

alter table lines add column if not exists manufacturer_website text;  -- 'https://kenner...' etc.

-- Manufacturer logo (and any other line-level imagery) attaches like every
-- other media — through media_assets, so credit/rights/alt are captured at
-- upload (CLAUDE.md non-negotiable #1). Mirrors media_creators.
create table if not exists media_lines (
  media_id   uuid references media_assets(id) on delete cascade,
  line_id    uuid references lines(id)        on delete cascade,
  sort_order smallint default 0,
  is_primary boolean default false,   -- the manufacturer logo
  primary key (media_id, line_id)
);
create index if not exists media_lines_line_id_idx on media_lines (line_id);

alter table media_lines enable row level security;
create policy "public read" on media_lines for select using (true);
create policy "authors write" on media_lines for all to authenticated
  using (true) with check (true);
