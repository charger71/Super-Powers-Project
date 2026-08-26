-- Lets an editor mark one character as the homepage's featured dossier (the
-- hero photo + lede + "Read the Dossier" slot) instead of that always being
-- whichever character happens to be slugged 'superman'. The partial unique
-- index is the database enforcing "only one at a time" — the admin also
-- stands down the previous holder before setting a new one (see admin.js),
-- but the constraint is what actually guarantees it.
alter table characters add column if not exists is_homepage_feature boolean not null default false;

create unique index if not exists characters_homepage_feature_key
  on characters (is_homepage_feature) where is_homepage_feature;

comment on column characters.is_homepage_feature is
  'The character featured in the homepage hero slot. At most one row may be true (see characters_homepage_feature_key). Falls back to the "superman" slug, then heuristics, when none is set.';
