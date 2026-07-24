-- Make comic (publication) records editable in the admin.
--
-- publication_characters is the "Comic Appearances" join — which canonical
-- characters appear in which comic. The front end already renders it on both
-- the character dossier ("Comic Appearances") and the comic detail page, but
-- there was no way to EDIT it: the admin had no publications entity at all.
--
-- The admin's generic link editor (renderLinkSections) selects, orders by, and
-- inserts sort_order on every join table it manages. character_enemies and
-- merchandise_characters already carry it; publication_characters did not, so
-- wiring up the comics link editor requires the same column here. Mirrors the
-- fix already applied to merchandise_characters in ..._media_merchandise.sql.

alter table publication_characters
  add column if not exists sort_order int default 0;
