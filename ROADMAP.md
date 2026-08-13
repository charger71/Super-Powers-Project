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
  - **Update (2026-07-25): both are now built** — see the Timeline + Search entry
    below. The tiles are live.
  - Both the Character Index and Toy Database use the **roster** treatment: a
    color field bracketed top & bottom by red `.star-bar`s, with yellow,
    red-bordered cards (`.roster .figure-card`). Character Index field is blue
    (`.roster--blue`, groups by alignment: Heroes / Allies / Villains); Toy
    Database field is yellow (`.roster--yellow`, nests **manufacturer → wave** —
    Kenner Series 1/2/3 then a no-series "Other" last, McFarlane likewise, wave
    sub-heads via `.toy-wave__head`).
  - Comic cards everywhere (index + dossier "Comic Appearances") now link to
    the new per-issue pages.

- **Timeline + Search (built 2026-07-25)** — the last two inert homepage tiles now
  land on real pages, both pre-rendered by `build-dossiers.mjs`.
  - `/timeline/index.html` (`renderTimeline`): one chronological spine of every
    dated record — toy releases (`release_year`), comic issues (`publications.year`),
    and screen media (`screen_media.year`) — grouped by year, oldest first, reusing
    the editorial `.timeline` component with a new `.timeline__events` list (left
    rule coloured per section via `.timeline__kind[data-group]`). Static, no client
    JS. Currently 92 events across 1984–2022.
  - `/search/index.html` (`renderSearch`) + `search-index.json` (`buildSearchIndex`)
    + `/js/search.js`: client-side search over a pre-built JSON index (no server —
    fits the static/cPanel constraint). Full-text ranking (title-prefix > title >
    keywords; every term must match), section filter pills (characters/toys/comics/
    media/merch/creators), `?q=` deep links, browsable when the query is empty.
    Index URLs are stored relative to `/search/` so they resolve under any mount
    path — the JSON and its `fetch()` can't be reached by `relativize()`. 145
    records indexed. New `.search-*` CSS documented in COMPONENTS.md.
  - Homepage tiles + both footers (`renderHome`, `pageShell`) now link the two
    pages instead of `#timeline`/`#search`.

  This effectively closes the "Other pages to build" list — Character Index, Toy
  Database, Comic Database, Timeline, and Search are all live. **Admin entity
  coverage is also complete** (characters, releases, variations, comics, screen
  media, interviews, merchandise, creators, media); only rarely-edited structural
  lookups (lines / series / teams) remain hand-seeded, by choice.

- **News & articles (built 2026-08-13)** — the editorial section, pre-rendered at
  `/news/index.html` (reverse-chronological feed) + `/news/<slug>.html` per post,
  via `renderArticleIndex` / `renderArticlePage`. Migration `20260813000001`.
  - **One table, not two.** `articles` with an `article_kinds` lookup
    (news / feature / guide) rather than separate news and article tables — a
    dated blurb and a long-form feature differ in length and cadence, not shape.
    Same call `publications` and `screen_media` already make with their kinds.
  - **Bylines are `editors`, a new table — deliberately NOT `creators`.**
    `creators` means real-world comic people (Kirby, Pérez, García-López), and
    site staff in there would surface in "Created by" credits. `editors` is also
    deliberately not tied to `auth.users`: that table isn't readable with the
    anon key the build uses, so a byline sourced from it could never render.
    Public-safe columns only — display name, slug, bio. No email.
  - **Scheduling is enforced in RLS, not in the build.** `published_at` is
    `not null default now()` (writing a post publishes it — the "publish direct"
    model); a future timestamp holds it back. `articles` is the one table held
    out of the blanket `public read using (true)` loop, because the build and the
    front end both read via the anon key — a blanket policy would serve
    tomorrow's post to anyone hitting `/rest/v1/articles` today, making
    scheduling cosmetic. Authenticated co-authors still see everything.
    **Consequence:** a scheduled post goes live on the next *rebuild* after its
    timestamp passes, not at the timestamp. With CI on a nightly 07:00 UTC cron,
    that is the effective granularity — raise the cron frequency if scheduling
    needs to be tighter than a day.
  - Homepage **"Longer reads" now comes from `articles`**, not `screen_media` —
    screen_media had been doing double duty as an article store before this
    existed, and is now just the video library. New homepage tile, both footers,
    site nav, and the search index/filters all carry the section
    (`g: 'article'`). Reuses the existing `.essay` component: no new CSS.
  - `article` is registered in `entity_types`, so posts can be either side of a
    curated "Related" link.

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

## Planned: Collecting Super Powers — a collector's guide

**Why.** "Search is the product" (`CLAUDE.md`) — collectors arrive Googling
"kenner super powers cyborg prototype" and "argentine riddler value". Right now
the collector-technical material is scattered across the *Character Dossier →
Collector-technical* bullets (prototypes, card-back variants, loose vs. MOC
pricing, bootlegs, factory codes) and the reference doc's *Collecting Notes*.
A single, editorial **guide** consolidates that into the on-ramp the hobby
actually needs: one place that explains the line, what's hard to get, what to
watch for, and how to grade condition — before a newcomer wanders into a
$2,000 Argentine Riddler blind. High SEO value; low data cost (mostly authored
prose over records that already exist).

