# Archive84 — Roadmap

Working document. Captures section ideas, page inventory, and phasing.
The build order from `CLAUDE.md` is the authoritative "when"; this doc is the
"what."

---

## Current state (2026-07-21)

- **Design system** (partial) — tokens, star pattern, photo-well, star-bar,
  pullquote (yellow + red variants), rounded-box treatment. Lives in
  `styles.css`.
- **Homepage** (`index.html`) — heavily iterated. Sections: strip + masthead,
  red star bar, hero + Latest Additions, tiles, stats ticker, pullquote,
  featured essays, red pullquote, footer.
- **Dossier page** (`dossier.html`) — Superman as demo. Sections: strip +
  compact masthead + star bar, dossier head (breadcrumb, tag chips, title,
  aliases), overview + powers-card (with SUPERMAN logo + red star-frame),
  vital stats callout, About container (smaller reading text), Power Action
  pullquote, Kenner Figures grid, Prototypes & Unreleased gallery (with
  lightbox), Comic Appearances grid, prev/next pager, footer.
- **Backend (Phase 0, in progress)** — hosted Supabase project `archive84`
  (ref `ccdcycgxblebzmpjmili`), schema applied via `supabase/migrations/`,
  RLS on every table (public read / authenticated write), `media` storage
  bucket, lines + Kenner series seeded. DB password in `.env` (keep out of
  any future git repo).
- **Admin** (`admin/`) — auth + list/edit/delete for characters, releases,
  and media; FK relationship pickers; entity-config-driven forms; media
  upload to Storage (credit/rights/alt required at upload) with
  attach/detach/primary flow on characters and releases. Serve via
  `python3 -m http.server 8084`. Still to build: remaining entities
  (config, not code).
- **Pre-render pipeline** — `node build/build-dossiers.mjs` (or `npm run
  build`) generates static `dossier/<slug>.html` per character AND
  `release/<slug>.html` per release from Supabase: content + meta tags in
  the HTML, root-absolute paths, placeholder images until real media is
  attached, prev/next pager on both (characters alphabetical; releases in
  line→year→name order). Figure cards link to their release detail page.
  This settles the pre-render vs. server-render question: **pre-rendered**,
  rebuilt on content change, deployable to shared cPanel as static files.
  The hand-comped `dossier.html` at the root is now the design reference;
  `dossier/superman.html` is the generated real page.
- **Local dev server** — `build/serve.mjs` (Node, zero-dep) serves the tree
  and exposes `POST /api/rebuild`, backing the admin's "Rebuild site" button
  (shows "N updated" / "no changes"). Production stays pure static; rebuild
  is a local/deploy-time step.
- **Incremental build** — the build renders every page (cheap) but only
  *writes* files whose HTML actually changed, so editing one record rewrites
  only its page and the handful that reference it (pager labels, linked
  release pages) — not all 86. Publications are fetched in one grouped query
  rather than one-per-character. NOTE: the project lives in a macOS
  CloudStorage (Dropbox) folder; when Dropbox is mid-sync, file I/O to
  recently-touched files stalls for seconds — that, not the build, is what
  makes rebuild times erratic. Excluding `dossier/`+`release/` from Dropbox
  sync (they regenerate from the DB) removes the variability.
- **Media roles** — `media_characters.role` (gallery|logo|headshot|
  alter_ego). Logo (SVG) replaces the powers-card text name; headshot +
  alter-ego headshot render as a paired strip in the sidebar. Assets still
  flow through media_assets so credit/rights/alt are captured at upload.
  Admin exposes the role as a dropdown per attached asset and on attach.
- **Phase 1 Kenner data (seeded)** — the full line from the reference doc
  via migration `20260721000004`: 35 characters, 51 releases (all 34 retail
  figures incl. mail-away Clark Kent, 8 vehicles + cancelled All-Terrain
  Trapper, Hall of Justice, Collector's Case, Man-Bat + Tower of Darkness
  prototypes, Argentine Riddler as `international_variant`/`variant_of`
  Green Lantern), 26 pack-in mini-comics (incl. 3 Estrela pt), all 15
  mini-series issues with Kirby credits, Kirby/Pérez figure-design credits.
  Fields the reference doesn't vet (S1 villain Power Actions, bios,
  overviews) are deliberately NULL — author work via the admin. 35 dossier
  pages build.
- **Golden record (seeded)** — Superman character (bio, powers, weaknesses,
  vitals), Justice League team link, 6 releases (Kenner 1984 + Series 2/3
  card reissues via `variant_of`, mail-away Clark Kent, Supermobile,
  McFarlane 2022), 5 publications with Kirby credits, García-López
  packaging-art credit. Migration `20260721000002`. Media assets still
  needed — real photos with real credits via the admin.

---

