-- Optional description field on media assets — an editorial note for
-- co-authors browsing the media library (condition, what's pictured, what
-- still needs doing), distinct from `caption`, which is the public-facing
-- text shown in figcaptions/the lightbox. description is never selected by
-- the build or the front end, so it never renders on the public site.
alter table media_assets add column if not exists description text;

comment on column media_assets.description is
  'Internal notes about the asset — not rendered on the public site (see caption for that).';
