-- Extend the rights_status controlled vocabulary.
--
-- Two new values so co-authors can attribute assets we don't own outright:
--   creative_commons — CC-licensed material (still needs a credit + the
--                      specific license spelled out in media_assets.credit).
--   unknown          — provenance not yet established. A holding value, not a
--                      license: it lets a record be saved (rights is NOT NULL)
--                      while flagging it for follow-up, rather than tempting an
--                      author to mislabel it "owned".
--
-- schema.sql's create-type now lists these too, but that statement only runs on
-- a fresh database, so extending the live enum takes ALTER TYPE ... ADD VALUE
-- (see CLAUDE.md). Ordered after permission_granted / before fair_use_editorial
-- and link_only to keep the enum roughly most- to least-permissive.

alter type rights_status add value if not exists 'creative_commons' after 'permission_granted';
alter type rights_status add value if not exists 'unknown';
