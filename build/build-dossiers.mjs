#!/usr/bin/env node
// Pre-renders character dossier pages AND release detail pages from Supabase
// into static HTML. Zero dependencies — Node 18+ fetch against the PostgREST
// API with the anon key (public reads only). Run after content changes:
//
//   node build/build-dossiers.mjs      (or: npm run build)
//
// Output: dossier/<slug>.html and release/<slug>.html — content and meta
// tags land in the HTML (CLAUDE.md non-negotiable #4: search is the
// product). Paths are root-absolute, so serve from the site root (cPanel
// docroot or build/serve.mjs).

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname, join, relative, sep as pathSep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPABASE_URL, SUPABASE_KEY } from '../js/config.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Stand-in until real photography is attached (see CLAUDE.md conventions).
const PLACEHOLDER = '../assets/sp-palceholder.jpg';

const MEDIA_EMBED = 'media_assets(storage_path,embed_url,alt_text,credit)';
// Same, plus poster_path/caption/source_url — used where video posters,
// captions, and attribution links render (the media hub + detail pages).
const MEDIA_EMBED_FULL = 'media_assets(storage_path,embed_url,poster_path,alt_text,caption,credit,source_url)';

async function rest(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

const esc = (s) => String(s ?? '')
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const storageUrl = (path) => path
  ? `${SUPABASE_URL}/storage/v1/object/public/media/${path}`
  : null;

const mediaUrl = (m) => m?.storage_path
  ? storageUrl(m.storage_path)
  : (m?.embed_url ?? null);

// A video poster: explicit poster_path, else a stored image, else null.
const posterUrl = (m) => storageUrl(m?.poster_path) ?? storageUrl(m?.storage_path);

// Normalize a YouTube/Vimeo watch URL into its embeddable form. Anything else
// (already-an-embed, other host) is returned untouched.
const embedSrc = (url) => {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vim = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vim) return `https://player.vimeo.com/video/${vim[1]}`;
  return url;
};

const paras = (text) => (text ?? '')
  .split(/\n\s*\n/).filter((p) => p.trim())
  .map((p) => `<p>${esc(p.trim())}</p>`).join('\n        ');

// Rich text: fields edited with the admin's rich editor store sanitized HTML
// (authenticated authors only write — see RLS). Legacy/plain content has no
// block tags and still flows through paras() so blank-line paragraphs keep
// working. Detection is a cheap tag sniff.
const looksLikeHtml = (s) => /<(p|h[1-6]|ul|ol|li|blockquote|br|hr|strong|em|b|i|u|a|small|table|tr|t[hd])\b/i.test(s ?? '');
const richText = (text) => text ? (looksLikeHtml(text) ? String(text) : paras(text)) : '';

// Plain-text extraction for meta descriptions / teasers (strip any HTML).
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const titleCase = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

// media links → assets, primary first then sort_order (no role filtering)
const sortedMedia = (links) => (links ?? [])
  .slice()
  .sort((a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order))
  .map((l) => l.media_assets)
  .filter(Boolean);

// character media filtered to specific role(s), primary/sort ordered
const pickMedia = (links, roles) => (links ?? [])
  .filter((l) => roles.includes(l.role ?? 'artwork'))
  .sort((a, b) => (b.is_primary - a.is_primary) || (a.sort_order - b.sort_order))
  .map((l) => l.media_assets)
  .filter(Boolean);

// A clickable image that opens the shared lightbox. `gallery` groups images so
// prev/next cycles within one set; `imgClass` keeps existing image styling.
const lbTrigger = (m, gallery, title, imgClass = '', btnClass = '') => {
  const url = mediaUrl(m);
  const alt = m.alt_text ?? title;
  return `<button type="button" class="lb-trigger ${btnClass}" data-gallery="${esc(gallery)}"`
    + ` data-full="${esc(url)}" data-title="${esc(title)}"`
    + ` data-credit="${m.credit ? esc('Photo: ' + m.credit) : ''}"`
    + ` data-caption="${esc(m.caption ?? m.alt_text ?? '')}">`
    + `<img class="${imgClass}" src="${esc(url)}" alt="${esc(alt)}" loading="lazy"></button>`;
};

// consistent global ordering for release prev/next + grouping
const releaseOrder = (a, b) =>
  (a.lines?.sort_order ?? 99) - (b.lines?.sort_order ?? 99) ||
  (a.release_year ?? 9999) - (b.release_year ?? 9999) ||
  a.name.localeCompare(b.name);

// ---- data ---------------------------------------------------------------

async function fetchCharacters() {
  return rest(
    'characters?select=*,character_teams(teams(name)),' +
    `media_characters(role,is_primary,sort_order,${MEDIA_EMBED})&order=name`
  );
}

// Enemies live in a separate, self-referential join table. Fetched on its own
// (and tolerantly) so that if the migration hasn't been applied yet — or the
// query otherwise fails — the whole site still rebuilds without enemies rather
// than failing outright. Returns a Map keyed by character_id.
async function fetchEnemiesByCharacter() {
  const map = new Map();
  let rows;
  try {
    // self-referential join — both FKs point at characters, so PostgREST needs
    // them named explicitly to know which side to walk
    rows = await rest(
      'character_enemies?select=character_id,sort_order,' +
      'enemy:characters!character_enemies_enemy_id_fkey(name,slug)'
    );
  } catch (err) {
    console.warn('Enemies unavailable (is the character_enemies migration applied?) — building without them.');
    return map;
  }
  for (const r of rows) {
    if (!r.enemy) continue;
    const list = map.get(r.character_id) ?? [];
    list.push({ ...r.enemy, sort_order: r.sort_order ?? 0 });
    map.set(r.character_id, list);
  }
  return map;
}

// Variations are a child table of releases, fetched tolerantly (like enemies)
// so a not-yet-applied migration doesn't fail the whole build. Each carries its
// own media. Returns a Map keyed by release_id, each value sorted for display.
async function fetchVariationsByRelease() {
  const map = new Map();
  let rows;
  try {
    rows = await rest(
      'release_variations?select=*,' +
      `media_variations(is_primary,sort_order,${MEDIA_EMBED})&order=sort_order`
    );
  } catch (err) {
    console.warn('Variations unavailable (is the release_variations migration applied?) — building without them.');
    return map;
  }
  for (const v of rows) {
    const list = map.get(v.release_id) ?? [];
    list.push(v);
    map.set(v.release_id, list);
  }
  return map;
}

async function fetchReleases() {
  const list = await rest(
    'releases?select=*,series(name,year,sort_order),lines(name,slug,sort_order),' +
    'characters!releases_character_id_fkey(name,slug),' +
    'release_characters(character_id,characters(name,slug)),' +
    'release_creators(role,creators(name,slug)),' +
    `media_releases(is_primary,sort_order,${MEDIA_EMBED})`
  );
  return list.sort(releaseOrder);
}

// One query for every publication + its character links, grouped in memory —
// replaces N sequential per-character queries.
async function fetchPublicationsByCharacter() {
  const pubs = await rest(
    'publications?select=*,publication_characters(character_id),' +
    `media_publications(is_primary,sort_order,${MEDIA_EMBED})&order=year.asc`
  );
  const map = new Map();
  for (const p of pubs) {
    for (const pc of p.publication_characters ?? []) {
      if (!map.has(pc.character_id)) map.set(pc.character_id, []);
      map.get(pc.character_id).push(p);
    }
  }
  return map;
}

// Screen media — the "Super Powers in the Media" video library. Each row may
// carry a single media asset (the video embed / poster). Tolerant: a not-yet-
// applied table just yields an empty library, and the rest of the site builds.
async function fetchScreenMedia() {
  try {
    return await rest(
      'screen_media?select=*,' + MEDIA_EMBED_FULL + '&order=year.asc'
    );
  } catch {
    console.warn('Screen media unavailable (is the schema applied?) — building without the media hub.');
    return [];
  }
}

// Licensed merchandise (non-figure goods) + attached photos + featured chars.
// Tolerant for the same reason as screen media.
async function fetchMerchandise() {
  try {
    return await rest(
      'merchandise?select=*,' +
      `media_merchandise(is_primary,sort_order,${MEDIA_EMBED}),` +
      'merchandise_characters(characters(name,slug))' +
      '&order=category.asc,name.asc'
    );
  } catch {
    console.warn('Merchandise unavailable (is the media_merchandise migration applied?) — building without the merchandise section.');
    return [];
  }
}

// Creators — public bio pages. Each carries an optional photo (media_creators)
// and its "credited work" is derived from the reverse join tables (toys via
// release_creators, comics via publication_creators). Tolerant: if the
// overview/photo columns aren't migrated yet, build without creator pages.
async function fetchCreators() {
  try {
    return await rest(
      'creators?select=*,' +
      `media_creators(is_primary,sort_order,${MEDIA_EMBED}),` +
      'release_creators(role,releases(name,slug,type,release_year)),' +
      'publication_creators(role,publications(title,slug,kind,year))' +
      '&order=name.asc'
    );
  } catch {
    console.warn('Creators unavailable (is the creator_pages migration applied?) — building without creator pages.');
    return [];
  }
}

// Write only when content actually changed, so an unchanged Batman page isn't
// rewritten (and Dropbox doesn't re-sync it) just because Superman changed.
// `--all` forces every file to be rewritten (the admin "Rebuild all" switch).
const FORCE_ALL = process.argv.includes('--all');

