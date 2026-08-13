-- News & articles — the editorial section.
--
-- One table with a `kind` lookup rather than separate news/article tables:
-- a dated site-news blurb and a long-form feature differ in length and
-- cadence, not in shape. Same call publications and screen_media already make
-- with their own kind vocabularies, and it keeps one admin entity, one index,
-- and one URL space (/news/<slug>.html). Splitting later is cheap; merging
-- two live URL spaces is not.
--
-- Bylines credit the site's own editors, NOT the `creators` table — creators
-- means real-world comic people (Kirby, Pérez, García-López), and mixing site
-- staff into it would pollute every "Created by" credit on the site.
--
-- Scheduling: published_at is NOT NULL DEFAULT now(), so writing an article
-- publishes it (the "trust everyone, publish direct" model in CLAUDE.md).
-- Setting a FUTURE published_at holds it back. That hold is enforced in RLS,
-- not merely in the build — see the policy note below.

-- ============================================================
-- 1. article kinds — editable controlled vocabulary
-- ============================================================
-- Column-for-column identical to every other vocab table (schema.sql builds
-- them all from one loop). `description` in particular is not optional: the
-- admin's generic vocabulary editor renders a Description field for every
-- lookup, so omitting it here would break editing an article kind.
create table if not exists article_kinds (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  sort_order  smallint default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

insert into article_kinds (slug, name, sort_order) values
  ('news','News',0), ('feature','Feature',1), ('guide','Guide',2)
on conflict (slug) do nothing;

-- ============================================================
-- 2. editors — byline identities for the site's co-authors
-- ============================================================
-- Deliberately NOT tied to auth.users: auth.users is not readable with the
-- anon key, and the public site is pre-rendered with that key, so a byline
-- sourced from it could never render. This table holds only what is safe to
-- publish — a display name and a slug. No email, no PII.
create table if not exists editors (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  display_name text not null,
  bio          text,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- ============================================================
-- 3. articles
-- ============================================================
create table if not exists articles (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  title        text not null,
  kind         text not null references article_kinds(slug) on update cascade on delete restrict,
  dek          text,                                   -- standfirst / teaser
  body         text,                                   -- rich HTML from the admin editor
  author_id    uuid references editors(id) on delete set null,
  published_at timestamptz not null default now(),     -- future = scheduled
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);
create index if not exists articles_published_idx on articles (published_at desc);
create index if not exists articles_kind_idx      on articles (kind, published_at desc);

-- photos attach like every other content type, so credit/rights/alt are still
-- captured at upload (CLAUDE.md non-negotiable #1). is_primary = hero image.
create table if not exists media_articles (
  media_id   uuid references media_assets(id) on delete cascade,
  article_id uuid references articles(id)     on delete cascade,
  sort_order smallint default 0,
  is_primary boolean default false,
  primary key (media_id, article_id)
);
create index if not exists media_articles_article_idx on media_articles (article_id);

-- lets articles be a source/target of the curated "see also" (related_items)
insert into entity_types (slug, name, sort_order) values
  ('article','Article',7)
on conflict (slug) do nothing;

-- ============================================================
-- 4. Row Level Security
-- ============================================================
-- article_kinds / editors / media_articles follow the house model: public
-- reads everything, authenticated co-authors write everything.
alter table article_kinds  enable row level security;
alter table editors        enable row level security;
alter table media_articles enable row level security;

create policy "public read"   on article_kinds  for select using (true);
create policy "authors write" on article_kinds  for all to authenticated using (true) with check (true);
create policy "public read"   on editors        for select using (true);
create policy "authors write" on editors        for all to authenticated using (true) with check (true);
create policy "public read"   on media_articles for select using (true);
create policy "authors write" on media_articles for all to authenticated using (true) with check (true);

-- articles is the ONE table that does not get a blanket `using (true)` read.
-- A scheduled post must be invisible to the anon key, not merely omitted from
-- the rendered HTML: the front end and the build both read through PostgREST
-- with that key, so a `using (true)` policy would serve tomorrow's article to
-- anyone who asked /rest/v1/articles today. Filtering only in the build would
-- make scheduling cosmetic.
alter table articles enable row level security;

create policy "public read published" on articles
  for select to anon using (published_at <= now());

-- Authenticated co-authors see and edit everything, scheduled posts included —
-- otherwise they could not preview or correct what they just scheduled.
create policy "authors write" on articles
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 5. updated_at triggers
-- ============================================================
create trigger trg_article_kinds_updated before update on article_kinds
  for each row execute function set_updated_at();
create trigger trg_editors_updated before update on editors
  for each row execute function set_updated_at();
create trigger trg_articles_updated before update on articles
  for each row execute function set_updated_at();
