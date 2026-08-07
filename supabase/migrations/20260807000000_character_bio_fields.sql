-- ============================================================
-- Character bio fields + "Created by" credits
--
-- Adds the classic "Who's Who" bio data to a character dossier:
--   * epithet         — the tagline under the logo on the powers card ("The
--                       Man of Steel"), rendered all-caps
--   * overview_extra   — a second, standard-styled rich-text block that sits
--                       directly under the Overview (NOT the big blue lede)
--   * marital_status / known_relatives / height / weight / eyes / hair —
--                       Vital Statistics rows
--   * random_fact     — a titleless last row in Vital Statistics (a fun aside)
--
-- Plus character_creators: the real-world creators who CREATED the character
-- (Siegel & Shuster for Superman), linked to their creator pages. This is
-- separate from the curated "See Also" (related_items) sidebar and from a
-- release's design/sculpt credits (release_creators).
-- ============================================================

alter table characters add column if not exists epithet         text;
alter table characters add column if not exists overview_extra  text;
alter table characters add column if not exists marital_status  text;
alter table characters add column if not exists known_relatives text;
alter table characters add column if not exists height          text;
alter table characters add column if not exists weight          text;
alter table characters add column if not exists eyes            text;
alter table characters add column if not exists hair            text;
alter table characters add column if not exists random_fact     text;

-- Real-world creators credited with creating the character. A plain
-- many-to-many (no role) with an editorial sort_order — mirrors
-- character_teams. The FK is left auto-named (character_creators_creator_id_fkey)
-- so the admin's link picker can address it.
create table if not exists character_creators (
  character_id uuid references characters(id) on delete cascade,
  creator_id   uuid references creators(id)   on delete cascade,
  sort_order   smallint default 0,   -- editorial order (billing), like character_teams
  primary key (character_id, creator_id)
);
create index if not exists character_creators_creator_id_idx on character_creators (creator_id);

alter table character_creators enable row level security;
create policy "public read" on character_creators for select using (true);
create policy "authors write" on character_creators for all to authenticated
  using (true) with check (true);