// Rewrite root-absolute internal links (href/src="/…") to relative, based on
// how deep the page sits, so the site works mounted at ANY path — a GitHub
// Pages project subpath (/Super-Powers-Project/), a cPanel subfolder, or the
// domain root. External URLs (https://…), anchors (#…), and protocol-relative
// (//…) links are left untouched.
function relativize(html, depth) {
  const prefix = '../'.repeat(depth);          // '' at the root
  return html.replace(/(href|src)="\/(?!\/)/g, `$1="${prefix}`);
}

async function writeIfChanged(path, content) {
  const depth = relative(root, path).split(pathSep).length - 1;
  content = relativize(content, depth);
  if (!FORCE_ALL) {
    try {
      if (await readFile(path, 'utf8') === content) return false;
    } catch { /* missing file → write it */ }
  }
  await writeFile(path, content);
  return true;
}

function releasesForCharacter(allReleases, c) {
  return allReleases.filter((r) =>
    r.character_id === c.id ||
    (r.release_characters ?? []).some((rc) => rc.character_id === c.id));
}

// ---- shared chrome ------------------------------------------------------

function backAndCrumb(crumb) {
  const items = crumb.map((c, i) => {
    const sep = i < crumb.length - 1 ? '\n        <span aria-hidden="true">►</span>' : '';
    const node = c.href
      ? `<a href="${esc(c.href)}">${esc(c.label)}</a>`
      : `<span aria-current="page">${esc(c.label)}</span>`;
    return `        ${node}${sep}`;
  }).join('\n');
  return `      <a class="back-link" href="/index.html" onclick="if(history.length>1){history.back();return false}">◄ Back</a>
      <nav class="breadcrumb" aria-label="Breadcrumb">
${items}
      </nav>`;
}

function pageShell({ title, description, ogImage, body }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)} · Archive84</title>
  <meta name="description" content="${esc(description)}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${esc(title)} · Archive84">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>

  <div class="strip">
    <div class="wrap strip__inner">
      <a class="strip__brand" href="/index.html"><span class="star" aria-hidden="true"></span> Archive84</a>
      <span>Vol. 1 · Issue 01 · Summer 2026</span>
    </div>
  </div>

  <header class="masthead masthead--compact">
    <div class="wrap">
      <a href="/index.html" class="wordmark wordmark--link">Archive84</a>
    </div>
  </header>

  <div class="star-bar" aria-hidden="true"></div>
${body}

  <footer class="foot">
    <div class="wrap">
      <div class="foot__grid">
        <div>
          <p class="foot__brand">Archive84</p>
          <p>An independent, fan-compiled visual reference to the DC Super Powers Collection (1984–1986) and its extended universe. Not affiliated with DC, Warner, or Kenner/Hasbro.</p>
        </div>
        <div>
          <h4>Sections</h4>
          <ul>
            <li><a href="/characters/index.html">Dossiers</a></li>
            <li><a href="/characters/index.html">Character Index</a></li>
            <li><a href="/timeline/index.html">Timeline</a></li>
            <li><a href="/toys/index.html">Toy Database</a></li>
            <li><a href="/comics/index.html">Comic Database</a></li>
            <li><a href="/creators/index.html">Creators</a></li>
            <li><a href="/media/index.html">In the Media</a></li>
            <li><a href="/merchandise/index.html">Merchandise</a></li>
            <li><a href="/search/index.html">Search</a></li>
          </ul>
        </div>
        <div>
          <h4>Colophon</h4>
          <ul>
            <li><a href="#">Editorial &amp; corrections</a></li>
            <li><a href="#">Submission guidelines</a></li>
            <li><a href="#">Contributor log</a></li>
            <li><a href="#">Errata</a></li>
          </ul>
        </div>
      </div>
      <div class="foot__legal">
        <span>© MMXXVI · Archive84</span>
        <span>DC characters © DC Comics · Super Powers © respective owners</span>
        <span>Set in Futura, Georgia &amp; IBM Plex Mono</span>
      </div>
    </div>
  </footer>

  <!-- Lightbox — opened by any .lb-trigger on the page (see /js/lightbox.js) -->
  <dialog class="lightbox" id="lightbox" aria-label="Image detail">
    <div class="lightbox__inner">
      <button class="lightbox__close" type="button" data-action="close" aria-label="Close">&times;</button>
      <button class="lightbox__prev"  type="button" data-action="prev"  aria-label="Previous">&#8249;</button>
      <button class="lightbox__next"  type="button" data-action="next"  aria-label="Next">&#8250;</button>
      <img class="lightbox__img" id="lightbox-img" src="" alt="">
      <figcaption class="lightbox__caption">
        <p class="dek" id="lightbox-status"></p>
        <h3 id="lightbox-title"></h3>
        <p id="lightbox-desc"></p>
      </figcaption>
    </div>
  </dialog>
  <script src="/js/lightbox.js" defer></script>

</body>
</html>
`;
}

function specRows(pairs) {
  return pairs
    .filter(([, v]) => v)
    .map(([k, v]) => `<div class="spec-row"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`)
    .join('\n            ');
}

function pager(kind, prev, next) {
  if (!prev || !next) return '';
  return `
  <nav class="dossier-pager" aria-label="Adjacent ${kind}s">
    <div class="wrap dossier-pager__inner">
      <a href="/${kind}/${esc(prev.slug)}.html" class="dossier-pager__prev">
        <p class="dek">◄ Previous</p>
        <span class="dossier-pager__label">${esc(prev.name)}</span>
      </a>
      <a href="/${kind}/${esc(next.slug)}.html" class="dossier-pager__next">
        <p class="dek">Next ►</p>
        <span class="dossier-pager__label">${esc(next.name)}</span>
      </a>
    </div>
  </nav>`;
}

// ---- fragments ----------------------------------------------------------

function figureCard(r) {
  const media = sortedMedia(r.media_releases);
  const front = mediaUrl(media[0]) ?? PLACEHOLDER;
  const back = mediaUrl(media[1]);
  const frontAlt = media[0]?.alt_text ?? `${r.name} — ${r.lines?.name ?? ''}${r.release_year ? `, ${r.release_year}` : ''}`;
  const flip = back
    ? `<div class="figure-card__flip" aria-hidden="true">
            <img class="figure-card__photo figure-card__photo--front" src="${esc(front)}" alt="${esc(frontAlt)}">
            <img class="figure-card__photo figure-card__photo--back" src="${esc(back)}" alt="${esc(media[1]?.alt_text ?? '')}">
          </div>`
    : `<div class="figure-card__flip figure-card__flip--static" aria-hidden="true">
            <img class="figure-card__photo" src="${esc(front)}" alt="${esc(frontAlt)}">
          </div>`;
  const meta = [
    r.series?.name,
    r.release_year,
    r.status !== 'released' ? r.status.replaceAll('_', ' ') : null,
    r.type !== 'figure' ? r.type.replaceAll('_', ' ') : null,
  ].filter(Boolean).join(' · ');
  const credit = media[0]?.credit ? `<p class="figure-card__meta">Photo: ${esc(media[0].credit)}</p>` : '';
  return `<a class="figure-card" href="/release/${esc(r.slug)}.html">
          ${flip}
          <h3>${esc(r.name)}</h3>
          <p class="figure-card__meta">${esc(meta)}</p>
          ${credit}
        </a>`;
}

function comicCard(p) {
  const media = sortedMedia(p.media_publications);
  const cover = mediaUrl(media[0]) ?? PLACEHOLDER;
  const alt = media[0]?.alt_text ?? `${p.title} — ${p.publisher ?? ''}${p.year ? `, ${p.year}` : ''}`;
  const meta = [p.publisher, p.year, p.kind === 'pack_in_mini' ? 'Pack-in' : null]
    .filter(Boolean).join(' · ');
  return `<a class="comic-card" href="/comics/${esc(p.slug)}.html">
          <img class="comic-card__photo" src="${esc(cover)}" alt="${esc(alt)}">
          <h3>${esc(p.title)}</h3>
          <p class="comic-card__meta">${esc(meta)}</p>
        </a>`;
}

function headshotFigure(media, label, fallbackAlt) {
  const src = mediaUrl(media) ?? PLACEHOLDER;
  return `<figure>
          <img src="${esc(src)}" alt="${esc(media?.alt_text ?? fallbackAlt)}">
          <figcaption>${esc(label)}</figcaption>
        </figure>`;
}

// ---- character page -----------------------------------------------------

function renderCharacterPage(c, releases, publications, enemyList, adj) {
  const teams = (c.character_teams ?? []).map((t) => t.teams?.name).filter(Boolean);
  const portraitMedia = pickMedia(c.media_characters, ['artwork'])[0];
  const portrait = mediaUrl(portraitMedia) ?? PLACEHOLDER;
  const portraitAlt = portraitMedia?.alt_text ?? `${c.name} character artwork — DC Comics`;

  const logoMedia = pickMedia(c.media_characters, ['logo'])[0];
  const headshotMedia = pickMedia(c.media_characters, ['headshot'])[0];
  const alterEgoMedia = pickMedia(c.media_characters, ['alter_ego'])[0];

  // linked cross-references for the Known Enemies section. The powers-card
  // Enemies line is separate free text (c.enemies) — curated card-back prose,
  // not every linked character.
  const enemies = [...(enemyList ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const firstFigure = releases.find((r) => r.type === 'figure');
  const kennerWaves = [...new Set(
    releases
      .filter((r) => r.lines?.slug === 'kenner-super-powers' && r.series?.name)
      .map((r) => r.series.name.replace('Series ', ''))
  )];

  const description = stripTags((c.overview ?? c.bio ?? '').split(/\n\s*\n/)[0] ?? '')
    .slice(0, 158);

  const byLine = [];
  for (const r of releases) {
    const last = byLine.at(-1);
    if (last && last.line.slug === r.lines?.slug) last.releases.push(r);
    else byLine.push({ line: r.lines ?? { name: 'Releases', slug: '' }, releases: [r] });
  }

  const alignmentTag = c.alignment
    ? `<span class="dossier-tag dossier-tag--blue">${esc(titleCase(c.alignment))}</span>`
    : '';
  const teamTags = teams.map((t) => `<span class="dossier-tag dossier-tag--yellow">${esc(t)}</span>`).join('\n        ');

  const vitals = specRows([
    ['Real Name', (c.aka ?? []).slice(0, 2).join(' · ')],
    ['Homeworld', c.homeworld],
    ['Alignment', titleCase(c.alignment)],
    ['Team', teams.join(' · ')],
    ['Base of Operations', c.base_of_operations],
    ['First Appearance', c.first_appearance],
    ['First Figure', firstFigure ? `${firstFigure.series?.name ?? firstFigure.lines?.name ?? ''} (${firstFigure.release_year ?? '—'})` : null],
    ['Power Action', firstFigure?.action_feature],
    ['Waves Present', kennerWaves.join(' · ')],
  ]);

  const pullquote = firstFigure?.action_feature ? `
  <section class="pullquote" aria-label="Power Action">
    <div class="wrap pullquote__inner">
      <blockquote>${esc(firstFigure.action_feature)}</blockquote>
      <cite>${esc([firstFigure.series?.name, firstFigure.release_year, firstFigure.lines?.name].filter(Boolean).join(' · '))}</cite>
    </div>
  </section>` : '';

  const releaseSections = byLine.map(({ line, releases: rs }) => `
  <section class="dossier-figures">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Releases</p>
        <h2>${esc(line.name)}</h2>
      </div>
      <div class="figures-grid">
        ${rs.map(figureCard).join('\n        ')}
      </div>
    </div>
  </section>`).join('\n');

  const comicsSection = publications.length ? `
  <section class="dossier-comics">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">In print</p>
        <h2>Comic Appearances</h2>
      </div>
      <div class="comics-grid">
        ${publications.map(comicCard).join('\n        ')}
      </div>
    </div>
  </section>` : '';

  const enemiesSection = enemies.length ? `
  <section class="dossier-enemies">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Rogues</p>
        <h2>Known Enemies</h2>
      </div>
      <ul class="enemies-list">
        ${enemies.map((e) => `<li><a class="enemy-link" href="/dossier/${esc(e.slug)}.html">${esc(e.name)}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </section>` : '';

  const aboutSection = c.bio ? `
        <section class="dossier-about">
          <h3>About ${esc(c.name)}</h3>
          ${richText(c.bio)}
        </section>` : '';

  const powersHeader = logoMedia
    ? `<img class="powers-card__logo" src="${esc(mediaUrl(logoMedia))}" alt="${esc(logoMedia.alt_text ?? c.name + ' logo')}">`
    : `<h2 class="powers-card__name">${esc(c.name)}</h2>`;

  // Power Action speech bubble — the figure's Power Action feature overlaid on
  // the bubble artwork in dark blue. Sits at the top of the sidebar, above the
  // character hero portrait.
  const powerBubble = firstFigure?.action_feature ? `<div class="power-bubble">
        <img class="power-bubble__shape" src="/assets/power_action_bubble.svg" alt="" aria-hidden="true">
        <span class="power-bubble__text">${esc(firstFigure.action_feature)}</span>
      </div>` : '';

  const powersCard = (c.powers || c.weaknesses || c.aka?.length || c.enemies || logoMedia) ? `
      <aside class="powers-card">
        ${powersHeader}
        ${c.powers ? `<div class="powers-card__section"><h3>Powers</h3><p>${esc(c.powers)}</p></div>` : ''}
        ${c.weaknesses ? `<div class="powers-card__section"><h3>Weaknesses</h3><p>${esc(c.weaknesses)}</p></div>` : ''}
        ${c.aka?.length ? `<div class="powers-card__section"><h3>Secret Identity</h3><p>${esc(c.aka.join(' · '))}</p></div>` : ''}
        ${c.enemies ? `<div class="powers-card__section"><h3>Enemies</h3><p>${esc(c.enemies)}</p></div>` : ''}
      </aside>` : '';

  const headshots = (headshotMedia || alterEgoMedia) ? `
      <div class="dossier-headshots">
        ${headshotMedia ? headshotFigure(headshotMedia, c.name, `${c.name} headshot`) : ''}
        ${alterEgoMedia ? headshotFigure(alterEgoMedia, c.aka?.[0] ?? 'Alter ego', `${c.name} alter ego`) : ''}
      </div>` : '';

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Dossiers', href: '/characters/index.html' },
  { label: c.name },
])}

      <div class="dossier-head__tags">
        ${alignmentTag}
        ${teamTags}
      </div>

      <h1 class="dossier-title">${esc(c.name)}</h1>
      ${c.aka?.length ? `<p class="dossier-aliases">${esc(c.aka.slice(0, 3).join(' · '))}</p>` : ''}
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap dossier-body__grid">

      <article class="dossier-lede">
        ${(c.overview || c.bio) ? `<p class="dek">Overview</p>
        ${richText(c.overview) || richText(c.bio)}` : ''}

        ${vitals ? `<aside class="dossier-spec">
          <p class="dek">Vital Statistics</p>
          <dl>
            ${vitals}
          </dl>
        </aside>` : ''}
${aboutSection}
      </article>

      <div class="dossier-sidebar">
      ${powerBubble}
      <img class="dossier-portrait" src="${esc(portrait)}" alt="${esc(portraitAlt)}">
      ${portraitMedia?.credit ? `<p class="dek dek--sm">Photo: ${esc(portraitMedia.credit)}</p>` : ''}
${headshots}
${powersCard}
      </div>

    </div>
  </section>
${pullquote}
${enemiesSection}
${releaseSections}
${comicsSection}
${pager('dossier', adj?.prev, adj?.next)}`;

  return pageShell({ title: c.name, description, ogImage: portrait, body });
}

// ---- release page -------------------------------------------------------

function renderReleasePage(r, variations, adj) {
  const media = sortedMedia(r.media_releases);
  const hero = mediaUrl(media[0]) ?? PLACEHOLDER;  // og:image only

  const linkedChar = r.characters
    ?? (r.release_characters ?? []).map((rc) => rc.characters).filter(Boolean)[0]
    ?? null;

  const description = stripTags(r.notes ?? `${r.name} — ${r.lines?.name ?? ''}${r.release_year ? `, ${r.release_year}` : ''}.`)
    .slice(0, 158);

  const statusTag = r.status !== 'released'
    ? `<span class="dossier-tag dossier-tag--red">${esc(titleCase(r.status.replaceAll('_', ' ')))}</span>`
    : '';
  const typeTag = `<span class="dossier-tag dossier-tag--blue">${esc(titleCase(r.type.replaceAll('_', ' ')))}</span>`;
  const rarityTag = r.rarity
    ? `<span class="dossier-tag dossier-tag--yellow">${esc(titleCase(r.rarity.replaceAll('_', ' ')))}</span>`
    : '';

  const money = (n) => n == null ? null : `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  const spec = specRows([
    ['Line', r.lines?.name],
    ['Series', r.series?.name],
    ['Year', r.release_year],
    ['Region', r.region && r.region !== 'US' ? r.region : (r.region === 'US' ? 'US' : null)],
    ['Type', titleCase(r.type.replaceAll('_', ' '))],
    ['Status', titleCase(r.status.replaceAll('_', ' '))],
    ['Action Feature', r.action_feature],
    ['Accessories', (r.accessories ?? []).join(', ')],
    ['Features', (r.features ?? []).join(', ')],
    ['Card Type', r.card_type],
    ['Rarity', titleCase((r.rarity ?? '').replaceAll('_', ' ')) || null],
    ['Est. Value (loose)', money(r.est_value_loose)],
    ['Est. Value (carded)', money(r.est_value_carded)],
  ]);

  const notesSection = r.notes ? `
        <section class="dossier-about">
          <h3>Notes</h3>
          ${richText(r.notes)}
        </section>` : '';

  const sources = (r.sources ?? []).filter(Boolean);
  const sourcesSection = sources.length ? `
        <div class="release-sources">
          <p class="dek">Sources</p>
          <ul>
            ${sources.map((s) => `<li><a href="${esc(s)}" rel="nofollow noopener">${esc(s.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></li>`).join('\n            ')}
          </ul>
        </div>` : '';

  // Design/sculpt/packaging credits, linking to each creator's bio page
  // (mirrors the comic page's Credits section).
  const credits = (r.release_creators ?? [])
    .map((rc) => ({ ...rc.creators, role: rc.role })).filter((c) => c?.name);
  const creditsSection = credits.length ? `
        <section class="dossier-about">
          <h3>Credits</h3>
          <ul class="credits-list">
            ${credits.map((c) => `<li><a href="/creators/${esc(c.slug)}.html">${esc(c.name)}</a>${c.role ? ` — ${esc(c.role)}` : ''}</li>`).join('\n            ')}
          </ul>
        </section>` : '';

  const variationsSection = (variations ?? []).length ? `
  <section class="release-variations">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Same release, documented differences</p>
        <h2>Variations</h2>
      </div>
      <ul class="variation-list">
        ${variations.map((v) => {
          const vMedia = sortedMedia(v.media_variations);
          const vGallery = `var-${v.slug}`;
          const vType = v.variation_type
            ? `<span class="dossier-tag dossier-tag--blue">${esc(titleCase(v.variation_type))}</span>` : '';
          const vRarity = v.rarity
            ? `<span class="dossier-tag dossier-tag--yellow">${esc(titleCase(v.rarity.replaceAll('_', ' ')))}</span>` : '';
          const vValues = [
            v.est_value_loose != null ? `Loose ${money(v.est_value_loose)}` : null,
            v.est_value_carded != null ? `Carded ${money(v.est_value_carded)}` : null,
          ].filter(Boolean).join(' · ');
          // all images shown together above the description; each opens the
          // lightbox grouped so prev/next stays within this one variation
          const vGalleryRow = vMedia.length ? `<div class="variation-card__gallery">
            ${vMedia.map((m) => `<figure>
              ${lbTrigger(m, vGallery, v.name)}
              ${m.credit ? `<figcaption>Photo: ${esc(m.credit)}</figcaption>` : ''}
            </figure>`).join('\n            ')}
          </div>` : '';
          return `<li class="variation-card">
          ${vGalleryRow}
          <div class="variation-card__body">
            <div class="variation-card__head">
              <h3>${esc(v.name)}</h3>
              ${vType}${vRarity}
            </div>
            ${v.description ? `<p>${esc(v.description)}</p>` : ''}
            ${vValues ? `<p class="variation-card__values">${esc(vValues)}</p>` : ''}
            ${v.notes ? `<p class="variation-card__notes">${esc(v.notes)}</p>` : ''}
          </div>
        </li>`;
        }).join('\n        ')}
      </ul>
    </div>
  </section>` : '';

  // Gallery lives in the main column above Notes and shows every image
  // (the former hero is just the first gallery item now).
  const galleryInline = media.length ? `
        <section class="release-gallery-block">
          <p class="dek">Photography</p>
          <div class="release-gallery">
            ${media.map((m) => `<figure>
              ${lbTrigger(m, `rel-${r.slug}`, r.name)}
              ${m.credit ? `<figcaption>Photo: ${esc(m.credit)}</figcaption>` : ''}
            </figure>`).join('\n            ')}
          </div>
        </section>` : '';

  const subtitle = [r.lines?.name, r.series?.name, r.release_year].filter(Boolean).join(' · ');

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Toy Database', href: '/toys/index.html' },
  ...(linkedChar ? [{ label: linkedChar.name, href: `/dossier/${linkedChar.slug}.html` }] : []),
  { label: r.name },
])}

      <div class="dossier-head__tags">
        ${typeTag}
        ${statusTag}
        ${rarityTag}
      </div>

      <h1 class="dossier-title">${esc(r.name)}</h1>
      ${subtitle ? `<p class="dossier-aliases">${esc(subtitle)}</p>` : ''}
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap dossier-body__grid">

      <article class="dossier-lede">
${galleryInline}
${notesSection}
${creditsSection}
${sourcesSection}
      </article>

      <div class="dossier-sidebar">
        <aside class="dossier-spec">
          <p class="dek">Specifications</p>
          <dl>
            ${spec}
          </dl>
        </aside>
      </div>

    </div>
  </section>
${variationsSection}
${pager('release', adj?.prev, adj?.next)}`;

  return pageShell({ title: r.name, description, ogImage: hero, body });
}

// ---- media hub ("Super Powers in the Media") ----------------------------

const KIND_LABELS = {
  series: 'Animated Series',
  episode: 'Episodes',
  commercial: 'Television Commercials',
  home_video: 'Home Video',
};
const KIND_ORDER = ['series', 'episode', 'commercial', 'home_video'];

// A single entry in the library — a poster card linking to its own page (where
// the player and the long-form article live). Mirrors figureCard → release page.
function videoCard(sm) {
  const m = sm.media_assets;
  const meta = [titleCase((sm.kind ?? '').replaceAll('_', ' ')), sm.year].filter(Boolean).join(' · ');
  const poster = posterUrl(m) ?? PLACEHOLDER;
  const teaser = stripTags(sm.description ?? '').slice(0, 160);
  return `<a class="video-card" href="/media/${esc(sm.slug)}.html">
          <div class="video-card__frame video-card__frame--poster">
            <img src="${esc(poster)}" alt="${esc(m?.alt_text ?? sm.title)}" loading="lazy">
            <span class="video-card__badge" aria-hidden="true">▶</span>
          </div>
          <h3>${esc(sm.title)}</h3>
          <p class="video-card__meta">${esc(meta)}</p>
          ${teaser ? `<p class="video-card__desc">${esc(teaser)}</p>` : ''}
        </a>`;
}

// A screen-media detail page: the player up top, a long-form article below,
// spec + attribution in the sidebar. `parent` is the resolved parent series
// (episode → series), if any.
function renderScreenMediaPage(sm, parent, adj) {
  const m = sm.media_assets;
  const embed = embedSrc(m?.embed_url);
  const poster = posterUrl(m) ?? PLACEHOLDER;

  const player = embed
    ? `<div class="media-player">
            <iframe src="${esc(embed)}" title="${esc(sm.title)}" loading="lazy"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
          </div>`
    : `<div class="media-player media-player--empty">
            <img src="${esc(poster)}" alt="${esc(m?.alt_text ?? sm.title)}">
            <span class="video-card__badge" aria-hidden="true">▶</span>
            <span class="video-card__pending">Embed pending — attach a video asset in the admin</span>
          </div>`;

  const description = stripTags(sm.description ?? `${sm.title} — Super Powers screen media.`)
    .slice(0, 158);

  const kindTag = sm.kind
    ? `<span class="dossier-tag dossier-tag--red">${esc(titleCase(sm.kind.replaceAll('_', ' ')))}</span>` : '';

  const spec = specRows([
    ['Kind', titleCase((sm.kind ?? '').replaceAll('_', ' ')) || null],
    ['Year', sm.year],
    ['Part of', parent?.title],
    ['Video source', m?.credit],
  ]);

  const articleSection = sm.description ? `
        <section class="dossier-about">
          <h3>About</h3>
          ${richText(sm.description)}
        </section>` : '';

  const sourceLink = m?.source_url ? `
        <div class="release-sources">
          <p class="dek">Source</p>
          <ul>
            <li><a href="${esc(m.source_url)}" rel="nofollow noopener">${esc(m.source_url.replace(/^https?:\/\//, '').replace(/\/$/, ''))}</a></li>
          </ul>
        </div>` : '';

  const subtitle = [titleCase((sm.kind ?? '').replaceAll('_', ' ')), sm.year].filter(Boolean).join(' · ');

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Media', href: '/media/index.html' },
  ...(parent ? [{ label: parent.title, href: `/media/${parent.slug}.html` }] : []),
  { label: sm.title },
])}

      <div class="dossier-head__tags">
        ${kindTag}
      </div>

      <h1 class="dossier-title">${esc(sm.title)}</h1>
      ${subtitle ? `<p class="dossier-aliases">${esc(subtitle)}</p>` : ''}
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap dossier-body__grid">

      <article class="dossier-lede">
        ${player}
${articleSection}
${sourceLink}
      </article>

      <div class="dossier-sidebar">
        <aside class="dossier-spec">
          <p class="dek">Details</p>
          <dl>
            ${spec}
          </dl>
        </aside>
      </div>

    </div>
  </section>
${pager('media', adj?.prev, adj?.next)}`;

  return pageShell({ title: sm.title, description, ogImage: poster, body });
}

function renderMediaHub(screenMedia) {
  const byKind = new Map();
  for (const sm of screenMedia) {
    const k = sm.kind ?? 'other';
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(sm);
  }
  const orderedKinds = [
    ...KIND_ORDER.filter((k) => byKind.has(k)),
    ...[...byKind.keys()].filter((k) => !KIND_ORDER.includes(k)),
  ];

  const librarySections = orderedKinds.map((k) => `
  <section class="media-library">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">On screen</p>
        <h2>${esc(KIND_LABELS[k] ?? titleCase(k.replaceAll('_', ' ')))}</h2>
      </div>
      <div class="video-grid">
        ${byKind.get(k).map(videoCard).join('\n        ')}
      </div>
    </div>
  </section>`).join('\n');

  const emptyState = !screenMedia.length ? `
  <section class="media-library">
    <div class="wrap">
      <p class="media-empty">No screen media entered yet. Add entries under <strong>Screen media</strong> in the admin, attach a video asset with an Embed URL, and rebuild.</p>
    </div>
  </section>` : '';

  const description = 'The animated Super Friends tie-ins, vintage Kenner TV commercials, and Warner Home Video releases that carried the DC Super Powers Collection.';

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Media' },
])}

      <div class="dossier-head__tags">
        <span class="dossier-tag dossier-tag--red">Editorial</span>
        <span class="dossier-tag dossier-tag--blue">Screen &amp; Adaptation</span>
      </div>

      <h1 class="dossier-title">Super Powers in the Media</h1>
      <p class="dossier-aliases">The cartoons, commercials, and home video that carried the line</p>
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>The Super Powers Collection was never just a shelf of toys. It was a cross-media event, and its loudest engine was television. Hanna-Barbera's long-running <em>Super Friends</em> was retitled in 1984 to sync with the toy line — first as <em>The Legendary Super Powers Show</em>, then in 1985–86 as <em>The Super Powers Team: Galactic Guardians</em>, an eight-episode final season story-edited by Alan Burnett and often cited as a precursor to the later DC animated "Timm-verse."</p>
        <p>Around the cartoons ran Kenner's own advertising: a wave-by-wave run of television commercials selling the Power Action features, the vehicles, and the Hall of Justice to Saturday-morning audiences. And in 1985, riding DC's 50th-anniversary push, Warner Home Video reissued 1960s Filmation DC cartoons — Superman, Batman, Superboy, Aquaman — repackaged under the Super Powers banner on VHS and Betamax.</p>
        <p>This page collects that screen history. Each entry below links a title to the video itself; attach a clip in the admin and it plays right here in the archive.</p>
      </article>
    </div>
  </section>

  <section class="pullquote" aria-label="Media note">
    <div class="wrap pullquote__inner">
      <blockquote>The toys were on the shelf. The heroes were on the television. They sold each other.</blockquote>
      <cite>The tie-in engine · 1984–1986</cite>
    </div>
  </section>
${librarySections}${emptyState}`;

  return pageShell({ title: 'Super Powers in the Media', description, ogImage: PLACEHOLDER, body });
}

