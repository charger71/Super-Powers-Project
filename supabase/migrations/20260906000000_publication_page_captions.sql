-- Translation caption pins for mini-comic pages.
--
-- A numbered marker placed at a point on one page scan (media_assets), not on
-- the publication as a whole — different pages of the same mini-comic carry
-- different pins. Position is a percent of the image (0-100), not pixels, so
-- it survives any display size. Powers the reader's "tap a pin, see the
-- translated line" overlay for foreign-language pack-in minis (e.g. the
-- Estrela Portuguese prints).
create table if not exists publication_page_captions (
  id              uuid primary key default gen_random_uuid(),
  media_id        uuid not null references media_assets(id) on delete cascade,
  x_pct           numeric(5,2) not null check (x_pct between 0 and 100),
  y_pct           numeric(5,2) not null check (y_pct between 0 and 100),
  translated_text text not null,
  original_text   text,
  language        text not null default 'en',
  sort_order      smallint default 0,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
create index if not exists publication_page_captions_media_idx
  on publication_page_captions (media_id);

alter table publication_page_captions enable row level security;
create policy "public read" on publication_page_captions
  for select using (true);
create policy "authors write" on publication_page_captions
  for all to authenticated using (true) with check (true);

create trigger trg_publication_page_captions_updated before update on publication_page_captions
  for each row execute function set_updated_at();
