-- Give screen_media a dedicated poster image, separate from the video asset.
--
-- media_id has been doing double duty ("Video / poster"), but a video embed and
-- the still you show before it plays are two different assets. Add
-- poster_media_id alongside it; media_id now means just the video. Both are
-- optional single media_assets references (attribution still lives on the asset,
-- captured in the Media tab). ON DELETE SET NULL mirrors media_id, so deleting
-- an asset detaches it rather than deleting the screen_media row.
alter table screen_media
  add column if not exists poster_media_id uuid references media_assets (id) on delete set null;
