# Style Guide

The visual foundations for the public site — colors, type, spacing, and the rules
that keep multiple authors' pages looking like one publication. Everything here is
already implemented in [`styles.css`](styles.css) as CSS custom properties and base
rules. **Use the tokens; don't hardcode values.** Component-level patterns live in
[`COMPONENTS.md`](COMPONENTS.md).

> The working codename in the CSS/markup is **ARCHIVE84**. The public name is still
> unsettled (see [`CLAUDE.md`](CLAUDE.md)) — this guide describes the *look*, which is
> stable, not the name, which isn't.

---

## Design intent

Editorial-magazine bones with Kenner toy-card color energy. Think a well-set reference
magazine that happens to be printed in the loud, flat, five-color palette of a 1984
action-figure card back. Serif headlines and running text carry the "reference"
authority; the flat brand colors, chunky sans titles, and star motifs carry the "toy"
energy.

---

## Color

Five brand colors **only**. Black is reserved for illustration/photography — it is not
a UI color. Body ink is dark blue, never black.

| Token | Value | Role |
|---|---|---|
| `--color-blue-lt` | `#4EB6E3` | Light-blue surfaces (masthead, section fields) |
| `--color-blue` | `#33327A` | **Body ink**, dark surfaces (strip, footer, stats), primary type |
| `--color-red` | `#EE4C41` | Accent, tags, CTAs-on-hover, section dividers |
| `--color-yellow` | `#FBEC3E` | Highlight surfaces, hero section, hover reveals |
| `--color-white` | `#F4F4EE` | Page background (warm off-white, not pure white) |

Supporting shades (use sparingly — shadows, halftones, hovers):
`--color-blue-dk` `#232265`, `--color-red-dk` `#B93A31`, `--color-yellow-dk` `#D6C830`,
`--color-orange` `#EE9B2E`.

Semantic aliases — **prefer these in component CSS**:

- `--color-ink` → body text (= dark blue)
- `--color-ink-mid` `#55547E` → secondary/caption text
- `--color-rule` `#D6D6DE` → hairline borders and dividers

**Rules**

- Never introduce a sixth hue or a hex value that isn't a token.
- Never use `#000`/black for text or UI. Dark blue is the "black."
- Selection color is yellow-on-ink (already set globally).
- Color-field sections alternate `--color-white` / `--color-blue-lt` / `--color-yellow`
  down the page; dark-blue sections are used for emphasis breaks (stats, prototypes).

---

## Typography

Five families, each with a fixed job. Don't mix these roles.

| Token | Stack | Used for |
|---|---|---|
| `--font-brand` | Futura → Trebuchet MS → Helvetica Neue → Arial | Wordmark, tile/card titles, spec labels — chunky card-back energy |
| `--font-display` | Futura → Arial Black → Impact | Big editorial headlines & deks (hero title, pullquotes) |
| `--font-body` | Georgia → Times New Roman → serif | Running body copy, ledes, article text |
| `--font-mono` | IBM Plex Mono → Courier New | Kickers, labels, eyebrows, tags, captions, edition marks |
| `--font-marker` | Balloon Extra Bold (self-hosted) → Marker Felt → Comic Sans MS | Only the Power Action speech bubble |

### Type scale (fluid, `clamp`-based)

Use the step tokens — never a raw `rem`/`px` font-size for display text.

| Token | Range | Typical use |
|---|---|---|
| `--step--2` | 0.68–0.72rem | micro labels: kickers, figcaptions, card meta |
| `--step--1` | 0.75–0.85rem | secondary captions, fine print |
| `--step-0` | 0.95–1.05rem | body copy (base) |
| `--step-1` | 1.1–1.35rem | ledes, sub-headers |
| `--step-2` | 1.4–1.9rem | card titles, section subheads |
| `--step-3` | 1.6–2.25rem | section titles |
| `--step-4` | 2–3.25rem | masthead wordmark |
| `--step-5` | 2.75–5rem | hero titles |
| `--step-6` | 2.75–5.5rem | dossier marquee title (`.dossier-title`) |

### Voice conventions (how the roles read on the page)

- **Kickers / eyebrows / labels / tags / captions:** mono, uppercase, letter-spaced
  `0.1–0.18em`, weight 700. This is the connective tissue — it appears everywhere small
  text labels something. See `.dek`, `.edition`.
- **Titles:** brand or display sans, `font-weight: 900`, uppercase, tight tracking
  (negative letter-spacing), line-height ~0.9–1.
- **Body / ledes / article text:** Georgia, line-height 1.5–1.7, sentence case.
- Drop caps (`::first-letter`) appear on the hero lede and masthead wordmark — an
  editorial flourish, used deliberately, not everywhere.

---

## Layout & spacing

| Token | Value | Meaning |
|---|---|---|
| `--page-max` | `1240px` | Max content width; wrap with `.wrap` |
| `--gutter` | `clamp(1rem, 2.5vw, 2.5rem)` | Horizontal page padding |
| `--radius` | `6px` | The one corner radius — cards, tiles, tags, photos |

- **`.wrap`** centers content at `--page-max` with gutter padding. Every full-width
  color-field section holds its content in a `.wrap`.
- Section vertical rhythm is `clamp(2rem, 4vw, 3.5rem)`–ish `padding-block` — match
  neighboring sections rather than inventing new spacing.
- One radius everywhere (`--radius`). Nested elements use `calc(var(--radius) - 2px)`.
  Circles (lightbox controls, video badge) are the only exception.

---

## Motifs

- **Star** — the house mark. Yellow five-point star, rendered as a CSS `mask` (no
  external asset). Inline as `.star` (with `--white` / `--dark` / `--red` variants), as a
  repeating `.star-bar` row, as the mobile nav toggle icon, or as a giant bleed
  decoration behind sections/tiles.
- **Halftone dots** — orange (or blue) radial-gradient dot field with a diagonal mask,
  used on pullquotes.

---

## Imagery

- **Always real `<img>` tags** with a real `src` and descriptive `alt`. Never ship the
  `.photo-well` colored-block placeholders (see the non-negotiable in
  [`CLAUDE.md`](CLAUDE.md)). When a specific photo doesn't exist yet, reuse the current
  Superman placeholder URL so sizing stays truthful.
- Product shots use `object-fit: contain` on a white pad (they're cut-outs); portraits
  and banners use `object-fit: cover`.
- Every image carries a `credit`/`rights`/`alt` per the media-attribution rule.

---

## Accessibility

- Interactive elements get a visible focus ring: `outline: 3px solid var(--color-blue);
  outline-offset: 2px`. Keep it — don't remove focus styles.
- All motion (card flips, hover lifts, transitions) is wrapped so it collapses under
  `@media (prefers-reduced-motion: reduce)`. Any new animation must do the same.
- Decorative elements (`.star`, `.star-bar`, background motifs) carry
  `aria-hidden="true"`.
- Contrast: yellow text on dark blue and dark blue on yellow/light-blue are the vetted
  pairings. Don't put light-blue type on white or yellow on white.

---

## Adding to the system

1. Reach for an existing component ([`COMPONENTS.md`](COMPONENTS.md)) before writing new
   CSS.
2. If you must add CSS, use the tokens above — no raw hexes, no raw font sizes for
   display text, no new radius.
3. Add it to `styles.css` under a commented `/* ---------- NAME ---------- */` section,
   matching the file's existing structure, and document it in `COMPONENTS.md`.
4. Controlled vocabularies (statuses, tags, categories) are enums/lookups in the DB, not
   free text — the same discipline the data model uses.
