-- Let artwork carry more than one image (different scans/prints/states of the
-- same piece), matching every other content type's media_* join table instead
-- of the single media_id FK it started with. Same shape as media_merchandise
-- (20260721000010_media_merchandise.sql).
create table if not exists media_artwork (
  media_id   uuid references media_assets(id) on delete cascade,
  artwork_id uuid references artwork(id)      on delete cascade,
  sort_order smallint default 0,
  is_primary boolean default false,
  primary key (media_id, artwork_id)
);
create index if not exists media_artwork_artwork_idx on media_artwork (artwork_id);

alter table media_artwork enable row level security;
create policy "public read"   on media_artwork for select using (true);
create policy "authors write" on media_artwork for all to authenticated
  using (true) with check (true);

-- Carry forward each artwork's existing single image as its primary, then
-- retire the column the join table replaces.
insert into media_artwork (media_id, artwork_id, is_primary)
select media_id, id, true from artwork where media_id is not null;

alter table artwork drop column media_id;
