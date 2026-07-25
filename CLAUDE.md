# The Super Powers Project

An archive/reference site for the **Kenner Super Powers Collection (1984–86)** and the
**McFarlane DC Super Powers** line (2022–present): figures, vehicles, playsets, prototypes,
artwork, comics, screen media, licensing, and creator interviews.

*"The Super Powers Project" is a working name — the public name is unsettled and needs a
trademark pass. Don't bake the name into slugs, table names, or anything expensive to change.*

---

## Stack

- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Front end:** vanilla JS / HTML / CSS — no framework
- **Admin:** hand-built, part of this project
- **Hosting:** TBD. Existing shared cPanel can serve the static front end;
  Supabase is hosted. (Shared cPanel can't run a persistent Node process.)

---

## The one architectural rule

**`characters` (canonical DC identity) is separate from `releases` (physical product).**

"Batman" is one character; "Batman • Kenner • 1984" and "Batman • McFarlane • 2022" are two
releases pointing at it. This is what makes cross-line character pages work automatically and
lets prototypes/variants be `releases` rows with a `status`/`region` flag rather than special
cases. Don't collapse these.

---

## Data model

See `schema.sql`. Core tables:

`lines` → `series` → `releases` → `characters`, plus `creators`, `media_assets`,
`artwork`, `publications`, `screen_media`, `interviews`, `merchandise`.

Relationships use explicit join tables with real FKs (`media_releases`, `release_creators`, etc.)
rather than a generic polymorphic pair — the point is that the **database** enforces integrity,
since multiple authors will be entering densely cross-linked records.

**Access model:** public reads everything; authenticated co-authors write everything.
No draft/approval workflow — this is a deliberate "trust everyone, publish direct" decision.

---

## Non-negotiables (expensive to retrofit)

1. **Media attribution is captured at upload.** `media_assets.credit` and `rights` are NOT NULL.
   Much of the best material is other collectors' photography and DC/Hasbro/McFarlane IP —
   thousands of un-attributable assets is the failure mode to design against.
   `alt_text` also gets captured at upload (a11y + SEO).
2. **Controlled vocabularies are enums/lookups, not free text** — or multi-author tagging
   sprawls into "villain / villains / bad guy".
3. **Slugs are stable and human-readable** (`cyborg-kenner-1986`) — they're public URLs.
4. **Search is the product.** Collectors arrive Googling "kenner super powers cyborg prototype".
   Record pages need their content in the HTML and real meta tags — this is why the front end
   is pre-rendered or server-rendered, not a client-only SPA.

---

## Build order

**Phase 0 — golden record (current).**
Schema + admin CRUD, then populate **one character (Superman) completely**: character, its
Kenner + McFarlane releases, a vehicle, artwork, media with credits, sources. Validate the model
against real content before scaling data entry.

**Phase 1 — Kenner MVP.** 34 figures, 8 vehicles, Hall of Justice, prototypes (Man-Bat, Tower of
Darkness), international variants (the Argentine Riddler — a `releases` row with
`region='AR'`, `status='international_variant'`, `variant_of` → Green Lantern).

**Phase 2 — media & editorial.** Artwork galleries, video library, creators + interviews,
comics/print, licensing, history timeline.

**Phase 3 — McFarlane line.** Mostly data entry; the model already supports it.

**Phase 4 — collector tools.** Checklists, want lists, rarity/value views.

---

## Admin: what to build

The admin is the risk on this path — it's the one thing WordPress would have given us free,
and it produces zero visitor-facing value, so keep it lean and don't gold-plate it.

Priority order:
1. Auth (Supabase Auth, email invite for co-authors)
2. List + create/edit for `releases` and `characters` (everything else can wait)
3. **Relationship pickers** — searchable selects backed by FKs. Never hand-typed IDs.
4. **Media: upload → Supabase Storage → attach.** Required credit/rights/alt on upload.
   A basic browse-and-pick grid. This is the biggest single chunk of work.
5. Remaining entities

---

## Front-end design system

The public site has one design system, already implemented in `styles.css` (a
token-driven, component-organized stylesheet). **Before writing any front-end markup or
CSS, read these and reuse what's there — don't reinvent or hardcode:**

- **`STYLE-GUIDE.md`** — foundations: the five-color palette + tokens, the four type
  families and the fluid step scale, layout tokens (`--page-max`, `--gutter`, `--radius`),
  voice conventions, motifs (star / stripe / halftone), imagery and accessibility rules.
- **`COMPONENTS.md`** — catalog of every reusable block (`.strip`, `.masthead`, `.hero`,
  `.tile`, `.figure-card`, `.dossier-*`, `.powers-card`, `.lightbox`, media/roster cards,
  utilities) with copy-paste markup.
- **`components.html`** — the **live pattern library**: open it in a browser to see every
  component rendered straight from `styles.css`. It's the fastest way to eyeball a block,
  and if something looks wrong there it's wrong on the site. Internal reference only
  (`noindex`), not a public page.

Rules of the road: use the CSS custom-property tokens (no raw hexes, no raw font-sizes
for display text, one `--radius`); reach for an existing component before adding CSS; if
you must add CSS, put it under a commented section in `styles.css` and document it in
`COMPONENTS.md`. The `admin/` styles are intentionally outside this system — keep them
plain.

---

## Conventions

- Vanilla JS, no build framework. Keep dependencies few and justified.
- **Front end follows the design system — see `STYLE-GUIDE.md` + `COMPONENTS.md`.** Use
  tokens, reuse components, no ad-hoc hexes or font sizes.
- Postgres enums for controlled vocab; `ALTER TYPE ... ADD VALUE` to extend.
- Every table: uuid pk, unique slug, `created_at`/`updated_at` (trigger-maintained).
- Front end reads via the Supabase JS client (anon key, RLS-protected).
- Image derivatives: Supabase Storage transforms, or generate on upload. Originals stay
  out of the served path.
- **Never use the `.photo-well` figure placeholders** (colored blocks with a `.photo-well__mark`
  letter/number inside). Always use real `<img>` tags with a placeholder URL and descriptive
  `alt` text — even during design comping — so real photography drops in cleanly and the
  layout is truthful about image sizing from the start. When we don't yet have a specific
  photo, reuse the current Superman placeholder URL as a stand-in.

---

## Reference

`Kenner-Super-Powers-Collection-Reference.md` has the full vetted Kenner content —
every figure, vehicle, action feature, year, rarity, and the media/licensing history.
That's the Phase 1 seed data.