- **Media hub + Merchandise (Phase 2 start, built 2026-07-22)** — two new
  pre-rendered sections. `/media/index.html` ("Super Powers in the Media"): an
  editorial intro (authored in `build-dossiers.mjs`) + a video library grouped
  by `screen_media.kind` (series/commercial/home_video). Each library card is a
  poster that links to its own page `/media/<slug>.html` — the responsive 16:9
  YouTube/Vimeo player (URL normalized by `embedSrc`) up top, a long-form
  article (`description` → paragraphs on blank lines) below, details/attribution
  in the sidebar, pager across items. `/merchandise/index.html` + per-piece
  `/merchandise/<slug>.html`: the licensed non-figure goods (`merchandise`
  table), grouped by category, reusing the figure-card shell. New migration
  `20260721000010` adds a `media_merchandise` join table (merch had no way to
  hold photos), `sort_order` on `merchandise_characters`, and vetted seed rows
  (Super Friends retitles, Kenner TV spots, Warner home video; lunchboxes,
  Underoos, party goods, Which Way books, Mayfair DC Heroes RPG). Admin gains
  Screen media / Interviews / Merchandise tabs (config-only). Homepage directory
  + both footers link the two sections. **Not yet live** — needs
  `supabase db push` then a rebuild to surface the seeded content.

- **Rich text editor (admin, built 2026-07-22)** — long-form fields (character
  overview/bio, release notes, screen-media description, interview body,
  merchandise description) use a zero-dependency editor: a small toolbar (bold,
  italic, H2/H3/H4 headings — H1 reserved for the page title, paragraph,
  bullet/numbered lists, blockquote, horizontal rule, basic table (size prompt;
  Tab moves between cells and appends a row past the last one), small text for
  citations/footers via a `<small>` toggle, link, clear) over a
  `contenteditable`, driven by
  `document.execCommand` (plus a Range-API `wrapSelection` for `<small>`).
  Rich fields render in a plain `<div>`, never a `<label>` — a label forwards
  clicks to its first control (the Bold button), which was toggling bold on
  every click in the editor. On save the HTML is run
  through a tag-whitelist sanitizer (`sanitizeHtml` in `admin.js`: strips
  scripts/handlers/styles, drops `javascript:` hrefs, forces `rel=noopener`,
  normalizes `<div>`→`<p>`), so Postgres holds clean HTML. New admin field kind
  `rich`. The build's `richText()` emits stored HTML directly but falls back to
  `paras()` for legacy plain-text fields (tag sniff), so old records keep
  rendering and open cleanly in the editor as `<p>` blocks. Public CSS styles
  article `h3/h4/ul/ol/blockquote/a` inside `.dossier-lede`/`.dossier-about`,
  with the section's own title scoped to `> h3:first-child` so editor headings
  don't inherit the red underline. This also fixes the earlier
  paragraph-break issue (editor emits real `<p>`s).

- **Homepage generated from the DB (built 2026-07-23)** — `index.html` is now
  produced by `build-dossiers.mjs` (`renderHome`) from live data, not
  hand-authored. Dynamic: the featured hero (Superman/golden record, with real
  portrait, first-figure/power-action/first-appearance, link to its dossier),
  "New in the Archive" (5 most-recently-updated records across
  characters/releases/media/merchandise, each linking to its page), the stats
  ticker (real counts: characters, Kenner figures, comic issues, merchandise),
  and "Longer reads" (the 3 newest `screen_media` articles, replacing the old
  photo-well placeholders with real `<img>`). Static chrome (masthead, section
  tiles, pullquotes, footer) is reproduced verbatim. The hand-authored original
  is preserved as `index.reference.html` (the design reference, like
  `dossier.html`).

- **Section index pages + wired homepage (built 2026-07-23)** — the homepage
  tiles and footer nav now land on real listing pages for everything that
  exists: `/characters/index.html` (roster grouped by alignment → dossiers),
  `/toys/index.html` (all releases grouped by line → release pages, reuses
  `figureCard`), `/comics/index.html` (publications grouped by kind → per-issue
  detail pages `/comics/<slug>.html` via `renderPublicationPage`: cover, spec,
  credits, featured characters, "packed with" release link, pager), plus the
  already-built `/media/` and `/merchandise/`. Record-page breadcrumbs
  ("Dossiers", "Toy Database", "Comic Database") point at these too. Timeline
  and Search tiles remain inert (`#timeline`/`#search`) — no data/implementation
  yet.
  - Both the Character Index and Toy Database use the **roster** treatment: a
    color field bracketed top & bottom by red `.star-bar`s, with yellow,
    red-bordered cards (`.roster .figure-card`). Character Index field is blue
    (`.roster--blue`, groups by alignment: Heroes / Allies / Villains); Toy
    Database field is yellow (`.roster--yellow`, nests **manufacturer → wave** —
    Kenner Series 1/2/3 then a no-series "Other" last, McFarlane likewise, wave
    sub-heads via `.toy-wave__head`).
  - Comic cards everywhere (index + dossier "Comic Appearances") now link to
    the new per-issue pages.

