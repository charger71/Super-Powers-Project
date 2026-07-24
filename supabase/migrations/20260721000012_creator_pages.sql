-- Creator bio pages: give each creator a public page with an overview, a photo,
-- a longer body, and an auto-generated list of the work credited to them.
--
-- Two structural additions:
--   1. creators.overview — a short lede shown above the long-form bio, mirroring
--      the characters table's overview/bio split (overview = intro, bio = body).
--   2. media_creators.is_primary / sort_order — the admin's generic media panel
--      and the build's sortedMedia() both key off these columns; media_creators
--      predates them (it was a bare two-column join). Same fix applied to
--      media_merchandise in ..._media_merchandise.sql.
--
-- No content is seeded here — overview/bio prose and photos (which carry
-- required credit/rights) are authored in the admin. The "credited work" list on
-- each page is derived live from release_creators + publication_creators, so it
-- needs no new data.

alter table creators
  add column if not exists overview text;

alter table media_creators
  add column if not exists sort_order smallint default 0,
  add column if not exists is_primary boolean default false;
