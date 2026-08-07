// Archive84 admin — auth + CRUD for characters, releases, and media.
// Lean by design (see CLAUDE.md): generic form renderer driven by the
// entity definitions below, so adding the remaining entities is config,
// not new code.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';

const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const publicUrl = (path) => `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;

// ---- controlled vocab ---------------------------------------------------
// Every controlled vocabulary is now an editable lookup table (see the
// VOCAB_TABLES block below and migration 20260727000000). There are no
// hardcoded enum lists left; fields pick their values via kind:'lookup'.

// ---- entity definitions -------------------------------------------------
// kind: text | slug | textarea | number | lookup | array | fk
// fk fields render as a searchable picker backed by the referenced table;
// the stored value is always the row's uuid, never hand-typed.
// lookup fields render a <select> of an editable vocab table's slugs.
// mediaJoin wires the "attached media" section into the edit drawer.
const ENTITIES = {
  characters: {
    label: 'Characters',
    table: 'characters',
    listCols: ['name', 'slug', 'alignment'],
    // roles let one attached asset be the logo (SVG, replaces the powers-card
    // text name), a headshot, or an alter-ego headshot — vs. the default
    // artwork pool the portrait is chosen from.
    mediaJoin: { table: 'media_characters', fk: 'character_id', roles: ['artwork', 'logo', 'headshot', 'alter_ego'] },
    // curated cross-type "Related" links (related_items) — this record's source type
    relatedType: 'character',
    // many-to-many links edited as searchable pickers, never hand-typed ids
    linkJoins: [
      { label: 'Enemies', table: 'character_enemies', fk: 'character_id', targetFk: 'enemy_id', targetTable: 'characters' },
      { label: 'Teams', table: 'character_teams', fk: 'character_id', targetFk: 'team_id', targetTable: 'teams' },
      // Real-world creators credited with creating the character — rendered as
      // text links in the dossier's Vital Statistics ("Created by"). Separate
      // from the curated related_items "See Also" sidebar.
      { label: 'Created by (creators)', table: 'character_creators', fk: 'character_id', targetFk: 'creator_id', targetTable: 'creators' },
    ],
    fields: [
      { col: 'name',               label: 'Name',                kind: 'text', required: true },
      { col: 'slug',               label: 'Slug',                kind: 'slug', required: true },
      { col: 'aka',                label: 'AKA (comma-separated)', kind: 'array' },
      { col: 'epithet',            label: 'Epithet (powers-card tagline, shown all-caps)', kind: 'text' },
      { col: 'alignment',          label: 'Alignment',           kind: 'lookup', table: 'alignments' },
      { col: 'first_appearance',   label: 'First appearance',    kind: 'text' },
      { col: 'homeworld',          label: 'Homeworld',           kind: 'text' },
      { col: 'base_of_operations', label: 'Base of operations',  kind: 'text' },
      { col: 'marital_status',     label: 'Marital status',      kind: 'text' },
      { col: 'known_relatives',    label: 'Known relatives',     kind: 'text' },
      { col: 'height',             label: 'Height',              kind: 'text' },
      { col: 'weight',             label: 'Weight',              kind: 'text' },
      { col: 'eyes',               label: 'Eyes',                kind: 'text' },
      { col: 'hair',               label: 'Hair',                kind: 'text' },
      { col: 'random_fact',        label: 'Random fact (titleless last Vital Stats row)', kind: 'text' },
      { col: 'overview',           label: 'Overview',            kind: 'rich' },
      { col: 'overview_extra',     label: 'Overview (extra rich text, standard style)', kind: 'rich' },
      { col: 'bio',                label: 'Bio',                 kind: 'rich' },
      { col: 'powers',             label: 'Powers',              kind: 'textarea' },
      { col: 'weaknesses',         label: 'Weaknesses',          kind: 'textarea' },
      { col: 'enemies',            label: 'Enemies (card text)', kind: 'textarea' },
    ],
  },
  releases: {
    label: 'Releases',
    table: 'releases',
    listCols: ['name', 'slug', 'type', 'status', 'release_year'],
    // roles split a release's photos by where they surface: 'artwork' (packaged
    // / card art) shows on the character dossier; 'loose' (out of package) shows
    // in the Toy Database. Default 'artwork' — see the media_releases migration.
    mediaJoin: { table: 'media_releases', fk: 'release_id', roles: ['artwork', 'loose'] },
    relatedType: 'release',
    fields: [
      { col: 'name',             label: 'Name',            kind: 'text', required: true },
      { col: 'slug',             label: 'Slug',            kind: 'slug', required: true },
      { col: 'type',             label: 'Type',            kind: 'lookup', table: 'release_types', required: true },
      { col: 'status',           label: 'Status',          kind: 'lookup', table: 'release_statuses', required: true, initial: 'released' },
      { col: 'line_id',          label: 'Line',            kind: 'fk', table: 'lines', required: true },
      { col: 'series_id',        label: 'Series',          kind: 'fk', table: 'series' },
      { col: 'character_id',     label: 'Character',       kind: 'fk', table: 'characters' },
      { col: 'variant_of',       label: 'Variant of',      kind: 'fk', table: 'releases' },
      { col: 'release_year',     label: 'Year',            kind: 'number' },
      { col: 'region',           label: 'Region',          kind: 'text', initial: 'US' },
      { col: 'action_feature',   label: 'Action feature',  kind: 'text' },
      { col: 'accessories',      label: 'Accessories (comma-separated)', kind: 'array' },
      { col: 'features',         label: 'Features (comma-separated)',    kind: 'array' },
      { col: 'card_type',        label: 'Card type',       kind: 'text' },
      { col: 'rarity',           label: 'Rarity',          kind: 'lookup', table: 'rarity_levels' },
      { col: 'est_value_loose',  label: 'Est. value loose ($)',  kind: 'number', step: '0.01' },
      { col: 'est_value_carded', label: 'Est. value carded ($)', kind: 'number', step: '0.01' },
      { col: 'overview_lede',    label: 'Overview lede (short enlarged intro, above photography)', kind: 'textarea' },
      { col: 'overview_text',    label: 'Overview text (rich body under the lede)', kind: 'rich' },
      { col: 'notes',            label: 'Notes',           kind: 'rich' },
      { col: 'sources',          label: 'Sources (comma-separated URLs)', kind: 'array' },
    ],
  },
  lines: {
    label: 'Lines',
    table: 'lines',
    orderBy: { col: 'sort_order', ascending: true },
    listCols: ['name', 'slug', 'manufacturer', 'year_start', 'year_end'],
    // the manufacturer logo (and any line-level imagery) — mark one is_primary;
    // the release page shows it under the specifications.
    mediaJoin: { table: 'media_lines', fk: 'line_id' },
    fields: [
      { col: 'name',         label: 'Name',         kind: 'text', required: true },
      { col: 'slug',         label: 'Slug',         kind: 'slug', required: true },
      { col: 'manufacturer', label: 'Manufacturer', kind: 'text' },
      { col: 'manufacturer_website', label: 'Manufacturer website (URL)', kind: 'text' },
      { col: 'year_start',   label: 'Year start',   kind: 'number' },
      { col: 'year_end',     label: 'Year end (blank = ongoing)', kind: 'number' },
      { col: 'description',  label: 'Description',   kind: 'rich' },
      { col: 'sort_order',   label: 'Sort order',   kind: 'number' },
    ],
  },
  series: {
    label: 'Series',
    table: 'series',
    orderBy: { col: 'sort_order', ascending: true },
    listCols: ['name', 'slug', 'year'],
    fields: [
      { col: 'line_id',     label: 'Line',        kind: 'fk', table: 'lines', required: true },
      { col: 'name',        label: 'Name',        kind: 'text', required: true },
      { col: 'slug',        label: 'Slug',        kind: 'slug', required: true },
      { col: 'year',        label: 'Year',        kind: 'number' },
      { col: 'description', label: 'Description', kind: 'textarea' },
      { col: 'sort_order',  label: 'Sort order',  kind: 'number' },
    ],
  },
  statuses: {
    label: 'Statuses',
    table: 'release_statuses',
    orderBy: { col: 'sort_order', ascending: true },
    listCols: ['name', 'slug', 'sort_order'],
    fields: [
      { col: 'name',        label: 'Name',        kind: 'text', required: true },
      { col: 'slug',        label: 'Slug',        kind: 'slug', required: true },
      { col: 'description', label: 'Description', kind: 'text' },
      { col: 'sort_order',  label: 'Sort order',  kind: 'number' },
    ],
  },
  teams: {
    label: 'Teams',
    table: 'teams',
    listCols: ['name', 'slug'],
    fields: [
      { col: 'name', label: 'Name', kind: 'text', required: true },
      { col: 'slug', label: 'Slug', kind: 'slug', required: true },
    ],
  },
  variations: {
    label: 'Variations',
    table: 'release_variations',
    listCols: ['name', 'slug', 'variation_type', 'rarity'],
    // variations carry their own photos, attached like any other media
    mediaJoin: { table: 'media_variations', fk: 'variation_id' },
    fields: [
      { col: 'release_id',       label: 'Release',         kind: 'fk', table: 'releases', required: true },
      { col: 'name',             label: 'Name',            kind: 'text', required: true },
      { col: 'slug',             label: 'Slug',            kind: 'slug', required: true },
      { col: 'variation_type',   label: 'Variation type',  kind: 'lookup', table: 'variation_types' },
      { col: 'description',      label: 'Description',     kind: 'rich' },
      { col: 'rarity',           label: 'Rarity',          kind: 'lookup', table: 'rarity_levels' },
      { col: 'est_value_loose',  label: 'Est. value loose ($)',  kind: 'number', step: '0.01' },
      { col: 'est_value_carded', label: 'Est. value carded ($)', kind: 'number', step: '0.01' },
      { col: 'sort_order',       label: 'Sort order',      kind: 'number' },
      { col: 'notes',            label: 'Notes',           kind: 'rich' },
      { col: 'sources',          label: 'Sources (comma-separated URLs)', kind: 'array' },
    ],
  },
  publications: {
    label: 'Comics',
    table: 'publications',
    titleCol: 'title',
    orderBy: { col: 'year', ascending: true },
    listCols: ['title', 'slug', 'kind', 'year'],
    // cover + interior scans attach like any other media (media_publications);
    // the "attached media" section marks one is_primary as the cover.
    mediaJoin: { table: 'media_publications', fk: 'publication_id' },
    relatedType: 'publication',
    // which canonical characters appear in this comic — the "Comic Appearances"
    // the front end renders on dossiers and comic pages, now editable.
    linkJoins: [
      { label: 'Characters (appearances)', table: 'publication_characters', fk: 'publication_id', targetFk: 'character_id', targetTable: 'characters' },
    ],
    // writer / artist / editor credits — a creator + a role. role is part of the
    // join's primary key, so one creator can hold several roles on one comic.
    creditJoins: [
      { label: 'Credits (writer / artist / editor)', table: 'publication_creators', fk: 'publication_id',
        roles: ['writer', 'penciller', 'inker', 'colorist', 'letterer', 'cover', 'editor'] },
    ],
    fields: [
      { col: 'title',        label: 'Title',        kind: 'text', required: true },
      { col: 'slug',         label: 'Slug',         kind: 'slug', required: true },
      { col: 'kind',         label: 'Kind',         kind: 'lookup', table: 'publication_kinds' },
      { col: 'publisher',    label: 'Publisher',    kind: 'text' },
      { col: 'year',         label: 'Year',         kind: 'number' },
      { col: 'issue_number', label: 'Issue number', kind: 'text' },
      { col: 'language',     label: 'Language',     kind: 'text', initial: 'en' },
      { col: 'packed_with',  label: 'Packed with (release)', kind: 'fk', table: 'releases' },
      { col: 'description',  label: 'Description',   kind: 'rich' },
    ],
  },
  screen_media: {
    label: 'Screen media',
    table: 'screen_media',
    titleCol: 'title',
    orderBy: { col: 'year', ascending: true },
    listCols: ['title', 'slug', 'kind', 'year'],
    relatedType: 'screen_media',
    fields: [
      { col: 'title',       label: 'Title',       kind: 'text', required: true },
      { col: 'slug',        label: 'Slug',        kind: 'slug', required: true },
      { col: 'kind',        label: 'Kind',        kind: 'lookup', table: 'screen_media_kinds' },
      { col: 'year',        label: 'Year',        kind: 'number' },
      { col: 'parent_id',   label: 'Parent (series → episode)', kind: 'fk', table: 'screen_media',
        fkCols: 'id, title, slug', fkOrder: 'title', fkLabel: (r) => `${r.title} · ${r.slug}` },
      { col: 'description', label: 'Description', kind: 'rich' },
      // Two single media assets: the video embed and the poster still shown
      // before it plays. Attribution lives on each asset, captured in the Media
      // tab. Pick a video-type asset (with an Embed URL) for the video.
      { col: 'media_id',    label: 'Video (media asset)', kind: 'fk', table: 'media_assets',
        fkCols: 'id, caption, alt_text, credit', fkOrder: 'created_at',
        fkLabel: (m) => `${m.caption || m.alt_text || 'untitled'} · ${m.credit}` },
      { col: 'poster_media_id', label: 'Poster image (media asset)', kind: 'fk', table: 'media_assets',
        fkCols: 'id, caption, alt_text, credit', fkOrder: 'created_at',
        fkLabel: (m) => `${m.caption || m.alt_text || 'untitled'} · ${m.credit}` },
    ],
  },
  interviews: {
    label: 'Interviews',
    table: 'interviews',
    titleCol: 'title',
    orderBy: { col: 'title', ascending: true },
    listCols: ['title', 'slug', 'format', 'interviewer'],
    // curated "see also" from an interview. 'interview' is source-only for now
    // (no public interview pages yet), so it isn't offered as a target type.
    relatedType: 'interview',
    fields: [
      { col: 'title',       label: 'Title',       kind: 'text', required: true },
      { col: 'slug',        label: 'Slug',        kind: 'slug', required: true },
      { col: 'subject_id',  label: 'Subject (creator)', kind: 'fk', table: 'creators' },
      { col: 'interviewer', label: 'Interviewer', kind: 'text' },
      { col: 'date',        label: 'Date (YYYY-MM-DD)', kind: 'text' },
      { col: 'format',      label: 'Format',      kind: 'lookup', table: 'interview_formats' },
      { col: 'body',        label: 'Body',        kind: 'rich' },
      { col: 'source_url',  label: 'Source URL',  kind: 'text' },
      { col: 'media_id',    label: 'Media asset', kind: 'fk', table: 'media_assets',
        fkCols: 'id, caption, alt_text, credit', fkOrder: 'created_at',
        fkLabel: (m) => `${m.caption || m.alt_text || 'untitled'} · ${m.credit}` },
    ],
  },
  merchandise: {
    label: 'Merchandise',
    table: 'merchandise',
    listCols: ['name', 'slug', 'category', 'manufacturer', 'year'],
    // licensed non-figure goods get photos like everything else (media_merchandise)
    mediaJoin: { table: 'media_merchandise', fk: 'merchandise_id' },
    relatedType: 'merchandise',
    // which characters a piece features (logo-only items just leave this empty)
    linkJoins: [
      { label: 'Characters', table: 'merchandise_characters', fk: 'merchandise_id', targetFk: 'character_id', targetTable: 'characters' },
    ],
    fields: [
      { col: 'name',         label: 'Name',         kind: 'text', required: true },
      { col: 'slug',         label: 'Slug',         kind: 'slug', required: true },
      { col: 'category',     label: 'Category',     kind: 'lookup', table: 'merchandise_categories' },
      { col: 'manufacturer', label: 'Manufacturer', kind: 'text' },
      { col: 'year',         label: 'Year',         kind: 'number' },
      { col: 'description',  label: 'Description',   kind: 'rich' },
    ],
  },
  creators: {
    label: 'Creators',
    table: 'creators',
    listCols: ['name', 'slug', 'role_summary'],
    // the creator's photo/headshot — mark one attachment primary for the page portrait
    mediaJoin: { table: 'media_creators', fk: 'creator_id' },
    relatedType: 'creator',
    fields: [
      { col: 'name',         label: 'Name',         kind: 'text', required: true },
      { col: 'slug',         label: 'Slug',         kind: 'slug', required: true },
      { col: 'role_summary', label: 'Role summary (tagline)', kind: 'text' },
      { col: 'overview',     label: 'Overview (lede)', kind: 'rich' },
      { col: 'bio',          label: 'Bio (body)',   kind: 'rich' },
      { col: 'birth_year',   label: 'Birth year',   kind: 'number' },
      { col: 'death_year',   label: 'Death year',   kind: 'number' },
      // website / social / portfolio URLs — the public page derives each one's
      // platform label + icon from its domain, so just paste the URLs
      { col: 'links',        label: 'Links (comma-separated URLs — website, social, portfolio)', kind: 'array' },
    ],
  },
  media: {
    label: 'Media',
    table: 'media_assets',
    titleCol: 'caption',
    orderBy: { col: 'created_at', ascending: false },
    upload: true,
    listCols: ['_thumb', 'caption', 'credit', 'rights', 'type'],
    // Attribution is captured AT upload — credit/rights/alt are required
    // here on purpose (see CLAUDE.md non-negotiable #1).
    fields: [
      { col: 'type',       label: 'Type',       kind: 'lookup', table: 'media_types', required: true, initial: 'photo' },
      { col: 'credit',     label: 'Credit *',   kind: 'text', required: true },
      { col: 'rights',     label: 'Rights *',   kind: 'lookup', table: 'rights_statuses', required: true },
      { col: 'alt_text',   label: 'Alt text *', kind: 'text', required: true },
      { col: 'caption',    label: 'Caption',    kind: 'text' },
      { col: 'source_url', label: 'Source URL', kind: 'text' },
      { col: 'embed_url',  label: 'Embed URL (video — instead of a file)', kind: 'text' },
    ],
  },
};

// ---- controlled-vocabulary lookup tables --------------------------------
// The editable vocabularies (converted from enums in 20260727000000) all share
// release_statuses' shape — slug + display name + sort order — so define them
// from a compact map instead of repeating the field list 11 times. Each becomes
// its own admin tab; the matching field elsewhere picks from it via
// kind:'lookup'. Keep this in sync with the migration + MENU_GROUPS.
const VOCAB_TABLES = {
  alignments:             'Alignments',
  release_types:          'Release types',
  rarity_levels:          'Rarity levels',
  variation_types:        'Variation types',
  media_types:            'Media types',
  rights_statuses:        'Rights statuses',
  artwork_types:          'Artwork types',
  publication_kinds:      'Comic kinds',
  screen_media_kinds:     'Screen media kinds',
  interview_formats:      'Interview formats',
  merchandise_categories: 'Merchandise categories',
};
// Curated "Related" links live in one polymorphic table (related_items) — see
// its migration. Each linkable type maps a related_items type slug to the table
// its rows live in and the column that titles them (comics/media use `title`).
// Kept in lockstep with the entity_types seed and the build's resolver.
// These are the types offered as link TARGETS (and how existing links are
// labeled). Every type here must have a public page for the build to resolve
// it. 'interview' is intentionally absent — interviews can curate related links
// (relatedType on the def) but have no page to point at, so they're source-only.
const RELATED_TYPES = [
  { slug: 'character',    label: 'Character',    table: 'characters',   titleCol: 'name'  },
  { slug: 'release',      label: 'Toy',          table: 'releases',     titleCol: 'name'  },
  { slug: 'publication',  label: 'Comic',        table: 'publications', titleCol: 'title' },
  { slug: 'screen_media', label: 'Media',        table: 'screen_media', titleCol: 'title' },
  { slug: 'creator',      label: 'Creator',      table: 'creators',     titleCol: 'name'  },
  { slug: 'merchandise',  label: 'Merchandise',  table: 'merchandise',  titleCol: 'name'  },
];
const RELATED_BY_SLUG = new Map(RELATED_TYPES.map((t) => [t.slug, t]));

for (const [table, label] of Object.entries(VOCAB_TABLES)) {
  ENTITIES[table] = {
    label,
    table,
    orderBy: { col: 'sort_order', ascending: true },
    listCols: ['name', 'slug', 'sort_order'],
    fields: [
      { col: 'name',        label: 'Name',        kind: 'text', required: true },
      { col: 'slug',        label: 'Slug',        kind: 'slug', required: true },
      { col: 'description', label: 'Description', kind: 'text' },
      { col: 'sort_order',  label: 'Sort order',  kind: 'number' },
    ],
  };
}

// ---- state --------------------------------------------------------------
const state = { entity: 'characters', rows: [], editing: null, sort: null };

const $ = (id) => document.getElementById(id);

// ---- auth ---------------------------------------------------------------
// ---- routing ------------------------------------------------------------
// The current view lives in the URL hash so a refresh restores it:
//   #<entity>            → that entity's list
//   #<entity>/<id>       → that record open in the editor
//   #<entity>/new        → a blank new-record editor
// We write the hash on every navigation; a guard flag stops our own writes
// from bouncing back through the hashchange handler.
let suppressHashChange = false;
let routed = false;   // first authed load restores the hash; later auth events don't

function setHash(h) {
  if (location.hash.slice(1) === h) return;   // unchanged → no event, leave guard alone
  suppressHashChange = true;
  location.hash = h;
}

function parseHash() {
  const [entity, recordId] = decodeURIComponent(location.hash.slice(1)).split('/');
  return { entity: ENTITIES[entity] ? entity : null, recordId: recordId || null };
}

// Apply whatever the hash names: switch entity, load its list, then (re)open a
// record if one is named. Used on first authed load and on external hash edits.
async function applyRoute() {
  const { entity, recordId } = parseHash();
  if (entity) state.entity = entity;
  renderMenu();
  await loadList();
  if (recordId === 'new') {
    openDrawer(null);
  } else if (recordId) {
    const row = state.rows.find((r) => r.id === recordId);
    if (row) openDrawer(row);
    else setHash(state.entity);   // stale id (deleted / different entity) → list
  }
}

window.addEventListener('hashchange', () => {
  if (suppressHashChange) { suppressHashChange = false; return; }  // our own write
  if (!$('app-view').hidden) applyRoute();                         // external edit / back-forward
});

async function refreshAuth() {
  const { data: { session } } = await db.auth.getSession();
  $('login-view').hidden = !!session;
  $('app-view').hidden = !session;
  $('logout').hidden = !session;
  $('rebuild').hidden = !session;
  $('rebuild-all-wrap').hidden = !session;
  $('menu').hidden = !session;
  $('user-email').textContent = session?.user?.email ?? '';
  // First authed load restores the hash (entity + open record). Later auth
  // events (token refresh) must NOT reopen/reset an editor you're using, so
  // they just refresh the list data underneath.
  if (session) {
    if (!routed) { routed = true; applyRoute(); }
    else loadList();
  }
}

// ---- rebuild (local dev server only — see build/serve.mjs) --------------
$('rebuild').addEventListener('click', async () => {
  const btn = $('rebuild');
  btn.disabled = true;
  btn.textContent = 'Rebuilding…';
  try {
    const all = $('rebuild-all').checked ? '?all=1' : '';
    const res = await fetch(`/api/rebuild${all}`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    btn.textContent = body.changed
      ? `Rebuilt ✓ ${body.changed} updated`
      : 'Rebuilt ✓ no changes';
  } catch (err) {
    btn.textContent = 'Rebuild unavailable';
    console.error('Rebuild failed — is the site served via `node build/serve.mjs`?', err);
  } finally {
    btn.disabled = false;
    setTimeout(() => { btn.textContent = 'Rebuild site'; }, 5000);
  }
});

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const { error } = await db.auth.signInWithPassword({
    email: $('login-email').value,
    password: $('login-password').value,
  });
  $('login-error').hidden = !error;
  if (error) $('login-error').textContent = error.message;
});

$('logout').addEventListener('click', () => db.auth.signOut());
db.auth.onAuthStateChange(() => refreshAuth());

// ---- menu (grouped dropdown in the header bar) --------------------------
// Groups the 13 entities so daily-use content sits apart from the rarely
// touched lookup tables. Keys must match ENTITIES; any entity left out of a
// group would simply not appear, so keep this in sync when adding tables.
const MENU_GROUPS = [
  { label: 'Content',      keys: ['characters', 'releases', 'variations'] },
  { label: 'Media',        keys: ['publications', 'screen_media', 'interviews', 'merchandise', 'creators', 'media'] },
  { label: 'Structure',    keys: ['lines', 'series', 'teams'] },
  { label: 'Vocabularies', keys: ['statuses', 'alignments', 'release_types', 'rarity_levels', 'variation_types',
                                  'media_types', 'rights_statuses', 'artwork_types', 'publication_kinds',
                                  'screen_media_kinds', 'interview_formats', 'merchandise_categories'] },
];

// One dropdown per group, laid out as a menubar in the header. The group
// holding the current entity is marked .is-current; the current entity itself
// is .active inside its panel.
function renderMenu() {
  const bar = $('menu');
  bar.replaceChildren(...MENU_GROUPS.map((group) => {
    const wrap = document.createElement('div');
    wrap.className = 'menu';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'menu__button' + (group.keys.includes(state.entity) ? ' is-current' : '');
    btn.setAttribute('aria-haspopup', 'true');
    btn.setAttribute('aria-expanded', 'false');
    const caret = document.createElement('span');
    caret.className = 'menu__caret';
    caret.setAttribute('aria-hidden', 'true');
    caret.textContent = '▾';
    const label = document.createElement('span');
    label.textContent = group.label;
    btn.append(label, caret);

    const panel = document.createElement('div');
    panel.className = 'menu__panel';
    panel.setAttribute('role', 'menu');
    panel.hidden = true;
    for (const key of group.keys) {
      const def = ENTITIES[key];
      if (!def) continue;
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'menu__item' + (key === state.entity ? ' active' : '');
      item.setAttribute('role', 'menuitem');
      item.textContent = def.label;
      item.addEventListener('click', () => {
        closeMenus();
        if (key === state.entity) return;
        state.entity = key;
        closeDrawer();
        setHash(state.entity);  // record the new entity's list in the URL
        renderMenu();
        loadList();
      });
      panel.append(item);
    }

    // toggle this dropdown; opening one closes any other that's open
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const willOpen = panel.hidden;
      closeMenus();
      if (willOpen) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    });

    wrap.append(btn, panel);
    return wrap;
  }));
}

function closeMenus() {
  for (const p of $('menu').querySelectorAll('.menu__panel')) p.hidden = true;
  for (const b of $('menu').querySelectorAll('.menu__button')) b.setAttribute('aria-expanded', 'false');
}

// click-away and Escape close whichever dropdown is open
document.addEventListener('click', (e) => { if (!$('menu').contains(e.target)) closeMenus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

// ---- list ---------------------------------------------------------------
async function loadList() {
  const def = ENTITIES[state.entity];
  const order = def.orderBy ?? { col: 'name', ascending: true };
  const { data, error } = await db.from(def.table).select('*')
    .order(order.col, { ascending: order.ascending });
  if (error) { alert(error.message); return; }
  state.rows = data;
  state.sort = null;               // clear any per-column sort when switching entities
  renderList();
}

// Every list carries a trailing "updated" column so sorting by latest edited
// is always available, whatever the entity's own columns are.
const EDITED_COL = 'updated_at';

// Mixed-type compare: nulls last, numbers numerically, dates by timestamp,
// everything else case-insensitive string. `dir` is 1 (asc) or -1 (desc).
function compareRows(a, b, col, dir) {
  const av = a[col], bv = b[col];
  const aEmpty = av == null || av === '';
  const bEmpty = bv == null || bv === '';
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : (aEmpty ? 1 : -1);
  if (col === EDITED_COL || col === 'created_at') {
    return (new Date(av) - new Date(bv)) * dir;
  }
  if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' }) * dir;
}

function listCell(row, col) {
  const td = document.createElement('td');
  if (col === '_thumb') {
    if (row.storage_path) {
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = publicUrl(row.storage_path);
      img.alt = row.alt_text ?? '';
      td.append(img);
    } else if (row.embed_url) {
      td.textContent = '▶ embed';
    }
  } else if ((col === EDITED_COL || col === 'created_at') && row[col]) {
    const d = new Date(row[col]);
    td.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    td.title = d.toLocaleString();
  } else {
    td.textContent = Array.isArray(row[col]) ? row[col].join(', ') : (row[col] ?? '');
  }
  return td;
}

function renderList() {
  const def = ENTITIES[state.entity];
  $('list-title').textContent = def.label;
  $('bulk-upload').hidden = !def.upload;
  const filter = $('list-filter').value.trim().toLowerCase();
  const displayCols = [...def.listCols, EDITED_COL];
  const cols = displayCols.filter((c) => c !== '_thumb');
  const rows = filter
    ? state.rows.filter((r) => cols.some((c) => String(r[c] ?? '').toLowerCase().includes(filter)))
    : state.rows.slice();

  // Active sort: an explicit header click, otherwise the entity's default.
  const sort = state.sort ?? def.orderBy ?? { col: 'name', ascending: true };
  const dir = sort.ascending ? 1 : -1;
  rows.sort((a, b) => compareRows(a, b, sort.col, dir));

  const head = document.createElement('tr');
  const headCells = displayCols.map((c) => {
    const th = document.createElement('th');
    if (c === '_thumb') { th.textContent = ''; return th; }
    const active = sort.col === c;
    th.textContent = (c === EDITED_COL ? 'edited' : c.replace(/_/g, ' '))
      + (active ? (sort.ascending ? ' ▲' : ' ▼') : '');
    th.className = 'sortable' + (active ? ' sorted' : '');
    th.addEventListener('click', () => {
      state.sort = { col: c, ascending: active ? !sort.ascending : true };
      renderList();
    });
    return th;
  });
  const actionsTh = document.createElement('th');
  actionsTh.className = 'row-actions';
  head.replaceChildren(...headCells, actionsTh);

  const body = rows.map((row) => {
    const tr = document.createElement('tr');
    const actionsTd = document.createElement('td');
    actionsTd.className = 'row-actions';
    const dup = document.createElement('button');
    dup.type = 'button';
    dup.className = 'row-dup';
    dup.textContent = 'Duplicate';
    dup.title = 'Create an editable copy of this record';
    dup.addEventListener('click', (e) => {
      e.stopPropagation();        // don't also open the row for editing
      duplicateRow(row);
    });
    actionsTd.append(dup);
    tr.replaceChildren(...displayCols.map((c) => listCell(row, c)), actionsTd);
    tr.addEventListener('click', () => openDrawer(row));
    return tr;
  });

  $('list').replaceChildren(head, ...body);
}

$('list-filter').addEventListener('input', renderList);
$('new-record').addEventListener('click', () => openDrawer(null));

// Pick a slug not already used by a loaded row, so a duplicate never collides
// with the unique-slug constraint. Strips any existing -copy suffix first so
// duplicating a copy gives "-copy-2", not "-copy-copy".
function uniqueSlug(base, existing) {
  const root = base.replace(/-copy(-\d+)?$/, '');
  const taken = new Set(existing);
  let candidate = `${root}-copy`;
  for (let n = 2; taken.has(candidate); n++) candidate = `${root}-copy-${n}`;
  return candidate;
}

// Row-list "Duplicate": copy a record's own columns into a new row (the unique
// slug is bumped and the title gets "(copy)"), then open the copy in the editor
// so it can be adjusted. Relationships and attached media are NOT copied — this
// clones the record's fields only, which is the point (e.g. a fast Series-2 from
// a Series-1 release); wire up links/media on the new copy as needed.
async function duplicateRow(row) {
  const def = ENTITIES[state.entity];
  const payload = { ...row };
  delete payload.id;
  delete payload.created_at;
  delete payload.updated_at;
  if (typeof payload.slug === 'string' && payload.slug) {
    payload.slug = uniqueSlug(payload.slug, state.rows.map((r) => r.slug).filter(Boolean));
  }
  const titleCol = def.titleCol ?? 'name';
  if (typeof payload[titleCol] === 'string' && payload[titleCol]) {
    payload[titleCol] = `${payload[titleCol]} (copy)`;
  }
  const { data, error } = await db.from(def.table).insert(payload).select().single();
  if (error) { alert(`Duplicate failed: ${error.message}`); return; }
  await loadList();
  openDrawer(data);
}

// ---- rich text editor (zero-dependency, contenteditable) ----------------
// Long-form fields (bios, notes, articles) use a small toolbar over a
// contenteditable region. Output is sanitized to a tag whitelist on save, so
// what lands in Postgres is clean HTML the static build can emit directly.
const RTE_ALLOWED = {
  P: [], BR: [], HR: [], STRONG: [], B: [], EM: [], I: [], U: [], SMALL: [],
  H2: [], H3: [], H4: [], UL: [], OL: [], LI: [], BLOCKQUOTE: [], A: ['href'],
  TABLE: [], THEAD: [], TBODY: [], TR: [], TH: [], TD: [],
  // images are picked from the media library and inserted as lightbox triggers;
  // credit/caption ride along as data-* so the front-end lightbox shows them
  IMG: ['src', 'alt', 'class', 'data-gallery', 'data-credit', 'data-caption'],
};

const INLINE_FMT = new Set(['B', 'STRONG', 'I', 'EM', 'U']);
const BLOCK_TAGS = new Set([
  'P', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'HR',
  'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD',
]);
const hasBlockDescendant = (el) => [...el.children].some(
  (c) => BLOCK_TAGS.has(c.tagName) || hasBlockDescendant(c));

// A bold/italic tag that neutralizes itself with an inline style (the Google
// Docs "<b style='font-weight:normal'>" paste wrapper) or that wraps block
// content is not real emphasis. Left alone, the whitelist strips the style and
// leaves a bare <b> that bolds an entire pasted block — so unwrap it instead.
function isFakeEmphasis(el) {
  const tag = el.tagName;
  if (!INLINE_FMT.has(tag)) return false;
  const style = el.getAttribute('style') || '';
  if ((tag === 'B' || tag === 'STRONG') && /font-weight\s*:\s*(normal|[1-4]00)\b/i.test(style)) return true;
  if ((tag === 'I' || tag === 'EM') && /font-style\s*:\s*normal\b/i.test(style)) return true;
  return hasBlockDescendant(el);
}

function sanitizeHtml(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  // contenteditable wraps lines in <div>; normalize those to paragraphs
  root.querySelectorAll('div').forEach((d) => {
    const p = document.createElement('p');
    while (d.firstChild) p.appendChild(d.firstChild);
    d.replaceWith(p);
  });
  const clean = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 8) { child.remove(); continue; }   // comments
      if (child.nodeType !== 1) continue;                       // keep text nodes
      const tag = child.tagName;
      if (!RTE_ALLOWED[tag] || isFakeEmphasis(child)) {         // unwrap unknown / fake-bold tags
        clean(child);
        while (child.firstChild) node.insertBefore(child.firstChild, child);
        child.remove();
        continue;
      }
      for (const attr of [...child.attributes]) {
        if (!RTE_ALLOWED[tag].includes(attr.name)) child.removeAttribute(attr.name);
      }
      if (tag === 'A') {
        const href = child.getAttribute('href') || '';
        if (!/^(https?:|mailto:|\/)/i.test(href)) child.removeAttribute('href');
        else { child.setAttribute('rel', 'noopener'); child.setAttribute('target', '_blank'); }
      }
      if (tag === 'IMG') {
        // drop images with no usable src; ensure alt exists (a11y — never null)
        const src = child.getAttribute('src') || '';
        if (!/^(https?:|\/)/i.test(src)) { child.remove(); continue; }
        if (child.getAttribute('alt') == null) child.setAttribute('alt', '');
        // 'lb-trigger' is the only class we emit — normalize whatever's here to it
        if (child.hasAttribute('class')) child.setAttribute('class', 'lb-trigger');
      }
      clean(child);
    }
  };
  clean(root);
  root.querySelectorAll('p').forEach((p) => {
    // keep a <p> that holds an image even when it has no text (image-only line)
    if (!p.textContent.trim() && !p.querySelector('br, img')) p.remove();
  });
  return root.innerHTML.trim();
}

const looksLikeHtml = (s) => /<(p|h[1-6]|ul|ol|li|blockquote|br|hr|strong|em|b|i|u|a|small|table|tr|t[hd])\b/i.test(s ?? '');
const escHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Stored value → editable HTML. HTML passes through; legacy plain text becomes
// <p> blocks split on blank lines, so old records open cleanly in the editor.
function toEditableHtml(value) {
  if (!value) return '';
  if (looksLikeHtml(value)) return value;
  return value.split(/\n\s*\n/).filter((p) => p.trim())
    .map((p) => `<p>${escHtml(p.trim())}</p>`).join('');
}

const RTE_TOOLS = [
  { cmd: 'bold',                label: 'B',       title: 'Bold',            css: 'font-weight:800' },
  { cmd: 'italic',              label: 'I',       title: 'Italic',          css: 'font-style:italic' },
  { cmd: 'formatBlock', arg: 'h2', label: 'H2',   title: 'Heading — large' },
  { cmd: 'formatBlock', arg: 'h3', label: 'H3',   title: 'Heading — medium' },
  { cmd: 'formatBlock', arg: 'h4', label: 'H4',   title: 'Heading — small' },
  { cmd: 'formatBlock', arg: 'p',  label: '¶',    title: 'Paragraph' },
  { cmd: 'insertUnorderedList', label: '• List',  title: 'Bulleted list' },
  { cmd: 'insertOrderedList',   label: '1. List', title: 'Numbered list' },
  { cmd: 'formatBlock', arg: 'blockquote', label: '❝', title: 'Quote' },
  { cmd: 'insertHorizontalRule', label: '―',      title: 'Horizontal rule — divider' },
  { cmd: 'insertTable',         label: 'Table',   title: 'Insert table' },
  { cmd: 'insertImage',         label: 'Image',   title: 'Insert image — from media library' },
  { cmd: 'small',               label: 'Sm',      title: 'Small text — citations, footers' },
  { cmd: 'createLink',          label: 'Link',    title: 'Add link' },
  { cmd: 'removeFormat',        label: 'Clear',   title: 'Clear formatting' },
];

// Insert a table skeleton (header row + body rows) at the caret. execCommand
// has no table command, so build the HTML and drop it in; empty cells carry a
// <br> so they're clickable. Sizes are clamped to keep tables "basic".
function insertTable(editor) {
  const input = prompt('Table size — columns × rows', '3 × 3');
  if (!input) return;
  const m = input.match(/(\d+)\s*[x×]\s*(\d+)/i);
  const cols = Math.min(Math.max(m ? +m[1] : 3, 1), 8);
  const rows = Math.min(Math.max(m ? +m[2] : 3, 1), 20);
  const cells = (tag, n) => Array.from({ length: n }, () => `<${tag}><br></${tag}>`).join('');
  const bodyRows = Array.from({ length: Math.max(rows - 1, 0) },
    () => `<tr>${cells('td', cols)}</tr>`).join('');
  const html = `<table><thead><tr>${cells('th', cols)}</tr></thead><tbody>${bodyRows}</tbody></table><p><br></p>`;
  editor.focus();
  document.execCommand('insertHTML', false, html);
}

// Insert an image at the caret by PICKING from the media library — so credit,
// rights, and alt text (captured at upload, non-negotiable #1) travel with the
// asset instead of being re-entered. The inserted <img> is a lightbox trigger
// (class 'lb-trigger' + data-gallery), and carries credit/caption as data-*
// so the front-end lightbox can show attribution. The static build emits this
// HTML directly; js/lightbox.js wires the click. The caret is captured before
// the modal steals focus and restored before insertion.
async function insertImage(editor) {
  const sel = window.getSelection();
  let savedRange = null;
  if (sel.rangeCount) {
    const r = sel.getRangeAt(0);
    if (editor.contains(r.commonAncestorContainer)) savedRange = r.cloneRange();
  }

  // image assets only: those backed by a stored file (photos/scans), newest first
  const { data: assets, error } = await db.from('media_assets')
    .select('id, caption, alt_text, credit, storage_path')
    .not('storage_path', 'is', null)
    .order('created_at', { ascending: false });
  if (error) { alert(error.message); return; }
  if (!assets?.length) { alert('No image media yet — upload images in the Media tab first.'); return; }

  const byLabel = new Map(assets.map((m) => [mediaLabel(m), m]));

  const dialog = document.createElement('dialog');
  dialog.className = 'rte-img-dialog';
  const listId = 'dl-rte-img';
  dialog.innerHTML = `
    <form method="dialog">
      <h3>Insert image</h3>
      <p class="hint">Pick from the media library — credit and alt travel with the asset.</p>
      <input id="rte-img-input" list="${listId}" placeholder="Type to search…" autocomplete="off">
      <datalist id="${listId}"></datalist>
      <div class="rte-img-dialog__actions">
        <button type="button" id="rte-img-cancel">Cancel</button>
        <button type="submit" value="insert" class="primary">Insert</button>
      </div>
    </form>`;
  dialog.querySelector('datalist').replaceChildren(...assets.map((m) => {
    const o = document.createElement('option');
    o.value = mediaLabel(m);
    return o;
  }));

  const input = dialog.querySelector('#rte-img-input');
  dialog.querySelector('#rte-img-cancel').addEventListener('click', () => dialog.close('cancel'));

  dialog.addEventListener('close', () => {
    const asset = dialog.returnValue === 'insert' ? byLabel.get(input.value) : null;
    dialog.remove();
    if (!asset) return;   // cancelled, or nothing valid typed

    const img = document.createElement('img');
    img.className = 'lb-trigger';
    img.setAttribute('data-gallery', 'prose');
    img.src = publicUrl(asset.storage_path);
    img.alt = asset.alt_text || '';
    if (asset.credit) img.setAttribute('data-credit', asset.credit);
    if (asset.caption) img.setAttribute('data-caption', asset.caption);

    editor.focus();
    if (savedRange) {
      sel.removeAllRanges();
      sel.addRange(savedRange);
    } else {                                   // no prior caret → append at the end
      const end = document.createRange();
      end.selectNodeContents(editor);
      end.collapse(false);
      sel.removeAllRanges();
      sel.addRange(end);
    }
    document.execCommand('insertHTML', false, `${img.outerHTML}<p><br></p>`);
  });

  document.body.append(dialog);
  dialog.showModal();
  input.focus();
}

// Tab / Shift-Tab moves between cells while editing a table; Tab out of the
// last cell appends a new row. Outside a table, Tab keeps its default behavior.
function handleTableTab(e, editor) {
  if (e.key !== 'Tab') return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  let node = sel.anchorNode;
  node = node.nodeType === 1 ? node : node.parentNode;
  const cell = node.closest?.('th, td');
  if (!cell || !editor.contains(cell)) return;
  e.preventDefault();
  const table = cell.closest('table');
  const all = [...table.querySelectorAll('th, td')];
  const idx = all.indexOf(cell);
  let next = e.shiftKey ? all[idx - 1] : all[idx + 1];
  if (!next && !e.shiftKey) {                 // past the last cell → new row
    const cols = table.querySelector('tr').children.length;
    const tbody = table.querySelector('tbody') || table;
    const tr = document.createElement('tr');
    for (let i = 0; i < cols; i++) {
      const td = document.createElement('td');
      td.innerHTML = '<br>';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
    next = tr.firstChild;
  }
  if (next) {
    const r = document.createRange();
    r.selectNodeContents(next);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
  }
}

// Toggle-wrap the current selection in an inline element (execCommand has no
// 'small'). If the selection already sits inside one, unwrap it instead.
function wrapSelection(tagName, editor) {
  const sel = window.getSelection();
  if (!sel.rangeCount || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);
  let container = range.commonAncestorContainer;
  container = container.nodeType === 1 ? container : container.parentNode;
  const existing = container.closest(tagName);
  if (existing && editor.contains(existing)) {          // toggle off
    const parent = existing.parentNode;
    while (existing.firstChild) parent.insertBefore(existing.firstChild, existing);
    parent.removeChild(existing);
    return;
  }
  const wrapper = document.createElement(tagName);
  try {
    range.surroundContents(wrapper);
  } catch {                                             // selection crosses nodes
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
  }
  sel.removeAllRanges();
  const r = document.createRange();
  r.selectNodeContents(wrapper);
  sel.addRange(r);
}

function buildRichField(field, value) {
  const wrap = document.createElement('div');
  wrap.className = 'rte-wrap';

  const toolbar = document.createElement('div');
  toolbar.className = 'rte-toolbar';

  const editor = document.createElement('div');
  editor.className = 'rte';
  editor.contentEditable = 'true';
  editor.dataset.col = field.col;
  editor.innerHTML = toEditableHtml(value);

  // Paste as clean, paragraph-aware text. Kills formatting cruft from Word /
  // Google Docs / web pages — notably the "<b style='font-weight:normal'>"
  // wrapper that otherwise bolds an entire pasted block. Use the toolbar to
  // re-apply bold/italic/headings intentionally.
  editor.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData)?.getData('text/plain') ?? '';
    if (!text) return;
    const html = text.split(/\n\s*\n/).filter((b) => b.trim())
      .map((b) => `<p>${escHtml(b.trim()).replace(/\n/g, '<br>')}</p>`)
      .join('');
    document.execCommand('insertHTML', false, html || `<p>${escHtml(text)}</p>`);
  });

  editor.addEventListener('keydown', (e) => handleTableTab(e, editor));

  for (const t of RTE_TOOLS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'rte-btn';
    b.title = t.title;
    b.textContent = t.label;
    if (t.css) b.style.cssText = t.css;
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the selection
    b.addEventListener('click', () => {
      editor.focus();
      try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch { /* older browsers */ }
      if (t.cmd === 'createLink') {
        const url = prompt('Link URL (https://…)');
        if (url) document.execCommand('createLink', false, url);
      } else if (t.cmd === 'small') {
        wrapSelection('small', editor);
      } else if (t.cmd === 'insertTable') {
        insertTable(editor);
      } else if (t.cmd === 'insertImage') {
        insertImage(editor);
      } else if (t.cmd === 'formatBlock') {
        document.execCommand('formatBlock', false, t.arg);
      } else {
        document.execCommand(t.cmd, false, null);
      }
    });
    toolbar.append(b);
  }

  wrap.append(toolbar, editor);
  return wrap;
}

// ---- fk picker ----------------------------------------------------------
// Text input + <datalist>, storing the uuid in a hidden input. Labels are
// "name · slug" — slugs are unique, so the label→id map is unambiguous.
// Most FK targets label as "name · slug", but some tables use a different
// title column (screen_media/interviews → title) or none at all (media_assets),
// so the columns, ordering, and label are overridable per field.
async function buildFkField(field, value) {
  const wrap = document.createElement('div');
  const cols = field.fkCols ?? 'id, name, slug';
  const { data, error } = await db.from(field.table).select(cols).order(field.fkOrder ?? 'name');
  if (error) { wrap.textContent = error.message; return wrap; }

  const labelFor = field.fkLabel ?? ((r) => `${r.name} · ${r.slug}`);
  const byLabel = new Map(data.map((r) => [labelFor(r), r.id]));
  const byId = new Map(data.map((r) => [r.id, labelFor(r)]));

  const listId = `dl-${field.col}`;
  const datalist = document.createElement('datalist');
  datalist.id = listId;
  datalist.replaceChildren(...data.map((r) => {
    const o = document.createElement('option');
    o.value = labelFor(r);
    return o;
  }));

  const input = document.createElement('input');
  input.setAttribute('list', listId);
  input.placeholder = 'Type to search…';
  input.value = value ? (byId.get(value) ?? '') : '';

  const hidden = document.createElement('input');
  hidden.type = 'hidden';
  hidden.name = field.col;
  hidden.value = value ?? '';

  input.addEventListener('input', () => {
    const id = byLabel.get(input.value) ?? '';
    hidden.value = id;
    input.classList.toggle('invalid', input.value !== '' && !id);
  });

  wrap.append(input, hidden, datalist);
  return wrap;
}

// ---- lookup picker ------------------------------------------------------
// A <select> populated from a small lookup table (e.g. release_statuses),
// storing a chosen column — the slug — rather than a uuid. Unlike an fk
// picker the value is a human-readable slug the schema references directly,
// so it behaves like an enum whose options are editable in their own tab.
async function buildLookupField(field, value) {
  const valueCol = field.valueCol ?? 'slug';
  const labelCol = field.labelCol ?? 'name';
  const order = field.lookupOrder ?? 'sort_order';
  const select = document.createElement('select');
  select.name = field.col;
  if (field.required) select.required = true;

  const { data, error } = await db.from(field.table)
    .select(`${valueCol}, ${labelCol}`).order(order);
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = error ? error.message : '—';
  select.replaceChildren(blank, ...(data ?? []).map((r) => {
    const o = document.createElement('option');
    o.value = r[valueCol];
    o.textContent = r[labelCol] ?? r[valueCol];
    return o;
  }));
  select.value = value ?? '';
  return select;
}

// ---- many-to-many links (inside drawers) --------------------------------
// Add/remove write through immediately, like attached media — so they need a
// saved row to hang off. New records show a hint until saved once.
async function renderLinkSections(def, row) {
  const box = $('drawer-links');
  box.replaceChildren();
  if (!def.linkJoins?.length) return;

  for (const join of def.linkJoins) {
    const section = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = join.label;
    section.append(h);

    if (!row) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = `Save this record first, then add ${join.label.toLowerCase()}.`;
      section.append(hint);
      box.append(section);
      continue;
    }

    const { data: links, error } = await db.from(join.table)
      .select(`${join.targetFk}, sort_order, ${join.targetTable}!${join.table}_${join.targetFk}_fkey(id, name, slug)`)
      .eq(join.fk, row.id)
      .order('sort_order');

    if (error) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = error.message;
      section.append(p);
      box.append(section);
      continue;
    }

    const list = document.createElement('ul');
    list.className = 'link-list';
    for (const l of links ?? []) {
      const target = l[join.targetTable];
      if (!target) continue;
      const li = document.createElement('li');
      li.textContent = `${target.name} · ${target.slug}`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'danger';
      rm.textContent = 'Remove';
      rm.addEventListener('click', async () => {
        const { error: delError } = await db.from(join.table).delete()
          .eq(join.fk, row.id).eq(join.targetFk, target.id);
        if (delError) { alert(delError.message); return; }
        renderLinkSections(def, row);
      });
      li.append(rm);
      list.append(li);
    }
    section.append(list);

    // picker: same datalist approach as buildFkField, excluding self and
    // anything already linked
    const { data: options } = await db.from(join.targetTable)
      .select('id, name, slug').order('name');
    const taken = new Set((links ?? []).map((l) => l[join.targetFk]));
    const available = (options ?? []).filter((o) => o.id !== row.id && !taken.has(o.id));

    const labelFor = (r) => `${r.name} · ${r.slug}`;
    const byLabel = new Map(available.map((r) => [labelFor(r), r.id]));

    const listId = `dl-link-${join.table}`;
    const datalist = document.createElement('datalist');
    datalist.id = listId;
    datalist.replaceChildren(...available.map((r) => {
      const o = document.createElement('option');
      o.value = labelFor(r);
      return o;
    }));

    const input = document.createElement('input');
    input.setAttribute('list', listId);
    input.placeholder = 'Type to search…';

    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Add';
    add.addEventListener('click', async () => {
      const targetId = byLabel.get(input.value);
      if (!targetId) { input.classList.add('invalid'); return; }
      const { error: insError } = await db.from(join.table).insert({
        [join.fk]: row.id,
        [join.targetFk]: targetId,
        sort_order: links?.length ?? 0,
      });
      if (insError) { alert(insError.message); return; }
      renderLinkSections(def, row);
    });

    const adder = document.createElement('div');
    adder.className = 'link-adder';
    adder.append(input, add, datalist);
    section.append(adder);
    box.append(section);
  }
}

// ---- creator credits (creator + role join tables) -----------------------
// Like renderLinkSections, but the join carries a `role` that is part of its
// primary key — so the picker is (creator, role) and one creator can appear
// under several roles. Target table is always `creators`.
async function renderCreditSections(def, row) {
  const box = $('drawer-credits');
  box.replaceChildren();
  if (!def.creditJoins?.length) return;

  for (const join of def.creditJoins) {
    const section = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = join.label;
    section.append(h);

    if (!row) {
      const hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = `Save this record first, then add ${join.label.toLowerCase()}.`;
      section.append(hint);
      box.append(section);
      continue;
    }

    const { data: credits, error } = await db.from(join.table)
      .select(`creator_id, role, creators!${join.table}_creator_id_fkey(id, name, slug)`)
      .eq(join.fk, row.id)
      .order('role');

    if (error) {
      const p = document.createElement('p');
      p.className = 'hint';
      p.textContent = error.message;
      section.append(p);
      box.append(section);
      continue;
    }

    const list = document.createElement('ul');
    list.className = 'link-list';
    for (const c of credits ?? []) {
      const creator = c.creators;
      if (!creator) continue;
      const li = document.createElement('li');
      li.textContent = `${creator.name}${c.role ? ` — ${c.role}` : ''}`;
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'danger';
      rm.textContent = 'Remove';
      rm.addEventListener('click', async () => {
        const del = db.from(join.table).delete()
          .eq(join.fk, row.id).eq('creator_id', creator.id);
        // role is part of the PK — match it exactly so we drop just this credit
        const { error: delError } = await (c.role == null
          ? del.is('role', null) : del.eq('role', c.role));
        if (delError) { alert(delError.message); return; }
        renderCreditSections(def, row);
      });
      li.append(rm);
      list.append(li);
    }
    section.append(list);

    // creator picker (searchable datalist over all creators)
    const { data: creators } = await db.from('creators')
      .select('id, name, slug').order('name');
    const labelFor = (r) => `${r.name} · ${r.slug}`;
    const byLabel = new Map((creators ?? []).map((r) => [labelFor(r), r.id]));

    const listId = `dl-credit-${join.table}`;
    const datalist = document.createElement('datalist');
    datalist.id = listId;
    datalist.replaceChildren(...(creators ?? []).map((r) => {
      const o = document.createElement('option');
      o.value = labelFor(r);
      return o;
    }));

    const input = document.createElement('input');
    input.setAttribute('list', listId);
    input.placeholder = 'Creator — type to search…';

    // role: suggested vocab via datalist, but free text is allowed (schema is text)
    const roleListId = `dl-credit-role-${join.table}`;
    const roleList = document.createElement('datalist');
    roleList.id = roleListId;
    roleList.replaceChildren(...(join.roles ?? []).map((r) => {
      const o = document.createElement('option');
      o.value = r;
      return o;
    }));
    const roleInput = document.createElement('input');
    roleInput.setAttribute('list', roleListId);
    roleInput.placeholder = 'Role (e.g. writer)';

    const add = document.createElement('button');
    add.type = 'button';
    add.textContent = 'Add';
    add.addEventListener('click', async () => {
      const creatorId = byLabel.get(input.value);
      const role = roleInput.value.trim();
      if (!creatorId) { input.classList.add('invalid'); return; }
      if (!role) { roleInput.classList.add('invalid'); return; }
      const dup = (credits ?? []).some((c) => c.creator_id === creatorId && (c.role ?? '') === role);
      if (dup) { roleInput.classList.add('invalid'); return; }
      const { error: insError } = await db.from(join.table).insert({
        [join.fk]: row.id, creator_id: creatorId, role,
      });
      if (insError) { alert(insError.message); return; }
      renderCreditSections(def, row);
    });

    const adder = document.createElement('div');
    adder.className = 'link-adder';
    adder.append(input, roleInput, add, datalist, roleList);
    section.append(adder);
    box.append(section);
  }
}

// ---- curated related items ("Related" cross-type see-also) ---------------
// One polymorphic table (related_items) links this record to any other record.
// Unlike renderLinkSections (single fixed target table), the target TYPE is
// chosen first (a <select>), then a searchable picker of that type's rows. The
// id columns carry no FK, so we resolve each existing link's label by querying
// its type's table — grouped so it's one query per distinct type, not per row.
async function renderRelatedSection(def, row) {
  const box = $('drawer-related');
  box.replaceChildren();
  if (!def.relatedType) return;

  const section = document.createElement('div');
  const h = document.createElement('h3');
  h.textContent = 'Related (curated “see also”)';
  section.append(h);

  if (!row) {
    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Save this record first, then add related items.';
    section.append(hint);
    box.append(section);
    return;
  }

  const { data: links, error } = await db.from('related_items')
    .select('target_type, target_id, note, sort_order')
    .eq('source_type', def.relatedType).eq('source_id', row.id)
    .order('sort_order');

  if (error) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = error.message;
    section.append(p);
    box.append(section);
    return;
  }

  // Resolve labels: one query per distinct target type, then look each up.
  const labels = new Map();  // `${type}:${id}` -> "Name · slug"
  const idsByType = new Map();
  for (const l of links ?? []) {
    if (!idsByType.has(l.target_type)) idsByType.set(l.target_type, []);
    idsByType.get(l.target_type).push(l.target_id);
  }
  for (const [type, ids] of idsByType) {
    const t = RELATED_BY_SLUG.get(type);
    if (!t) continue;
    const { data: rows } = await db.from(t.table)
      .select(`id, ${t.titleCol}, slug`).in('id', ids);
    for (const r of rows ?? []) labels.set(`${type}:${r.id}`, `${r[t.titleCol]} · ${r.slug}`);
  }

  const list = document.createElement('ul');
  list.className = 'link-list';
  for (const l of links ?? []) {
    const t = RELATED_BY_SLUG.get(l.target_type);
    const label = labels.get(`${l.target_type}:${l.target_id}`) ?? `(missing ${l.target_type})`;
    const li = document.createElement('li');
    li.textContent = `${t ? t.label : l.target_type}: ${label}${l.note ? ` — ${l.note}` : ''}`;
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'danger';
    rm.textContent = 'Remove';
    rm.addEventListener('click', async () => {
      const { error: delError } = await db.from('related_items').delete()
        .eq('source_type', def.relatedType).eq('source_id', row.id)
        .eq('target_type', l.target_type).eq('target_id', l.target_id);
      if (delError) { alert(delError.message); return; }
      renderRelatedSection(def, row);
    });
    li.append(rm);
    list.append(li);
  }
  section.append(list);

  // adder: type <select> → searchable datalist of that type's rows → note.
  const typeSel = document.createElement('select');
  typeSel.replaceChildren(...RELATED_TYPES.map((t) => {
    const o = document.createElement('option');
    o.value = t.slug; o.textContent = t.label;
    return o;
  }));

  const listId = 'dl-related-target';
  const datalist = document.createElement('datalist');
  datalist.id = listId;

  const input = document.createElement('input');
  input.setAttribute('list', listId);
  input.placeholder = 'Type to search…';

  const noteInput = document.createElement('input');
  noteInput.placeholder = 'Note (optional)';

  const taken = new Set((links ?? []).map((l) => `${l.target_type}:${l.target_id}`));
  let byLabel = new Map();

  // (re)load the datalist for the selected target type, excluding self + linked
  const loadOptions = async () => {
    const t = RELATED_BY_SLUG.get(typeSel.value);
    input.value = '';
    const { data: rows } = await db.from(t.table)
      .select(`id, ${t.titleCol}, slug`).order(t.titleCol);
    const labelFor = (r) => `${r[t.titleCol]} · ${r.slug}`;
    const available = (rows ?? []).filter((r) =>
      !(t.slug === def.relatedType && r.id === row.id) && !taken.has(`${t.slug}:${r.id}`));
    byLabel = new Map(available.map((r) => [labelFor(r), r.id]));
    datalist.replaceChildren(...available.map((r) => {
      const o = document.createElement('option');
      o.value = labelFor(r);
      return o;
    }));
  };
  typeSel.addEventListener('change', loadOptions);
  await loadOptions();

  const add = document.createElement('button');
  add.type = 'button';
  add.textContent = 'Add';
  add.addEventListener('click', async () => {
    const targetId = byLabel.get(input.value);
    if (!targetId) { input.classList.add('invalid'); return; }
    const { error: insError } = await db.from('related_items').insert({
      source_type: def.relatedType, source_id: row.id,
      target_type: typeSel.value, target_id: targetId,
      note: noteInput.value.trim() || null,
      sort_order: links?.length ?? 0,
    });
    if (insError) { alert(insError.message); return; }
    renderRelatedSection(def, row);
  });

  const adder = document.createElement('div');
  adder.className = 'link-adder';
  adder.append(typeSel, input, noteInput, add, datalist);
  section.append(adder);
  box.append(section);
}

// ---- attached media (inside character/release drawers) ------------------
const mediaLabel = (m) => `${m.caption || m.alt_text || 'untitled'} · ${m.credit} [${m.id.slice(0, 8)}]`;

// Drag-to-reorder for the attached-media grid, on Pointer Events so it works
// with both mouse and touch. The whole card is the drag surface (except its
// action buttons / role select). On touch we only start from the grip handle,
// so a finger can still scroll the page past the grid. Dragging rearranges the
// cards live; on release we write each card's new index back to join.sort_order
// (the column the front end reads).
function enableMediaReorder(grid, def, row, join, originalOrder) {
  let dragging = null;

  const onMove = (e) => {
    if (!dragging) return;
    e.preventDefault();
    // pointer capture keeps events flowing to the dragged card; hit-test the
    // point ourselves to find which card we're over (works the same for touch).
    const over = document.elementFromPoint(e.clientX, e.clientY)?.closest('.media-card');
    if (!over || over === dragging || over.parentElement !== grid) return;
    const r = over.getBoundingClientRect();
    // grid wraps into rows, so weigh vertical position first, then horizontal
    const before = e.clientY < r.top + r.height / 2 ||
      (e.clientY < r.bottom && e.clientX < r.left + r.width / 2);
    grid.insertBefore(dragging, before ? over : over.nextSibling);
  };

  grid.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;                        // primary press / touch only
    const card = e.target.closest('.media-card');
    if (!card) return;
    // let the action buttons and role <select> receive their own clicks
    if (e.target.closest('.media-card__actions, .media-card__role')) return;
    // on touch, only the grip handle drags — everywhere else stays a scroll
    if (e.pointerType === 'touch' && !e.target.closest('.media-card__handle')) return;
    e.preventDefault();
    dragging = card;
    card.classList.add('is-dragging');
    card.setPointerCapture(e.pointerId);

    const end = async () => {
      card.removeEventListener('pointermove', onMove);
      if (!dragging) return;
      dragging.classList.remove('is-dragging');
      dragging = null;
      await persistMediaOrder(grid, def, row, join, originalOrder);
    };
    card.addEventListener('pointermove', onMove);
    card.addEventListener('pointerup', end, { once: true });
    card.addEventListener('pointercancel', end, { once: true });
  });
}

async function persistMediaOrder(grid, def, row, join, originalOrder) {
  const ids = [...grid.querySelectorAll('.media-card')].map((c) => c.dataset.mediaId);
  const unchanged = ids.length === originalOrder.length &&
    ids.every((id, i) => id === originalOrder[i]);
  if (unchanged) return;
  // composite PK (fk, media_id) — update only the rows whose index moved
  const writes = ids
    .map((mediaId, i) => ({ mediaId, i }))
    .filter(({ mediaId, i }) => originalOrder[i] !== mediaId)
    .map(({ mediaId, i }) => db.from(join.table).update({ sort_order: i })
      .eq(join.fk, row.id).eq('media_id', mediaId));
  const failed = (await Promise.all(writes)).find((r) => r.error);
  if (failed) alert('Reorder failed: ' + failed.error.message);
  renderMediaSection(def, row);
}

async function renderMediaSection(def, row) {
  const box = $('drawer-media');
  box.replaceChildren();
  if (!def.mediaJoin || !row) return;

  const join = def.mediaJoin;
  const h = document.createElement('h3');
  h.textContent = 'Attached media';
  box.append(h);

  const roleCols = join.roles ? ', role' : '';
  const { data: links, error } = await db.from(join.table)
    .select(`media_id, is_primary${roleCols}, media_assets(*)`)
    .eq(join.fk, row.id)
    .order('sort_order');
  if (error) { box.append(error.message); return; }

  // current attachments — drag to reorder (persists to join.sort_order below)
  const grid = document.createElement('div');
  grid.className = 'media-grid';
  const reorderable = links.length > 1;
  for (const link of links) {
    const m = link.media_assets;
    const card = document.createElement('div');
    card.className = 'media-card';
    card.dataset.mediaId = m.id;

    // drag handle — only the handle starts a drag, so the buttons/role select
    // inside the card stay tappable. Hidden when there's nothing to reorder.
    if (reorderable) {
      const handle = document.createElement('div');
      handle.className = 'media-card__handle';
      handle.textContent = '⠿';
      handle.title = 'Drag to reorder';
      card.append(handle);
    }

    if (m.storage_path) {
      const img = document.createElement('img');
      img.src = publicUrl(m.storage_path);
      img.alt = m.alt_text ?? '';
      img.draggable = false;   // else the browser's native image-drag fights our reorder
      card.append(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'media-card__embed';
      ph.textContent = '▶';
      card.append(ph);
    }

    const cap = document.createElement('p');
    cap.textContent = m.caption || m.alt_text || '';
    card.append(cap);

    const cred = document.createElement('p');
    cred.className = 'media-card__credit';
    cred.textContent = m.credit;
    card.append(cred);

    // role selector (character media only) — which slot this asset fills
    if (join.roles) {
      const roleSel = document.createElement('select');
      roleSel.className = 'media-card__role';
      roleSel.replaceChildren(...join.roles.map((r) => {
        const o = document.createElement('option');
        o.value = r;
        o.textContent = r.replace(/_/g, ' ');
        return o;
      }));
      roleSel.value = link.role ?? 'artwork';
      roleSel.addEventListener('change', async () => {
        await db.from(join.table).update({ role: roleSel.value })
          .eq(join.fk, row.id).eq('media_id', m.id);
        renderMediaSection(def, row);
      });
      card.append(roleSel);
    }

    const actions = document.createElement('div');
    actions.className = 'media-card__actions';

    const primaryBtn = document.createElement('button');
    primaryBtn.type = 'button';
    primaryBtn.textContent = link.is_primary ? '★ primary' : '☆ make primary';
    primaryBtn.disabled = link.is_primary;
    primaryBtn.addEventListener('click', async () => {
      await db.from(join.table).update({ is_primary: false }).eq(join.fk, row.id);
      await db.from(join.table).update({ is_primary: true })
        .eq(join.fk, row.id).eq('media_id', m.id);
      renderMediaSection(def, row);
    });

    const detachBtn = document.createElement('button');
    detachBtn.type = 'button';
    detachBtn.textContent = 'Detach';
    detachBtn.addEventListener('click', async () => {
      await db.from(join.table).delete().eq(join.fk, row.id).eq('media_id', m.id);
      renderMediaSection(def, row);
    });

    actions.append(primaryBtn, detachBtn);
    card.append(actions);
    grid.append(card);
  }
  if (reorderable) enableMediaReorder(grid, def, row, join, links.map((l) => l.media_id));
  box.append(grid);

  // attach picker
  const { data: allMedia } = await db.from('media_assets')
    .select('id, caption, alt_text, credit')
    .order('created_at', { ascending: false });
  const attached = new Set(links.map((l) => l.media_id));
  const candidates = (allMedia ?? []).filter((m) => !attached.has(m.id));

  const pickerWrap = document.createElement('div');
  pickerWrap.className = 'media-attach';

  const dl = document.createElement('datalist');
  dl.id = 'dl-attach-media';
  dl.replaceChildren(...candidates.map((m) => {
    const o = document.createElement('option');
    o.value = mediaLabel(m);
    return o;
  }));

  const input = document.createElement('input');
  input.setAttribute('list', 'dl-attach-media');
  input.placeholder = candidates.length ? 'Attach media — type to search…' : 'No unattached media yet — upload in the Media tab';
  input.disabled = !candidates.length;

  const byLabel = new Map(candidates.map((m) => [mediaLabel(m), m.id]));

  let roleSelect = null;
  if (join.roles) {
    roleSelect = document.createElement('select');
    roleSelect.className = 'media-attach__role';
    roleSelect.replaceChildren(...join.roles.map((r) => {
      const o = document.createElement('option');
      o.value = r;
      o.textContent = r.replace(/_/g, ' ');
      return o;
    }));
  }

  const attachBtn = document.createElement('button');
  attachBtn.type = 'button';
  attachBtn.textContent = 'Attach';
  attachBtn.addEventListener('click', async () => {
    const mediaId = byLabel.get(input.value);
    if (!mediaId) return;
    const payload = {
      media_id: mediaId,
      [join.fk]: row.id,
      is_primary: links.length === 0,
    };
    if (roleSelect) payload.role = roleSelect.value;
    const { error: attachError } = await db.from(join.table).insert(payload);
    if (attachError) { alert(attachError.message); return; }
    renderMediaSection(def, row);
  });

  pickerWrap.append(input, ...(roleSelect ? [roleSelect] : []), attachBtn, dl);
  box.append(pickerWrap);

  // inline upload — create a new media_assets row and attach it in one step,
  // so you never have to leave the record you're editing to visit the Media
  // tab. Credit/rights/alt are captured here too (see CLAUDE.md non-negotiable
  // #1) — the same required fields the Media editor and bulk upload enforce.
  box.append(renderInlineUpload(def, row, join, links.length === 0));
}

// Shared credit/rights/type/source carried between consecutive inline uploads,
// so attaching several assets from the same photographer doesn't re-type them.
// Reset when a fresh record opens (see openDrawer).
let stickyMedia = {};

// Build the collapsible "Upload new media" block for renderMediaSection.
// isFirst → the created asset becomes this record's primary attachment.
function renderInlineUpload(def, row, join, isFirst) {
  const details = document.createElement('details');
  details.className = 'media-upload';
  // stay expanded after an upload so the next file is one click away
  if (stickyMedia.credit) details.open = true;
  const summary = document.createElement('summary');
  summary.textContent = 'Upload new media';
  details.append(summary);

  const fields = document.createElement('div');
  fields.className = 'media-upload__fields';

  // labeled control helper — mirrors the plain <label>{caption}{control} the
  // rest of the drawer uses.
  const field = (caption, control, span) => {
    const l = document.createElement('label');
    if (span) l.className = 'span-2';
    l.append(caption + ' ', control);
    return l;
  };
  const enumSelect = (values, initial) => {
    const s = document.createElement('select');
    fillEnumSelect(s, values, initial);
    return s;
  };
  const textInput = (placeholder) => {
    const i = document.createElement('input');
    i.type = 'text';
    if (placeholder) i.placeholder = placeholder;
    return i;
  };

  const typeSel   = document.createElement('select');
  const rightsSel = document.createElement('select');
  fillLookupSelect(typeSel, 'media_types', stickyMedia.type ?? 'photo');
  fillLookupSelect(rightsSel, 'rights_statuses', stickyMedia.rights);
  const creditIn  = textInput('e.g. Photo © Jane Collector, used with permission');
  const altIn     = textInput('Describe the image for a11y + SEO');
  const captionIn = textInput('Optional');
  const sourceIn  = textInput('Optional');
  // carry the last-used shared attribution into this upload
  creditIn.value = stickyMedia.credit ?? '';
  sourceIn.value = stickyMedia.source_url ?? '';
  const embedIn   = textInput('For video instead of a file');
  const fileIn    = document.createElement('input');
  fileIn.type = 'file';
  fileIn.accept = 'image/*,.pdf';

  let roleSel = null;
  if (join.roles) roleSel = enumSelect(join.roles);

  fields.append(
    field('Type', typeSel),
    field('Rights *', rightsSel),
    field('Credit *', creditIn, true),
    field('Alt text *', altIn, true),
    field('Caption', captionIn),
    field('Source URL', sourceIn),
    field('Embed URL', embedIn, true),
    field('File', fileIn, true),
    ...(roleSel ? [field('Role', roleSel)] : []),
  );
  details.append(fields);

  const actions = document.createElement('div');
  actions.className = 'media-upload__actions';
  const uploadBtn = document.createElement('button');
  uploadBtn.type = 'button';
  uploadBtn.textContent = 'Upload & attach';
  const status = document.createElement('span');
  status.className = 'drawer__status';
  actions.append(uploadBtn, status);
  details.append(actions);

  uploadBtn.addEventListener('click', async () => {
    const file = fileIn.files[0];
    const embed = embedIn.value.trim();
    const credit = creditIn.value.trim();
    const alt = altIn.value.trim();
    if (!file && !embed) { status.textContent = 'Pick a file or provide an embed URL.'; return; }
    if (!credit) { status.textContent = 'Credit is required.'; return; }
    if (!alt) { status.textContent = 'Alt text is required.'; return; }

    uploadBtn.disabled = true;
    status.textContent = 'Uploading…';
    try {
      const asset = {
        type: typeSel.value,
        rights: rightsSel.value,
        credit,
        alt_text: alt,
        caption: captionIn.value.trim() || null,
        source_url: sourceIn.value.trim() || null,
        embed_url: embed || null,
      };
      if (file) {
        const { path, width, height } = await uploadFile(file);
        asset.storage_path = path;
        asset.width = width;
        asset.height = height;
      }
      const { data: created, error: assetError } =
        await db.from('media_assets').insert(asset).select('id').single();
      if (assetError) throw new Error(assetError.message);

      const link = { media_id: created.id, [join.fk]: row.id, is_primary: isFirst };
      if (roleSel) link.role = roleSel.value;
      const { error: linkError } = await db.from(join.table).insert(link);
      if (linkError) throw new Error(linkError.message);

      // remember shared attribution for the next upload on this record
      stickyMedia = {
        type: typeSel.value,
        rights: rightsSel.value,
        credit,
        source_url: sourceIn.value.trim() || null,
      };
      renderMediaSection(def, row);
    } catch (err) {
      uploadBtn.disabled = false;
      status.textContent = err.message;
    }
  });

  return details;
}

// ---- form ---------------------------------------------------------------
const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Admin entities whose records have a public page → the built page's directory.
// Drives the editor's "View page" link (href ../<dir>/<slug>.html — relative so
// it works wherever the site is mounted). Entities absent here have no page.
const VIEW_DIRS = {
  characters:   'dossier',
  releases:     'release',
  publications: 'comics',
  screen_media: 'media',
  creators:     'creators',
  merchandise:  'merchandise',
};

async function openDrawer(row) {
  const def = ENTITIES[state.entity];
  state.editing = row;
  stickyMedia = {}; // shared media attribution is scoped to one open record
  const title = row ? (row[def.titleCol ?? 'name'] || '(untitled)') : `New ${def.label.replace(/s$/, '').toLowerCase()}`;
  $('drawer-entity').textContent = def.label;
  $('drawer-title').textContent = row ? `Edit: ${title}` : title;
  $('delete').hidden = !row;
  $('form-status').textContent = '';

  // "View page" link — only for a saved record of an entity that has a public
  // page (a slug is required to build the URL).
  const viewLink = $('drawer-view');
  const viewDir = VIEW_DIRS[state.entity];
  if (row && viewDir && row.slug) {
    viewLink.href = `../${viewDir}/${row.slug}.html`;
    viewLink.hidden = false;
  } else {
    viewLink.hidden = true;
    viewLink.removeAttribute('href');
  }

  const fields = await Promise.all(def.fields.map(async (f) => {
    const value = row ? row[f.col] : (f.initial ?? null);

    // Rich fields must NOT sit inside a <label>: a label forwards clicks to its
    // first labelable descendant — here the Bold button — so clicking anywhere
    // in the editor would toggle bold. Use a plain container with a caption.
    if (f.kind === 'rich') {
      const wrap = document.createElement('div');
      wrap.className = 'field-rich span-2';
      const cap = document.createElement('span');
      cap.className = 'field-rich__cap';
      cap.textContent = f.label;
      wrap.append(cap, buildRichField(f, value));
      return wrap;
    }

    const label = document.createElement('label');
    label.textContent = f.label;

    let input;
    if (f.kind === 'fk') {
      input = await buildFkField(f, value);
    } else if (f.kind === 'lookup') {
      input = await buildLookupField(f, value);
    } else if (f.kind === 'enum') {
      input = document.createElement('select');
      input.name = f.col;
      if (f.required) input.required = true;
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '—';
      input.replaceChildren(blank, ...f.values.map((v) => {
        const o = document.createElement('option');
        o.value = v;
        o.textContent = v.replace(/_/g, ' ');
        return o;
      }));
      input.value = value ?? '';
    } else if (f.kind === 'textarea') {
      input = document.createElement('textarea');
      input.name = f.col;
      input.value = value ?? '';
    } else {
      input = document.createElement('input');
      input.name = f.col;
      input.type = f.kind === 'number' ? 'number' : 'text';
      if (f.step) input.step = f.step;
      input.value = Array.isArray(value) ? value.join(', ') : (value ?? '');
      if (f.required) input.required = true;
    }

    if (f.kind === 'slug') {
      input.addEventListener('focus', () => {
        const name = document.querySelector('#record-form [name="name"]');
        if (!input.value && name?.value) input.value = slugify(name.value);
      });
    }

    label.append(input);
    if (f.kind === 'textarea') label.classList.add('span-2');
    return label;
  }));

  // upload entities get a file input on new records, a preview when editing
  if (def.upload) {
    const label = document.createElement('label');
    label.classList.add('span-2');
    if (row) {
      if (row.storage_path) {
        label.textContent = 'File';
        const img = document.createElement('img');
        img.className = 'drawer__preview';
        img.src = publicUrl(row.storage_path);
        img.alt = row.alt_text ?? '';
        label.append(img);
      }
    } else {
      label.textContent = 'File (or give an embed URL below)';
      const file = document.createElement('input');
      file.type = 'file';
      file.name = '_file';
      file.accept = 'image/*,.pdf';
      label.append(file);
    }
    fields.unshift(label);
  }

  $('drawer-fields').replaceChildren(...fields);
  // full-page editor: hide the list while editing (the header menu stays,
  // so you can jump to another entity — it closes the drawer on the way out)
  $('list-panel').hidden = true;
  $('drawer').hidden = false;
  window.scrollTo(0, 0);
  // reflect the open record in the URL so a refresh reopens it
  setHash(`${state.entity}/${row ? row.id : 'new'}`);
  renderLinkSections(def, row);
  renderCreditSections(def, row);
  renderRelatedSection(def, row);
  renderMediaSection(def, row);
}

function closeDrawer() {
  if (!$('bulk-panel').hidden) closeBulk();
  const wasOpen = !$('drawer').hidden;
  $('drawer').hidden = true;
  $('drawer-links').replaceChildren();
  $('drawer-credits').replaceChildren();
  $('drawer-related').replaceChildren();
  $('drawer-media').replaceChildren();
  $('list-panel').hidden = false;
  state.editing = null;
  // drop the record from the URL, back to the entity's list
  if (wasOpen) setHash(state.entity);
}
$('drawer-close').addEventListener('click', closeDrawer);

function collectPayload() {
  const def = ENTITIES[state.entity];
  const form = $('record-form');
  const payload = {};
  for (const f of def.fields) {
    if (f.kind === 'rich') {
      const ed = form.querySelector(`.rte[data-col="${f.col}"]`);
      const html = ed ? sanitizeHtml(ed.innerHTML) : '';
      payload[f.col] = html || null;
      continue;
    }
    const el = form.querySelector(`[name="${f.col}"]`);
    const raw = el.value.trim();
    if (f.kind === 'array') {
      payload[f.col] = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else if (f.kind === 'number') {
      payload[f.col] = raw === '' ? null : Number(raw);
    } else {
      payload[f.col] = raw === '' ? null : raw;
    }
  }
  return payload;
}

async function uploadFile(file) {
  const path = `uploads/${Date.now()}-${slugify(file.name.replace(/\.[^.]+$/, ''))}${file.name.match(/\.[^.]+$/)?.[0] ?? ''}`;
  const { error } = await db.storage.from('media').upload(path, file);
  if (error) throw new Error(`Upload failed: ${error.message}`);

  let width = null;
  let height = null;
  if (file.type.startsWith('image/')) {
    try {
      const bmp = await createImageBitmap(file);
      width = bmp.width;
      height = bmp.height;
      bmp.close();
    } catch { /* non-decodable image; dimensions stay null */ }
  }
  return { path, width, height };
}

$('record-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const def = ENTITIES[state.entity];
  const payload = collectPayload();
  $('form-status').textContent = 'Saving…';

  try {
    if (def.upload && !state.editing) {
      const file = $('record-form').querySelector('[name="_file"]')?.files[0];
      if (file) {
        const { path, width, height } = await uploadFile(file);
        payload.storage_path = path;
        payload.width = width;
        payload.height = height;
      } else if (!payload.embed_url) {
        throw new Error('Pick a file or provide an embed URL.');
      }
    }

    const wasNew = !state.editing;
    const query = state.editing
      ? db.from(def.table).update(payload).eq('id', state.editing.id)
      : db.from(def.table).insert(payload);
    // return the saved row so we can stay on the editor in edit mode
    const { data, error } = await query.select().single();
    if (error) throw new Error(error.message);

    state.editing = data;
    $('form-status').textContent = 'Saved.';
    // refresh the (hidden) list so it's current when the user goes Back
    loadList();
    // a brand-new record becomes an edit: re-render so the relationship/media
    // pickers unlock, the Delete button appears, and the title flips to "Edit"
    if (wasNew) {
      await openDrawer(data);
      $('form-status').textContent = 'Saved.';
    }
  } catch (err) {
    $('form-status').textContent = err.message;
  }
});

$('delete').addEventListener('click', async () => {
  const def = ENTITIES[state.entity];
  const row = state.editing;
  if (!row) return;
  const title = row[def.titleCol ?? 'name'] || '(untitled)';
  if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
  const { error } = await db.from(def.table).delete().eq('id', row.id);
  if (error) { $('form-status').textContent = error.message; return; }
  if (def.upload && row.storage_path) {
    await db.storage.from('media').remove([row.storage_path]);
  }
  closeDrawer();
  loadList();
});

// ---- bulk media upload --------------------------------------------------
// Pick many files at once; shared type/credit/rights/source apply to all,
// alt text is captured per file (non-negotiable #1). Each file becomes its
// own media_assets row. Thumbnails preview locally before upload.
const bulkFiles = []; // { file, thumbUrl, done }

// fills a <select> from a fixed string array — still used for the media-attach
// role pickers (roles remain hardcoded per join table, not a lookup).
function fillEnumSelect(sel, values, initial) {
  sel.replaceChildren(...values.map((v) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = v.replace(/_/g, ' ');
    return o;
  }));
  if (initial) sel.value = initial;
}

// fills a pre-existing <select> from a lookup table (slug value, name label) —
// the bulk + inline media-upload shortcuts, whose Type/Rights are now editable
// vocab tables. Async, fire-and-forget: the options land a moment after render.
async function fillLookupSelect(sel, table, initial) {
  const { data, error } = await db.from(table).select('slug, name').order('sort_order');
  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = error ? error.message : '—';
  sel.replaceChildren(blank, ...(data ?? []).map((r) => {
    const o = document.createElement('option');
    o.value = r.slug;
    o.textContent = r.name ?? r.slug;
    return o;
  }));
  if (initial) sel.value = initial;
}

function openBulk() {
  const def = ENTITIES[state.entity];
  const typeField = def.fields.find((f) => f.col === 'type');
  const rightsField = def.fields.find((f) => f.col === 'rights');
  fillLookupSelect($('bulk-type'), typeField?.table ?? 'media_types', typeField?.initial);
  fillLookupSelect($('bulk-rights'), rightsField?.table ?? 'rights_statuses');
  $('bulk-credit').value = '';
  $('bulk-source').value = '';
  $('bulk-files').value = '';
  $('bulk-status').textContent = '';
  clearBulkFiles();
  $('list-panel').hidden = true;
  $('bulk-panel').hidden = false;
  window.scrollTo(0, 0);
}

function closeBulk() {
  $('bulk-panel').hidden = true;
  clearBulkFiles();
  $('list-panel').hidden = false;
}

function clearBulkFiles() {
  bulkFiles.forEach((b) => URL.revokeObjectURL(b.thumbUrl));
  bulkFiles.length = 0;
  $('bulk-grid').replaceChildren();
}

function renderBulkGrid() {
  $('bulk-grid').replaceChildren(...bulkFiles.map((b, i) => {
    const card = document.createElement('div');
    card.className = 'bulk__card';
    card.dataset.i = i;

    const img = document.createElement('img');
    img.src = b.thumbUrl;
    img.alt = '';
    if (!b.file.type.startsWith('image/')) img.style.visibility = 'hidden';

    const name = document.createElement('div');
    name.className = 'bulk__name';
    name.textContent = b.file.name;

    const alt = document.createElement('input');
    alt.type = 'text';
    alt.placeholder = 'Alt text * (required)';
    alt.className = 'bulk-alt';

    const cap = document.createElement('input');
    cap.type = 'text';
    cap.placeholder = 'Caption (optional)';
    cap.className = 'bulk-caption';

    card.append(img, name, alt, cap);
    return card;
  }));
}

$('bulk-upload').addEventListener('click', openBulk);
$('bulk-close').addEventListener('click', closeBulk);

$('bulk-files').addEventListener('change', (e) => {
  clearBulkFiles();
  for (const file of e.target.files) {
    bulkFiles.push({ file, thumbUrl: URL.createObjectURL(file), done: false });
  }
  renderBulkGrid();
});

$('bulk-submit').addEventListener('click', async () => {
  const def = ENTITIES[state.entity];
  if (!bulkFiles.length) { $('bulk-status').textContent = 'Choose files first.'; return; }

  const credit = $('bulk-credit').value.trim();
  if (!credit) { $('bulk-status').textContent = 'Credit is required.'; return; }
  const shared = {
    type: $('bulk-type').value,
    rights: $('bulk-rights').value,
    credit,
    source_url: $('bulk-source').value.trim() || null,
  };

  const cards = [...$('bulk-grid').children];
  // validate every alt-text before uploading anything
  for (let i = 0; i < bulkFiles.length; i++) {
    if (bulkFiles[i].done) continue;
    const alt = cards[i].querySelector('.bulk-alt').value.trim();
    if (!alt) {
      cards[i].classList.add('bulk__card--error');
      $('bulk-status').textContent = 'Every file needs alt text.';
      return;
    }
    cards[i].classList.remove('bulk__card--error');
  }

  $('bulk-submit').disabled = true;
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < bulkFiles.length; i++) {
    const b = bulkFiles[i];
    if (b.done) continue;
    const card = cards[i];
    $('bulk-status').textContent = `Uploading ${ok + failed + 1} of ${bulkFiles.length}…`;
    try {
      const { path, width, height } = await uploadFile(b.file);
      const row = {
        ...shared,
        alt_text: card.querySelector('.bulk-alt').value.trim(),
        caption: card.querySelector('.bulk-caption').value.trim() || null,
        storage_path: path,
        width,
        height,
      };
      const { error } = await db.from(def.table).insert(row);
      if (error) throw new Error(error.message);
      b.done = true;
      card.classList.add('bulk__card--done');
      ok++;
    } catch (err) {
      card.classList.add('bulk__card--error');
      card.title = err.message;
      failed++;
    }
  }

  $('bulk-submit').disabled = false;
  $('bulk-status').textContent = failed
    ? `Uploaded ${ok}, ${failed} failed (retry the highlighted ones).`
    : `Uploaded ${ok} ✓`;
  loadList();
});

// ---- boot ---------------------------------------------------------------
renderMenu();
refreshAuth();
