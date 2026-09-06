# Components

A catalog of the reusable building blocks already defined in [`styles.css`](styles.css).
Before adding markup or CSS, find the block here and reuse its classes — the site is one
publication authored by several people, and consistency comes from reusing these, not
re-styling. Foundations (tokens, color, type) are in [`STYLE-GUIDE.md`](STYLE-GUIDE.md).

**See it live:** open [`components.html`](components.html) in a browser — it renders every
block below straight from `styles.css`, so it never drifts from reality.

Conventions: BEM-ish naming (`.block__element`, `.block--modifier`), `data-accent`
attributes for color variants on tiles. Snippets below are minimal — copy the *structure*,
fill real content.

---

## Page chrome (every page)

### Edition strip — `.strip`
Thin dark-blue bar at the very top: the brand mark, plus a site search box (`.strip__search`)
right-aligned by `.strip__inner`'s `space-between` — it's the brand's only sibling, so that
alone pushes it to the edge. On subpages the brand is a link home
(`<a class="strip__brand" href="/index.html">`). The search box is a plain GET form to
`/search/index.html`, which already deep-links `?q=` (see `js/search.js`) — no extra JS needed.

```html
<div class="strip">
  <div class="wrap strip__inner">
    <span class="strip__brand"><span class="star" aria-hidden="true"></span> ARCHIVE84</span>
    <form class="strip__search" action="/search/index.html" role="search">
      <input type="search" name="q" placeholder="Search the archive…" aria-label="Search the archive">
      <button type="submit">Search</button>
    </form>
  </div>
</div>
```

### Masthead — `.masthead` / `.wordmark`
The big wordmark block, with the section nav (below). On the home masthead the nav is a row under
the dek; the compact subpage version (`.masthead--compact` + `.wordmark--link`) uses
`.masthead__inner` to sit the wordmark and nav on one row.

```html
<header class="masthead">
  <div class="wrap">
    <h1 class="wordmark">ARCHIVE84</h1>
    <p class="masthead__dek">A visual reference to the <em>DC Super Powers Collection</em>…</p>
    <!-- section nav — see below -->
  </div>
</header>

<header class="masthead masthead--compact">
  <div class="wrap masthead__inner">
    <a href="/index.html" class="wordmark wordmark--link">Archive84</a>
    <!-- section nav — see below -->
  </div>
</header>
```

### Section nav — `.site-nav`
Primary site nav, lives in the masthead. Same one-row layout on every page — home and subpage
masthead alike — wordmark/dek to the left, Futura-uppercase links inline to their right (the home
masthead just top-aligns the nav against the taller title+dek block instead of centering it).
Below 760px links collapse behind a star-icon `Menu` button into a full-width dropdown anchored
to the masthead, its links stretched to fill the dropdown's width (toggled by `/js/nav.js`, which
flips `aria-expanded` on the button — the CSS reveals the menu off that). Keep the
`id="site-menu"` / `aria-controls="site-menu"` pairing so the toggle and the script find each
other. Add `aria-current="page"` to the link for the current section to underline it.

```html
<nav class="site-nav" aria-label="Sections">
  <button class="site-nav__toggle" type="button" aria-expanded="false" aria-controls="site-menu">
    <span class="star" aria-hidden="true"></span>Menu
  </button>
  <ul class="site-nav__menu" id="site-menu">
    <li><a href="/characters/index.html">Characters</a></li>
    <li><a href="/toys/index.html">Toys</a></li>
    <li><a href="/comics/index.html">Comics</a></li>
    <li><a href="/media/index.html">Media</a></li>
    <li><a href="/merchandise/index.html">Merch</a></li>
    <li><a href="/timeline/index.html">Timeline</a></li>
    <li><a href="/search/index.html">Search</a></li>
  </ul>
</nav>
```

Generated pages build this from `siteMenu()` in `build/build-dossiers.mjs` — edit the section
list there, not the emitted HTML.

### Star bar — `.star-bar`
Full-width red row stamped with repeating yellow stars. A section divider. Decorative:

```html
<div class="star-bar" aria-hidden="true"></div>
```

### Footer — `.foot`
Dark-blue footer, 3-column grid (`.foot__grid`): brand blurb, then link columns under
`.foot h4` headings, plus a `.foot__legal` bottom row.

