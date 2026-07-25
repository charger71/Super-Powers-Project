-- ============================================================================
-- PROVISIONAL SEED — McFarlane DC Super Powers line (2022–2025)
-- ============================================================================
-- ⚠️  THIS DATA IS AUTO-COMPILED FROM PUBLIC WEB SOURCES (July 2026) AND IS
--     NOT VETTED. Unlike the Kenner seed (which came from the vetted
--     Kenner-Super-Powers-Collection-Reference.md), there is no authoritative
--     McFarlane reference doc. Expect errors in exact figure names, variant
--     labels, wave assignments, and release years. VET BEFORE TREATING AS
--     CANONICAL — every slug here is a permanent public URL (CLAUDE.md #3).
--
-- Sources (fragmentary, sometimes contradictory):
--   * toyhabits.com (wave-by-wave articles; several are "leaked"/"rumor")
--   * herohabit.com/mcfarlane-super-powers-checklist
--   * mcfarlane.com official product pages
--
-- Known conflicts, left as-is and flagged:
--   * Wave 11 and the "Wave 13" article list the SAME four figures
--     (Animal Man, Cyborg, Deadman, 1970s Nightwing). Seeded ONCE under
--     Wave 11; no Wave 13 series is created.
--   * Metamorpho and Green Lantern (Guy Gardner) are each reported in TWO
--     waves (W8 and W12). Both entries kept, distinguished by slug.
--   * Many release_year values are best-effort; the DC license end date is
--     reported as both 2025 and 2026.
--
-- Editorial policy (matches the Kenner seed): characters get name/slug/
-- alignment/aka only — bios, overviews, vitals are author work via the admin.
-- Batman/Superman/Flash/etc. VARIANTS are release rows pointing at the one
-- canonical character (releases ≠ characters, CLAUDE.md's core rule); only
-- genuinely distinct DC identities get their own character row.
-- ============================================================================

-- ------------------------------------------------------------
-- Series — the McFarlane waves
-- ------------------------------------------------------------
insert into series (line_id, slug, name, year, sort_order)
select l.id, s.slug, s.name, s.year, s.sort_order
from (values
  ('mcfarlane-wave-1',  'Wave 1',  2022, 1),
  ('mcfarlane-wave-2',  'Wave 2',  2022, 2),
  ('mcfarlane-wave-3',  'Wave 3',  2023, 3),
  ('mcfarlane-wave-4',  'Wave 4',  2023, 4),
  ('mcfarlane-wave-5',  'Wave 5',  2023, 5),
  ('mcfarlane-wave-6',  'Wave 6',  2024, 6),
  ('mcfarlane-wave-7',  'Wave 7',  2024, 7),
  ('mcfarlane-wave-8',  'Wave 8',  2024, 8),
  ('mcfarlane-wave-9',  'Wave 9',  2024, 9),
  ('mcfarlane-wave-10', 'Wave 10', 2024, 10),
  ('mcfarlane-wave-11', 'Wave 11', 2025, 11),
  ('mcfarlane-wave-12', 'Wave 12', 2025, 12)
) as s(slug, name, year, sort_order)
join lines l on l.slug = 'mcfarlane-dc-super-powers'
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Characters — 31 new DC identities the line introduces beyond the
-- Kenner-era roster. first_appearance intentionally NULL (not vetted).
-- ------------------------------------------------------------
insert into characters (slug, name, aka, alignment)
values
  ('batman-who-laughs',   'The Batman Who Laughs', array[]::text[],                      'villain'),
  ('john-stewart',        'John Stewart',          array['Green Lantern'],               'hero'),
  ('deathstroke',         'Deathstroke',           array['Slade Wilson']::text[],        'villain'),
  ('nightwing',           'Nightwing',             array['Dick Grayson']::text[],        'hero'),
  ('black-manta',         'Black Manta',           array[]::text[],                      'villain'),
  ('tim-drake',           'Tim Drake',             array['Robin']::text[],               'hero'),
  ('jason-todd',          'Jason Todd',            array['Robin', 'Red Hood'],           'hero'),
  ('peacemaker',          'Peacemaker',            array['Christopher Smith']::text[],   'neutral'),
  ('judo-master',         'Judo Master',           array[]::text[],                      'hero'),
  ('vigilante',           'Vigilante',             array[]::text[],                      'hero'),
  ('reverse-flash',       'Reverse-Flash',         array['Eobard Thawne']::text[],       'villain'),
  ('thomas-wayne-batman', 'Thomas Wayne',          array['Batman', 'Flashpoint'],        'neutral'),
  ('lord-superman',       'Lord Superman',         array[]::text[],                      'villain'),
  ('sinestro',            'Sinestro',              array[]::text[],                      'villain'),
  ('guy-gardner',         'Guy Gardner',           array['Green Lantern']::text[],       'hero'),
  ('kilowog',             'Kilowog',               array['Green Lantern Corps']::text[], 'hero'),
  ('blue-beetle',         'Blue Beetle',           array['Ted Kord']::text[],            'hero'),
  ('booster-gold',        'Booster Gold',          array['Michael Carter']::text[],      'hero'),
  ('metamorpho',          'Metamorpho',            array['Rex Mason']::text[],           'hero'),
  ('bizarro',             'Bizarro',               array[]::text[],                      'neutral'),
  ('lobo',                'Lobo',                  array[]::text[],                      'neutral'),
  ('the-atom',            'The Atom',              array['Ray Palmer']::text[],          'hero'),
  ('jay-garrick',         'Jay Garrick',           array['The Flash']::text[],           'hero'),
  ('wally-west',          'Wally West',            array['The Flash', 'Kid Flash'],      'hero'),
  ('ultraman',            'Ultraman',              array[]::text[],                      'villain'),
  ('mr-terrific',         'Mr. Terrific',          array['Michael Holt']::text[],        'hero'),
  ('animal-man',          'Animal Man',            array['Buddy Baker']::text[],         'hero'),
  ('deadman',             'Deadman',               array['Boston Brand']::text[],        'hero'),
  ('starman',             'Starman',               array[]::text[],                      'hero'),
  ('alan-scott',          'Alan Scott',            array['Green Lantern']::text[],       'hero'),
  ('hourman',             'Hourman',               array['Rex Tyler']::text[],           'hero')
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Link the existing golden-record Superman to Wave 1.
-- ------------------------------------------------------------
update releases
set series_id = (select id from series where slug = 'mcfarlane-wave-1')
where slug = 'superman-mcfarlane-2022' and series_id is null;

-- ------------------------------------------------------------
-- Figures
-- ------------------------------------------------------------
insert into releases
  (slug, name, type, status, line_id, series_id, character_id,
   release_year, region, rarity, notes, sources)
select
  v.slug, v.name, 'figure', 'released',
  (select id from lines where slug = 'mcfarlane-dc-super-powers'),
  s.id, c.id, v.year, 'US', v.rarity::rarity_level, v.notes,
  array['https://toyhabits.com/category/super-powers/', 'https://mcfarlane.com']
from (values
  -- Wave 1 (2022, Walmart exclusive launch)
  ('batman-hush-mcfarlane-2022',                 'Batman (Hush)',                          'mcfarlane-wave-1',  'batman',            2022, null,   'Jim Lee "Hush"-inspired sculpt; part of the 2022 Walmart-exclusive launch.'),
  ('darkseid-mcfarlane-2022',                    'Darkseid (New 52)',                      'mcfarlane-wave-1',  'darkseid',          2022, null,   'New 52-styled Darkseid; 2022 launch alongside Superman and Batman.'),
  -- Wave 2 (2022)
  ('batman-who-laughs-mcfarlane-2022',           'The Batman Who Laughs',                  'mcfarlane-wave-2',  'batman-who-laughs', 2022, null,   null),
  ('the-flash-mcfarlane-2022',                   'The Flash (DC Rebirth)',                 'mcfarlane-wave-2',  'the-flash',         2022, null,   'Barry Allen, DC Rebirth costume.'),
  ('green-lantern-john-stewart-mcfarlane-2022',  'Green Lantern (John Stewart)',           'mcfarlane-wave-2',  'john-stewart',      2022, null,   'DC Rebirth John Stewart.'),
  -- Wave 3 (2023)
  ('wonder-woman-mcfarlane-2023',                'Wonder Woman (DC Rebirth)',              'mcfarlane-wave-3',  'wonder-woman',      2023, null,   null),
  ('deathstroke-mcfarlane-2023',                 'Deathstroke',                            'mcfarlane-wave-3',  'deathstroke',       2023, null,   null),
  ('nightwing-mcfarlane-2023',                   'Nightwing',                              'mcfarlane-wave-3',  'nightwing',         2023, null,   null),
  -- Wave 4 (2023)
  ('aquaman-mcfarlane-2023',                     'Aquaman (DC Rebirth)',                   'mcfarlane-wave-4',  'aquaman',           2023, null,   'Bearded "mature" DC Rebirth Aquaman.'),
  ('black-manta-mcfarlane-2023',                 'Black Manta',                            'mcfarlane-wave-4',  'black-manta',       2023, null,   'Never made for the vintage Kenner line.'),
  ('batman-classic-detective-mcfarlane-2023',    'Batman (Classic Detective)',             'mcfarlane-wave-4',  'batman',            2023, null,   'Classic grey-and-blue look.'),
  ('robin-tim-drake-mcfarlane-2023',             'Robin (Tim Drake)',                      'mcfarlane-wave-4',  'tim-drake',         2023, null,   null),
  ('the-flash-wally-west-mcfarlane-2023',        'The Flash (Wally West, Opposites Attract)', 'mcfarlane-wave-4', 'wally-west',      2023, null,   'Wave assignment uncertain (reported as a 2023 release).'),
  -- Wave 5 (2023, repaints/variants)
  ('superman-v2-mcfarlane-2023',                 'Superman (v2)',                          'mcfarlane-wave-5',  'superman',          2023, null,   'Wave 5 repaint.'),
  ('dark-knight-batman-mcfarlane-2023',          'Batman (Dark Knight, Black Suit)',       'mcfarlane-wave-5',  'batman',            2023, null,   null),
  ('robin-tim-drake-v2-mcfarlane-2023',          'Robin (Tim Drake) v2',                   'mcfarlane-wave-5',  'tim-drake',         2023, null,   'Wave 5 repaint.'),
  ('nightwing-nightfall-mcfarlane-2023',         'Nightwing (Nightfall)',                  'mcfarlane-wave-5',  'nightwing',         2023, null,   null),
  ('reverse-flash-mcfarlane-2023',               'Reverse-Flash',                          'mcfarlane-wave-5',  'reverse-flash',     2023, 'rare', 'Reported as a Walmart exclusive.'),
  ('dark-flash-mcfarlane-2023',                  'Dark Flash (Flash Rebirth)',             'mcfarlane-wave-5',  'the-flash',         2023, null,   null),
  ('thomas-wayne-batman-mcfarlane-2023',         'Batman (Thomas Wayne, Flashpoint)',      'mcfarlane-wave-5',  'thomas-wayne-batman', 2023, null, null),
  ('grey-suit-batman-mcfarlane-2023',            'Batman (Grey Suit)',                     'mcfarlane-wave-5',  'batman',            2023, null,   null),
  -- Wave 6 (2024)
  ('batman-gold-mcfarlane-2024',                 'Batman (Gold, Tec Shield)',              'mcfarlane-wave-6',  'batman',            2024, null,   'Based on the 1990 Kenner Tec Shield design.'),
  ('lord-superman-mcfarlane-2024',               'Lord Superman',                          'mcfarlane-wave-6',  'lord-superman',     2024, null,   'Black-and-white Justice Lord-style Superman.'),
  ('green-lantern-hal-jordan-mcfarlane-2024',    'Green Lantern (Hal Jordan)',             'mcfarlane-wave-6',  'green-lantern',     2024, null,   'Classic 1984-styled Hal Jordan.'),
  ('sinestro-mcfarlane-2024',                    'Sinestro',                               'mcfarlane-wave-6',  'sinestro',          2024, null,   'First Super Powers-line appearance.'),
  ('the-flash-gold-mcfarlane-2024',              'The Flash (Gold)',                       'mcfarlane-wave-6',  'the-flash',         2024, null,   null),
  ('batman-zur-en-arrh-mcfarlane-2024',          'Batman of Zur-En-Arrh',                  'mcfarlane-wave-6',  'batman',            2024, null,   'Grant Morrison R.I.P. version.'),
  -- Wave 7 (2024, "deep cuts")
  ('blue-beetle-mcfarlane-2024',                 'Blue Beetle',                            'mcfarlane-wave-7',  'blue-beetle',       2024, null,   'Ted Kord, Justice League International.'),
  ('brainiac-mcfarlane-2024',                    'Brainiac (First Appearance)',            'mcfarlane-wave-7',  'brainiac',          2024, null,   'Green-skinned original-comic look.'),
  ('kilowog-mcfarlane-2024',                     'Kilowog',                                'mcfarlane-wave-7',  'kilowog',           2024, null,   null),
  ('sinestro-corps-mcfarlane-2024',              'Sinestro (Sinestro Corps)',              'mcfarlane-wave-7',  'sinestro',          2024, null,   'Pink-skin / yellow-black Sinestro Corps repaint.'),
  ('superman-gold-40th-mcfarlane-2024',          'Superman (Gold, 40th Anniversary)',      'mcfarlane-wave-7',  'superman',          2024, null,   '40th-anniversary gold repaint.'),
  ('batman-manga-mcfarlane-2024',                'Batman (Manga)',                         'mcfarlane-wave-7',  'batman',            2024, null,   null),
  -- Wave 8 (2024) — incl. 2 Entertainment Earth exclusives
  ('booster-gold-mcfarlane-2024',                'Booster Gold',                           'mcfarlane-wave-8',  'booster-gold',      2024, null,   null),
  ('metamorpho-mcfarlane-2024',                  'Metamorpho',                             'mcfarlane-wave-8',  'metamorpho',        2024, null,   'Also reported in Wave 12 — conflict, kept both.'),
  ('black-manta-black-mcfarlane-2024',           'Black Manta (Black Suit)',               'mcfarlane-wave-8',  'black-manta',       2024, null,   null),
  ('green-lantern-guy-gardner-mcfarlane-2024',   'Green Lantern (Guy Gardner)',            'mcfarlane-wave-8',  'guy-gardner',       2024, null,   'Also reported in Wave 12 — conflict, kept both.'),
  ('batman-dark-knight-ee-mcfarlane-2024',       'Batman (The Dark Knight) — EE Exclusive', 'mcfarlane-wave-8', 'batman',           2024, 'rare', 'Entertainment Earth exclusive.'),
  ('superman-fleischer-ee-mcfarlane-2024',       'Superman (Fleischer) — EE Exclusive',    'mcfarlane-wave-8',  'superman',          2024, 'rare', 'Entertainment Earth exclusive, Fleischer-cartoon style.'),
  -- Wave 9 (2024) — incl. gold chase variants
  ('superman-classic-mcfarlane-2024',            'Superman (Classic)',                     'mcfarlane-wave-9',  'superman',          2024, null,   null),
  ('batman-black-grey-mcfarlane-2024',           'Batman (Black & Grey, DKR)',             'mcfarlane-wave-9',  'batman',            2024, null,   'Dark Knight Returns-inspired large chest symbol.'),
  ('riddler-mcfarlane-2024',                     'The Riddler (Classic)',                  'mcfarlane-wave-9',  'riddler',           2024, null,   null),
  ('bizarro-mcfarlane-2024',                     'Bizarro',                                'mcfarlane-wave-9',  'bizarro',           2024, null,   null),
  ('wonder-woman-gold-chase-mcfarlane-2024',     'Wonder Woman (Gold Chase)',              'mcfarlane-wave-9',  'wonder-woman',      2024, 'rare', 'Gold chase variant.'),
  ('aquaman-gold-chase-mcfarlane-2024',          'Aquaman (Gold Chase)',                   'mcfarlane-wave-9',  'aquaman',           2024, 'rare', 'Gold chase variant.'),
  -- Wave 10 (2024) — incl. chase variants
  ('the-atom-mcfarlane-2024',                    'The Atom (Ray Palmer)',                  'mcfarlane-wave-10', 'the-atom',          2024, null,   null),
  ('the-flash-jay-garrick-mcfarlane-2024',       'The Flash (Jay Garrick)',                'mcfarlane-wave-10', 'jay-garrick',       2024, null,   null),
  ('lobo-mcfarlane-2024',                        'Lobo',                                   'mcfarlane-wave-10', 'lobo',              2024, null,   null),
  ('robin-jason-todd-mcfarlane-2024',            'Robin (Jason Todd)',                     'mcfarlane-wave-10', 'jason-todd',        2024, null,   null),
  ('batman-unmasked-chase-mcfarlane-2024',       'Batman (Unmasked Chase)',                'mcfarlane-wave-10', 'batman',            2024, 'rare', 'Chase variant with unmasked Bruce Wayne head.'),
  ('superman-return-chase-mcfarlane-2024',       'Superman (Return of Superman Chase)',    'mcfarlane-wave-10', 'superman',          2024, 'rare', 'Chase variant, darker "Return of Superman" scheme.'),
  -- Wave 11 (2025, McFarlane Toys Store exclusive) — the "Wave 13" article lists the same four
  ('animal-man-mcfarlane-2025',                  'Animal Man',                             'mcfarlane-wave-11', 'animal-man',        2025, null,   'McFarlane Store exclusive. Also reported as "Wave 13" — same four figures.'),
  ('cyborg-mcfarlane-2025',                      'Cyborg',                                 'mcfarlane-wave-11', 'cyborg',            2025, null,   'McFarlane Store exclusive.'),
  ('deadman-mcfarlane-2025',                     'Deadman',                                'mcfarlane-wave-11', 'deadman',           2025, null,   'McFarlane Store exclusive.'),
  ('nightwing-1970s-mcfarlane-2025',             'Nightwing (1970s)',                      'mcfarlane-wave-11', 'nightwing',         2025, null,   'McFarlane Store exclusive.'),
  -- Wave 12 (2025, "Superman: The Movie" subline)
  ('superman-the-movie-mcfarlane-2025',          'Superman: The Movie (1978)',             'mcfarlane-wave-12', 'superman',          2025, null,   '"Superman: The Movie" subline, 1978 film-inspired.'),
  ('green-lantern-guy-gardner-comic-mcfarlane-2025', 'Green Lantern (Guy Gardner, Comic)', 'mcfarlane-wave-12', 'guy-gardner',      2025, null,   'Comic-edition Guy Gardner; W8/W12 conflict.'),
  ('metamorpho-w12-mcfarlane-2025',              'Metamorpho (Wave 12)',                   'mcfarlane-wave-12', 'metamorpho',        2025, null,   'W8/W12 conflict — may be the same figure as the Wave 8 entry.'),
  ('ultraman-mcfarlane-2025',                    'Ultraman',                               'mcfarlane-wave-12', 'ultraman',          2025, null,   'Evil Superman of Earth-3.'),
  ('mr-terrific-mcfarlane-2025',                 'Mr. Terrific',                           'mcfarlane-wave-12', 'mr-terrific',       2025, null,   null)
) as v(slug, name, wave, charslug, year, rarity, notes)
join series s on s.slug = v.wave
join characters c on c.slug = v.charslug
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Vehicles, playset, and multi-packs (character_id null; linked below)
-- ------------------------------------------------------------
insert into releases
  (slug, name, type, status, line_id, series_id, release_year, region, notes, sources)
select
  v.slug, v.name, v.type::release_type, 'released',
  (select id from lines where slug = 'mcfarlane-dc-super-powers'),
  s.id, v.year, 'US', v.notes,
  array['https://toyhabits.com/category/super-powers/', 'https://mcfarlane.com']
from (values
  ('batwing-mcfarlane-2022',              'Batwing',                              'vehicle',  'mcfarlane-wave-1',  2022, 'Assault flier, scaled to the figures; 2022 launch.'),
  ('supermobile-mcfarlane-2022',          'Supermobile',                          'vehicle',  'mcfarlane-wave-1',  2022, 'McFarlane re-issue of the classic Supermobile.'),
  ('batmobile-mcfarlane-2023',            'Batmobile',                            'vehicle',  'mcfarlane-wave-3',  2023, 'Wave assignment approximate (2023 vehicle).'),
  ('invisible-jet-mcfarlane-2023',        'Invisible Jet',                        'vehicle',  'mcfarlane-wave-3',  2023, 'Wave assignment approximate (2023 vehicle).'),
  ('whirly-bat-mcfarlane-2023',           'Whirly Bat',                           'vehicle',  'mcfarlane-wave-5',  2023, 'Single-seat helicopter.'),
  ('blue-beetle-bug-ship-mcfarlane-2024', 'Blue Beetle Bug Ship',                 'vehicle',  'mcfarlane-wave-7',  2024, 'The Bug, designed by Ted Kord.'),
  ('brainiac-skull-ship-mcfarlane-2024',  'Brainiac Skull Ship',                  'vehicle',  'mcfarlane-wave-7',  2024, 'Skull-shaped interstellar warship.'),
  ('black-manta-sea-saucer-mcfarlane-2024','Black Manta Sea Saucer',              'vehicle',  'mcfarlane-wave-10', 2024, null),
  ('bat-multicraft-mcfarlane-2024',       'Bat Multicraft',                       'vehicle',  'mcfarlane-wave-10', 2024, 'Seats Batman and Robin.'),
  ('t-craft-mcfarlane-2025',              'T-Craft',                              'vehicle',  'mcfarlane-wave-12', 2025, 'Superman: The Movie subline.'),
  ('fortress-of-solitude-mcfarlane-2025', 'Fortress of Solitude',                 'playset',  'mcfarlane-wave-12', 2025, 'First playset of the McFarlane line; Superman: The Movie subline.'),
  ('peacemaker-judo-master-vigilante-3-pack-mcfarlane-2023', 'Peacemaker, Judo Master & Vigilante 3-Pack', 'box_set', 'mcfarlane-wave-5', 2023, 'Entertainment Earth exclusive multi-pack.'),
  ('jsa-3-pack-mcfarlane-2024',            'Justice Society of America 3-Pack',    'box_set',  'mcfarlane-wave-9',  2024, 'Starman, Green Lantern (Alan Scott), and Hourman.')
) as v(slug, name, type, wave, year, notes)
join series s on s.slug = v.wave
on conflict (slug) do nothing;

-- ------------------------------------------------------------
-- Featured-character links for the vehicles / playset / multi-packs
-- (mirrors how the Kenner Supermobile links to Superman)
-- ------------------------------------------------------------
insert into release_characters (release_id, character_id)
select r.id, c.id
from (values
  ('batwing-mcfarlane-2022',               'batman'),
  ('supermobile-mcfarlane-2022',           'superman'),
  ('batmobile-mcfarlane-2023',             'batman'),
  ('invisible-jet-mcfarlane-2023',         'wonder-woman'),
  ('whirly-bat-mcfarlane-2023',            'batman'),
  ('blue-beetle-bug-ship-mcfarlane-2024',  'blue-beetle'),
  ('brainiac-skull-ship-mcfarlane-2024',   'brainiac'),
  ('black-manta-sea-saucer-mcfarlane-2024','black-manta'),
  ('bat-multicraft-mcfarlane-2024',        'batman'),
  ('bat-multicraft-mcfarlane-2024',        'robin'),
  ('t-craft-mcfarlane-2025',               'superman'),
  ('fortress-of-solitude-mcfarlane-2025',  'superman'),
  ('peacemaker-judo-master-vigilante-3-pack-mcfarlane-2023', 'peacemaker'),
  ('peacemaker-judo-master-vigilante-3-pack-mcfarlane-2023', 'judo-master'),
  ('peacemaker-judo-master-vigilante-3-pack-mcfarlane-2023', 'vigilante'),
  ('jsa-3-pack-mcfarlane-2024',            'starman'),
  ('jsa-3-pack-mcfarlane-2024',            'alan-scott'),
  ('jsa-3-pack-mcfarlane-2024',            'hourman')
) as l(release_slug, char_slug)
join releases r on r.slug = l.release_slug
join characters c on c.slug = l.char_slug
on conflict do nothing;
