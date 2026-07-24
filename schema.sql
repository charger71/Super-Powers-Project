-- The Super Powers Project — initial schema
-- Postgres / Supabase. Derived from the content model.
-- Core principle: Character (canonical DC identity) is separate from Release (physical product).

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "pgcrypto";      -- gen_random_uuid()
create extension if not exists "pg_trgm";       -- fuzzy search

-- ============================================================
-- Controlled vocabularies (enums)
-- Postgres enums are cheap integrity wins; add values with
-- ALTER TYPE ... ADD VALUE. Use lookup tables instead if you
-- expect co-authors to manage these values themselves.
-- ============================================================
create type release_type   as enum ('figure','vehicle','playset','accessory','box_set');
create type release_status as enum ('released','mail_away','international_variant','prototype','cancelled','reissue');
create type alignment      as enum ('hero','villain','ally','neutral');
create type media_type     as enum ('photo','video','scan','audio');
create type rights_status  as enum ('owned','permission_granted','fair_use_editorial','link_only');
create type artwork_type   as enum ('style_guide','card_art','box_art','comic_cover','comic_interior','concept','prototype_render');
create type rarity_level   as enum ('common','uncommon','rare','very_rare','grail');
create type variation_type as enum ('card','paint','mold','accessory','packaging','country');