**What (feature).** A pre-rendered guide at `/guide/index.html` (candidate slug —
"guide" is generic and cheap to change per the naming caution in `CLAUDE.md`),
built by `build-dossiers.mjs` like the other section indexes, static, no client
JS. Long-form editorial reusing the existing `.dossier-*` article treatment and
the rich-text article CSS; figure/roster cards link out to the real release and
character pages so the guide stays a *view over the data*, not a fork of it.

**Structure (draft outline).**

1. **Start here — what the line is.** The three-series arc (1984 → cancelled
   Feb 1986), the ~4.5" scale (not the oft-misreported 3¾"), the spring "Power
   Action" gimmick the line is named for. Links to the Timeline.
2. **The waves at a glance.** Series 1 "greatest hits" (12 figures) → Series 2
   Kirby New Gods wave + mail-away Clark Kent → the rare Series 3 (Cyborg and
   Mister Miracle the toughest US cards). Roster cards → the Toy Database.
3. **Grails & what's hard.** Argentine Riddler (~$2–3k, the ultimate get),
   Series 3 carded figures, complete boxed Hall of Justice, the poorly-selling
   Series 2 vehicles (Boulder Bomber, Darkseid Destroyer). Links to those
   release pages.
4. **Condition & completeness.** The spring leg-action mechanisms wearing loose
   (Flash, Aquaman especially); capes/weapons/armor and pack-in mini-comics
   swinging value; loose vs. MOC. Feeds the dossier "Common Damage / Repair
   Guide" and "Loose vs. MOC Pricing" items.
5. **Watch-outs — variants, bootlegs, and origins.** International variants as a
   rabbit hole (Estrela/Brazil, Pacipa/Argentina, Colombian "Super Heroes"),
   bootlegs & fakes, factory codes / country-of-origin markings.
6. **Sub-hobbies.** Pack-in mini-comics (their own checklist), prototypes &
   never-produced items (Man-Bat, Tower of Darkness, All-Terrain Trapper).
7. **Where to go deeper.** The vetted external archives from the reference doc
   (Jason Geyer's Super Powers Archive / ToyOtter, kennersuperpowers.com, the
   Super Friends Wiki), clearly marked as outside resources.

**Data notes.**
- Mostly authored prose. The vetted facts live in
  `Kenner-Super-Powers-Collection-Reference.md` (*Collecting Notes*, *Series*
  tables, *International Variants*, *Never Produced*) — the guide is the
  editorial synthesis of that material, cross-linked to records.
- Where the guide cites specific pieces (Riddler, Hall of Justice, Cyborg), it
  links to their existing release/character pages rather than restating specs —
  keeps prices/rarity in one place as the collector-tools phase fills them in.
- Rarity/value bands are **Phase 4** territory (collector tools). Until then the
  guide talks in relative terms ("the rarest wave", "condition-sensitive") and
  defers hard numbers, so it doesn't go stale as a price list.
- Homepage directory + footers get a "Collecting" entry once the page exists;
  any new CSS goes under a commented section in `styles.css` and into
  `COMPONENTS.md`, per the rules of the road.

**Scope note.** Editorial content, not infrastructure — slot it into Phase 2
(Media & Editorial) as a natural companion to the history timeline, with the
Phase 4 hooks (real rarity/value) left as links to fill in later.

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

## Planned: revision history (edit tracking)

**Why.** The access model is deliberately "trust everyone, publish direct" — no
draft/approval workflow (see `CLAUDE.md`). That's the right call for velocity,
but as co-authors grow it needs a safety net: **accountability and undo, not
gatekeeping.** With multiple people writing densely cross-linked records
straight to production, we want to see who changed what and when, and be able to
roll a bad or accidental edit back — without slowing anyone down at write time.

**What (feature).**
- Per-record **history panel** in the admin editor: a timeline of every save —
  editor, timestamp, and a field-level diff (before → after).
- **Revert**: one click restores a previous version (applied as a *new* revision,
  so history is append-only and nothing is ever silently lost).
- Public-facing trust signals can read from this later — it's the backend behind
  the dossier "Last Updated / Contributor Log", "Errata", and "Contributor
  Notes" items already listed under *Character Dossier → Meta / navigation*.

**Sketch (not committed).**
- An append-only `record_revisions` audit table: `table_name`, `row_id`,
  `editor` (auth uid), `changed_at`, and the old/new row as `jsonb` (field-level
  diff derivable from the pair). Populated by a **Postgres trigger** on each
  content table so *every* write path is captured and it can't be bypassed from
  the client. RLS: co-authors read; inserts only via the trigger.
- Open questions: how join-table edits (relationships/media attach-detach) are
  represented; retention/pruning for high-churn records; whether to diff at the
  field level in SQL or in the admin; surfacing "last edited by" in list views.
- Scope note: this is infrastructure, not a phase gate — slot it in once the
  co-author count makes it worth the trigger maintenance.

---

## Design deferred

- **Powers-card border** — currently a proper 9-slice `border-image` with a
  base64 SVG source; polygons match the header star-bar's proportions. Works
  but the source is verbose. If we ever need to change the frame width or
  swap the polygon shape, easiest path is to regenerate the SVG via a small
  script rather than hand-edit the base64.
- **Photo well** — subtle diagonal-stripe placeholder; real product
  photography drops in as `<img>` children when available.
