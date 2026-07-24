-- Gaps surfaced by wiring the dossier page to live data:
-- 1. The dossier's "Overview" editorial (toy-line-focused, distinct from the
--    character bio) had no home.
-- 2. Publications had no link to characters, so a character page couldn't
--    query its comic appearances.

alter table characters add column overview text;

create table publication_characters (
  publication_id uuid references publications(id) on delete cascade,
  character_id   uuid references characters(id)   on delete cascade,
  primary key (publication_id, character_id)
);
alter table publication_characters enable row level security;
create policy "public read" on publication_characters for select using (true);
create policy "authors write" on publication_characters for all to authenticated
  using (true) with check (true);

-- Golden record: Superman's overview editorial (from the dossier comp).
update characters set overview =
$txt$Superman launched the Super Powers Collection in the spring of 1984 — the figure that opened the pegboard and set the tone for everything Kenner released across the next two years. He came packaged on a blue starfield card back with a Power Punch action, a mini-comic drawn by Jack Kirby, and the tagline that carried the whole line.

Kenner's Series 1 mold gave Superman the definitive 4 ¾-inch action-figure silhouette for a generation: block cape, sculpted S-shield, red trunks over blue tights, boots to the knee. Squeeze the legs together and both arms swing forward in a two-fisted "Power Punch" — a hidden lever mechanism buried in the torso, and one of the small engineering feats that made the line feel alive on a store shelf.

By the time Wave 3 arrived in 1986 the figure had appeared in Kenner catalogs, on Saturday-morning television, in a Super Powers–branded Colorforms set, and inside the pages of DC's own tie-in mini-series. The figure itself was never revised, remade, or repainted across the line's eighteen-month run — a rare distinction that speaks to how completely Kenner nailed Superman on the first try.$txt$
where slug = 'superman';

-- Link the seeded publications to Superman.
insert into publication_characters (publication_id, character_id)
select p.id, c.id
from publications p, characters c
where c.slug = 'superman';