## Character Dossier — additional sections to build

Grouped by intent. Rough order = priority within each group.

### Collector-technical (MOC nerds)

- **Prototypes** — unreleased test-shots (Man-Bat, Tower of Darkness). High
  priority: on-brand for the DC Super Powers line specifically.
- **International Variants** — Argentine Riddler, PBP Estrela (Brazil),
  Croner (Chile).
- **Card Back Variants** — Series 1 vs. 2 vs. 3 backs, mail-away offers on
  reverse.
- **Accessories & Mini-Comic** — packed-in comics, Kenner catalogs, capes.
- **Mail-Away Offers** — Clark Kent mail-away, gold-shield, etc.
- **Point-of-Purchase Displays** — in-store Kenner cardboard signage.
- **Sculptor / Designer Credits** — who at Kenner sculpted, painted, packaged.
- **Common Damage / Repair Guide** — cracked crotches, missing capes,
  restoration tips.
- **Loose vs. MOC Pricing** — rarity price bands, auction data.
- **Bootlegs & Fakes** — knockoff spot guide.
- **Factory Codes / Country of Origin** — Hong Kong, Macao, Mexico plate
  markings.

### Media / adaptation

- **Screen Appearances** — Super Friends, Superman '78, animated series,
  Snyderverse.
- **Iconic Storylines** — Death of Superman, All-Star Superman, Red Son,
  Kingdom Come.
- **Costume Evolution** — visual timeline of costume changes over 80+ years.
- **Alternate Versions** — Bizarro, Injustice, Elseworlds.
- **Voice / Live-Action Cast** — George Reeves through Corenswet.
- **Cereal Box / Cross-Promotion** — Super Powers cereal, Pizza Hut,
  McDonald's tie-ins.
- **Comic Runs** — post-Crisis, Byrne era, New 52, Rebirth (a "where to
  start" guide).

### Editorial / narrative

- **History / Origin** — publishing history + key eras (Golden → Bronze →
  Modern).
- **Ad Gallery** — vintage Kenner TV spots, magazine ads.
- **Behind the Scenes** — Kirby's design sketches, Kenner concept art.
- **Notable Quotes** — memorable lines from comics, ads, cartoons.
- **Fan Corner** — collector stories, restoration projects, custom builds.
- **Contributor Notes** — who wrote/researched this dossier.

### Meta / navigation

- **Related Characters** — small linked cards for allies/enemies.
- **See Also** — cross-links to related characters, comics, waves.
- **All Appearances Index** — comprehensive checkbox list.
- **Sources / Bibliography** — where the facts come from.
- **Errata** — corrections, updates, community-flagged issues.
- **Last Updated / Contributor Log** — trust signal for a fan-compiled
  reference.
- **Trivia / Notes** — collector minutiae, easter eggs.
- **Rarity & Value** — for the collector tools phase.

### Interactive (later phase)

- **My Collection** — mark which variants you own.
- **Wantlist** — mark what you're hunting.
- **Discussion / Comments** — collector forum thread link.

### Top picks for next design iteration

**Prototypes** (photo-well grid variant + short editorial notes) — most
on-brand next step. Then **Ad Gallery** (great visual section, another
photo-well pattern) and **Iconic Storylines** (an editorial rhythm break
from all the grids). **See Also** small linked cards would round it out.

---

## Other pages to build

From the original brief:

- **Design System documentation page** — tokens, components, patterns.
  Currently only lives as CSS.
- **Character Index** — sortable roster; alphabet or wave-scoped.
- **Timeline page** — 1984 → present, waves + comics + screen appearances
  on one scrollable spine.
- **Toy Database** — every figure, vehicle, playset. Filters: wave, region,
  status (standard / prototype / international variant).
- **Comic Database** — Super Powers mini-series + tie-ins + every packed-in
  mini-comic.
- **Search & Filters** — cross-section query interface.

---

## Phases (from CLAUDE.md)

- **Phase 0 — Golden Record** *(current)* — schema + admin CRUD, populate
  Superman completely as the model-validation exercise.
- **Phase 1 — Kenner MVP** — 34 figures, 8 vehicles, Hall of Justice,
  prototypes (Man-Bat, Tower of Darkness), international variants.
- **Phase 2 — Media & Editorial** — artwork galleries, video library,
  creators + interviews, comics/print, licensing, history timeline.
- **Phase 3 — McFarlane line** — mostly data entry; model already supports
  it.
- **Phase 4 — Collector tools** — checklists, want lists, rarity/value
  views.

---

## Design deferred

- **Powers-card border** — currently a proper 9-slice `border-image` with a
  base64 SVG source; polygons match the header star-bar's proportions. Works
  but the source is verbose. If we ever need to change the frame width or
  swap the polygon shape, easiest path is to regenerate the SVG via a small
  script rather than hand-edit the base64.
- **Photo well** — subtle diagonal-stripe placeholder; real product
  photography drops in as `<img>` children when available.