// ---- merchandise (non-figure licensed goods) ----------------------------

const MERCH_CATEGORY_LABELS = {
  apparel: 'Apparel & Soft Goods',
  housewares: 'Housewares & Home',
  party: 'Party & Stationery',
  publishing: 'Publishing & Games',
};
const MERCH_CATEGORY_ORDER = ['apparel', 'housewares', 'party', 'publishing'];

// Reuses the figure-card shell (real <img> + placeholder, per CLAUDE.md) so
// merchandise reads as a sibling of the toy database, not a different species.
function merchCard(m) {
  const media = sortedMedia(m.media_merchandise);
  const img = mediaUrl(media[0]) ?? PLACEHOLDER;
  const alt = media[0]?.alt_text ?? `${m.name}${m.year ? `, ${m.year}` : ''}`;
  const meta = [
    MERCH_CATEGORY_LABELS[m.category] ?? (m.category ? titleCase(m.category) : null),
    m.manufacturer,
    m.year,
  ].filter(Boolean).join(' · ');
  const credit = media[0]?.credit ? `<p class="figure-card__meta">Photo: ${esc(media[0].credit)}</p>` : '';
  return `<a class="figure-card merch-card" href="/merchandise/${esc(m.slug)}.html">
          <div class="figure-card__flip figure-card__flip--static" aria-hidden="true">
            <img class="figure-card__photo" src="${esc(img)}" alt="${esc(alt)}">
          </div>
          <h3>${esc(m.name)}</h3>
          <p class="figure-card__meta">${esc(meta)}</p>
          ${credit}
        </a>`;
}

