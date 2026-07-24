# The Super Powers Project

An archive and visual reference to the **Kenner Super Powers Collection (1984–86)**
and the **McFarlane DC Super Powers** line (2022–present): figures, vehicles,
playsets, prototypes, artwork, comics, screen media, licensing, and creator
interviews.

> *"Archive84" is the current working name; the public name is unsettled.*
> Not affiliated with DC, Warner, or Kenner/Hasbro.

---

## Stack

- **Backend:** [Supabase](https://supabase.com) — Postgres + Auth + Storage + RLS
- **Front end:** vanilla JS / HTML / CSS — no framework, few dependencies
- **Rendering:** pages are **pre-rendered** to static HTML from the database
  (content + meta tags land in the HTML, because search is the product), then
  served as plain static files
- **Admin:** a hand-built, config-driven CRUD app (part of this repo)

The one architectural rule: **`characters` (canonical DC identity) is separate
from `releases` (physical product)** — "Batman" is one character; the 1984 Kenner
and 2022 McFarlane Batmen are two releases pointing at it. See `CLAUDE.md`.

---

## Layout

```
schema.sql                  Full Postgres schema (reference)
supabase/migrations/        Applied migrations (source of truth for the DB)
js/config.js                Supabase URL + publishable key (safe to ship)
build/build-dossiers.mjs    Pre-renders every page from Supabase
build/serve.mjs             Zero-dep local dev server (+ /api/rebuild)
admin/                      Auth + CRUD app (index.html, admin.js, admin.css)
styles.css                  Public-site design system
index.html                  Homepage (generated; index.reference.html is the
                            hand-authored design reference)
dossier/ release/ media/    Generated pages (character, release, media hub,
merchandise/ comics/          merchandise, comics)
characters/ toys/           Generated section index pages
Kenner-…-Reference.md       Vetted Phase-1 seed content
ROADMAP.md                  What's built and what's next
```

Generated directories are committed so the repo is a complete, deployable
snapshot; they are rebuilt from the database by the build script.

---

## Prerequisites

- **Node.js 18+** (the build uses built-in `fetch`; zero npm dependencies)
- **[Supabase CLI](https://supabase.com/docs/guides/cli)** — only needed to
  apply database migrations
- The DB password lives in `.env` (`SUPABASE_DB_PASSWORD=…`) and is **gitignored**.
  `js/config.js` holds only the publishable key — RLS protects the data, not key
  secrecy.

---

## Run it locally

**1. Start the dev server** (serves the static tree on port 8084, localhost only):

```bash
node build/serve.mjs
# → serving … on http://localhost:8084
```

- Public site: <http://localhost:8084/>
- Admin: <http://localhost:8084/admin/index.html> (sign in with a Supabase Auth
  co-author account)

Use a different port with `PORT=8090 node build/serve.mjs`. Any static file
server works too, but only `serve.mjs` provides the admin's **Rebuild** button
(`POST /api/rebuild`).

**2. Rebuild the pages from the database** after editing content:

```bash
npm run build          # or: node build/build-dossiers.mjs
node build/build-dossiers.mjs --all   # force-rewrite every page
```

The build reads from Supabase (public/anon reads) and only writes files whose
HTML actually changed.

**3. Apply database migrations** (when the schema changes):

```bash
# .env holds SUPABASE_DB_PASSWORD (read by the CLI)
set -a; source ./.env; set +a
supabase db push
```

---

## Editing content

1. Open the **admin**, sign in.
2. Create/edit **characters**, **releases**, **screen media**, **interviews**,
   **merchandise**, etc. Relationships use searchable pickers backed by FKs —
   never hand-typed IDs.
3. Upload **media** (credit / rights / alt text are required at upload) and
   attach it to records.
4. Long-form fields use a built-in rich text editor (headings, lists, quotes,
   tables, small print, links).
5. Click **Rebuild site**, or run `npm run build`.

---

## Deploy

Production is pure static files: build, then upload the tree (everything except
`build/`, `supabase/`, `.env`, and other tooling) to any static host — e.g. a
shared cPanel docroot. There is no persistent Node process in production; the
rebuild step is local/deploy-time only.

---

## More

- `CLAUDE.md` — project conventions and non-negotiables
- `ROADMAP.md` — current state and phased plan
- `schema.sql` — the data model in full