-- ============================================================
-- Shared bits
-- ============================================================
-- Every table gets: uuid pk, human-readable slug, timestamps.
-- Slugs drive URLs; keep them stable once public.

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ============================================================
-- Lines & series
-- ============================================================
create table lines (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'kenner-super-powers'
  name          text not null,                 -- 'Kenner Super Powers Collection'
  manufacturer  text,                          -- 'Kenner' / 'McFarlane Toys'
  year_start    smallint,
  year_end      smallint,                      -- null = ongoing
  description   text,
  sort_order    smallint default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table series (
  id            uuid primary key default gen_random_uuid(),
  line_id       uuid not null references lines(id) on delete cascade,
  slug          text unique not null,          -- 'kenner-series-3'
  name          text not null,                 -- 'Series 3'
  year          smallint,
  description   text,
  sort_order    smallint default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create index on series (line_id);

-- ============================================================
-- Characters (canonical identity — line-agnostic)
-- ============================================================
create table characters (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,      -- 'cyborg'
  name              text not null,
  aka               text[] default '{}',
  alignment         alignment,
  first_appearance  text,                      -- 'DC Comics Presents #26 (1980)'
  bio               text,                      -- character biography (About section)
  overview          text,                      -- toy-line editorial (dossier Overview)
  homeworld         text,                      -- 'Krypton'
  base_of_operations text,                     -- 'Metropolis'
  powers            text,                      -- prose, card-back style
  weaknesses        text,                      -- prose, card-back style
  enemies           text,                      -- free-text card-back list (the linked
                                               -- Known Enemies section uses character_enemies)
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- Teams as a proper many-to-many (Justice League, Super Friends, New Gods...)
create table teams (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create table character_teams (
  character_id uuid references characters(id) on delete cascade,
  team_id      uuid references teams(id)      on delete cascade,
  primary key (character_id, team_id)
);

-- Enemies are characters too, so this is FK-linked rather than free text —
-- lets a dossier cross-link to the enemy's own page.
create table character_enemies (
  character_id uuid references characters(id) on delete cascade,
  enemy_id     uuid references characters(id) on delete cascade,
  sort_order   int  default 0,   -- card-back order is editorial, not alphabetical
  primary key (character_id, enemy_id),
  constraint character_enemies_not_self check (character_id <> enemy_id)
);
create index on character_enemies (enemy_id);

-- ============================================================
-- Creators
-- ============================================================
create table creators (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,            -- 'george-perez'
  name        text not null,
  role_summary text,                           -- 'Artist / designer'
  bio         text,
  birth_year  smallint,
  death_year  smallint,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- Releases (the physical product) — the workhorse table
-- ============================================================
create table releases (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,      -- 'cyborg-kenner-1986'
  name              text not null,
  type              release_type not null,
  status            release_status not null default 'released',

  line_id           uuid not null references lines(id)   on delete restrict,
  series_id         uuid references series(id)           on delete set null,
  character_id      uuid references characters(id)       on delete set null,  -- null for vehicles/playsets
  variant_of        uuid references releases(id)         on delete set null,  -- Argentine Riddler -> Green Lantern

  release_year      smallint,
  region            text default 'US',         -- ISO-ish: 'US','AR','BR','CO'
  action_feature    text,                      -- 'Thrusting Arms'
  accessories       text[] default '{}',       -- {'drill hand','claw hand'}
  features          text[] default '{}',       -- vehicles/playsets
  card_type         text,                      -- '23-back'
  rarity            rarity_level,
  est_value_loose   numeric(10,2),
  est_value_carded  numeric(10,2),
  notes             text,
  sources           text[] default '{}',       -- citation URLs

  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index on releases (line_id);
create index on releases (series_id);
create index on releases (character_id);
create index on releases (type);
create index on releases (status);

-- A variation is a minor change WITHIN one release (23-back vs 31-back card,
-- red vs blue drill hand) — as opposed to releases.variant_of, which is for
-- differences big enough to be their own release. Renders inline on the release.
create table release_variations (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,          -- 'cyborg-kenner-1986-31-back'
  release_id        uuid not null references releases(id) on delete cascade,
  name              text not null,                 -- '31-back card'
  variation_type    variation_type,
  description       text,
  rarity            rarity_level,
  est_value_loose   numeric(10,2),
  est_value_carded  numeric(10,2),
  notes             text,
  sources           text[] default '{}',
  sort_order        int default 0,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);
create index on release_variations (release_id);

-- A release can be designed by several creators, and vice versa.
create table release_creators (
  release_id uuid references releases(id) on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  role       text,                             -- 'design','sculpt','packaging art'
  primary key (release_id, creator_id, role)
);

-- Vehicles/playsets associate with characters without "being" one.
create table release_characters (
  release_id   uuid references releases(id)   on delete cascade,
  character_id uuid references characters(id) on delete cascade,
  primary key (release_id, character_id)
);

-- ============================================================
-- Media assets — the cross-cutting hub
-- ============================================================
create table media_assets (
  id             uuid primary key default gen_random_uuid(),
  type           media_type not null,
  storage_path   text,                         -- Supabase Storage object path (photos/scans)
  embed_url      text,                         -- YouTube/Vimeo (video)
  poster_path    text,                         -- video thumbnail
  width          int,
  height         int,
  caption        text,
  alt_text       text,                         -- capture at upload; a11y + SEO
  credit         text not null,                -- '© J. Collector'
  source_url     text,
  rights         rights_status not null,       -- never nullable. attribution travels with the asset.
  uploaded_by    uuid references auth.users(id) on delete set null,
  created_at     timestamptz default now(),
  updated_at     timestamptz default now(),

  -- must be *somewhere*: stored file or an embed
  constraint media_has_location check (storage_path is not null or embed_url is not null)
);
create index on media_assets (type);
create index on media_assets (rights);

-- Polymorphic attachment via explicit join tables.
-- More tables than a generic (entity_type, entity_id) pair — but the FKs are
-- real, so the database enforces integrity instead of your admin code.
create table media_releases (
  media_id   uuid references media_assets(id) on delete cascade,
  release_id uuid references releases(id)     on delete cascade,
  sort_order smallint default 0,
  is_primary boolean default false,           -- hero image
  primary key (media_id, release_id)
);
create table media_characters (
  media_id     uuid references media_assets(id) on delete cascade,
  character_id uuid references characters(id)   on delete cascade,
  sort_order   smallint default 0,
  is_primary   boolean default false,
  role         text not null default 'artwork',  -- artwork|logo|headshot|alter_ego
  primary key (media_id, character_id)
);
create index on media_characters (character_id, role);
create table media_creators (
  media_id   uuid references media_assets(id) on delete cascade,
  creator_id uuid references creators(id)     on delete cascade,
  primary key (media_id, creator_id)
);
create table media_variations (
  media_id     uuid references media_assets(id)       on delete cascade,
  variation_id uuid references release_variations(id) on delete cascade,
  sort_order   smallint default 0,
  is_primary   boolean default false,
  primary key (media_id, variation_id)
);

-- ============================================================
-- Artwork
-- ============================================================
create table artwork (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  type          artwork_type not null,
  year          smallint,
  description   text,
  media_id      uuid references media_assets(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create table artwork_creators (
  artwork_id uuid references artwork(id)  on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  primary key (artwork_id, creator_id)
);
create table artwork_characters (
  artwork_id   uuid references artwork(id)     on delete cascade,
  character_id uuid references characters(id)  on delete cascade,
  primary key (artwork_id, character_id)
);

-- ============================================================
-- Publications (comics, mini-comics, books, RPG)
-- ============================================================
create table publications (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  kind          text,                          -- 'mini_series','pack_in_mini','book','rpg'
  publisher     text,
  year          smallint,
  issue_number  text,
  language      text default 'en',             -- Estrela minis are 'pt'
  packed_with   uuid references releases(id) on delete set null,  -- pack-in minis
  description   text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create table media_publications (
  media_id       uuid references media_assets(id)  on delete cascade,
  publication_id uuid references publications(id)  on delete cascade,
  sort_order     smallint default 0,
  is_primary     boolean default false,           -- cover image
  primary key (media_id, publication_id)
);
create table publication_creators (
  publication_id uuid references publications(id) on delete cascade,
  creator_id     uuid references creators(id)     on delete cascade,
  role           text,                          -- 'writer','penciller','cover'
  primary key (publication_id, creator_id, role)
);
create table publication_characters (
  publication_id uuid references publications(id) on delete cascade,
  character_id   uuid references characters(id)   on delete cascade,
  primary key (publication_id, character_id)
);

-- ============================================================
-- Screen media (cartoons, commercials, VHS)
-- ============================================================
create table screen_media (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  kind          text,                          -- 'series','episode','commercial','home_video'
  year          smallint,
  parent_id     uuid references screen_media(id) on delete cascade, -- episode -> series
  description   text,
  media_id      uuid references media_assets(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- Interviews
-- ============================================================
create table interviews (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  subject_id   uuid references creators(id) on delete set null,
  interviewer  text,
  date         date,
  format       text,                           -- 'text','audio','video'
  body         text,                           -- markdown for text interviews
  media_id     uuid references media_assets(id) on delete set null,
  source_url   text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- Merchandise / licensing
-- ============================================================
create table merchandise (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  category     text,                           -- 'apparel','housewares','party','publishing'
  manufacturer text,
  year         smallint,
  description  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create table merchandise_characters (
  merchandise_id uuid references merchandise(id) on delete cascade,
  character_id   uuid references characters(id)  on delete cascade,
  primary key (merchandise_id, character_id)
);

-- ============================================================
-- updated_at triggers
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'lines','series','characters','teams','creators','releases','release_variations','media_assets',
    'artwork','publications','screen_media','interviews','merchandise'
  ] loop
    execute format(
      'create trigger trg_%s_updated before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- ============================================================
-- Row Level Security
-- Model: public reads everything; authenticated co-authors write everything
-- (the "trust everyone, publish direct" decision). Tighten later if needed.
-- Applied to EVERY table, join tables included — a join table without RLS
-- is writable by the anon key on Supabase.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'lines','series','characters','teams','character_teams','creators',
    'releases','release_creators','release_characters','release_variations',
    'media_assets','media_releases','media_characters','media_creators','media_variations',
    'artwork','artwork_creators','artwork_characters',
    'publications','media_publications','publication_creators','publication_characters',
    'screen_media','interviews','merchandise','merchandise_characters'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "public read" on %I for select using (true)', t);
    execute format(
      'create policy "authors write" on %I for all to authenticated
       using (true) with check (true)', t);
  end loop;
end $$;

-- ============================================================
-- Storage: one public bucket for media uploads
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "public read media" on storage.objects
  for select using (bucket_id = 'media');
create policy "authors upload media" on storage.objects
  for insert to authenticated with check (bucket_id = 'media');
create policy "authors update media" on storage.objects
  for update to authenticated using (bucket_id = 'media');
create policy "authors delete media" on storage.objects
  for delete to authenticated using (bucket_id = 'media');

-- ============================================================
-- Search
-- Postgres full-text over the fields collectors actually search.
-- array_to_string() is only STABLE, which generated columns reject;
-- this wrapper is safe to mark IMMUTABLE for text[] contents.
-- ============================================================
create or replace function immutable_array_to_string(text[], text)
returns text language sql immutable as
$$ select array_to_string($1, $2) $$;

alter table releases add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(name,'') || ' ' ||
      coalesce(action_feature,'') || ' ' ||
      coalesce(notes,'') || ' ' ||
      coalesce(immutable_array_to_string(accessories,' '),'')
    )
  ) stored;
create index releases_search_idx on releases using gin (search_vector);

alter table characters add column search_vector tsvector
  generated always as (
    to_tsvector('english',
      coalesce(name,'') || ' ' ||
      coalesce(immutable_array_to_string(aka,' '),'') || ' ' ||
      coalesce(bio,'')
    )
  ) stored;
create index characters_search_idx on characters using gin (search_vector);

-- Trigram index for fuzzy/typo-tolerant name matching.
create index releases_name_trgm  on releases  using gin (name gin_trgm_ops);
create index characters_name_trgm on characters using gin (name gin_trgm_ops);

-- ============================================================
-- Convenience view: every release with its line/series/character resolved
-- ============================================================
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