function renderMerchIndex(merch) {
  const byCat = new Map();
  for (const m of merch) {
    const c = m.category ?? 'other';
    if (!byCat.has(c)) byCat.set(c, []);
    byCat.get(c).push(m);
  }
  const orderedCats = [
    ...MERCH_CATEGORY_ORDER.filter((c) => byCat.has(c)),
    ...[...byCat.keys()].filter((c) => !MERCH_CATEGORY_ORDER.includes(c)),
  ];

  const catSections = orderedCats.map((c) => `
  <section class="dossier-figures merch-section">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Licensed goods</p>
        <h2>${esc(MERCH_CATEGORY_LABELS[c] ?? titleCase(c))}</h2>
      </div>
      <div class="figures-grid">
        ${byCat.get(c).map(merchCard).join('\n        ')}
      </div>
    </div>
  </section>`).join('\n');

  const emptyState = !merch.length ? `
  <section class="dossier-figures merch-section">
    <div class="wrap">
      <p class="media-empty">No merchandise entered yet. Add pieces under <strong>Merchandise</strong> in the admin, attach photos, and rebuild.</p>
    </div>
  </section>` : '';

  const description = 'Beyond the action figures — the lunchboxes, Underoos, party goods, storybooks, and games that carried the Super Powers logo across the licensing blitz of 1984–86.';

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Merchandise' },
])}

      <div class="dossier-head__tags">
        <span class="dossier-tag dossier-tag--blue">Licensing</span>
        <span class="dossier-tag dossier-tag--yellow">Non-figure</span>
      </div>

      <h1 class="dossier-title">Beyond the Figures</h1>
      <p class="dossier-aliases">Toys &amp; merchandise that carried the Super Powers logo</p>
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>When DC awarded Kenner the master toy license, it set off a licensing blitz that reached well past the action-figure aisle. A 1984 Toy Fair licensing handout lists the sprawl: lunchboxes, Underoos, 3-D puffy stickers, party supplies, paintable figurines, bedsheets, clothing, and coloring and activity books. Mayfair Games' <em>DC Heroes</em> RPG and the "Which Way" interactive storybooks rounded out the print side.</p>
        <p>None of it is a Kenner action figure — which is exactly why it lives here rather than in the Toy Database. This section catalogs the non-figure goods that wore the Super Powers logo.</p>
      </article>
    </div>
  </section>
${catSections}${emptyState}`;

  return pageShell({ title: 'Beyond the Figures — Merchandise', description, ogImage: PLACEHOLDER, body });
}

function renderMerchPage(m, adj) {
  const media = sortedMedia(m.media_merchandise);
  const hero = mediaUrl(media[0]) ?? PLACEHOLDER;

  const chars = (m.merchandise_characters ?? []).map((mc) => mc.characters).filter(Boolean);

  const description = stripTags(m.description ?? `${m.name} — Super Powers licensed merchandise${m.year ? `, ${m.year}` : ''}.`)
    .slice(0, 158);

  const catTag = m.category
    ? `<span class="dossier-tag dossier-tag--blue">${esc(MERCH_CATEGORY_LABELS[m.category] ?? titleCase(m.category))}</span>`
    : '';

  const spec = specRows([
    ['Category', MERCH_CATEGORY_LABELS[m.category] ?? (m.category ? titleCase(m.category) : null)],
    ['Manufacturer', m.manufacturer],
    ['Year', m.year],
  ]);

  const galleryInline = media.length ? `
        <section class="release-gallery-block">
          <p class="dek">Photography</p>
          <div class="release-gallery">
            ${media.map((im) => `<figure>
              ${lbTrigger(im, `merch-${m.slug}`, m.name)}
              ${im.credit ? `<figcaption>Photo: ${esc(im.credit)}</figcaption>` : ''}
            </figure>`).join('\n            ')}
          </div>
        </section>` : '';

  const descSection = m.description ? `
        <section class="dossier-about">
          <h3>About</h3>
          ${richText(m.description)}
        </section>` : '';

  const charsSection = chars.length ? `
  <section class="dossier-enemies">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Featured</p>
        <h2>Characters</h2>
      </div>
      <ul class="enemies-list">
        ${chars.map((ch) => `<li><a class="enemy-link" href="/dossier/${esc(ch.slug)}.html">${esc(ch.name)}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </section>` : '';

  const subtitle = ['Super Powers merchandise', m.manufacturer, m.year].filter(Boolean).join(' · ');

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Merchandise', href: '/merchandise/index.html' },
  { label: m.name },
])}

      <div class="dossier-head__tags">
        ${catTag}
      </div>

      <h1 class="dossier-title">${esc(m.name)}</h1>
      ${subtitle ? `<p class="dossier-aliases">${esc(subtitle)}</p>` : ''}
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap dossier-body__grid">

      <article class="dossier-lede">
${galleryInline}
${descSection}
      </article>

      <div class="dossier-sidebar">
        <aside class="dossier-spec">
          <p class="dek">Specifications</p>
          <dl>
            ${spec}
          </dl>
        </aside>
      </div>

    </div>
  </section>
