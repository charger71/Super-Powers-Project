-- Make artwork records editable in the admin.
--
-- artwork was the last core content table with no admin entity at all (see the
-- "remaining entities" note in ROADMAP.md) — style guides, card art, box art and
-- concept pieces could only be entered by hand in SQL.
--
-- Adding it is meant to be config, not code, but the admin's generic link editor
-- (renderLinkSections) selects, orders by, and inserts sort_order on every join
-- table it manages. artwork_characters (which characters a piece depicts) and
-- artwork_creators (who drew it) predate that editor and carry no such column,
-- so the two artwork link sections need it before they can be wired up.
--
-- Same one-line fix already applied to merchandise_characters in
-- ..._media_merchandise.sql and publication_characters in
-- ..._publication_characters_sort_order.sql. Order is editorial (billing order
-- for creators, cover-credit order for characters), not alphabetical.

alter table artwork_characters
  add column if not exists sort_order int default 0;

alter table artwork_creators
  add column if not exists sort_order int default 0;
