#!/usr/bin/env bash
# Schema drift check — proves schema.sql and supabase/migrations/ still describe
# the same database, and that no view has fallen behind its table.
#
# Why this exists. schema.sql is the human-readable reference for the live
# database, but nothing enforced that it matched the migrations, so it drifted:
# an entire table (media_merchandise) and several columns went missing without
# anyone noticing, and release_full silently lost two columns because Postgres
# freezes `select *` at CREATE VIEW time. All three were found by running this
# comparison by hand. This script is that comparison, automated.
#
# Usage:
#   ./build/check-schema.sh            # uses PGHOST/PGPORT/PGUSER, or local defaults
#   npm run check:schema
#
# Needs a reachable Postgres and permission to create databases. Exits non-zero
# on any difference, so CI fails the build.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUFFIX="$$"
DB_MIG="drift_mig_${SUFFIX}"
DB_REF="drift_ref_${SUFFIX}"
TMP="$(mktemp -d)"

psql_q() { psql -v ON_ERROR_STOP=1 -q "$@"; }

cleanup() {
  psql -q -c "drop database if exists ${DB_MIG}" >/dev/null 2>&1 || true
  psql -q -c "drop database if exists ${DB_REF}" >/dev/null 2>&1 || true
  rm -rf "$TMP"
}
trap cleanup EXIT

# Roles and schemas Supabase provides that a bare Postgres does not. Stubbed so
# the files under test can run unmodified — we are comparing THEM, not Supabase.
stub() {
  local db="$1"
  psql_q -d "$db" <<'SQL'
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key default gen_random_uuid(), email text);
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text, public boolean);
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, owner uuid, name text);
alter table storage.objects enable row level security;
create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
SQL
}

echo "→ creating scratch databases"
psql -q -c "create role anon nologin"          >/dev/null 2>&1 || true
psql -q -c "create role authenticated nologin" >/dev/null 2>&1 || true
psql -q -c "create database ${DB_MIG}"
psql -q -c "create database ${DB_REF}"
stub "$DB_MIG"
stub "$DB_REF"

echo "→ applying migrations"
count=0
for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! psql_q -d "$DB_MIG" -f "$f" >/dev/null 2>"$TMP/err"; then
    echo "FAIL: migration $(basename "$f") did not apply:" >&2
    head -5 "$TMP/err" >&2
    exit 1
  fi
  count=$((count + 1))
done
echo "  $count migrations applied clean"

echo "→ applying schema.sql"
if ! psql_q -d "$DB_REF" -f "$ROOT/schema.sql" >/dev/null 2>"$TMP/err"; then
  echo "FAIL: schema.sql did not apply — it is meant to be runnable, not just readable:" >&2
  head -5 "$TMP/err" >&2
  exit 1
fi

COLS="select table_name||'.'||column_name||':'||data_type
      from information_schema.columns where table_schema='public' order by 1;"

psql -tAc "$COLS" -d "$DB_MIG" > "$TMP/mig.txt"
psql -tAc "$COLS" -d "$DB_REF" > "$TMP/ref.txt"

status=0

echo "→ comparing schema.sql against the migrations"
if ! diff -u "$TMP/ref.txt" "$TMP/mig.txt" > "$TMP/diff.txt"; then
  echo "" >&2
  echo "FAIL: schema.sql and the migrations describe different databases." >&2
  echo "  '-' = in schema.sql only, '+' = in the migrations only." >&2
  echo "  Whichever is wrong, fix it — schema.sql is only useful while it is true." >&2
  echo "" >&2
  grep '^[-+][a-z]' "$TMP/diff.txt" >&2 || true
  status=1
else
  echo "  identical ($(wc -l < "$TMP/ref.txt" | tr -d ' ') columns)"
fi

# Views built with `select r.*` freeze their column list at CREATE VIEW time, so
# a column added to the table afterwards never appears. Postgres gives no
# warning. Any view over a table must therefore expose all of that table's
# columns; if not, the view needs recreating in a migration.
echo "→ checking views have not fallen behind their tables"
VIEW_LAG="$(psql -tA -d "$DB_MIG" <<'SQL'
select v.table_name || ' is missing: ' || string_agg(t.column_name, ', ' order by t.column_name)
from (values ('release_full','releases')) as m(view_name, table_name)
join information_schema.columns t
  on t.table_schema = 'public' and t.table_name = m.table_name
join information_schema.views v
  on v.table_schema = 'public' and v.table_name = m.view_name
where not exists (
  select 1 from information_schema.columns vc
  where vc.table_schema = 'public'
    and vc.table_name = m.view_name
    and vc.column_name = t.column_name
)
group by v.table_name;
SQL
)"

if [ -n "$VIEW_LAG" ]; then
  echo "" >&2
  echo "FAIL: a view is behind its underlying table." >&2
  echo "  $VIEW_LAG" >&2
  echo "  Cause: 'select *' is expanded once, when the view is created." >&2
  echo "  Fix: add a migration that drops and recreates the view (keep" >&2
  echo "       'with (security_invoker = true)')." >&2
  status=1
else
  echo "  no view lag"
fi

if [ $status -eq 0 ]; then
  echo ""
  echo "Schema check passed."
fi
exit $status