${charsSection}
${pager('merchandise', adj?.prev, adj?.next)}`;

  return pageShell({ title: m.name, description, ogImage: hero, body });
}

// ---- publication (comic) detail page ------------------------------------

const PUB_KIND_LABEL = {
  mini_series: 'Mini-Series', pack_in_mini: 'Pack-in Mini-Comic',
  book: 'Book', rpg: 'Role-Playing Game',
};

function renderPublicationPage(p, packedRelease, adj) {
  const media = sortedMedia(p.media_publications);
  const cover = mediaUrl(media[0]) ?? PLACEHOLDER;

  const description = stripTags(p.description ?? `${p.title} — DC Super Powers${p.year ? `, ${p.year}` : ''}.`).slice(0, 158);
  const kindLabel = PUB_KIND_LABEL[p.kind] ?? (p.kind ? titleCase(p.kind.replaceAll('_', ' ')) : null);

  const creators = (p.publication_creators ?? [])
    .map((pc) => ({ ...pc.creators, role: pc.role })).filter((c) => c?.name);
  const chars = (p.publication_characters ?? []).map((pc) => pc.characters).filter(Boolean);

  const spec = specRows([
    ['Kind', kindLabel],
    ['Publisher', p.publisher],
    ['Year', p.year],
    ['Issue', p.issue_number ? `#${p.issue_number}` : null],
    ['Language', p.language && p.language !== 'en' ? p.language.toUpperCase() : null],
    ['Packed with', packedRelease?.name],
  ]);

  const descSection = p.description ? `
        <section class="dossier-about">
          <h3>About</h3>
          ${richText(p.description)}
        </section>` : '';

  const creditsSection = creators.length ? `
        <section class="dossier-about">
          <h3>Credits</h3>
          <ul class="credits-list">
            ${creators.map((c) => `<li><a href="/creators/${esc(c.slug)}.html">${esc(c.name)}</a>${c.role ? ` — ${esc(c.role)}` : ''}</li>`).join('\n            ')}
          </ul>
        </section>` : '';

  const charsSection = chars.length ? `
  <section class="dossier-enemies">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Featured</p>
        <h2>Characters</h2>
      </div>
      <ul class="enemies-list">
        ${chars.map((ch) => `<li><a class="enemy-link" href="/dossier/${esc(ch.slug)}.html">${esc(ch.name)}</a></li>`).join('\n        ')}
      </ul>
    </div>
  </section>` : '';

  const packedLink = packedRelease ? `<p class="dossier-aliases">Packed with <a href="/release/${esc(packedRelease.slug)}.html">${esc(packedRelease.name)}</a></p>` : '';
  const subtitle = [kindLabel, p.publisher, p.year].filter(Boolean).join(' · ');

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Comic Database', href: '/comics/index.html' },
  { label: p.title },
])}

      <div class="dossier-head__tags">
        ${kindLabel ? `<span class="dossier-tag dossier-tag--blue">${esc(kindLabel)}</span>` : ''}
      </div>

      <h1 class="dossier-title">${esc(p.title)}</h1>
      ${subtitle ? `<p class="dossier-aliases">${esc(subtitle)}</p>` : ''}
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap dossier-body__grid">

      <article class="dossier-lede">
        <section class="release-gallery-block">
          <p class="dek">${media.length > 1 ? 'Cover &amp; Interiors' : 'Cover'}</p>
          <div class="release-gallery">
            ${(media.length ? media : [{ storage_path: null, embed_url: cover, alt_text: p.title, credit: '' }]).map((m) => `<figure>
              ${lbTrigger(m, `pub-${p.slug}`, p.title)}
              ${m.credit ? `<figcaption>Scan: ${esc(m.credit)}</figcaption>` : ''}
            </figure>`).join('\n            ')}
          </div>
        </section>
${descSection}
${creditsSection}
      </article>

      <div class="dossier-sidebar">
        <aside class="dossier-spec">
          <p class="dek">Specifications</p>
          <dl>
            ${spec}
          </dl>
        </aside>
      </div>

    </div>
  </section>
${charsSection}
${pager('comics', adj?.prev, adj?.next)}`;

  return pageShell({ title: p.title, description, ogImage: cover, body });
}

// ---- creator (bio) detail page ------------------------------------------

// Combine the reverse-join rows into one entry per credited work, collecting
// the roles this creator held on it (a creator can be both writer and cover).
function groupCredits(rows, embed, keyOf) {
  const map = new Map();
  for (const row of rows ?? []) {
    const item = row[embed];
    if (!item) continue;
    const key = keyOf(item);
    const entry = map.get(key) ?? { ...item, roles: [] };
    if (row.role) entry.roles.push(row.role);
    map.set(key, entry);
  }
  return [...map.values()];
}

const creditRoles = (roles) => roles.length
  ? ` — ${esc([...new Set(roles)].join(', '))}` : '';

function renderCreatorPage(cr, adj) {
  const photo = sortedMedia(cr.media_creators)[0];
  const portrait = mediaUrl(photo) ?? PLACEHOLDER;
  const portraitAlt = photo?.alt_text ?? `${cr.name} — portrait`;

  const description = stripTags(cr.overview ?? cr.bio ?? cr.role_summary
    ?? `${cr.name} — a creator behind the DC Super Powers Collection.`).slice(0, 158);

  let lifespan = null;
  if (cr.birth_year && cr.death_year) lifespan = `${cr.birth_year}–${cr.death_year}`;
  else if (cr.birth_year) lifespan = `b. ${cr.birth_year}`;
  else if (cr.death_year) lifespan = `d. ${cr.death_year}`;

  const toys = groupCredits(cr.release_creators, 'releases', (r) => r.slug)
    .sort((a, b) => (a.release_year ?? 9999) - (b.release_year ?? 9999) || a.name.localeCompare(b.name));
  const comics = groupCredits(cr.publication_creators, 'publications', (p) => p.slug)
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.title.localeCompare(b.title));

  const spec = specRows([
    ['Role', cr.role_summary],
    ['Years', lifespan],
    ['Toys credited', toys.length || null],
    ['Comics credited', comics.length || null],
  ]);

  const portraitSidebar = `
      <img class="dossier-portrait" src="${esc(portrait)}" alt="${esc(portraitAlt)}">
      ${photo?.credit ? `<p class="dek dek--sm">Photo: ${esc(photo.credit)}</p>` : ''}`;

  const overviewSection = cr.overview ? `
        <section class="dossier-about">
          ${richText(cr.overview)}
        </section>` : '';

  const bioSection = cr.bio ? `
        <section class="dossier-about">
          <h3>Biography</h3>
          ${richText(cr.bio)}
        </section>` : '';

  const creditList = (items, hrefBase, labelOf, metaOf) => `
          <ul class="credits-list">
            ${items.map((it) => `<li><a href="/${hrefBase}/${esc(it.slug)}.html">${esc(labelOf(it))}</a>${metaOf(it) ? ` <span class="credit-meta">${esc(metaOf(it))}</span>` : ''}${creditRoles(it.roles)}</li>`).join('\n            ')}
          </ul>`;

  const creditedSection = (toys.length || comics.length) ? `
        <section class="dossier-about">
          <h3>Credited Work</h3>
          ${toys.length ? `<p class="dek">Toys &amp; Figures</p>${creditList(toys, 'release', (r) => r.name, (r) => [r.release_year, titleCase(r.type)].filter(Boolean).join(' · '))}` : ''}
          ${comics.length ? `<p class="dek">Comics</p>${creditList(comics, 'comics', (p) => p.title, (p) => p.year ? String(p.year) : '')}` : ''}
        </section>` : `
        <section class="dossier-about">
          <p class="hint">No credited work recorded yet.</p>
        </section>`;

  const subtitle = [cr.role_summary, lifespan].filter(Boolean).join(' · ');

  const body = `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([
  { label: 'Home', href: '/index.html' },
  { label: 'Creators', href: '/creators/index.html' },
  { label: cr.name },
])}

      <div class="dossier-head__tags">
        <span class="dossier-tag dossier-tag--blue">Creator</span>
      </div>

      <h1 class="dossier-title">${esc(cr.name)}</h1>
      ${subtitle ? `<p class="dossier-aliases">${esc(subtitle)}</p>` : ''}
    </div>
  </section>

  <section class="dossier-body">
    <div class="wrap dossier-body__grid">

      <article class="dossier-lede">
${overviewSection}
${bioSection}
${creditedSection}
      </article>

      <div class="dossier-sidebar">
${portraitSidebar}
        <aside class="dossier-spec">
          <p class="dek">Details</p>
          <dl>
            ${spec}
          </dl>
        </aside>
      </div>

    </div>
  </section>
${pager('creators', adj?.prev, adj?.next)}`;

  return pageShell({ title: cr.name, description, ogImage: portrait, body });
}

function renderCreatorIndex(creators) {
  const card = (cr) => {
    const portrait = mediaUrl(sortedMedia(cr.media_creators)[0]) ?? PLACEHOLDER;
    const credits = (cr.release_creators?.length ?? 0) + (cr.publication_creators?.length ?? 0);
    const meta = [cr.role_summary, credits ? `${credits} credit${credits === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
    return `<a class="figure-card" href="/creators/${esc(cr.slug)}.html">
          <div class="figure-card__flip figure-card__flip--static" aria-hidden="true">
            <img class="figure-card__photo" src="${esc(portrait)}" alt="${esc(cr.name)} — portrait">
          </div>
          <h3>${esc(cr.name)}</h3>
          ${meta ? `<p class="figure-card__meta">${esc(meta)}</p>` : ''}
        </a>`;
  };

  const body = `${indexHead(
    'Creators',
    '<span class="dossier-tag dossier-tag--blue">Bylines</span>',
    'Creators',
    'The writers, artists, and designers behind Super Powers',
  )}

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>The people who designed, wrote, and drew the Super Powers line — ${creators.length} creator${creators.length === 1 ? '' : 's'}. Each page collects an overview, a biography, and every toy and comic credited to them in the archive.</p>
      </article>
    </div>
  </section>

  <div class="star-bar" aria-hidden="true"></div>
  <div class="roster roster--blue">
  <section class="roster-group">
    <div class="wrap">
      <div class="figures-grid">
        ${creators.map(card).join('\n        ')}
      </div>
    </div>
  </section>
  </div>
  <div class="star-bar" aria-hidden="true"></div>`;

  return pageShell({
    title: 'Creators',
    description: `Browse the ${creators.length} creators behind the DC Super Powers Collection — writers, artists, and designers.`,
    ogImage: PLACEHOLDER,
    body,
  });
}

// ---- section index pages ------------------------------------------------
// Listing pages that make the homepage tiles land somewhere real. Each reuses
// the card renderers so it reads as a sibling of the record pages.

function indexHead(crumbLabel, tags, title, subtitle) {
  return `
  <section class="dossier-head">
    <div class="wrap">
${backAndCrumb([{ label: 'Home', href: '/index.html' }, { label: crumbLabel }])}

      <div class="dossier-head__tags">
        ${tags}
      </div>

      <h1 class="dossier-title">${esc(title)}</h1>
      <p class="dossier-aliases">${esc(subtitle)}</p>
    </div>
  </section>`;
}

