-- External links for creators: website, social, portfolio, etc.
--
-- Stored as a plain text[] of URLs (same shape as releases.sources / creators
-- have no per-link label). The public page derives each link's platform label
-- and icon from its domain, so no controlled vocab or child table is needed.
alter table creators add column if not exists links text[] default '{}';
