-- Phase 1 seed: the full Kenner Super Powers Collection, from the vetted
-- Kenner-Super-Powers-Collection-Reference.md.
--
-- Editorial policy for this seed:
--  * Facts come from the reference doc. Where it names an action feature or
--    accessory, it's here; where it doesn't (e.g. Series 1 villain Power
--    Actions), the field stays NULL for authors to fill — nothing invented.
--  * first_appearance / aka only where they are settled public record;
--    ambiguous cases (Hawkman's identity) stay NULL.
--  * Characters get name/slug/alignment only — bios, overviews, and vitals
--    are author work, entered through the admin.

-- ============================================================
-- Characters (33 new; Superman already exists)
-- ============================================================
insert into characters (slug, name, aka, alignment, first_appearance)
values
  ('batman',            'Batman',            array['Bruce Wayne']::text[],               'hero',    'Detective Comics #27 (1939)'),
  ('robin',             'Robin',             array['Dick Grayson'],                      'hero',    'Detective Comics #38 (1940)'),
  ('wonder-woman',      'Wonder Woman',      array['Diana Prince'],                      'hero',    'All Star Comics #8 (1941)'),
  ('aquaman',           'Aquaman',           array['Arthur Curry'],                      'hero',    'More Fun Comics #73 (1941)'),
  ('the-flash',         'The Flash',         array['Barry Allen'],                       'hero',    'Showcase #4 (1956)'),
  ('green-lantern',     'Green Lantern',     array['Hal Jordan'],                        'hero',    'Showcase #22 (1959)'),
  ('hawkman',           'Hawkman',           array[]::text[],                            'hero',    null),
  ('lex-luthor',        'Lex Luthor',        array[]::text[],                            'villain', 'Action Comics #23 (1940)'),
  ('brainiac',          'Brainiac',          array[]::text[],                            'villain', 'Action Comics #242 (1958)'),
  ('the-joker',         'The Joker',         array[]::text[],                            'villain', 'Batman #1 (1940)'),
  ('the-penguin',       'The Penguin',       array['Oswald Cobblepot'],                  'villain', 'Detective Comics #58 (1941)'),
  ('firestorm',         'Firestorm',         array['Ronnie Raymond', 'Martin Stein'],    'hero',    'Firestorm, the Nuclear Man #1 (1978)'),
  ('green-arrow',       'Green Arrow',       array['Oliver Queen'],                      'hero',    'More Fun Comics #73 (1941)'),
  ('martian-manhunter', 'Martian Manhunter', array['J''onn J''onzz'],                    'hero',    'Detective Comics #225 (1955)'),
  ('red-tornado',       'Red Tornado',       array[]::text[],                            'hero',    'Justice League of America #64 (1968)'),
  ('doctor-fate',       'Doctor Fate',       array['Kent Nelson'],                       'hero',    'More Fun Comics #55 (1940)'),
  ('darkseid',          'Darkseid',          array[]::text[],                            'villain', 'Superman''s Pal Jimmy Olsen #134 (1970)'),
  ('desaad',            'DeSaad',            array[]::text[],                            'villain', 'Forever People #2 (1971)'),
  ('kalibak',           'Kalibak',           array[]::text[],                            'villain', 'New Gods #1 (1971)'),
  ('steppenwolf',       'Steppenwolf',       array[]::text[],                            'villain', 'New Gods #7 (1972)'),
  ('mantis',            'Mantis',            array[]::text[],                            'villain', 'Forever People #2 (1971)'),
  ('parademon',         'Parademon',         array[]::text[],                            'villain', null),
  ('shazam',            'Shazam!',           array['Captain Marvel', 'Billy Batson'],    'hero',    'Whiz Comics #2 (1940)'),
  ('plastic-man',       'Plastic Man',       array['Eel O''Brian'],                      'hero',    'Police Comics #1 (1941)'),
  ('orion',             'Orion',             array[]::text[],                            'hero',    'New Gods #1 (1971)'),
  ('mister-miracle',    'Mister Miracle',    array['Scott Free'],                        'hero',    'Mister Miracle #1 (1971)'),
  ('cyborg',            'Cyborg',            array['Victor Stone'],                      'hero',    'DC Comics Presents #26 (1980)'),
  ('samurai',           'Samurai',           array['Toshio Eto'],                        'hero',    'The All-New Super Friends Hour (1977)'),
  ('golden-pharaoh',    'Golden Pharaoh',    array[]::text[],                            'hero',    'Super Powers Collection (1986)'),
  ('mr-freeze',         'Mr. Freeze',        array['Victor Fries'],                      'villain', 'Batman #121 (1959)'),
  ('cyclotron',         'Cyclotron',         array[]::text[],                            'ally',    'Super Powers Collection (1986)'),
  ('tyr',               'Tyr',               array[]::text[],                            'villain', 'Super Powers Collection (1986)'),
  ('riddler',           'The Riddler',       array['Edward Nigma'],                      'villain', 'Detective Comics #140 (1948)'),
  ('man-bat',           'Man-Bat',           array['Kirk Langstrom'],                    'villain', 'Detective Comics #400 (1970)');

-- ============================================================
-- Additional creators
-- ============================================================
insert into creators (slug, name, role_summary) values
  ('george-perez', 'George Pérez',
   'Designed Cyborg and redesigned Lex Luthor and Brainiac for the toy line — one of the rare cases of creator royalties.'),
  ('dick-giordano', 'Dick Giordano',
   'Additional figure and packaging artwork alongside the García-López style guides.');

-- ============================================================
-- Figure releases (33 new; the 3 Superman cards + Clark Kent exist)
-- ============================================================
insert into releases
  (slug, name, type, status, line_id, series_id, character_id,
   release_year, region, action_feature, accessories, rarity, notes, sources)
select
  v.slug, v.name, 'figure', 'released',
  (select id from lines where slug = 'kenner-super-powers'),
  s.id, c.id, v.year, 'US', v.action, v.accessories, v.rarity::rarity_level, v.notes,
  array['https://kennersuperpowers.com']
from (values
  -- Series 1 (1984)
  ('batman-kenner-1984',            'Batman',            'kenner-series-1', 'batman',            1984, 'Power Action Punch',            array[]::text[],                                       null,        null),
  ('robin-kenner-1984',             'Robin',             'kenner-series-1', 'robin',             1984, 'Power Action Karate Chop',      array[]::text[],                                       null,        null),
  ('wonder-woman-kenner-1984',      'Wonder Woman',      'kenner-series-1', 'wonder-woman',      1984, 'Power Action Deflection',       array[]::text[],                                       null,        null),
  ('aquaman-kenner-1984',           'Aquaman',           'kenner-series-1', 'aquaman',           1984, 'Power Action Deep Sea Kick',    array[]::text[],                                       null,        'Leg-action figures like Aquaman often wear loose with age and become hard to stand.'),
  ('the-flash-kenner-1984',         'The Flash',         'kenner-series-1', 'the-flash',         1984, 'Power Action Running Legs',     array[]::text[],                                       null,        'Leg-action figures like Flash often wear loose with age and become hard to stand.'),
  ('green-lantern-kenner-1984',     'Green Lantern',     'kenner-series-1', 'green-lantern',     1984, 'Power Action Power Beam',       array['green lantern'],                                null,        'Came with a lantern accessory.'),
  ('hawkman-kenner-1984',           'Hawkman',           'kenner-series-1', 'hawkman',           1984, 'Power Action Wings',            array[]::text[],                                       null,        'Flapping-wing action.'),
  ('lex-luthor-kenner-1984',        'Lex Luthor',        'kenner-series-1', 'lex-luthor',        1984, null,                            array['armor'],                                        null,        'Pérez-redesigned armored Luthor; came with armor.'),
  ('brainiac-kenner-1984',          'Brainiac',          'kenner-series-1', 'brainiac',          1984, null,                            array[]::text[],                                       null,        'Pérez-redesigned chrome-look Brainiac.'),
  ('the-joker-kenner-1984',         'The Joker',         'kenner-series-1', 'the-joker',         1984, null,                            array[]::text[],                                       null,        null),
  ('the-penguin-kenner-1984',       'The Penguin',       'kenner-series-1', 'the-penguin',       1984, null,                            array[]::text[],                                       null,        null),
  -- Series 2 (1985)
  ('firestorm-kenner-1985',         'Firestorm',         'kenner-series-2', 'firestorm',         1985, 'Power Action Atomic Punch',     array[]::text[],                                       null,        null),
  ('green-arrow-kenner-1985',       'Green Arrow',       'kenner-series-2', 'green-arrow',       1985, 'Power Action Archery Pull',     array['bow', '3 arrows'],                              null,        null),
  ('martian-manhunter-kenner-1985', 'Martian Manhunter', 'kenner-series-2', 'martian-manhunter', 1985, 'Power Action Martian Punch',    array['removable cape'],                               null,        null),
  ('red-tornado-kenner-1985',       'Red Tornado',       'kenner-series-2', 'red-tornado',       1985, 'Power Action Tornado Twist',    array['removable cape'],                               null,        null),
  ('doctor-fate-kenner-1985',       'Doctor Fate',       'kenner-series-2', 'doctor-fate',       1985, 'Power Action Mystic Spell Cast', array['removable cape'],                              null,        null),
  ('darkseid-kenner-1985',          'Darkseid',          'kenner-series-2', 'darkseid',          1985, 'Power Action Raging Motion',    array['removable cape'],                               null,        'Kirby redesigned his Fourth World characters for the line — reportedly among the only royalties he received for his creations.'),
  ('desaad-kenner-1985',            'DeSaad',            'kenner-series-2', 'desaad',            1985, 'Power Action Shock Squeeze',    array['removable skirt'],                              null,        null),
  ('kalibak-kenner-1985',           'Kalibak',           'kenner-series-2', 'kalibak',           1985, 'Power Action Club Swing',       array['Beta-Club'],                                    null,        null),
  ('steppenwolf-kenner-1985',       'Steppenwolf',       'kenner-series-2', 'steppenwolf',       1985, 'Power Action Electro-Axe Chop', array['Electro-Axe'],                                  null,        'Also offered as a mail-in in some markets; sourcing varies.'),
  ('mantis-kenner-1985',            'Mantis',            'kenner-series-2', 'mantis',            1985, 'Power Action Pincer Thrust',    array[]::text[],                                       null,        null),
  ('parademon-kenner-1985',         'Parademon',         'kenner-series-2', 'parademon',         1985, 'Power Action Battle Flight',    array['gun'],                                          null,        null),
  -- Series 3 (1986) — the rarest wave
  ('shazam-kenner-1986',            'Shazam!',           'kenner-series-3', 'shazam',            1986, null,                            array[]::text[],                                       'rare',      null),
  ('plastic-man-kenner-1986',       'Plastic Man',       'kenner-series-3', 'plastic-man',       1986, null,                            array[]::text[],                                       'rare',      null),
  ('orion-kenner-1986',             'Orion',             'kenner-series-3', 'orion',             1986, null,                            array[]::text[],                                       'rare',      'Kirby Fourth World.'),
  ('mister-miracle-kenner-1986',    'Mister Miracle',    'kenner-series-3', 'mister-miracle',    1986, null,                            array[]::text[],                                       'very_rare', 'Kirby Fourth World; one of the two hardest carded figures to find.'),
  ('cyborg-kenner-1986',            'Cyborg',            'kenner-series-3', 'cyborg',            1986, 'Power Action Thrusting Arms',   array['drill hand', 'claw hand'],                      'very_rare', 'Pérez design; interchangeable hands. One of the two hardest carded figures to find.'),
  ('samurai-kenner-1986',           'Samurai',           'kenner-series-3', 'samurai',           1986, null,                            array[]::text[],                                       'rare',      'Created for the line (Super Friends character).'),
  ('golden-pharaoh-kenner-1986',    'Golden Pharaoh',    'kenner-series-3', 'golden-pharaoh',    1986, 'Power Action Soaring Wings',    array['staff'],                                        'rare',      'Created for the line.'),
  ('mr-freeze-kenner-1986',         'Mr. Freeze',        'kenner-series-3', 'mr-freeze',         1986, null,                            array[]::text[],                                       'rare',      null),
  ('cyclotron-kenner-1986',         'Cyclotron',         'kenner-series-3', 'cyclotron',         1986, 'Power Action Cyclo-Spin',       array['removable face', 'removable chestplate'],       'rare',      null),
  ('tyr-kenner-1986',               'Tyr',               'kenner-series-3', 'tyr',               1986, null,                            array[]::text[],                                       'rare',      'Created for the line.')
) as v(slug, name, series_slug, char_slug, year, action, accessories, rarity, notes)
join series s     on s.slug = v.series_slug
join characters c on c.slug = v.char_slug;

-- ============================================================
-- Vehicles, playset, case (Supermobile exists)
-- ============================================================
insert into releases
  (slug, name, type, status, line_id, series_id,
   release_year, region, features, rarity, notes, sources)
select
  v.slug, v.name, v.type::release_type, 'released',
  (select id from lines where slug = 'kenner-super-powers'),
  s.id, v.year, 'US', v.features, v.rarity::rarity_level, v.notes,
  array['https://kennersuperpowers.com']
from (values
  ('batmobile-kenner-1984',             'Batmobile',              'vehicle', 'kenner-series-1', 1984, array[]::text[], null,
   'One of the three Series 1 vehicles.'),
  ('lex-soar-7-kenner-1984',            'Lex-Soar 7',             'vehicle', 'kenner-series-1', 1984, array[]::text[], null,
   'One of the three Series 1 vehicles.'),
  ('hall-of-justice-kenner-1984',       'Hall of Justice',        'playset', 'kenner-series-1', 1984,
   array['vehicle landing pad', 'working elevator', 'computer command center', 'security doors', 'jail cells with hidden trap doors', 'revitalization chambers (store up to 10 figures)'],
   'rare',
   'The line''s only playset — doubled as a carrying case, folding sandwich-style. Hard to find complete and boxed (the landing-pad ramp especially); commands top dollar.'),
  ('collectors-case-kenner-1984',       'Collector''s Case',      'accessory', 'kenner-series-1', 1984, array[]::text[], null,
   'Official figure carrying case.'),
  ('batcopter-kenner-1985',             'Batcopter',              'vehicle', 'kenner-series-2', 1985, array[]::text[], null,
   'Series 2 vehicles sold poorly and lingered on clearance shelves after cancellation.'),
  ('kalibak-boulder-bomber-kenner-1985', 'Kalibak Boulder Bomber', 'vehicle', 'kenner-series-2', 1985, array[]::text[], null,
   'Series 2 vehicles sold poorly and lingered on clearance shelves after cancellation. Condition-sensitive.'),
  ('darkseid-destroyer-kenner-1985',    'Darkseid Destroyer',     'vehicle', 'kenner-series-2', 1985, array[]::text[], null,
   'Series 2 vehicles sold poorly and lingered on clearance shelves after cancellation. Condition-sensitive.'),
  ('delta-probe-one-kenner-1986',       'Delta Probe One',        'vehicle', 'kenner-series-3', 1986, array[]::text[], null,
   'One of the two final-wave vehicles.'),
  ('justice-jogger-kenner-1986',        'Justice Jogger',         'vehicle', 'kenner-series-3', 1986, array[]::text[], null,
   'The infamous "walking" cockpit vehicle.')
) as v(slug, name, type, series_slug, year, features, rarity, notes)
join series s on s.slug = v.series_slug;

-- ============================================================
-- Prototypes & cancelled
-- ============================================================
insert into releases
  (slug, name, type, status, line_id, series_id, character_id,
   release_year, region, rarity, notes, sources)
values
(
  'man-bat-kenner-prototype', 'Man-Bat', 'figure', 'prototype',
  (select id from lines where slug = 'kenner-super-powers'), null,
  (select id from characters where slug = 'man-bat'),
  null, 'US', 'grail',
  'The most famous unproduced Super Powers figure — an actual hardcopy prototype was created. Unmade Series 4, 5, and 6 designs were revealed in 2003 by toy historian Jason Geyer and collector James "Sallah" Sawyer.',
  array['https://kennersuperpowers.com']
),
(
  'tower-of-darkness-kenner-1986', 'Darkseid''s Tower of Darkness', 'playset', 'prototype',
  (select id from lines where slug = 'kenner-super-powers'), null, null,
  1986, 'US', null,
  'Darkseid playset previewed at the 1986 Toy Fair and pictured on third-wave card backs, but never released. Design featured rotating cannons, clutching arms, and a revolving gate/jail cell. Reached late development.',
  array['https://kennersuperpowers.com']
),
(
  'all-terrain-trapper-kenner-1986', 'All-Terrain Trapper', 'vehicle', 'cancelled',
  (select id from lines where slug = 'kenner-super-powers'), null, null,
  1986, 'US', null,
  'Pictured on third-wave card backs but cancelled before production.',
  array['https://kennersuperpowers.com']
);

-- ============================================================
-- The Argentine Riddler — the model's stress test
-- ============================================================
insert into releases
  (slug, name, type, status, line_id, series_id, character_id, variant_of,
   release_year, region, rarity, est_value_loose, est_value_carded, notes, sources)
values (
  'riddler-pacipa-argentina', 'The Riddler (Pacipa)', 'figure', 'international_variant',
  (select id from lines where slug = 'kenner-super-powers'), null,
  (select id from characters where slug = 'riddler'),
  (select id from releases where slug = 'green-lantern-kenner-1984'),
  null, 'AR', 'grail', 2000.00, 3000.00,
  'Produced in Argentina by Pacipa without Kenner''s consent — a repainted Green Lantern mold. Only available in Argentina; the rarest and most expensive figure in the whole universe of Super Powers, routinely $2,000–$3,000.',
  array['https://kennersuperpowers.com']
);

-- ============================================================
-- Vehicle ↔ character associations
-- ============================================================
insert into release_characters (release_id, character_id)
select r.id, c.id
from (values
  ('batmobile-kenner-1984',              'batman'),
  ('lex-soar-7-kenner-1984',             'lex-luthor'),
  ('batcopter-kenner-1985',              'batman'),
  ('kalibak-boulder-bomber-kenner-1985', 'kalibak'),
  ('darkseid-destroyer-kenner-1985',     'darkseid'),
  ('tower-of-darkness-kenner-1986',      'darkseid')
) as v(release_slug, char_slug)
join releases r   on r.slug = v.release_slug
join characters c on c.slug = v.char_slug;

-- ============================================================
-- Creator credits on releases
-- ============================================================
-- Kirby: redesigned his Fourth World characters for the toys.
insert into release_creators (release_id, creator_id, role)
select r.id, cr.id, 'character redesign'
from releases r, creators cr
where cr.slug = 'jack-kirby'
  and r.slug in (
    'darkseid-kenner-1985', 'desaad-kenner-1985', 'kalibak-kenner-1985',
    'steppenwolf-kenner-1985', 'mantis-kenner-1985', 'parademon-kenner-1985',
    'orion-kenner-1986', 'mister-miracle-kenner-1986'
  );

-- Pérez: Cyborg design; Luthor and Brainiac redesigns.
insert into release_creators (release_id, creator_id, role)
select r.id, cr.id, v.role
from (values
  ('cyborg-kenner-1986',     'design'),
  ('lex-luthor-kenner-1984', 'character redesign'),
  ('brainiac-kenner-1984',   'character redesign')
) as v(release_slug, role)
join releases r on r.slug = v.release_slug
join creators cr on cr.slug = 'george-perez';

-- ============================================================
-- Pack-in mini-comics (Series 1 + 2 figures shipped with one;
-- Superman's already exists)
-- ============================================================
insert into publications
  (slug, title, kind, publisher, year, language, packed_with, description)
select
  c.slug || '-mini-comic-' || v.year,
  c.name || ' Mini-Comic',
  'pack_in_mini', 'DC Comics / Kenner', v.year, 'en', r.id,
  'Pack-in mini-comic bundled with the Series ' || v.series_no || ' ' || c.name || ' figure.'
from (values
  ('batman', 1984, 1), ('robin', 1984, 1), ('wonder-woman', 1984, 1),
  ('aquaman', 1984, 1), ('the-flash', 1984, 1), ('green-lantern', 1984, 1),
  ('hawkman', 1984, 1), ('lex-luthor', 1984, 1), ('brainiac', 1984, 1),
  ('the-joker', 1984, 1), ('the-penguin', 1984, 1),
  ('firestorm', 1985, 2), ('green-arrow', 1985, 2), ('martian-manhunter', 1985, 2),
  ('red-tornado', 1985, 2), ('doctor-fate', 1985, 2), ('darkseid', 1985, 2),
  ('desaad', 1985, 2), ('kalibak', 1985, 2), ('steppenwolf', 1985, 2),
  ('mantis', 1985, 2), ('parademon', 1985, 2)
) as v(char_slug, year, series_no)
join characters c on c.slug = v.char_slug
join releases r   on r.slug = v.char_slug || '-kenner-' || v.year;

-- Estrela published Portuguese minis for the three characters that never
-- got English ones.
insert into publications (slug, title, kind, publisher, language, description)
select
  c.slug || '-mini-comic-estrela',
  c.name || ' Mini-Comic (Estrela)',
  'pack_in_mini', 'Estrela', 'pt',
  'Portuguese-language mini-comic published by Estrela in Brazil — ' || c.name || ' never received an English mini-comic.'
from characters c
where c.slug in ('cyborg', 'plastic-man', 'shazam');

-- Link every mini-comic to its character.
insert into publication_characters (publication_id, character_id)
select p.id, c.id
from publications p
join characters c on p.slug like c.slug || '-mini-comic%'
on conflict do nothing;

-- ============================================================
-- Remaining mini-series issues (v1 #4–5, v2 #2–6, v3 #1–4)
-- ============================================================
insert into publications (slug, title, kind, publisher, year, issue_number, language, description)
select
  'super-powers-' || v.year || '-0' || v.issue,
  'Super Powers Vol. ' || v.vol || ' #' || v.issue,
  'mini_series', 'DC Comics', v.year, v.issue::text, 'en', v.descr
from (values
  (1984, 1, 4, 'Fourth issue of the 1984 mini-series, plotted by Jack Kirby.'),
  (1984, 1, 5, 'Final issue of the 1984 mini-series — written and penciled by Jack Kirby himself.'),
  (1985, 2, 2, 'Penciled by Jack Kirby.'),
  (1985, 2, 3, 'Penciled by Jack Kirby.'),
  (1985, 2, 4, 'Penciled by Jack Kirby.'),
  (1985, 2, 5, 'Penciled by Jack Kirby.'),
  (1985, 2, 6, 'Final issue of the 1985 mini-series, penciled by Jack Kirby.'),
  (1986, 3, 1, 'First issue of the 1986 tie-in mini-series.'),
  (1986, 3, 2, null),
  (1986, 3, 3, null),
  (1986, 3, 4, 'Final issue of the 1986 mini-series — and of the line.')
) as v(year, vol, issue, descr);

-- Kirby credits on the new issues.
insert into publication_creators (publication_id, creator_id, role)
select p.id, cr.id, v.role
from (values
  ('super-powers-1984-04', 'plot'),
  ('super-powers-1984-05', 'script'),
  ('super-powers-1984-05', 'pencils'),
  ('super-powers-1985-02', 'pencils'),
  ('super-powers-1985-03', 'pencils'),
  ('super-powers-1985-04', 'pencils'),
  ('super-powers-1985-05', 'pencils'),
  ('super-powers-1985-06', 'pencils')
) as v(pub_slug, role)
join publications p on p.slug = v.pub_slug
join creators cr on cr.slug = 'jack-kirby';

-- The mini-series are team books — keep the existing convention of linking
-- them to Superman (established for issues seeded in the golden record).
insert into publication_characters (publication_id, character_id)
select p.id, c.id
from publications p, characters c
where c.slug = 'superman'
  and p.kind = 'mini_series'
on conflict do nothing;
