-- ============================================================
-- Character enemies (character <-> character, self-referential)
--
-- Enemies are DC characters, so they're FK links rather than free text —
-- the dossier can then cross-link to the enemy's own page. Rendered two ways:
-- plain text in the powers card (card-back nostalgia) and as links in the
-- "Known Enemies" section.
-- ============================================================
create table character_enemies (
  character_id uuid references characters(id) on delete cascade,
  enemy_id     uuid references characters(id) on delete cascade,
  sort_order   int  default 0,   -- card-back order is editorial, not alphabetical
  primary key (character_id, enemy_id),
  -- a character can't be its own enemy
  constraint character_enemies_not_self check (character_id <> enemy_id)
);

create index on character_enemies (enemy_id);

alter table character_enemies enable row level security;
create policy "public read" on character_enemies for select using (true);
create policy "authors write" on character_enemies for all to authenticated
  using (true) with check (true);
