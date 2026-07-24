-- Rename the default character-media role 'gallery' → 'artwork': these assets
-- are the character artwork (the portrait pool), not a generic gallery.
-- Roles are now: 'artwork' (default), 'logo', 'headshot', 'alter_ego'.

alter table media_characters alter column role set default 'artwork';
update media_characters set role = 'artwork' where role = 'gallery';
