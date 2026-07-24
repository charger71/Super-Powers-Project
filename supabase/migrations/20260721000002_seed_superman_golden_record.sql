-- Phase 0 golden record: Superman, populated completely.
-- Content normally enters through the admin; the golden record ships as a
-- migration so the model gets validated against real, vetted content
-- (Kenner-Super-Powers-Collection-Reference.md) before scaling data entry.
-- Media assets are NOT seeded — they require real files with real credits,
-- which go through the admin upload flow.

-- ============================================================
-- Character
-- ============================================================
insert into characters
  (slug, name, aka, alignment, first_appearance, homeworld, base_of_operations,
   bio, powers, weaknesses)
values (
  'superman',
  'Superman',
  array['Kal-El', 'Clark Kent', 'The Last Son of Krypton', 'The Man of Steel'],
  'hero',
  'Action Comics #1 (1938)',
  'Krypton',
  'Metropolis',
  $txt$The Superman character was created by writer Jerry Siegel and artist Joe Shuster in the 1930s. The now-iconic character originally debuted in Action Comics #1, published on April 18, 1938. Shortly after, Superman's popularity led to several other media outlets, including pre-television radio shows and novels beginning in the early 1940s. Later the Superman franchise would eventually develop into a live-action black and white television show, an animated series, and several blockbuster movies, all before the 1984 release of the Super Powers Collection toy line.

Superman (birth name Kal-El) was born on Krypton and escaped shortly before the destruction of his home planet. When his parents, Jor-El and Lara, discover Krypton's impending doom, Jor-El begins constructing a spacecraft to carry Kal-El to Earth. Unfortunately, Superman's parents perish along with the planet's destruction, as the spaceship transporting the infant barely escapes Krypton's destructive fate. The devastating explosion then alters the planetary debris into kryptonite, a radioactive substance that is highly lethal to Superman's superpowers.

The spacecraft found its way to the planet earth crash-landed in a rural part of the United States. Superman was then discovered at the crash site as a small child and adopted by Jonathan and Martha Kent, who took him in and raised them as their own. Kal-El was renamed Clark Kent and grew up with wholesome midwestern values as a testament to his adopted parents.

Clark Kent eventually discovered his powers and relocated to the city of Metropolis after learning of his true origin. He then became Superman, defender of justice, and works undercover as a placid-mannered reporter for the Daily Planet. Ironically, Superman becomes the subject of frequent headline stories written by his coworker Lois Lane. Over time, the two become romantically attracted to each other and find themselves caught up in many adventures. Honoring the traditional and moral values instilled in him by his foster parents along with the historical teachings of Krypton, Superman is a self-sacrificing hero devoted to promoting "truth, justice, and the American way."$txt$,
  'Super-strength, super-vision (x-ray vision, telescopic vision, heat vision, microscopic vision), invulnerability, flight, super-speed, super-breath, super-senses, super-voice, super-intellect.',
  $txt$Green Kryptonite can kill Superman, Red "K" affects him in bizarre ways, Gold "K" takes away his powers. Superman's invulnerability does not protect him against magic. Superman loses his powers in a solar system with a red sun.$txt$
);

insert into teams (slug, name) values ('justice-league', 'Justice League');

insert into character_teams (character_id, team_id)
select c.id, t.id
from characters c, teams t
where c.slug = 'superman' and t.slug = 'justice-league';

-- ============================================================
-- Creators (the ones credited on Superman material)
-- ============================================================
insert into creators (slug, name, role_summary) values
  ('jack-kirby', 'Jack Kirby',
   'Comic artist. Plotted the 1984 Super Powers mini-series, penciled the 1985 series, and redesigned his Fourth World characters for the toy line.'),
  ('jose-luis-garcia-lopez', 'José Luis García-López',
   'Artist of the DC Style Guides that most Super Powers figure and packaging art is based on.');

-- ============================================================
-- Releases
-- ============================================================
-- The Series 1 figure, then the same mold reissued on Series 2/3 cards
-- (modeled as status='reissue' + variant_of, exercising the variant machinery
-- the Argentine Riddler will need in Phase 1).
insert into releases
  (slug, name, type, status, line_id, series_id, character_id, variant_of,
   release_year, region, action_feature, accessories, card_type, rarity, notes, sources)
