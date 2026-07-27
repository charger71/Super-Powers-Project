-- ============================================================
-- Curated "Related items" — a hand-curated, cross-type "see also".
--
-- This is the ONE deliberate exception to the schema's rule of typed join
-- tables with real FKs (see CLAUDE.md / the media_* join tables). A related
-- link can point from any entity to any other (character -> comic, release ->
-- creator, ...), which is inherently polymorphic. Rather than a join table per
-- type pair (character_related_releases, release_related_publications, ...) we
-- accept ONE polymorphic table and give up FK integrity on the id columns.
--
-- What we keep instead of FKs:
--   * source_type / target_type FK into entity_types, so the type strings
--     can't sprawl ('char' / 'character' / 'figure').
--   * a self-link CHECK.
--   * build-time tolerance: build-dossiers.mjs resolves every link against the
--     rows it already fetched and silently SKIPS any whose target no longer
--     exists — so a deleted target degrades to "link disappears", never a
--     broken page.
--   * cleanup_related_items(): sweep dead rows on demand (no FK cascade does
--     it for us).
--
-- Links are one-directional and curated: adding "Batman -> Batmobile" shows on
-- Batman's page only; it is not auto-mirrored onto the Batmobile.
-- ============================================================

-- The linkable entity types — same editable-lookup shape as alignments etc.
-- Only types that have a public page are listed (media assets have none).
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
  ('character',    'Character', 0),
  ('release',      'Toy',       1),
  ('publication',  'Comic',     2),
  ('screen_media', 'Media',     3),
  ('creator',      'Creator',   4);

create table related_items (
  source_type text not null references entity_types(slug) on update cascade on delete restrict,
  source_id   uuid not null,
  target_type text not null references entity_types(slug) on update cascade on delete restrict,
  target_id   uuid not null,
  sort_order  smallint default 0,
  note        text,                          -- optional editorial caption ("appears in")
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  primary key (source_type, source_id, target_type, target_id),
  -- a record can't be related to itself
  constraint related_not_self check (not (source_type = target_type and source_id = target_id))
);
-- the build queries "everything related out of this record"
create index on related_items (source_type, source_id);

-- updated_at trigger (set_updated_at() is defined in the initial schema)
create trigger trg_entity_types_updated before update on entity_types
  for each row execute function set_updated_at();
create trigger trg_related_items_updated before update on related_items
  for each row execute function set_updated_at();

-- RLS: public read, authenticated authors write (a join table without RLS is
-- anon-writable on Supabase — same policy as every other table here).
alter table entity_types enable row level security;
create policy "public read" on entity_types for select using (true);
create policy "authors write" on entity_types for all to authenticated
  using (true) with check (true);

alter table related_items enable row level security;
create policy "public read" on related_items for select using (true);
create policy "authors write" on related_items for all to authenticated
  using (true) with check (true);

-- Sweep links whose source or target row no longer exists. No FK does this for
-- us (the id columns are intentionally FK-less), so run it after bulk deletes.
-- security definer so it can read across the base tables regardless of caller.
create or replace function cleanup_related_items()
returns integer language plpgsql security definer as $$
declare
  deleted integer := 0;
begin
  with dead as (
    delete from related_items ri
    where not exists (
      select 1 from characters   c where ri.source_type = 'character'    and c.id  = ri.source_id
      union all select 1 from releases     r where ri.source_type = 'release'      and r.id  = ri.source_id
      union all select 1 from publications p where ri.source_type = 'publication'  and p.id  = ri.source_id
      union all select 1 from screen_media s where ri.source_type = 'screen_media' and s.id  = ri.source_id
      union all select 1 from creators     k where ri.source_type = 'creator'      and k.id  = ri.source_id
    )
    or not exists (
      select 1 from characters   c where ri.target_type = 'character'    and c.id  = ri.target_id
      union all select 1 from releases     r where ri.target_type = 'release'      and r.id  = ri.target_id
      union all select 1 from publications p where ri.target_type = 'publication'  and p.id  = ri.target_id
      union all select 1 from screen_media s where ri.target_type = 'screen_media' and s.id  = ri.target_id
      union all select 1 from creators     k where ri.target_type = 'creator'      and k.id  = ri.target_id
    )
    returning 1
  )
  select count(*) into deleted from dead;
  return deleted;
end $$;
