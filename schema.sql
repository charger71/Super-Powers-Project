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
-- There are no controlled-vocabulary enums left. Every one graduated to an
-- editable lookup table (defined in the next section): release_statuses,
-- alignments, release_types, rarity_levels, variation_types, media_types,
-- rights_statuses, artwork_types, publication_kinds, screen_media_kinds,
-- interview_formats, merchandise_categories. Each consuming column stores the
-- slug and FKs into its lookup, so anything reading the value as a string is
-- unaffected. Co-authors add values in the admin, not via a migration.
-- See migration 20260727000000_vocab_lookups (and _release_status_lookup).

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
  manufacturer_website text,                    -- manufacturer homepage (logo links here)
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
-- Release statuses (controlled vocab as an editable lookup table)
-- Was a Postgres enum; promoted to a table so co-authors can add
-- statuses from the admin without a migration. releases.status holds
-- the slug (see the FK below), so anything reading status as a string
-- ('released', 'prototype', ...) is unaffected.
-- ============================================================
create table release_statuses (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- 'international_variant'
  name          text not null,                 -- 'International variant'
  description   text,
  sort_order    smallint default 0,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
insert into release_statuses (slug, name, sort_order) values
  ('released',              'Released',              0),
  ('mail_away',             'Mail-away',             1),
  ('international_variant', 'International variant',  2),
  ('prototype',             'Prototype',             3),
  ('cancelled',             'Cancelled',             4),
  ('reissue',               'Reissue',               5);

-- The other controlled vocabularies, all the same shape as release_statuses.
-- Created in a loop to keep the boilerplate down; each gets an updated_at
-- trigger + RLS from the shared arrays at the bottom of this file, and its
-- values seeded just below. Defined here (before any consuming table) so the
-- FKs that follow resolve.
do $$
declare t text;
begin
  foreach t in array array[
    'alignments', 'release_types', 'rarity_levels', 'variation_types',
    'media_types', 'rights_statuses', 'artwork_types',
    'publication_kinds', 'screen_media_kinds', 'interview_formats', 'merchandise_categories',
    'article_kinds'
  ] loop
    execute format($f$
      create table %I (
        id          uuid primary key default gen_random_uuid(),
        slug        text unique not null,
        name        text not null,
        description text,
        sort_order  smallint default 0,
        created_at  timestamptz default now(),
        updated_at  timestamptz default now()
      )$f$, t);
  end loop;
end $$;

insert into alignments (slug, name, sort_order) values
  ('hero','Hero',0), ('villain','Villain',1), ('ally','Ally',2), ('neutral','Neutral',3);
insert into release_types (slug, name, sort_order) values
  ('figure','Figure',0), ('vehicle','Vehicle',1), ('playset','Playset',2),
  ('accessory','Accessory',3), ('box_set','Box set',4);
insert into rarity_levels (slug, name, sort_order) values
  ('common','Common',0), ('uncommon','Uncommon',1), ('rare','Rare',2),
  ('very_rare','Very rare',3), ('grail','Grail',4);
insert into variation_types (slug, name, sort_order) values
  ('card','Card',0), ('paint','Paint',1), ('mold','Mold',2),
  ('accessory','Accessory',3), ('packaging','Packaging',4), ('country','Country',5);
insert into media_types (slug, name, sort_order) values
  ('photo','Photo',0), ('video','Video',1), ('scan','Scan',2), ('audio','Audio',3);
insert into rights_statuses (slug, name, sort_order) values
  ('owned','Owned',0), ('permission_granted','Permission granted',1),
  ('creative_commons','Creative Commons',2), ('fair_use_editorial','Fair use (editorial)',3),
  ('link_only','Link only',4), ('unknown','Unknown',5);
insert into artwork_types (slug, name, sort_order) values
  ('style_guide','Style guide',0), ('card_art','Card art',1), ('box_art','Box art',2),
  ('comic_cover','Comic cover',3), ('comic_interior','Comic interior',4),
  ('concept','Concept',5), ('prototype_render','Prototype render',6);
insert into publication_kinds (slug, name, sort_order) values
  ('mini_series','Mini-series',0), ('pack_in_mini','Pack-in mini',1),
  ('book','Book',2), ('rpg','RPG',3);
insert into screen_media_kinds (slug, name, sort_order) values
  ('series','Series',0), ('episode','Episode',1),
  ('commercial','Commercial',2), ('home_video','Home video',3);
insert into interview_formats (slug, name, sort_order) values
  ('text','Text',0), ('audio','Audio',1), ('video','Video',2);
insert into merchandise_categories (slug, name, sort_order) values
  ('apparel','Apparel',0), ('housewares','Housewares',1),
  ('party','Party',2), ('publishing','Publishing',3);
insert into article_kinds (slug, name, sort_order) values
  ('news','News',0), ('feature','Feature',1), ('guide','Guide',2);

-- ============================================================
-- Characters (canonical identity — line-agnostic)
-- ============================================================
create table characters (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,      -- 'cyborg'
  name              text not null,
  aka               text[] default '{}',
  epithet           text,                      -- powers-card tagline ('The Man of Steel'), all-caps
  alignment         text references alignments(slug) on update cascade on delete restrict,
  first_appearance  text,                      -- 'DC Comics Presents #26 (1980)'
  bio               text,                      -- character biography (About section)
  overview          text,                      -- toy-line editorial (dossier Overview)
  overview_extra    text,                      -- second, standard-styled rich text under Overview
  homeworld         text,                      -- 'Krypton'
  base_of_operations text,                     -- 'Metropolis'
  marital_status    text,                      -- Vital Statistics
  known_relatives   text,                      -- Vital Statistics
  height            text,                      -- Vital Statistics
  weight            text,                      -- Vital Statistics
  eyes              text,                      -- Vital Statistics
  hair              text,                      -- Vital Statistics
  random_fact       text,                      -- titleless last row of Vital Statistics
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
  sort_order   smallint default 0,   -- editorial order, like character_enemies
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
  overview    text,                            -- short lede above the bio (public page)
  bio         text,
  birth_year  smallint,
  death_year  smallint,
  links       text[] default '{}',            -- external URLs: website, social, portfolio (platform derived from domain)
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- The real-world creators who CREATED the character (Siegel & Shuster for
-- Superman). A plain many-to-many with editorial sort_order, rendered as text
-- links to each creator's page in the dossier's Vital Statistics. Distinct from
-- release_creators (a toy's design/sculpt credits) and the curated related_items
-- "See Also" sidebar.
--
-- Sits AFTER creators deliberately: it references both characters and creators,
-- so defining it up with the other character joins made this file fail to run.
create table character_creators (
  character_id uuid references characters(id) on delete cascade,
  creator_id   uuid references creators(id)   on delete cascade,
  sort_order   smallint default 0,   -- editorial order (billing), like character_teams
  primary key (character_id, creator_id)
);
create index on character_creators (creator_id);

-- ============================================================
-- Releases (the physical product) — the workhorse table
-- ============================================================
create table releases (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,      -- 'cyborg-kenner-1986'
  name              text not null,
  type              text not null references release_types(slug) on update cascade on delete restrict,
  -- slug FK into release_statuses; on update cascade so renaming a status flows
  -- through, on delete restrict so an in-use status can't be removed.
  status            text not null default 'released'
                      references release_statuses(slug)
                      on update cascade on delete restrict,

  line_id           uuid not null references lines(id)   on delete restrict,
  series_id         uuid references series(id)           on delete set null,
  character_id      uuid references characters(id)       on delete set null,  -- null for vehicles/playsets
  variant_of        uuid references releases(id)         on delete set null,  -- Argentine Riddler -> Green Lantern

  overview_lede     text,                      -- short enlarged intro (release detail Overview)
  overview_text     text,                      -- rich body under the lede
  release_year      smallint,
  region            text default 'US',         -- ISO-ish: 'US','AR','BR','CO'
  action_feature    text,                      -- 'Thrusting Arms'
  accessories       text[] default '{}',       -- {'drill hand','claw hand'}
  features          text[] default '{}',       -- vehicles/playsets
  card_type         text,                      -- '23-back'
  rarity            text references rarity_levels(slug) on update cascade on delete restrict,
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
  variation_type    text references variation_types(slug) on update cascade on delete restrict,
  description       text,
  rarity            text references rarity_levels(slug) on update cascade on delete restrict,
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
  type           text not null references media_types(slug) on update cascade on delete restrict,
  storage_path   text,                         -- Supabase Storage object path (photos/scans)
  embed_url      text,                         -- YouTube/Vimeo (video)
  poster_path    text,                         -- video thumbnail
  width          int,
  height         int,
  caption        text,
  alt_text       text,                         -- capture at upload; a11y + SEO
  credit         text not null,                -- '© J. Collector'
  source_url     text,
  rights         text not null references rights_statuses(slug) on update cascade on delete restrict, -- never nullable; attribution travels with the asset
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
  role       text not null default 'artwork', -- artwork|loose (dossier vs Toy Database)
  primary key (media_id, release_id)
);
create index on media_releases (release_id, role);
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
  sort_order smallint default 0,
  is_primary boolean default false,           -- the headshot/portrait
  primary key (media_id, creator_id)
);
create table media_variations (
  media_id     uuid references media_assets(id)       on delete cascade,
  variation_id uuid references release_variations(id) on delete cascade,
  sort_order   smallint default 0,
  is_primary   boolean default false,
  primary key (media_id, variation_id)
);
-- Line-level imagery — the manufacturer logo (is_primary) shown on release pages.
create table media_lines (
  media_id   uuid references media_assets(id) on delete cascade,
  line_id    uuid references lines(id)        on delete cascade,
  sort_order smallint default 0,
  is_primary boolean default false,           -- the manufacturer logo
  primary key (media_id, line_id)
);
create index on media_lines (line_id);

-- ============================================================
-- Artwork
-- ============================================================
create table artwork (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  type          text not null references artwork_types(slug) on update cascade on delete restrict,
  year          smallint,
  description   text,
  media_id      uuid references media_assets(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
create table artwork_creators (
  artwork_id uuid references artwork(id)  on delete cascade,
  creator_id uuid references creators(id) on delete cascade,
  sort_order int default 0,   -- editorial order (billing), like character_creators
  primary key (artwork_id, creator_id)
);
create table artwork_characters (
  artwork_id   uuid references artwork(id)     on delete cascade,
  character_id uuid references characters(id)  on delete cascade,
  sort_order   int default 0,   -- editorial order in the admin's link editor
  primary key (artwork_id, character_id)
);

-- ============================================================
-- Publications (comics, mini-comics, books, RPG)
-- ============================================================
create table publications (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  kind          text references publication_kinds(slug) on update cascade on delete restrict,
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
  sort_order     int default 0,                   -- editorial order in the admin's link editor
  primary key (publication_id, character_id)
);

-- ============================================================
-- Screen media (cartoons, commercials, VHS)
-- ============================================================
create table screen_media (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  title         text not null,
  kind          text references screen_media_kinds(slug) on update cascade on delete restrict,
  year          smallint,
  parent_id     uuid references screen_media(id) on delete cascade, -- episode -> series
  description   text,
  media_id      uuid references media_assets(id) on delete set null, -- the video asset
  poster_media_id uuid references media_assets(id) on delete set null, -- still shown before play
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
  format       text references interview_formats(slug) on update cascade on delete restrict,
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
  category     text references merchandise_categories(slug) on update cascade on delete restrict,
  manufacturer text,
  year         smallint,
  description  text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create table merchandise_characters (
  merchandise_id uuid references merchandise(id) on delete cascade,
  character_id   uuid references characters(id)  on delete cascade,
  sort_order     int default 0,                   -- editorial order in the admin's link editor
  primary key (merchandise_id, character_id)
);
-- merchandise attaches photos like every other content type; images still flow
-- through media_assets so credit/rights/alt are captured at upload.
create table media_merchandise (
  media_id       uuid references media_assets(id) on delete cascade,
  merchandise_id uuid references merchandise(id)  on delete cascade,
  sort_order     smallint default 0,
  is_primary     boolean default false,           -- hero image
  primary key (media_id, merchandise_id)
);
create index media_merchandise_merch_idx on media_merchandise (merchandise_id);

-- ============================================================
-- News & articles (the editorial section)
-- ============================================================
-- One table with a `kind` lookup rather than separate news/article tables —
-- a dated news blurb and a long-form feature differ in length and cadence,
-- not in shape. Same call publications and screen_media make with their kinds.

-- Byline identities for the site's own co-authors. Deliberately separate from
-- `creators` (real-world comic people) so site staff never pollute a "Created
-- by" credit, and deliberately NOT tied to auth.users — that table isn't
-- readable with the anon key the pre-render build uses, so a byline sourced
-- from it could never render. Holds only what is safe to publish: no email.
create table editors (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  display_name text not null,
  bio          text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create table articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  kind         text not null references article_kinds(slug) on update cascade on delete restrict,
  dek          text,                                   -- standfirst / teaser
  body         text,                                   -- rich HTML from the admin editor
  author_id    uuid references editors(id) on delete set null,
  published_at timestamptz not null default now(),     -- future = scheduled, see RLS below
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index articles_published_idx on articles (published_at desc);
create index articles_kind_idx      on articles (kind, published_at desc);

create table media_articles (
  media_id   uuid references media_assets(id) on delete cascade,
  article_id uuid references articles(id)     on delete cascade,
  sort_order smallint default 0,
  is_primary boolean default false,           -- hero image
  primary key (media_id, article_id)
);
create index media_articles_article_idx on media_articles (article_id);

-- ============================================================
-- Curated "Related items" — a hand-curated, cross-type "see also"
--
-- The ONE deliberate exception to "typed join tables, no polymorphic pair":
-- a related link can point from any entity to any other, so it's polymorphic
-- and gives up FK integrity on the id columns. source_type/target_type still
-- FK into entity_types (so the type strings can't sprawl), a CHECK blocks
-- self-links, and the build resolves-or-skips each link so a deleted target
-- degrades to "link disappears", never a broken page. cleanup_related_items()
-- sweeps dead rows on demand. Links are one-directional (not auto-mirrored).
-- See migration 20260727000002_related_items.
-- ============================================================
create table entity_types (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  sort_order  smallint default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
insert into entity_types (slug, name, sort_order) values
  ('character','Character',0), ('release','Toy',1), ('publication','Comic',2),
  ('screen_media','Media',3), ('creator','Creator',4),
  ('merchandise','Merchandise',5), ('interview','Interview',6),
  ('article','Article',7);

create table related_items (
  source_type text not null references entity_types(slug) on update cascade on delete restrict,
  source_id   uuid not null,
  target_type text not null references entity_types(slug) on update cascade on delete restrict,
  target_id   uuid not null,
  sort_order  smallint default 0,
  note        text,                          -- optional editorial caption
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (source_type, source_id, target_type, target_id),
  constraint related_not_self check (not (source_type = target_type and source_id = target_id))
);
create index on related_items (source_type, source_id);

-- ============================================================
-- Accounts & access levels
-- Every table above is "trust everyone" — any co-author writes anything.
-- CREDENTIALS are the exception: user_roles says who may change another
-- co-author's email or password, invite someone, or delete an account.
-- Enforced by the admin-users Edge Function — the only holder of the
-- service_role key — which re-checks this table on every call.
-- ============================================================
create table user_roles (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('admin', 'editor')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- named to match the migration rather than the trg_%s_updated loop below
create trigger set_updated_at before update on user_roles
  for each row execute function set_updated_at();

-- New accounts (invited from the admin or created in the Supabase dashboard)
-- land as 'editor'. An admin promotes them from Admin ▸ Account ▸ Users.
-- The live database also carries a one-time seed setting the project owner to
-- 'admin' — a bootstrap, not part of the schema; see the user_roles migration.
create or replace function handle_new_user_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user_role();

-- ============================================================
-- updated_at triggers
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'lines','series','release_statuses','characters','teams','creators','releases','release_variations','media_assets',
    'artwork','publications','screen_media','interviews','merchandise',
    'alignments','release_types','rarity_levels','variation_types','media_types','rights_statuses',
    'artwork_types','publication_kinds','screen_media_kinds','interview_formats','merchandise_categories',
    'article_kinds','editors','articles',
    'entity_types','related_items'
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
    'lines','series','release_statuses','characters','teams','character_teams',
    'character_enemies','character_creators','creators',
    'releases','release_creators','release_characters','release_variations',
    'media_assets','media_releases','media_characters','media_creators','media_variations','media_lines',
    'artwork','artwork_creators','artwork_characters',
    'publications','media_publications','publication_creators','publication_characters',
    'screen_media','interviews','merchandise','merchandise_characters','media_merchandise',
    'alignments','release_types','rarity_levels','variation_types','media_types','rights_statuses',
    'artwork_types','publication_kinds','screen_media_kinds','interview_formats','merchandise_categories',
    'article_kinds','editors','media_articles',
    'entity_types','related_items'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy "public read" on %I for select using (true)', t);
    execute format(
      'create policy "authors write" on %I for all to authenticated
       using (true) with check (true)', t);
  end loop;
end $$;

-- `articles` is the ONE table deliberately held out of the loop above: it must
-- not get a blanket `using (true)` read. Articles carry a published_at that may
-- be in the future (scheduled), and the front end and the pre-render build both
-- read through PostgREST with the anon key — so a blanket policy would serve
-- tomorrow's article to anyone who asked /rest/v1/articles today. Filtering only
-- in the build would make scheduling cosmetic. Authenticated co-authors still
-- see everything, so they can preview and correct what they just scheduled.
alter table articles enable row level security;
create policy "public read published" on articles
  for select to anon using (published_at <= now());
create policy "authors write" on articles
  for all to authenticated using (true) with check (true);

-- `user_roles` is the other hold-out, for the opposite reason: it gets NO write
-- policy at all. A blanket "authors write" would let any co-author promote
-- themselves to admin with the publishable key, which is the whole thing this
-- table exists to prevent. Co-authors may read it (the admin needs its own
-- level to decide what to render); roles change only through the admin-users
-- Edge Function's service_role client, which bypasses RLS by design.
alter table user_roles enable row level security;
create policy "authors read roles" on user_roles
  for select to authenticated using (true);

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
