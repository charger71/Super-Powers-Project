-- Convert every remaining controlled vocabulary into an editable lookup table,
-- following the exact pattern established for release_statuses
-- (20260726000001_release_status_lookup.sql). Co-authors want to manage these
-- values themselves instead of a migration + code deploy per new value.
--
-- Two shapes are converted here:
--   * Postgres enums (alignment, release_type, rarity_level, variation_type,
--     media_type, rights_status, artwork_type) → the column becomes TEXT holding
--     the same slug, gains an FK into the lookup, and the enum type is dropped.
--   * Free-text vocab columns (publications.kind, screen_media.kind,
--     interviews.format, merchandise.category) → already text, they just gain the
--     lookup table + FK.
--
-- Compatibility trick (same as statuses): each column keeps the slug the enum
-- used, so anything reading it as a string (the static build, titleCase(), etc.)
-- keeps working. The only new rule is an FK: a value must exist in the lookup
-- before a row can use it. ON UPDATE CASCADE lets a slug rename in the admin flow
-- through to the referencing rows; ON DELETE RESTRICT stops an in-use value from
-- being deleted out from under them.

-- release_full is `select r.*`, so it depends on releases.type and releases.rarity
-- (both change type here). Drop it now; recreate it unchanged at the end.
drop view if exists release_full;

