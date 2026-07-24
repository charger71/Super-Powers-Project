-- ============================================================
-- Release variations
--
-- A variation is a minor change WITHIN a single release — same product, a
-- documented difference (23-back vs 31-back card, red vs blue drill hand,
-- straight vs bent leg, Hong Kong vs Mexico stamp). Distinct from releases.
-- variant_of, which is for differences big enough to be their own release
-- (the Argentine Riddler). Variations render inline on the release page.
-- ============================================================
create type variation_type as enum
  ('card', 'paint', 'mold', 'accessory', 'packaging', 'country');

create table release_variations (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,          -- 'cyborg-kenner-1986-31-back'
  release_id        uuid not null references releases(id) on delete cascade,
  name              text not null,                 -- '31-back card'
  variation_type    variation_type,                -- controlled vocab
  description       text,
  rarity            rarity_level,                  -- variations differ in scarcity
  est_value_loose   numeric(10,2),
  est_value_carded  numeric(10,2),
  notes             text,
  sources           text[] default '{}',           -- citation URLs
  sort_order        int default 0,                 -- editorial order on the page
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index on release_variations (release_id);

-- Variations carry their own photography (the whole point — showing the diff),
-- attached via a join table like every other media relationship.
create table media_variations (
  media_id     uuid references media_assets(id)       on delete cascade,
  variation_id uuid references release_variations(id) on delete cascade,
  sort_order   smallint default 0,
  is_primary   boolean default false,
  primary key (media_id, variation_id)
);

create trigger trg_release_variations_updated before update on release_variations
  for each row execute function set_updated_at();

alter table release_variations enable row level security;
alter table media_variations  enable row level security;
create policy "public read"   on release_variations for select using (true);
create policy "authors write" on release_variations for all to authenticated using (true) with check (true);
create policy "public read"   on media_variations   for select using (true);
create policy "authors write" on media_variations   for all to authenticated using (true) with check (true);

-- refresh PostgREST's schema cache so the new tables/columns are queryable now
notify pgrst, 'reload schema';
