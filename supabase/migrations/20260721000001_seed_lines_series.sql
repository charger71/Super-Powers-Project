-- Seed the two product lines and the three Kenner series.
-- Reference data, not content — safe to ship as a migration.
-- McFarlane waves get added via the admin as Phase 3 approaches.

insert into lines (slug, name, manufacturer, year_start, year_end, sort_order) values
  ('kenner-super-powers',       'Kenner Super Powers Collection', 'Kenner',         1984, 1986, 1),
  ('mcfarlane-dc-super-powers', 'McFarlane DC Super Powers',      'McFarlane Toys', 2022, null, 2);

insert into series (line_id, slug, name, year, sort_order)
select l.id, s.slug, s.name, s.year, s.sort_order
from (values
  ('kenner-series-1', 'Series 1', 1984, 1),
  ('kenner-series-2', 'Series 2', 1985, 2),
  ('kenner-series-3', 'Series 3', 1986, 3)
) as s(slug, name, year, sort_order)
join lines l on l.slug = 'kenner-super-powers';
