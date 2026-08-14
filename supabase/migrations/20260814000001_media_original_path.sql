-- Remember the uncropped file behind a cropped media asset.
--
-- Cropping in the admin writes a NEW object and repoints storage_path at it.
-- Without somewhere to record the file it replaced, that crop would be
-- one-way: the original pixels are gone, so a crop that took too much could
-- only be undone by re-uploading and re-attaching a fresh asset — which is
-- exactly the "make a second record" problem the in-place replace removed.
--
-- original_path holds the first file the asset ever served. It is set once, on
-- the first crop, and left alone afterwards, so re-cropping always works from
-- the full original rather than compounding one lossy crop on top of another.
-- Null means "never cropped, storage_path IS the original".
--
-- This also honours the CLAUDE.md rule that originals stay out of the served
-- path: the front end and the build only ever read storage_path, so the
-- original stops being served the moment a crop lands, without being deleted.
alter table media_assets
  add column if not exists original_path text;

comment on column media_assets.original_path is
  'Pre-crop file; set once on first crop. Null = storage_path is the original.';