function renderCharacterIndex(characters) {
  const alignOrder = ['hero', 'ally', 'neutral', 'villain'];
  const alignLabel = { hero: 'Heroes', ally: 'Allies', neutral: 'Neutral', villain: 'Villains', other: 'Unaligned' };
  const byAlign = new Map();
  for (const c of characters) {
    const a = c.alignment ?? 'other';
    if (!byAlign.has(a)) byAlign.set(a, []);
    byAlign.get(a).push(c);
  }
  const ordered = [...alignOrder.filter((a) => byAlign.has(a)), ...[...byAlign.keys()].filter((a) => !alignOrder.includes(a))];

  const card = (c) => {
    const portrait = mediaUrl(pickMedia(c.media_characters, ['artwork'])[0]
      ?? pickMedia(c.media_characters, ['headshot'])[0]) ?? PLACEHOLDER;
    const meta = [titleCase(c.alignment ?? ''), (c.aka ?? [])[0]].filter(Boolean).join(' · ');
    return `<a class="figure-card" href="/dossier/${esc(c.slug)}.html">
          <div class="figure-card__flip figure-card__flip--static" aria-hidden="true">
            <img class="figure-card__photo" src="${esc(portrait)}" alt="${esc(c.name)} — DC Comics">
          </div>
          <h3>${esc(c.name)}</h3>
          ${meta ? `<p class="figure-card__meta">${esc(meta)}</p>` : ''}
        </a>`;
  };

  const groupSections = ordered.map((a) => `
  <section class="roster-group">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">The roster</p>
        <h2>${esc(alignLabel[a] ?? titleCase(a))}</h2>
      </div>
      <div class="figures-grid">
        ${byAlign.get(a).map(card).join('\n        ')}
      </div>
    </div>
  </section>`).join('\n');

  const body = `${indexHead(
    'Character Index',
    '<span class="dossier-tag dossier-tag--blue">Roster</span>',
    'Character Index',
    'Every hero and villain in the Super Powers universe',
  )}

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>The canonical DC identities behind the toy line — ${characters.length} characters, sorted by allegiance. Every card opens a full dossier collecting that character's Kenner and McFarlane releases, comics, and screen appearances.</p>
      </article>
    </div>
  </section>

  <div class="star-bar" aria-hidden="true"></div>
  <div class="roster roster--blue">
${groupSections}
  </div>
  <div class="star-bar" aria-hidden="true"></div>`;

  return pageShell({
    title: 'Character Index',
    description: `Browse all ${characters.length} characters in the DC Super Powers reference — heroes, villains, and the New Gods.`,
    ogImage: PLACEHOLDER,
    body,
  });
}

function renderToyIndex(releases) {
  // Nested grouping: manufacturer (line) → wave (series). Releases arrive
  // pre-sorted by releaseOrder (line, year, name). Releases without a series
  // (vehicles, playsets, prototypes) fall into an "Other" wave within the line.
  const byLine = [];
  for (const r of releases) {
    let lineGroup = byLine.find((g) => g.slug === (r.lines?.slug ?? ''));
    if (!lineGroup) {
      lineGroup = { name: r.lines?.name ?? 'Releases', slug: r.lines?.slug ?? '', waves: new Map() };
      byLine.push(lineGroup);
    }
    const waveName = r.series?.name ?? 'Other';
    // no-series releases (vehicles, playsets, prototypes) always sort last and
    // show no year — hence the 9999 sentinel rather than a real release year
    const waveYear = r.series?.name ? (r.series.year ?? r.release_year ?? 9999) : 9999;
    // Tie-break waves that share a year (e.g. McFarlane ships several waves in
    // one year) by the series' own sort_order; the no-series "Other" bucket
    // sorts last.
    const waveSort = r.series?.name ? (r.series.sort_order ?? 999) : 9999;
    if (!lineGroup.waves.has(waveName)) lineGroup.waves.set(waveName, { year: waveYear, sort: waveSort, releases: [] });
    const w = lineGroup.waves.get(waveName);
    w.releases.push(r);
    w.year = Math.min(w.year, waveYear);
    w.sort = Math.min(w.sort, waveSort);
  }

  const sections = byLine.map((lg) => {
    const waves = [...lg.waves.entries()].sort((a, b) => a[1].year - b[1].year || a[1].sort - b[1].sort);
    const waveBlocks = waves.map(([wn, w]) => `
      <div class="toy-wave">
        <h3 class="toy-wave__head">${esc(wn)}${w.year < 9999 ? ` · ${esc(w.year)}` : ''}</h3>
        <div class="figures-grid">
          ${w.releases.map(figureCard).join('\n          ')}
        </div>
      </div>`).join('\n');
    return `
  <section class="roster-group">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">Manufacturer</p>
        <h2>${esc(lg.name)}</h2>
      </div>
${waveBlocks}
    </div>
  </section>`;
  }).join('\n');

  const body = `${indexHead(
    'Toy Database',
    '<span class="dossier-tag dossier-tag--red">Kenner &amp; McFarlane</span>',
    'Toy Database',
    'Every figure, vehicle, and playset — by manufacturer and wave',
  )}

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>All ${releases.length} releases across the lines — figures, vehicles, playsets, prototypes, and international variants. Each card opens the release's full detail page.</p>
      </article>
    </div>
  </section>

  <div class="star-bar" aria-hidden="true"></div>
  <div class="roster roster--yellow">
${sections}
  </div>
  <div class="star-bar" aria-hidden="true"></div>`;

  return pageShell({
    title: 'Toy Database',
    description: `Every DC Super Powers release — ${releases.length} figures, vehicles, and playsets from Kenner (1984–86) and McFarlane.`,
    ogImage: PLACEHOLDER,
    body,
  });
}

function renderComicIndex(publications) {
  const kindOrder = ['mini_series', 'pack_in_mini', 'book', 'rpg'];
  const kindLabel = {
    mini_series: 'Mini-Series', pack_in_mini: 'Pack-in Mini-Comics',
    book: 'Books', rpg: 'Role-Playing', other: 'Other',
  };
  const byKind = new Map();
  for (const p of publications) {
    const k = p.kind ?? 'other';
    if (!byKind.has(k)) byKind.set(k, []);
    byKind.get(k).push(p);
  }
  const ordered = [...kindOrder.filter((k) => byKind.has(k)), ...[...byKind.keys()].filter((k) => !kindOrder.includes(k))];

  const card = (p) => {
    const cover = mediaUrl(sortedMedia(p.media_publications)[0]) ?? PLACEHOLDER;
    const meta = [p.publisher, p.year, p.issue_number ? `#${p.issue_number}` : null,
      p.language && p.language !== 'en' ? p.language.toUpperCase() : null].filter(Boolean).join(' · ');
    return `<a class="comic-card" href="/comics/${esc(p.slug)}.html">
          <img class="comic-card__photo" src="${esc(cover)}" alt="${esc(p.title)}">
          <h3>${esc(p.title)}</h3>
          ${meta ? `<p class="comic-card__meta">${esc(meta)}</p>` : ''}
        </a>`;
  };

  const sections = ordered.map((k) => `
  <section class="dossier-comics">
    <div class="wrap">
      <div class="dossier-section-head">
        <p class="dek">In print</p>
        <h2>${esc(kindLabel[k] ?? titleCase(k.replaceAll('_', ' ')))}</h2>
      </div>
      <div class="comics-grid">
        ${byKind.get(k).map(card).join('\n        ')}
      </div>
    </div>
  </section>`).join('\n');

  const body = `${indexHead(
    'Comic Database',
    '<span class="dossier-tag dossier-tag--blue">DC Comics</span>',
    'Comic Database',
    'The mini-series and every packed-in mini-comic',
  )}

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>The Super Powers publishing history — Jack Kirby's tie-in mini-series and the ${publications.length} catalogued issues, including the mini-comics packed with Kenner figures.</p>
      </article>
    </div>
  </section>
${sections}`;

  return pageShell({
    title: 'Comic Database',
    description: 'The DC Super Powers mini-series, tie-ins, and every mini-comic packed with a Kenner figure.',
    ogImage: PLACEHOLDER,
    body,
  });
}

// ---- home page ----------------------------------------------------------
// The homepage was hand-authored (index.reference.html keeps that design as
// the reference). This generates the real index.html from live data: the
// featured hero, "New in the Archive" latest additions, the stats ticker, and
// "Longer reads" all come from Supabase. Static chrome (masthead, section
// tiles, pullquotes, footer) is reproduced verbatim.

const initials = (s) => ((String(s).match(/\b[A-Za-z0-9]/g) ?? []).slice(0, 2).join('') || '★').toUpperCase();