values
(
  'superman-kenner-1984', 'Superman', 'figure', 'released',
  (select id from lines where slug = 'kenner-super-powers'),
  (select id from series where slug = 'kenner-series-1'),
  (select id from characters where slug = 'superman'),
  null,
  1984, 'US', 'Power Action Punch', array['fabric cape'], 'Series 1 card', 'common',
  'Launch figure of the Super Powers Collection, packaged on the blue starfield card with a pack-in mini-comic. Squeezing the legs together swings both arms forward. The mold went unchanged across the line''s entire 1984–86 run.',
  array['https://kennersuperpowers.com', 'https://thetoycollectorsguide.com']
),
(
  'superman-kenner-1985', 'Superman (Series 2 card)', 'figure', 'reissue',
  (select id from lines where slug = 'kenner-super-powers'),
  (select id from series where slug = 'kenner-series-2'),
  (select id from characters where slug = 'superman'),
  (select id from releases where slug = 'superman-kenner-1984'),
  1985, 'US', 'Power Action Punch', array['fabric cape'], 'Series 2 card', 'common',
  'Same figure reissued on the Series 2 card back.',
  array['https://kennersuperpowers.com']
),
(
  'superman-kenner-1986', 'Superman (Series 3 card)', 'figure', 'reissue',
  (select id from lines where slug = 'kenner-super-powers'),
  (select id from series where slug = 'kenner-series-3'),
  (select id from characters where slug = 'superman'),
  (select id from releases where slug = 'superman-kenner-1984'),
  1986, 'US', 'Power Action Punch', array['fabric cape'], 'Series 3 card', 'uncommon',
  'Final reissue on the Series 3 card back.',
  array['https://kennersuperpowers.com']
),
(
  'clark-kent-kenner-1985', 'Clark Kent (mail-away)', 'figure', 'mail_away',
  (select id from lines where slug = 'kenner-super-powers'),
  (select id from series where slug = 'kenner-series-2'),
  (select id from characters where slug = 'superman'),
  null,
  1985, 'US', null, array[]::text[], null, 'rare',
  'The canonical Series 2 mail-away exclusive — offered via mail order rather than at retail. A prized get for collectors.',
  array['https://kennersuperpowers.com']
),
(
  'supermobile-kenner-1984', 'Supermobile', 'vehicle', 'released',
  (select id from lines where slug = 'kenner-super-powers'),
  (select id from series where slug = 'kenner-series-1'),
  null,
  null,
  1984, 'US', null, array[]::text[], null, 'common',
  'One of the three Series 1 vehicles (with the Batmobile and Lex-Soar 7). Superman-scaled cockpit.',
  array['https://kennersuperpowers.com', 'https://retrotoyquest.com']
),
(
  'superman-mcfarlane-2022', 'Superman', 'figure', 'released',
  (select id from lines where slug = 'mcfarlane-dc-super-powers'),
  null,
  (select id from characters where slug = 'superman'),
  null,
  2022, 'US', null, array[]::text[], null, 'common',
  'Part of the first 2022 wave of the McFarlane Toys / DC Direct Super Powers revival, alongside Batman and Darkseid.',
  array['https://mcfarlane.com']
);

-- Supermobile is Superman's vehicle without "being" him.
insert into release_characters (release_id, character_id)
select r.id, c.id
from releases r, characters c
where r.slug = 'supermobile-kenner-1984' and c.slug = 'superman';

-- Packaging art credit: García-López style guide basis.
insert into release_creators (release_id, creator_id, role)
select r.id, cr.id, 'packaging art (style guide basis)'
from releases r, creators cr
where r.slug = 'superman-kenner-1984' and cr.slug = 'jose-luis-garcia-lopez';

-- ============================================================
-- Publications
-- ============================================================
insert into publications
  (slug, title, kind, publisher, year, issue_number, language, packed_with, description)
values
(
  'super-powers-1984-01', 'Super Powers Vol. 1 #1', 'mini_series', 'DC Comics',
  1984, '1', 'en', null,
  'First issue of the 1984 tie-in prestige mini-series, plotted by Jack Kirby.'
),
(
  'super-powers-1984-02', 'Super Powers Vol. 1 #2', 'mini_series', 'DC Comics',
  1984, '2', 'en', null,
  'Second issue of the 1984 mini-series, plotted by Jack Kirby.'
),
(
  'super-powers-1984-03', 'Super Powers Vol. 1 #3', 'mini_series', 'DC Comics',
  1984, '3', 'en', null,
  'Third issue of the 1984 mini-series, plotted by Jack Kirby.'
),
(
  'super-powers-1985-01', 'Super Powers Vol. 2 #1', 'mini_series', 'DC Comics',
  1985, '1', 'en', null,
  'First issue of the 1985 tie-in mini-series, penciled by Jack Kirby.'
),
(
  'superman-mini-comic-1984', 'Superman Mini-Comic', 'pack_in_mini', 'DC Comics / Kenner',
  1984, null, 'en',
  (select id from releases where slug = 'superman-kenner-1984'),
  'Pack-in mini-comic bundled with the Series 1 Superman figure.'
);

insert into publication_creators (publication_id, creator_id, role)
select p.id, c.id, r.role
from creators c
join (values
  ('super-powers-1984-01', 'plot'),
  ('super-powers-1984-02', 'plot'),
  ('super-powers-1984-03', 'plot'),
  ('super-powers-1985-01', 'pencils')
) as r(pub_slug, role) on true
join publications p on p.slug = r.pub_slug
where c.slug = 'jack-kirby';
