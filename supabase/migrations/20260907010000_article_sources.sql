-- ============================================================
-- News & Articles: sources
--
-- Same shape as releases.sources / release_variations.sources — a plain
-- array of citation URLs, rendered as a linked list under the body.
-- ============================================================
alter table articles add column if not exists sources text[] default '{}';