function renderHome(characters, releases, screenMedia, merchandise, publicationCount) {
  // Featured character: Superman (the golden record) if present, else the
  // first character that has a portrait, else whatever's first.
  const hero = characters.find((c) => c.slug === 'superman')
    ?? characters.find((c) => pickMedia(c.media_characters, ['artwork']).length)
    ?? characters[0];

  let heroBlock = '';
  if (hero) {
    const heroReleases = releasesForCharacter(releases, hero).sort(releaseOrder);
    const heroFig = heroReleases.find((r) => r.type === 'figure');
    const heroPortrait = mediaUrl(pickMedia(hero.media_characters, ['artwork'])[0]
      ?? pickMedia(hero.media_characters, ['headshot'])[0]) ?? PLACEHOLDER;
    const heroDek = (hero.aka ?? []).slice(0, 3).join(' · ') || hero.first_appearance || '';
    const heroLede = stripTags((hero.overview ?? hero.bio ?? '').split(/\n\s*\n/)[0] ?? '').slice(0, 440)
      || `${hero.name} in the DC Super Powers Collection.`;
    const heroUpdated = new Date(hero.updated_at ?? Date.now())
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const heroMeta = [
      heroFig ? ['First figure', [heroFig.series?.name, heroFig.release_year].filter(Boolean).join(' · ')] : null,
      heroFig?.action_feature ? ['Power action', heroFig.action_feature] : null,
      hero.first_appearance ? ['First appearance', hero.first_appearance] : null,
    ].filter(Boolean);

    heroBlock = `<article class="hero" aria-labelledby="hero-title">
      <span class="hero__eyebrow">
        <span class="tag">Featured Dossier</span>
        Updated ${esc(heroUpdated)}
      </span>

      <img class="hero__photo" src="${esc(heroPortrait)}" alt="${esc(hero.name)} — DC Super Powers Collection">

      <h2 id="hero-title" class="hero__title">${esc(hero.name)}</h2>
      ${heroDek ? `<p class="hero__dek">${esc(heroDek)}</p>` : ''}

      <p class="hero__lede">${esc(heroLede)}</p>

      ${heroMeta.length ? `<div class="hero__meta">
        ${heroMeta.map(([k, v]) => `<span><strong>${esc(k)}</strong> ${esc(v)}</span>`).join('\n        ')}
      </div>` : ''}

      <a href="/dossier/${esc(hero.slug)}.html" class="hero__cta">Read the Dossier</a>
    </article>`;
  }

  // "New in the Archive" — most recently updated records across sections.
  const recent = [
    ...characters.map((c) => ({ when: c.updated_at, href: `/dossier/${c.slug}.html`, title: c.name, label: 'Character Dossier', accent: 'thumb--blue' })),
    ...releases.map((r) => ({ when: r.updated_at, href: `/release/${r.slug}.html`, title: r.name, label: 'Toy Database', accent: 'thumb--red' })),
    ...screenMedia.map((s) => ({ when: s.updated_at, href: `/media/${s.slug}.html`, title: s.title, label: 'In the Media', accent: 'thumb--yellow' })),
    ...merchandise.map((m) => ({ when: m.updated_at, href: `/merchandise/${m.slug}.html`, title: m.name, label: 'Merchandise', accent: '' })),
  ].filter((i) => i.when)
    .sort((a, b) => new Date(b.when) - new Date(a.when))
    .slice(0, 5);

  const auxList = recent.map((it) => `<li>
          <div class="thumb ${it.accent}">${esc(initials(it.title))}</div>
          <a class="aux__item" href="${esc(it.href)}">
            <strong>${esc(it.title)}</strong>
            <small>${esc(it.label)}</small>
          </a>
        </li>`).join('\n        ');

  // Stats ticker — real counts.
  const kennerFigures = releases.filter((r) => r.lines?.slug === 'kenner-super-powers' && r.type === 'figure').length;
  const stats = [
    [characters.length, 'characters'],
    [kennerFigures, 'Kenner figures'],
    [publicationCount, 'comic issues'],
    [merchandise.length, 'merchandise pieces'],
  ];
  const statsLine = stats.map(([n, l]) => `<span><b>${n}</b> ${esc(l)}</span>`).join('\n        ');

  // "Longer reads" — the media articles (screen_media), newest first.
  const essays = screenMedia.slice()
    .sort((a, b) => new Date(b.updated_at ?? 0) - new Date(a.updated_at ?? 0))
    .slice(0, 3);
  const essaysBlock = essays.map((s) => {
    const poster = posterUrl(s.media_assets) ?? PLACEHOLDER;
    const kindLabel = KIND_LABELS[s.kind] ?? titleCase((s.kind ?? 'media').replaceAll('_', ' '));
    const teaser = stripTags(s.description ?? '').slice(0, 150);
    const foot = [titleCase((s.kind ?? '').replaceAll('_', ' ')), s.year].filter(Boolean).join(' · ');
    return `<article class="essay">
          <img class="essay__photo" src="${esc(poster)}" alt="${esc(s.media_assets?.alt_text ?? s.title)}">
          <p class="essay__kicker">In the Media · ${esc(kindLabel)}</p>
          <h3><a href="/media/${esc(s.slug)}.html">${esc(s.title)}</a></h3>
          ${teaser ? `<p>${esc(teaser)}</p>` : ''}
          <div class="essay__foot"><span>${esc(foot)}</span><span>Read →</span></div>
        </article>`;
  }).join('\n        ');

  const essaysSection = essays.length ? `
  <!-- FEATURED ESSAYS -->
  <section class="featured">
    <div class="wrap">
      <div class="featured__head">
        <div>
          <p class="dek">From the archive —</p>
          <h2 class="featured__title">Longer reads</h2>
        </div>
      </div>

      <div class="featured__grid">
        ${essaysBlock}
      </div>
    </div>
  </section>

  <div class="star-bar" aria-hidden="true"></div>
` : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ARCHIVE84 — The DC Super Powers Reference Archive</title>
  <meta name="description" content="Archive84 is a visual reference to the DC Super Powers Collection — the characters, comics, and toys of 1984 and beyond.">
  <link rel="stylesheet" href="/styles.css">
</head>
<body>

  <!-- TOP EDITION STRIP -->
  <div class="strip">
    <div class="wrap strip__inner">
      <span class="strip__brand"><span class="star" aria-hidden="true"></span> ARCHIVE84</span>
      <span>Vol. 1 · Issue 01 · Summer 2026</span>
    </div>
  </div>

  <!-- MASTHEAD -->
  <header class="masthead">
    <div class="wrap">
      <h1 class="wordmark">ARCHIVE84</h1>
      <p class="masthead__dek">
        A visual reference to the <em>DC Super Powers Collection</em> — the characters, comics, and toys that opened the doors on 1984.
      </p>
    </div>
  </header>

  <div class="star-bar" aria-hidden="true"></div>

  <!-- HERO + AUX -->
  <section class="hero-section">
    <div class="hero-grid wrap">

    ${heroBlock}

    <aside class="aux" aria-labelledby="aux-title">
      <p class="dek dek--sm">In this issue —</p>
      <h2 class="aux__heading" id="aux-title">New in the Archive</h2>

      <ul class="aux__list">
        ${auxList}
      </ul>

      <a href="/characters/index.html" class="aux__more">See all additions</a>
    </aside>
    </div>
  </section>

  <!-- PULLQUOTE — closing note (red + blue halftone) -->
  <section class="pullquote pullquote--red" aria-label="Closing note">
    <div class="wrap pullquote__inner">
      <blockquote>Eighteen months of toys. Forty years of memory.</blockquote>
      <cite>Closing note · Vol. 1</cite>
    </div>
  </section>

  <!-- DIRECTORY -->
  <section class="directory">
    <div class="wrap">
      <div class="directory__head">
        <div>
          <p class="dek">In this archive —</p>
          <h2 class="directory__title">The Sections</h2>
        </div>
      </div>

      <nav class="tiles" aria-label="Primary sections">
        <a class="tile" data-accent="blue" href="/characters/index.html">
          <p class="tile__kicker">Character files</p>
          <h3 class="tile__title">Dossiers</h3>
          <p class="tile__desc">Full-page reference on every hero and villain in the Super Powers universe.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="red" href="/characters/index.html">
          <p class="tile__kicker">The roster</p>
          <h3 class="tile__title">Character Index</h3>
          <p class="tile__desc">Sortable by name, wave, allegiance, or debut year. The quickest way in.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="yellow" href="/timeline/index.html">
          <p class="tile__kicker">1984 → present</p>
          <h3 class="tile__title">Timeline</h3>
          <p class="tile__desc">Toy waves, comic issues, and animated appearances on a single scrollable spine.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="red" href="/toys/index.html">
          <p class="tile__kicker">Kenner, 1984–1986</p>
          <h3 class="tile__title">Toy Database</h3>
          <p class="tile__desc">Every figure, vehicle, and playset. Card variants and accessory checklists.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="blue" href="/comics/index.html">
          <p class="tile__kicker">DC Comics tie-ins</p>
          <h3 class="tile__title">Comic Database</h3>
          <p class="tile__desc">The mini-series, cross-overs, and every mini-comic packed with a Kenner figure.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="yellow" href="/media/index.html">
          <p class="tile__kicker">Screen &amp; adaptation</p>
          <h3 class="tile__title">In the Media</h3>
          <p class="tile__desc">The Super Friends cartoons, Kenner TV commercials, and Super Powers home video that carried the line.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="red" href="/merchandise/index.html">
          <p class="tile__kicker">Beyond the figures</p>
          <h3 class="tile__title">Merchandise</h3>
          <p class="tile__desc">Lunchboxes, Underoos, party goods, storybooks, and games — the licensed logo, off the toy aisle.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>

        <a class="tile" data-accent="yellow" href="/search/index.html">
          <p class="tile__kicker">Cross-reference</p>
          <h3 class="tile__title">Search &amp; Filters</h3>
          <p class="tile__desc">Query across every section at once. Wave, publisher, year, allegiance, accessory.</p>
          <span class="tile__arrow" aria-hidden="true">→</span>
        </a>
      </nav>
    </div>
  </section>

  <!-- STATS TICKER -->
  <section class="stats" aria-label="Archive at a glance">
    <div class="wrap">
      <p class="stats__line">
        ${statsLine}
      </p>
    </div>
  </section>
${essaysSection}
  <!-- PULLQUOTE (halftone) -->
  <section class="pullquote" aria-label="Editor's note">
    <div class="wrap pullquote__inner">
      <blockquote>Thirty-four figures. Three waves. One line that made the DC universe holdable.</blockquote>
      <cite>Editor's note · Vol. 1</cite>
    </div>
  </section>

    <div class="star-bar" aria-hidden="true"></div>

  <!-- FOOTER -->
  <footer class="foot">
    <div class="wrap">
      <div class="foot__grid">
        <div>
          <p class="foot__brand">ARCHIVE84</p>
          <p>An independent, fan-compiled visual reference to the DC Super Powers Collection (1984–1986) and its extended universe. Not affiliated with DC, Warner, or Kenner/Hasbro.</p>
        </div>
        <div>
          <h4>Sections</h4>
          <ul>
            <li><a href="/characters/index.html">Dossiers</a></li>
            <li><a href="/characters/index.html">Character Index</a></li>
            <li><a href="/timeline/index.html">Timeline</a></li>
            <li><a href="/toys/index.html">Toy Database</a></li>
            <li><a href="/comics/index.html">Comic Database</a></li>
            <li><a href="/media/index.html">In the Media</a></li>
            <li><a href="/merchandise/index.html">Merchandise</a></li>
            <li><a href="/search/index.html">Search</a></li>
          </ul>
        </div>
        <div>
          <h4>Colophon</h4>
          <ul>
            <li><a href="#">Editorial &amp; corrections</a></li>
            <li><a href="#">Submission guidelines</a></li>
            <li><a href="#">Contributor log</a></li>
            <li><a href="#">Errata</a></li>
          </ul>
        </div>
      </div>
      <div class="foot__legal">
        <span>© MMXXVI · Archive84</span>
        <span>DC characters © DC Comics · Super Powers © respective owners</span>
        <span>Set in Baskerville, Georgia &amp; Futura</span>
      </div>
    </div>
  </footer>

</body>
</html>
`;
}

// ---- timeline -----------------------------------------------------------

// Human labels for the release `type` enum, used on the timeline spine.
const RELEASE_TYPE_LABELS = {
  figure: 'Figure', vehicle: 'Vehicle', playset: 'Playset',
  accessory: 'Accessory', 'mini-comic': 'Mini-comic', other: 'Release',
};

// One scrollable spine: every dated record (toy releases, comic issues, screen
// media) grouped by year, oldest first. Reuses the editorial `.timeline`
// component. Purely static — no data lives client-side.
function renderTimeline(releases, publications, screenMedia) {
  const events = [];
  for (const r of releases) {
    if (!r.release_year) continue;
    events.push({
      year: r.release_year, group: 'toy',
      kind: [r.lines?.name, RELEASE_TYPE_LABELS[r.type] ?? titleCase(r.type ?? 'Release')].filter(Boolean).join(' · '),
      title: r.name, href: `/release/${r.slug}.html`,
    });
  }
  for (const p of publications) {
    if (!p.year) continue;
    events.push({
      year: p.year, group: 'comic',
      kind: KIND_LABELS[p.kind] ?? titleCase((p.kind ?? 'comic').replaceAll('_', ' ')),
      title: p.issue_number ? `${p.title} #${p.issue_number}` : p.title,
      href: `/comics/${p.slug}.html`,
    });
  }
  for (const s of screenMedia) {
    if (!s.year) continue;
    events.push({
      year: s.year, group: 'media',
      kind: KIND_LABELS[s.kind] ?? titleCase((s.kind ?? 'media').replaceAll('_', ' ')),
      title: s.title, href: `/media/${s.slug}.html`,
    });
  }

  const byYear = new Map();
  for (const e of events) {
    if (!byYear.has(e.year)) byYear.set(e.year, []);
    byYear.get(e.year).push(e);
  }
  const groupRank = { toy: 0, comic: 1, media: 2 };
  const years = [...byYear.keys()].sort((a, b) => a - b);

  const items = years.map((y) => {
    const evs = byYear.get(y).sort((a, b) =>
      (groupRank[a.group] - groupRank[b.group]) || a.title.localeCompare(b.title));
    const lis = evs.map((e) => `<li class="timeline__event">
            <span class="timeline__kind" data-group="${e.group}">${esc(e.kind)}</span>
            <a href="${e.href}">${esc(e.title)}</a>
          </li>`).join('\n          ');
    return `<li class="timeline__item">
        <span class="timeline__year">${esc(y)}</span>
        <div class="timeline__body">
          <ul class="timeline__events">
          ${lis}
          </ul>
        </div>
      </li>`;
  }).join('\n      ');

  const span = years.length ? `${years[0]}–${years[years.length - 1]}` : '1984 → present';
  const body = `${indexHead(
    'Timeline',
    '<span class="dossier-tag dossier-tag--yellow">The spine</span>',
    'Timeline',
    'Toy waves, comic issues, and screen appearances on one spine',
  )}

  <section class="dossier-body">
    <div class="wrap">
      <article class="dossier-lede media-lede">
        <p class="dek">Overview</p>
        <p>Every dated record in the archive — ${events.length} across ${years.length} years (${esc(span)}) — laid out oldest to newest. Toy releases, comic issues, and screen appearances share the same spine, so you can see the line unfold season by season.</p>
      </article>
    </div>
  </section>

  <div class="star-bar" aria-hidden="true"></div>
  <section class="dossier-history">
    <div class="wrap">
      <ol class="timeline">
      ${items}
      </ol>
    </div>
  </section>
  <div class="star-bar" aria-hidden="true"></div>`;

  return pageShell({
    title: 'Timeline',
    description: `A chronological spine of the DC Super Powers universe — ${events.length} toy, comic, and screen records from ${esc(span)}.`,
    ogImage: PLACEHOLDER,
    body,
  });
}

