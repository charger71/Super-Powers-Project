-- Convert release_status from a fixed enum into an editable lookup table.
--
-- The other controlled vocabularies stay enums, but co-authors kept needing new
-- release statuses (store exclusives, convention exclusives, "announced but not
-- yet shipped"...), and ALTER TYPE ADD VALUE for each one means a migration and
-- a code deploy every time. schema.sql already flagged the escape hatch: "Use
-- lookup tables instead if you expect co-authors to manage these values
-- themselves." Statuses crossed that line, so they graduate to a table.
--
-- Compatibility trick: releases.status stays a TEXT column holding the same
-- slug the enum used ('released', 'international_variant', ...). Nothing that
-- reads status as a string changes — the static build's `r.status !== 'released'`
-- and titleCase(r.status) keep working untouched. The only new rule is a foreign
-- key so a status has to exist in the lookup table before a release can use it.

-- release_full is defined as `select r.*`, so it depends on releases.status and
-- would block the column-type change. Drop it here; recreate it (unchanged) at
-- the end.
drop view if exists release_full;

-- 1. The lookup table. Same shape as lines/series: uuid pk + unique human slug
--    (so the generic admin CRUD, which is id-based, works as-is) with the slug
--    doubling as the value releases point at.
create table if not exists release_statuses (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- 'international_variant' (matches old enum labels)
  name        text not null,                 -- 'International variant' (display label)
  description text,
  sort_order  smallint default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- 2. Seed the six existing enum values, preserving their order.
insert into release_statuses (slug, name, sort_order) values
  ('released',              'Released',              0),
  ('mail_away',             'Mail-away',             1),
  ('international_variant', 'International variant',  2),
  ('prototype',             'Prototype',             3),
  ('cancelled',             'Cancelled',             4),
  ('reissue',               'Reissue',               5)
on conflict (slug) do nothing;

-- 3. Convert releases.status from the enum to text + FK. Drop the default first
--    ('released'::release_status can't cast cleanly once the type changes), swap
--    the type, restore a plain-text default, then wire up the FK. ON UPDATE
--    CASCADE so renaming a status slug in the admin flows through to releases;
--    ON DELETE RESTRICT so a status still in use can't be deleted out from under
--    a release. NOT NULL survives the type change. The existing releases(status)
--    index is rebuilt automatically by the type change.
alter table releases alter column status drop default;
alter table releases alter column status type text using status::text;
alter table releases alter column status set default 'released';
alter table releases
  add constraint releases_status_fkey
  foreign key (status) references release_statuses (slug)
  on update cascade on delete restrict;

-- 4. The enum type is now unused.
drop type release_status;

-- 5. Team membership gets an editorial sort_order, mirroring character_enemies,
--    so the admin's generic many-to-many link editor (which orders by and writes
--    sort_order) can manage character_teams like it manages enemies.
alter table character_teams add column if not exists sort_order smallint default 0;

-- 6. updated_at trigger, matching every other content table.
create trigger trg_release_statuses_updated before update on release_statuses
  for each row execute function set_updated_at();

-- 7. RLS: public read, authenticated authors write — the same policy pair every
--    other table carries.
alter table release_statuses enable row level security;
create policy "public read" on release_statuses for select using (true);
create policy "authors write" on release_statuses for all to authenticated
  using (true) with check (true);

-- 8. Recreate the convenience view exactly as it was.
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