---

## Home page

### Hero + Aux — `.hero-section` (yellow field)
Two-column `.hero-grid`: the featured dossier (`.hero`) and the "New in the Archive"
sidebar card (`.aux`).

- **`.hero`** — `.hero__eyebrow` (with a red `.tag`), `.hero__photo` (21:9), `.hero__title`
  (display, step-5), `.hero__dek`, `.hero__lede` (drop cap), `.hero__meta` (rule-bracketed
  key/value row), `.hero__cta` (blue button, arrow appended, inverts to yellow on hover).
- **`.aux`** — white card. `.aux__heading`, then `.aux__list` of `li` rows, each a real
  56×56 `img.aux__photo` (`object-fit: cover` — the character's headshot, or the best
  available photo for a toy/video/merch item) + `a.aux__item` (`strong` title + `small`
  label), closed by an `.aux__more` link.

```html
<aside class="aux">
  <p class="dek dek--sm">In this issue —</p>
  <h2 class="aux__heading">New in the Archive</h2>
  <ul class="aux__list">
    <li>
      <img class="aux__photo" src="…batman-headshot.png" alt="Batman">
      <a class="aux__item" href="dossier/batman.html">
        <strong>Batman</strong><small>Character Dossier</small>
      </a>
    </li>
  </ul>
  <a class="aux__more" href="#">More additions</a>
</aside>
```

### Directory tiles — `.directory` / `.tiles` / `.tile`
3-up grid of big flat color tiles that link to sections. Color via
`data-accent="blue|red|yellow"`; a giant star bleeds off the corner; whole tile inverts
to blue/yellow on hover.

```html
<a class="tile" data-accent="red" href="toys/">
  <p class="tile__kicker">Section</p>
  <h3 class="tile__title">Toy Database</h3>
  <p class="tile__desc">Every figure, vehicle, and playset.</p>
  <span class="tile__arrow">→</span>
</a>
```

### Stats ticker — `.stats`
One dark-blue line of key numbers, `b` for the yellow figure, `span`s divided by hairlines.

```html
<section class="stats"><p class="wrap stats__line">
  <span><b>34</b> Figures</span><span><b>8</b> Vehicles</span>
</p></section>
```

### Featured essays — `.featured` / `.featured__grid` / `.essay`
Light-blue field with a giant ghost star; 3-up `.essay` cards (white): `.essay__photo`
(4:3 `img`), `.essay__kicker`, `h3` (linked), `p`, `.essay__foot` (mono meta row).

### Pullquote — `.pullquote` (+ `.pullquote--red`)
Full-bleed quote panel with halftone dots. `blockquote` (display, hard offset shadow) +
`cite`. Yellow/orange by default; `--red` flips to red field, blue dots, white type.

---

## Dossier (character) page

### Breadcrumb — `.breadcrumb` / Back link — `.back-link`
Mono uppercase nav. `[aria-current]` dims the current crumb.