// ---- search -------------------------------------------------------------

// Flat, compact index consumed by /js/search.js on the client. URLs are stored
// relative to /search/index.html (one level deep) so they resolve correctly
// wherever the site is mounted — matching the relativize() philosophy, which
// can't reach a JSON file or a fetch() inside a static script.
function buildSearchIndex(characters, releases, publications, screenMedia, merchandise, creators) {
  const kw = (...parts) => parts.flat().filter(Boolean).join(' ').toLowerCase();
  const idx = [];

  for (const c of characters) {
    idx.push({
      t: c.name, u: `../dossier/${c.slug}.html`, g: 'character',
      k: titleCase(c.alignment ?? '') || 'Character', y: '',
      m: kw(c.aka ?? [], c.alignment, c.first_appearance, c.homeworld),
    });
  }
  for (const r of releases) {
    idx.push({
      t: r.name, u: `../release/${r.slug}.html`, g: 'toy',
      k: [r.lines?.name, RELEASE_TYPE_LABELS[r.type] ?? titleCase(r.type ?? 'Release')].filter(Boolean).join(' · '),
      y: r.release_year ?? '',
      m: kw(r.lines?.name, r.series?.name, r.type, r.status, r.region, r.characters?.name),
    });
  }
  for (const p of publications) {
    idx.push({
      t: p.issue_number ? `${p.title} #${p.issue_number}` : p.title,
      u: `../comics/${p.slug}.html`, g: 'comic',
      k: KIND_LABELS[p.kind] ?? titleCase((p.kind ?? 'comic').replaceAll('_', ' ')),
      y: p.year ?? '', m: kw(p.publisher, p.kind, p.language),
    });
  }
  for (const s of screenMedia) {
    idx.push({
      t: s.title, u: `../media/${s.slug}.html`, g: 'media',
      k: KIND_LABELS[s.kind] ?? titleCase((s.kind ?? 'media').replaceAll('_', ' ')),
      y: s.year ?? '', m: kw(s.kind),
    });
  }
  for (const m of merchandise) {
    idx.push({
      t: m.name, u: `../merchandise/${m.slug}.html`, g: 'merch',
      k: MERCH_CATEGORY_LABELS[m.category] ?? titleCase((m.category ?? 'merchandise').replaceAll('_', ' ')),
      y: m.year ?? '', m: kw(m.category, m.manufacturer),
    });
  }
  for (const cr of creators) {
    idx.push({
      t: cr.name, u: `../creators/${cr.slug}.html`, g: 'creator',
      k: 'Creator', y: '', m: kw(cr.role, cr.roles),
    });
  }
  return idx;
}

// The search page: an input + section filters + a results region filled in by
// /js/search.js. Works with JS off via a noscript fallback to the indexes.
function renderSearch(indexCount) {
  const filters = [
    ['all', 'Everything'], ['character', 'Characters'], ['toy', 'Toys'],
    ['comic', 'Comics'], ['media', 'Media'], ['merch', 'Merchandise'],
    ['creator', 'Creators'],
  ];
  const filterBtns = filters.map(([g, label], i) =>
    `<button type="button" class="search-filter${i === 0 ? ' is-active' : ''}" data-group="${g}">${esc(label)}</button>`
  ).join('\n        ');

  const body = `${indexHead(
    'Search',
    '<span class="dossier-tag dossier-tag--red">Cross-reference</span>',
    'Search & Filters',
    'Query every section of the archive at once',
  )}

  <section class="dossier-body">
    <div class="wrap">
      <form class="search-box" role="search" onsubmit="return false">
        <input type="search" id="search-input" name="q" autocomplete="off"
          placeholder="Search ${indexCount} records — characters, toys, comics, media…"
          aria-label="Search the archive">
      </form>
      <div class="search-filters" role="group" aria-label="Filter by section">
        ${filterBtns}
      </div>
      <p class="search-status" id="search-status" aria-live="polite"></p>
      <div class="search-results" id="search-results"></div>
      <noscript>
        <p class="dossier-lede">Search needs JavaScript. Browse the sections directly:
          <a href="/characters/index.html">Characters</a>,
          <a href="/toys/index.html">Toys</a>,
          <a href="/comics/index.html">Comics</a>,
          <a href="/media/index.html">Media</a>,
          <a href="/merchandise/index.html">Merchandise</a>,
          <a href="/creators/index.html">Creators</a>.</p>
      </noscript>
    </div>
  </section>
  <script src="/js/search.js" defer></script>`;

  return pageShell({
    title: 'Search',
    description: `Search the DC Super Powers archive — ${indexCount} characters, toys, comics, media, and merchandise records in one query.`,
    ogImage: PLACEHOLDER,
    body,
  });
}

// ---- main ---------------------------------------------------------------

const [characters, releases, pubsByChar, enemiesByChar, variationsByRelease, screenMedia, merchandise, allPublications, creators] = await Promise.all([
  fetchCharacters(), fetchReleases(), fetchPublicationsByCharacter(), fetchEnemiesByCharacter(),
  fetchVariationsByRelease(), fetchScreenMedia(), fetchMerchandise(),
  rest(`publications?select=*,media_publications(is_primary,sort_order,${MEDIA_EMBED}),publication_creators(role,creators(name,slug)),publication_characters(characters(name,slug))&order=kind.asc,year.asc`).catch(() => []),
  fetchCreators(),
]);

if (!characters.length && !releases.length && !screenMedia.length && !merchandise.length) {
  console.log('Nothing in the database — nothing to build.');
  process.exit(0);
}

await mkdir(join(root, 'dossier'), { recursive: true });
await mkdir(join(root, 'release'), { recursive: true });
await mkdir(join(root, 'media'), { recursive: true });
await mkdir(join(root, 'merchandise'), { recursive: true });
await mkdir(join(root, 'characters'), { recursive: true });
await mkdir(join(root, 'toys'), { recursive: true });
await mkdir(join(root, 'comics'), { recursive: true });
await mkdir(join(root, 'creators'), { recursive: true });
await mkdir(join(root, 'timeline'), { recursive: true });
await mkdir(join(root, 'search'), { recursive: true });

const adjacent = (arr, i) => arr.length > 1
  ? { prev: arr[(i - 1 + arr.length) % arr.length], next: arr[(i + 1) % arr.length] }
  : null;

let written = 0;
let skipped = 0;

for (const [i, c] of characters.entries()) {
  const own = releasesForCharacter(releases, c).sort(releaseOrder);
  const publications = pubsByChar.get(c.id) ?? [];
  const enemyList = enemiesByChar.get(c.id) ?? [];
  const html = renderCharacterPage(c, own, publications, enemyList, adjacent(characters, i));
  if (await writeIfChanged(join(root, 'dossier', `${c.slug}.html`), html)) {
    written++;
    console.log(`built dossier/${c.slug}.html`);
  } else skipped++;
}

for (const [i, r] of releases.entries()) {
  const variations = variationsByRelease.get(r.id) ?? [];
  const html = renderReleasePage(r, variations, adjacent(releases, i));
  if (await writeIfChanged(join(root, 'release', `${r.slug}.html`), html)) {
    written++;
    console.log(`built release/${r.slug}.html`);
  } else skipped++;
}

// Media hub — editorial page (intro + video library) + a page per item
{
  const html = renderMediaHub(screenMedia);
  if (await writeIfChanged(join(root, 'media', 'index.html'), html)) {
    written++;
    console.log('built media/index.html');
  } else skipped++;
}
const screenById = new Map(screenMedia.map((sm) => [sm.id, sm]));
for (const [i, sm] of screenMedia.entries()) {
  const parent = sm.parent_id ? screenById.get(sm.parent_id) : null;
  const html = renderScreenMediaPage(sm, parent, adjacent(screenMedia, i));
  if (await writeIfChanged(join(root, 'media', `${sm.slug}.html`), html)) {
    written++;
    console.log(`built media/${sm.slug}.html`);
  } else skipped++;
}

// Merchandise — index grid + one detail page per piece
{
  const html = renderMerchIndex(merchandise);
  if (await writeIfChanged(join(root, 'merchandise', 'index.html'), html)) {
    written++;
    console.log('built merchandise/index.html');
  } else skipped++;
}
for (const [i, m] of merchandise.entries()) {
  const html = renderMerchPage(m, adjacent(merchandise, i));
  if (await writeIfChanged(join(root, 'merchandise', `${m.slug}.html`), html)) {
    written++;
    console.log(`built merchandise/${m.slug}.html`);
  } else skipped++;
}

// Comic (publication) detail pages — the comic-database cards link here
{
  const releaseById = new Map(releases.map((r) => [r.id, r]));
  for (const [i, p] of allPublications.entries()) {
    const packed = p.packed_with ? releaseById.get(p.packed_with) : null;
    const html = renderPublicationPage(p, packed, adjacent(allPublications, i));
    if (await writeIfChanged(join(root, 'comics', `${p.slug}.html`), html)) {
      written++;
      console.log(`built comics/${p.slug}.html`);
    } else skipped++;
  }
}

// Creator bio pages — comic/toy credits link here
for (const [i, cr] of creators.entries()) {
  const html = renderCreatorPage(cr, adjacent(creators, i));
  if (await writeIfChanged(join(root, 'creators', `${cr.slug}.html`), html)) {
    written++;
    console.log(`built creators/${cr.slug}.html`);
  } else skipped++;
}

// Section index pages — listings the homepage tiles link to
for (const [dir, html] of [
  ['characters', renderCharacterIndex(characters)],
  ['toys', renderToyIndex(releases)],
  ['comics', renderComicIndex(allPublications)],
  ...(creators.length ? [['creators', renderCreatorIndex(creators)]] : []),
]) {
  if (await writeIfChanged(join(root, dir, 'index.html'), html)) {
    written++;
    console.log(`built ${dir}/index.html`);
  } else skipped++;
}

// Timeline — one chronological spine of every dated record
{
  const html = renderTimeline(releases, allPublications, screenMedia);
  if (await writeIfChanged(join(root, 'timeline', 'index.html'), html)) {
    written++;
    console.log('built timeline/index.html');
  } else skipped++;
}

// Search — client-side index (JSON) + the search page that queries it
{
  const index = buildSearchIndex(characters, releases, allPublications, screenMedia, merchandise, creators);
  if (await writeIfChanged(join(root, 'search-index.json'), JSON.stringify(index))) {
    written++;
    console.log(`built search-index.json (${index.length} records)`);
  } else skipped++;
  const html = renderSearch(index.length);
  if (await writeIfChanged(join(root, 'search', 'index.html'), html)) {
    written++;
    console.log('built search/index.html');
  } else skipped++;
}

// Home page — generated from live data (hero, latest additions, stats, reads)
{
  const html = renderHome(characters, releases, screenMedia, merchandise, allPublications.length);
  if (await writeIfChanged(join(root, 'index.html'), html)) {
    written++;
    console.log('built index.html');
  } else skipped++;
}

console.log(`\n${written} written, ${skipped} unchanged (${written + skipped} pages).`);
