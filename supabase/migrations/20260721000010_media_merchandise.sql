-- Phase 2 groundwork: "Super Powers in the Media" + licensed merchandise.
--
-- Two structural fixes + seed of vetted editorial content:
--   1. media_merchandise join table — merchandise had no way to attach photos
--      (every other content type does). A showcase needs images, and images
--      still flow through media_assets so credit/rights/alt are captured at
--      upload (CLAUDE.md non-negotiable #1).
--   2. merchandise_characters.sort_order — lets the admin's generic link editor
--      order character links the same way it does everywhere else.
--
-- Seeded rows carry vetted metadata only (from
-- Kenner-Super-Powers-Collection-Reference.md). No media assets are seeded:
-- videos (embed_url) and photos attach through the admin, where real
-- credit/rights are required. Manufacturer/year left NULL where the reference
-- doesn't vet them — author via the admin rather than inventing sources.

-- ============================================================
-- 1. media_merchandise — attach photos/scans to merchandise
-- ============================================================
create table if not exists media_merchandise (
  media_id       uuid references media_assets(id) on delete cascade,
  merchandise_id uuid references merchandise(id)  on delete cascade,
  sort_order     smallint default 0,
  is_primary     boolean default false,           -- hero image
  primary key (media_id, merchandise_id)
);
create index if not exists media_merchandise_merch_idx on media_merchandise (merchandise_id);

alter table media_merchandise enable row level security;
create policy "public read"   on media_merchandise for select using (true);
create policy "authors write" on media_merchandise for all to authenticated
  using (true) with check (true);

-- ============================================================
-- 2. ordered character links on merchandise
-- ============================================================
alter table merchandise_characters
  add column if not exists sort_order int default 0;

-- ============================================================
-- 3. Seed — Screen media (the "video library" spine)
--    Facts from the reference doc's "Animated TV" + "Other tie-ins".
-- ============================================================
insert into screen_media (slug, title, kind, year, description) values
  ('superfriends-legendary-super-powers-show',
   'SuperFriends: The Legendary Super Powers Show', 'series', 1984,
   $txt$Hanna-Barbera's long-running Super Friends was retitled in 1984 to sync with Kenner's new toy line — the animated engine that drove the Super Powers brand into living rooms. Firestorm joined the roster; Darkseid and the New Gods arrived as the villains, mirroring the figures on shelves.$txt$),
  ('super-powers-team-galactic-guardians',
   'The Super Powers Team: Galactic Guardians', 'series', 1985,
   $txt$The eighth and final Super Friends season (1985–86), story-edited by Alan Burnett — often cited as a precursor to the later DC animated "Timm-verse." Cyborg joined the team; the darker, more serialized tone tracked the line's Series 3 expansion.$txt$),
  ('kenner-super-powers-tv-commercials',
   'Kenner Super Powers TV Commercials', 'commercial', 1984,
   $txt$The vintage Kenner television spots that sold the line — stop-motion and live-action ads showcasing the Power Action features wave by wave (1984–1986). A core piece of the nostalgia and a frequent subject of collector video archives.$txt$),
  ('super-powers-warner-home-video',
   'Super Powers — Warner Home Video (VHS/Betamax)', 'home_video', 1985,
   $txt$In 1985 Warner Home Video reissued 1960s Filmation DC cartoons (Superman, Batman, Superboy, Aquaman) under the Super Powers label — part of DC's 50th-anniversary push and the toy line's cross-promotion.$txt$);

-- ============================================================
-- 4. Seed — Licensed merchandise (non-figure, Super Powers logo)
--    The 1984 Toy Fair licensing blitz + tie-ins from the reference doc.
--    Manufacturer/year NULL where not vetted — fill via the admin.
-- ============================================================
insert into merchandise (slug, name, category, manufacturer, year, description) values
  ('super-powers-lunchboxes', 'Super Powers Lunchboxes', 'housewares', null, 1984,
   $txt$Metal and plastic lunchboxes carrying the Super Powers logo and García-López style-guide character art — part of the 1984 Toy Fair licensing blitz.$txt$),
  ('super-powers-underoos', 'Super Powers Underoos', 'apparel', null, 1984,
   $txt$"Underwear that's fun to wear" — character-emblazoned Underoos sets under the Super Powers banner, among the most remembered soft-goods tie-ins of the era.$txt$),
  ('super-powers-puffy-stickers', 'Super Powers 3-D Puffy Stickers', 'party', null, 1984,
   $txt$Padded vinyl "puffy" stickers featuring the line's heroes and villains — a staple of mid-'80s licensed party and stationery goods.$txt$),
  ('super-powers-party-supplies', 'Super Powers Party Supplies', 'party', null, 1984,
   $txt$Paper plates, cups, napkins, banners and invitations bearing the Super Powers logo — the licensed birthday-party ecosystem of the period.$txt$),
  ('super-powers-paintable-figurines', 'Super Powers Paintable Figurines', 'housewares', null, 1984,
   $txt$Cast figural blanks sold with paints for kids to finish at home — a common licensed craft item of the mid-1980s.$txt$),
  ('super-powers-bedsheets', 'Super Powers Bedsheets & Bedding', 'housewares', null, 1984,
   $txt$Sheets, pillowcases and comforters printed with the Super Powers heroes — the line's reach into the bedroom textile category.$txt$),
  ('super-powers-secret-of-the-frozen-city', 'Coloring & Activity Books — "Secret of the Frozen City"', 'publishing', null, 1984,
   $txt$Coloring and activity books under the Super Powers label, including the titled "Secret of the Frozen City" plus character-specific editions.$txt$),
  ('super-powers-which-way-books', 'Which Way Books (interactive storybooks)', 'publishing', null, 1985,
   $txt$"Which Way" choose-your-path interactive storybooks tied into the Super Powers branding — the reader decides the hero's next move.$txt$),
  ('dc-heroes-rpg-mayfair', 'DC Heroes RPG (Mayfair Games)', 'publishing', 'Mayfair Games', 1985,
   $txt$Mayfair Games' DC Heroes tabletop role-playing game launched in this era and tied into the DC/Super Powers branding — the era's licensed way to play the whole roster on paper.$txt$);