### Dossier head — `.dossier-head`
`.dossier-head__tags` row of `.dossier-tag` (`--blue`/`--yellow`/`--red`), then
`.dossier-title` (brand, huge, yellow offset shadow) and italic `.dossier-aliases`.
A tag is a plain `<span>` unless it links somewhere (e.g. a character's team,
to that team's own page) — then it's an `<a class="dossier-tag ...">` with the
same look plus a small lift on hover/focus.

```html
<div class="dossier-head__tags">
  <span class="dossier-tag dossier-tag--blue">Hero</span>
</div>
<h1 class="dossier-title">Superman</h1>
<p class="dossier-aliases">Kal-El · Clark Kent</p>
```

### Dossier body — `.dossier-body` / `.dossier-body__grid`
Two columns: main article (`.dossier-lede`) + `.dossier-sidebar`. Collapses to one column
under 800px. Each main-column section (`.dossier-lede__more`, `.dossier-spec`,
`.release-gallery-block`, `.dossier-about`, `.release-sources`) carries a 2rem margin top
**and** bottom, so the rhythm holds in any order — adjacent margins collapse, so the gap
between two sections stays 2rem instead of doubling. Keep that pair on anything new.

- **`.dossier-lede`** — lead article; first paragraph is enlarged. Rich-text children
  (`h2`–`h4`, `ul`/`ol`, `table`, `blockquote`, `hr`, `a`, `small`) are all styled — this
  is the admin-editor output surface. Same styling applies inside `.dossier-about`.
  - **`.dossier-lede__more`** — an optional second rich-text block under the Overview
    (character `overview_extra`, release `overview_text`). Deliberately plain body-copy
    prose, **not** the enlarged blue lede — wrap it in this div so its paragraphs escape
    the `> p:first-of-type` rule. Carries its own bottom margin so whatever follows
    (the spec block, the About box) sits clear of it.
- **`.dossier-spec`** — yellow "Vital Stats" / "Specifications" block: `.dek` heading + `dl` of `.spec-row`
  (`dt` brand label / `dd` italic value). `dd a` (e.g. the "Created by" creator links)
  is underlined blue → red on hover. `.spec-row--note` is a titleless full-width row
  (`dd` only) for the character `random_fact` aside that closes the list.
- **`.dossier-about`** — off-white bordered biography box; first `h3` gets the red
  underline, inner headings don't.

### Sidebar pieces — `.dossier-sidebar`
Light-blue padded container (`--color-blue-lt`) that stacks: `.power-bubble` (marker-font
Power Action callout over SVG), the framed `.dossier-portrait` (3:4), `.dossier-headshots`
(paired figures), and the `.powers-card`. On mobile (≤800px) the whole sidebar reorders
**above** the main column (`order:-1`) and goes full-bleed — pulled out past the wrap's
gutter with square corners, so its light-blue field runs edge to edge while its own
padding keeps the contents inset. Applies to character, release and creator pages.

- **`.power-bubble`** — tops the sidebar on character pages (the first figure's Power
  Action) and on release pages (that release's own `action_feature`); omitted when there
  is no feature text.

- **`.dossier-portrait-frame`** — wraps `.dossier-portrait` so a slightly-tilted yellow
  field bracketed top & bottom by red star-bars (the star motif) sits behind an upright
  portrait — a comic pin-up backing. Used on character pages and on release pages for the
  loose (out-of-package) figure photo. Creator pages use the frame without its band
  (see `--plain` below).
- **`.dossier-sidebar--plain`** — creator-page modifier: strips the background, border
  and padding off the sidebar asides (`.dossier-spec`, `.dossier-related`) and drops the
  star-bar band behind `.dossier-portrait-frame`, so the whole column — photo included —
  sits directly on the light-blue field instead of reading as separate panels.
- **`.powers-card`** — the fixed 1984 dossier card: red star-frame border (`border-image`),
  `.powers-card__logo` or text `.powers-card__name`, an optional all-caps dark-blue
  `.powers-card__epithet` tagline directly beneath it, then `.powers-card__section` blocks.
  (This card is a constant character-level artifact — see project memory.)

### Figures grid — `.dossier-figures` / `.figures-grid` / `.figure-card`
The releases for this character. `a.figure-card` links to the release detail; the
`.figure-card__flip` does a 3D front/back photo flip on hover/focus (`--back` on the rear
image; `--static` for single-photo cards). Uses `auto-fill` so a lone card stays
card-sized.

```html
<a class="figure-card" href="release/superman-kenner-1984.html">
  <div class="figure-card__flip">
    <img class="figure-card__photo" src="…front.png" alt="Superman, front">
    <img class="figure-card__photo figure-card__photo--back" src="…back.png" alt="card back">
  </div>
  <h3>Superman</h3>
  <p class="figure-card__meta">Kenner · 1984</p>
</a>
```

### Known enemies — `.dossier-enemies` / `.enemies-list` / `.enemy-link`
Wrapped row of red pill links to villain dossiers.

### Related — `.dossier-related` / `.related-list` / `.related-card`
Curated cross-type "see also" block that sits in the **sidebar** of the dossier,
release, media, comic, and creator detail pages. Cards are heterogeneous (a
character, a toy, a comic, a video, a creator) but share one look: a square
thumbnail, a red mono `__kind` kicker, a brand-font `__name`, and an optional
italic `__note`. Backed by the polymorphic `related_items` table; the build
resolves each link against the records it fetched and silently drops any that
don't resolve. Thumbnails are real `<img>` (never `.photo-well`).

```html
<aside class="dossier-related">
  <p class="dek">Related</p>
  <ul class="related-list">
    <li><a class="related-card" href="release/batmobile-kenner-1984.html">
      <img class="related-card__thumb" src="…batmobile.png" alt="Batmobile">
      <span class="related-card__body">
        <span class="related-card__kind">Toy</span>
        <span class="related-card__name">Batmobile</span>
        <span class="related-card__note">Batman's ride</span>
      </span>
    </a></li>
  </ul>
</aside>
```

### History timeline — `.dossier-history` / `.timeline` / `.timeline__item`
Light-blue field; each item is a `year | body` grid (`.timeline__year` red, big brand
numerals). Stacks under 640px.

### Prototypes gallery — `.dossier-prototypes` / `.gallery` / `.gallery__item`
Dark-blue archive section; `.gallery__item` is a `button` opening the lightbox, with a
photo + `.gallery__cap`.

### Comics grid — `.dossier-comics` / `.comics-grid` / `.comic-card`
2:3 cover cards (`.comic-card__photo`) with title + `.comic-card__meta`.

### Dossier pager — `.dossier-pager`
Prev/next yellow blocks (`.dossier-pager__next` right-aligns).

---

## Release (product) page

- **`.release-hero`** — square product shot, `contain` on white pad.
- **`.release-charlink`** — red link back to the character dossier.
- **`.release-sources`** — mono source-URL list.
- **`.dossier-links`** — creator bio-sidebar list of external links (website /
  social / portfolio); `.dek` heading + `ul` of `a`. URLs are stored plain and
  the build derives each label from its domain (Twitter, ArtStation, …).
- **`.release-gallery-block` / `.release-gallery`** — all attached photography;
  `figure` + `figcaption` (mono, truncated), images `contain` on white. On the
  release page the block is headed by a `.dossier-section-head` **h2**
  ("Photography") rather than a `.dek` — merchandise and comic pages still use
  the plain `.dek`. The main column above it runs: **Overview** (`.dek` +
  enlarged lede + a `.dossier-lede__more` body, from the release's
  `overview_lede` / `overview_text`), then the yellow `.dossier-spec`
  **Specifications** block — the same main-column placement the character
  dossier gives its Vital Statistics — then this gallery.
- **Loose figure photo** — the out-of-package ('loose' role) shot at the top of
  the sidebar. Reuses the character page's portrait treatment:
  `.dossier-portrait-frame` wrapping a `.dossier-portrait` image (here a
  lightbox trigger, so it opens the shared release gallery), with the mono
  `Photo: …` credit as a `.dek.dek--sm` line beneath — the figure stands in for
  the character artwork. The linked character's `.powers-card` follows directly
  beneath it (same card as the dossier's — it's a character-level artifact).
- **`.release-manufacturer`** — in the sidebar under the powers card: the LINE's manufacturer
  logo (`__logo`, from `media_lines`) + name (`__name`, not the line name) on a
  white card, both linking to the line's `manufacturer_website` when set.
- **`.release-variations` / `.variation-card`** — documented variants: per-card
  `.variation-card__gallery`, `.variation-card__head` (`h3` + tags), `.variation-card__meta`
  (line/series/year/region/action feature/accessories/card type — whichever the
  variation overrides from its parent release), `.variation-card__values`
  and `.variation-card__notes`. Only variations with *neither* a line nor a
  series tag get the full card here — a tagged one has its own page instead
  (see Line / Series / Team pages below), so showing the full card here too
  would just be duplicated content; instead it's an "Also released as"
  `.figures-grid` of plain teaser tiles beneath the full cards, linking out.

---

## Line / Series / Team pages

Hub pages at `/line/<slug>.html`, `/series/<slug>.html`, `/team/<slug>.html` —
one per row, not a master listing. Built entirely from existing dossier
components, no new CSS beyond the two hover rules noted below:

- Head: `.dossier-head` with a `Line`/`Series`/`Team` tag, `.dossier-title`,
  and a `.dossier-aliases` subtitle (manufacturer/years, or parent line/year).
- Main column (`.dossier-lede`): the row's `overview_lede` + `description` in
  the same enlarged-lede-then-`.dossier-lede__more` shape as the release page's
  Overview. A line page adds a `.credits-list` of its series underneath.
- Sidebar (`.dossier-sidebar--plain`): a `.dossier-spec` box; a line page also
  shows `.release-manufacturer` (the same logo+name block as the release
  page sidebar, via the shared `manufacturerBrandBlock` helper).
- Below the grid: `.dossier-figures` / `.figures-grid` of everything tagged
  with the row — a line's releases (grouped by series/wave, like the Toy
  Database), a series' releases, or a team's member characters (plain
  `.figure-card`s to their dossiers).
- A line or series page can ALSO have its own `.release-variations` /
  `.variation-list` section — a `release_variations` row tagged with that
  line/series directly (not via its parent release), e.g. a foreign
  licensee's rebrand documented as a variation on the original release
  rather than a release of its own ("Superman (Estrela)" on the Kenner
  Superman page, tagged `line_id` = Estrela). Reuses the exact `.variation-card`
  the release page renders — same shared `variationCard()` helper — except
  the heading links back to that parent release, anchored to the card
  (`/release/<slug>.html#var-<slug>`; every variation card carries that id
  now, `text-decoration: none` + underline-on-hover like `.release-manufacturer__name`)
  and an "On `<release>`" line gives it context it wouldn't need on the
  release's own page.
- `.dossier-pager` closes out every one of these pages.

Reached from the release page's Line/Series spec rows and a character's team
tags/spec row, all now links instead of plain text.

---

## Media & merchandise

- **`.media-library`** (alternating bg) / **`.video-grid`** / **`.video-card`** — video
  cards with a 16:9 `.video-card__frame` (iframe or poster), a `.video-card__badge` play
  button, optional `.video-card__pending` chip, then `h3` / `.video-card__meta` /
  `.video-card__desc`.
- **`.media-player`** — detail-page 16:9 embed/poster.
- **`.media-lede`** — narrow single-column intro; **`.media-empty`** — dashed "nothing
  here yet" box.
- **`.merch-section`** — alternating background like the media library.
- **`.toy-wave` / `.toy-wave__head`** — wave sub-headings inside a manufacturer section.

---

## Index rosters

- **`.roster--yellow` / `.roster--blue`** color fields, **`.roster-group`** padding.
  Cards on a roster field (`.roster .figure-card`) render yellow with a red border so
  they read on any background. Bracket a roster top and bottom with `.star-bar`.

---

## Lightbox (shared)

Native `<dialog class="lightbox">` with `.lightbox__inner`, `.lightbox__img`,
`.lightbox__caption`, and `.lightbox__close` / `__prev` / `__next` round controls
(`[hidden]` on prev/next for single-image galleries).

Any image opens it via a **`.lb-trigger`** button wrapper (`.lb-trigger--thumb` sizes to
content instead of full width):

```html
<button class="lb-trigger" aria-label="Enlarge">
  <img src="…" alt="…">
</button>
```

### Prose figure — `.prose-figure`

An image placed inside rich text (via the admin editor's media picker) is stored
as a bare `<img class="lb-trigger" data-gallery="prose" …>` carrying its caption
and credit as `data-caption` / `data-credit`. The static build (`richText()`)
wraps any such image that has a caption or credit in a `.prose-figure` so the
caption shows **inline** under the image — the `<img>` stays a lightbox trigger.
The caption reads as body prose; the credit follows the site's mono `Photo: …`
attribution convention. Images with neither stay bare.

```html
<figure class="prose-figure">
  <img class="lb-trigger" data-gallery="prose" src="…" alt="…"
       data-caption="…" data-credit="…">
  <figcaption>
    <span class="prose-figure__caption">…</span>
    <span class="prose-figure__credit">Photo: …</span>
  </figcaption>
</figure>
```

---

## Reader (mini-comic pages)

Native `<dialog class="reader">` — the same shared-dialog pattern as the
lightbox (`.reader__inner`, round `.reader__close`/`__prev`/`__next`), plus a
page counter and numbered translation pins. Opened by any **`.reader-trigger`**
button instead of `.lb-trigger`, so the two never bind to the same element.

A publication's gallery uses the reader once there's something to page
through — **2+ attached images, or a single image that already carries
translation pins** — and the plain lightbox otherwise (see
`renderPublicationPage` in `build/build-dossiers.mjs`).

```html
<button class="reader-trigger" data-gallery="pub-<slug>"
        data-full="…" data-title="…" data-credit="…" data-caption="…"
        data-source-lang="pt"
        data-captions='[{"n":1,"x":42,"y":18,"translated":"…","original":"…","language":"en"}]'>
  <img src="…" alt="…">
</button>
```

`data-captions` is a JSON array, pre-serialized at build time from
`publication_page_captions` (keyed by that page's `media_id`) so the reader
needs no database call of its own. `x`/`y` are 0–100 percent of the page
image, not pixels — `js/reader.js` positions each `.reader__pin` with an
inline `left`/`top` in that unit, so it survives any display size.
`data-source-lang` carries the publication's own `language` (e.g. `pt` for an
Estrela print), used as the `lang` attribute on a pin's optional original-text
line for correct screen-reader pronunciation.

Pins render directly on the page — there's no separate show/hide-translations
toggle; a page simply has as many pins as it has captions. Clicking, tapping,
or focusing a pin (a real `<button>`, keyboard-reachable) opens a single
shared `.reader__callout` with the translated line and, if present, an
italicized original-language line underneath.

---

## Timeline page (`.timeline` + multi-event years)

The chronological spine at `/timeline/index.html` reuses the editorial
`.timeline` / `.timeline__item` / `.timeline__year` / `.timeline__body`
component (from the dossier "history" section). Each year's body holds a list of
linked events instead of one paragraph:

```html
<ol class="timeline">
  <li class="timeline__item">
    <span class="timeline__year">1984</span>
    <div class="timeline__body">
      <ul class="timeline__events">
        <li class="timeline__event">
          <span class="timeline__kind" data-group="toy">Kenner · Figure</span>
          <a href="/release/superman-kenner-1984.html">Superman</a>
        </li>
      </ul>
    </div>
  </li>
</ol>
```

`.timeline__kind[data-group]` colours the left rule by section:
`toy` (red), `comic` (blue-lt), `media` (yellow-dk). Wrap the `<ol>` in a
`.dossier-history` section, bracketed by `.star-bar`s.

## Search page (`.search-*`)

Client-side search at `/search/index.html`, driven by `/js/search.js` over a
pre-built `search-index.json`. Blocks:

| Class | Purpose |
|---|---|
| `.search-box` + `input[type=search]` | Full-width query field (blue border, yellow focus ring) |
| `.search-filters` / `.search-filter` | Pill toggles per section; `.is-active` = filled red |
| `.search-status` | Mono result count / live region |
| `.search-results` | Column of `.search-result` links |
| `.search-result` | Grid row: `__kind` (mono, coloured by `data-group`) · `__title` · `__year` |

The build (`build/build-dossiers.mjs`) emits the page, the JSON index, and stores
result URLs relative to `/search/` so links resolve under any mount path.

---

## Utilities

| Class | Purpose |
|---|---|
| `.wrap` | Center content at `--page-max` with gutter |
| `.star` (`--white`/`--dark`/`--red`) | Inline star mark (decorative → `aria-hidden`) |
| `.dek` (`.dek--sm`) | Mono uppercase kicker/label |
| `.edition` | Mono edition/date line |
| `.dossier-section-head` | Standard `h2` section header block |
| `.tag` | Small red mono label (in eyebrows) |

> ⚠️ **`.photo-well`** and `.photo-well__mark` exist for legacy support only. Do **not**
> use them for new work — always real `<img>` with `alt` (see
> [`STYLE-GUIDE.md`](STYLE-GUIDE.md#imagery) and [`CLAUDE.md`](CLAUDE.md)).

---

## Admin

The admin (`admin/admin.css`) is deliberately **not** part of this system — plain
`system-ui`, minimal tokens (`--ink`, `--accent`, `--danger`), legibility only. Don't
pull public-site components into it or vice-versa; the design budget goes to the
visitor-facing pages.