-- 1. Create the 11 lookup tables. Identical shape to release_statuses/lines: uuid
--    pk + unique human slug (so the id-based generic admin CRUD works as-is) with
--    the slug doubling as the value the referencing column stores. RLS + the
--    shared updated_at trigger are attached in the same loop.
do $$
declare t text;
begin
  foreach t in array array[
    'alignments', 'release_types', 'rarity_levels', 'variation_types',
    'media_types', 'rights_statuses', 'artwork_types',
    'publication_kinds', 'screen_media_kinds', 'interview_formats', 'merchandise_categories'
  ] loop
    execute format($f$
      create table if not exists %I (
        id          uuid primary key default gen_random_uuid(),
        slug        text unique not null,
        name        text not null,
        description text,
        sort_order  smallint default 0,
        created_at  timestamptz default now(),
        updated_at  timestamptz default now()
      )$f$, t);
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select using (true)', t);
    execute format('create policy "authors write" on %I for all to authenticated using (true) with check (true)', t);
    execute format(
      'create trigger trg_%s_updated before update on %I
       for each row execute function set_updated_at()', t, t);
  end loop;
end $$;

-- 2. Seed the existing values, preserving their order as sort_order.
insert into alignments (slug, name, sort_order) values
  ('hero', 'Hero', 0), ('villain', 'Villain', 1), ('ally', 'Ally', 2), ('neutral', 'Neutral', 3)
on conflict (slug) do nothing;

insert into release_types (slug, name, sort_order) values
  ('figure', 'Figure', 0), ('vehicle', 'Vehicle', 1), ('playset', 'Playset', 2),
  ('accessory', 'Accessory', 3), ('box_set', 'Box set', 4)
on conflict (slug) do nothing;

insert into rarity_levels (slug, name, sort_order) values
  ('common', 'Common', 0), ('uncommon', 'Uncommon', 1), ('rare', 'Rare', 2),
  ('very_rare', 'Very rare', 3), ('grail', 'Grail', 4)
on conflict (slug) do nothing;

insert into variation_types (slug, name, sort_order) values
  ('card', 'Card', 0), ('paint', 'Paint', 1), ('mold', 'Mold', 2),
  ('accessory', 'Accessory', 3), ('packaging', 'Packaging', 4), ('country', 'Country', 5)
on conflict (slug) do nothing;

insert into media_types (slug, name, sort_order) values
  ('photo', 'Photo', 0), ('video', 'Video', 1), ('scan', 'Scan', 2), ('audio', 'Audio', 3)
on conflict (slug) do nothing;

insert into rights_statuses (slug, name, sort_order) values
  ('owned', 'Owned', 0), ('permission_granted', 'Permission granted', 1),
  ('creative_commons', 'Creative Commons', 2), ('fair_use_editorial', 'Fair use (editorial)', 3),
  ('link_only', 'Link only', 4), ('unknown', 'Unknown', 5)
on conflict (slug) do nothing;

insert into artwork_types (slug, name, sort_order) values
  ('style_guide', 'Style guide', 0), ('card_art', 'Card art', 1), ('box_art', 'Box art', 2),
  ('comic_cover', 'Comic cover', 3), ('comic_interior', 'Comic interior', 4),
  ('concept', 'Concept', 5), ('prototype_render', 'Prototype render', 6)
on conflict (slug) do nothing;

insert into publication_kinds (slug, name, sort_order) values
  ('mini_series', 'Mini-series', 0), ('pack_in_mini', 'Pack-in mini', 1),
  ('book', 'Book', 2), ('rpg', 'RPG', 3)
on conflict (slug) do nothing;

insert into screen_media_kinds (slug, name, sort_order) values
  ('series', 'Series', 0), ('episode', 'Episode', 1),
  ('commercial', 'Commercial', 2), ('home_video', 'Home video', 3)
on conflict (slug) do nothing;

insert into interview_formats (slug, name, sort_order) values
  ('text', 'Text', 0), ('audio', 'Audio', 1), ('video', 'Video', 2)
on conflict (slug) do nothing;

insert into merchandise_categories (slug, name, sort_order) values
  ('apparel', 'Apparel', 0), ('housewares', 'Housewares', 1),
  ('party', 'Party', 2), ('publishing', 'Publishing', 3)
on conflict (slug) do nothing;

-- 2b. Defensive: the four free-text columns had no constraint, so absorb any
--     stray values already in the data before the FK is enforced (nice enough
--     display name derived from the slug; edit later in the admin).
insert into publication_kinds (slug, name)
  select distinct kind, initcap(replace(kind, '_', ' ')) from publications where kind is not null
on conflict (slug) do nothing;
insert into screen_media_kinds (slug, name)
  select distinct kind, initcap(replace(kind, '_', ' ')) from screen_media where kind is not null
on conflict (slug) do nothing;
insert into interview_formats (slug, name)
  select distinct format, initcap(replace(format, '_', ' ')) from interviews where format is not null
on conflict (slug) do nothing;
insert into merchandise_categories (slug, name)
  select distinct category, initcap(replace(category, '_', ' ')) from merchandise where category is not null
on conflict (slug) do nothing;

-- 3. Convert enum columns to text + FK, then drop the now-unused enum type.
--    `set data type` is used throughout (and columns literally named "type" are
--    quoted) to keep the statements unambiguous. NOT NULL survives the swap; the
--    releases(type) / media_assets(type,rights) indexes rebuild automatically.
alter table characters alter column alignment set data type text using alignment::text;
alter table characters add constraint characters_alignment_fkey
  foreign key (alignment) references alignments (slug) on update cascade on delete restrict;
drop type alignment;

alter table releases alter column "type" set data type text using "type"::text;
alter table releases add constraint releases_type_fkey
  foreign key ("type") references release_types (slug) on update cascade on delete restrict;
drop type release_type;

-- rarity_level backs two columns; convert both before dropping the type.
alter table releases alter column rarity set data type text using rarity::text;
alter table release_variations alter column rarity set data type text using rarity::text;
alter table releases add constraint releases_rarity_fkey
  foreign key (rarity) references rarity_levels (slug) on update cascade on delete restrict;
alter table release_variations add constraint release_variations_rarity_fkey
  foreign key (rarity) references rarity_levels (slug) on update cascade on delete restrict;
drop type rarity_level;

alter table release_variations alter column variation_type set data type text using variation_type::text;
alter table release_variations add constraint release_variations_variation_type_fkey
  foreign key (variation_type) references variation_types (slug) on update cascade on delete restrict;
drop type variation_type;

alter table media_assets alter column "type" set data type text using "type"::text;
alter table media_assets add constraint media_assets_type_fkey
  foreign key ("type") references media_types (slug) on update cascade on delete restrict;
drop type media_type;

alter table media_assets alter column rights set data type text using rights::text;
alter table media_assets add constraint media_assets_rights_fkey
  foreign key (rights) references rights_statuses (slug) on update cascade on delete restrict;
drop type rights_status;

alter table artwork alter column "type" set data type text using "type"::text;
alter table artwork add constraint artwork_type_fkey
  foreign key ("type") references artwork_types (slug) on update cascade on delete restrict;
drop type artwork_type;

-- 4. Free-text vocab columns are already text — just wire up the FK.
alter table publications add constraint publications_kind_fkey
  foreign key (kind) references publication_kinds (slug) on update cascade on delete restrict;
alter table screen_media add constraint screen_media_kind_fkey
  foreign key (kind) references screen_media_kinds (slug) on update cascade on delete restrict;
alter table interviews add constraint interviews_format_fkey
  foreign key (format) references interview_formats (slug) on update cascade on delete restrict;
alter table merchandise add constraint merchandise_category_fkey
  foreign key (category) references merchandise_categories (slug) on update cascade on delete restrict;

-- 5. Recreate the convenience view exactly as it was.
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
