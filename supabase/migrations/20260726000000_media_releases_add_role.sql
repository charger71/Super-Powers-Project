-- Give release media a `role`, mirroring media_characters.role.
--
-- A single release (e.g. "Superman • Kenner • 1984") carries more than one kind
-- of photo, and different pages want different ones:
--   artwork — packaged / card art. Shown on the character (dossier) page.
--   loose   — the figure out of package. Shown in the Toy Database listing.
--
-- Plain text with a default (not an enum) to match media_characters — the admin
-- constrains the vocabulary via a <select>. Default 'artwork' so every existing
-- release photo keeps behaving as it does today (character page unchanged; the
-- Toy Database falls back to it until a loose photo is tagged).

alter table media_releases
  add column if not exists role text not null default 'artwork';

create index if not exists media_releases_release_id_role_idx
  on media_releases (release_id, role);
