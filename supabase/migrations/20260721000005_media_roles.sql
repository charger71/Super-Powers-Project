-- Character media gains a role so a single character can carry, besides its
-- gallery/portrait shots, a logo (SVG — replaces the text name in the powers
-- card), a headshot, and an alter-ego headshot. These stay in media_assets
-- so credit/rights/alt are still captured at upload (non-negotiable #1);
-- the role just says which slot each asset fills.
--
-- Roles: 'gallery' (default, portrait pool), 'logo', 'headshot', 'alter_ego'.
-- Kept as free text + default rather than an enum so authors can add slots
-- without a migration; the admin offers the fixed set above.

alter table media_characters add column role text not null default 'gallery';
create index on media_characters (character_id, role);
