#!/bin/sh
# Builds backend/db/postgres/baseline/ from the schema migration chain.
#
# The baseline is a pg_dump (schema + reference data) of a database created by
# applying every file in backend/db/postgres/schema/ in order. Fresh installs
# restore it in one step instead of replaying the chain; manifest.txt records
# which schema files (and checksums) it contains, so the init runner marks them
# as applied and only runs files added or changed after the baseline.
#
# Requires psql/pg_dump 16 and an EMPTY scratch database, e.g.:
#   docker run --rm -d --name s3c-baseline -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16-alpine
#   PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres PGPASSWORD=x PGDATABASE=postgres \
#     ./scripts/build-schema-baseline.sh
#   docker stop s3c-baseline
set -eu

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCHEMA_DIR="$ROOT/backend/db/postgres/schema"
OUT_DIR="$ROOT/backend/db/postgres/baseline"

existing="$(psql -v ON_ERROR_STOP=1 -q -A -t -c "SELECT count(*) FROM pg_namespace WHERE nspname IN ('platform', 'data')")"
if [ "$existing" != "0" ]; then
  echo "✖ Target database is not empty (schemas platform/data exist). Use an empty scratch database." >&2
  exit 1
fi

mkdir -p "$OUT_DIR"
manifest="$OUT_DIR/manifest.txt.tmp"
: > "$manifest"

for file in $(find "$SCHEMA_DIR" -maxdepth 1 -name '*.sql' | sort); do
  name="$(basename "$file")"
  echo "▶ $name"
  psql -v ON_ERROR_STOP=1 --single-transaction -q -f "$file" >/dev/null
  printf '%s %s\n' "$(sha256sum "$file" | cut -d ' ' -f 1)" "$name" >> "$manifest"
done

{
  echo "-- ============================================================================="
  echo "-- S3C Manager — PostgreSQL schema baseline (generated, do not edit)"
  echo "-- Built by scripts/build-schema-baseline.sh from backend/db/postgres/schema/."
  echo "-- Contains the files listed in manifest.txt; later files are applied by the"
  echo "-- init runner on top of it."
  echo "-- ============================================================================="
  # Drop version banners and pg_dump's per-run \restrict keys so rebuilds are reproducible.
  pg_dump --no-owner --no-privileges --no-tablespaces \
    | grep -v -e '^-- Dumped from database version' -e '^-- Dumped by pg_dump version' \
              -e '^\\restrict ' -e '^\\unrestrict '
} > "$OUT_DIR/baseline.sql"

mv "$manifest" "$OUT_DIR/manifest.txt"
echo "✅ baseline written: $(wc -l < "$OUT_DIR/manifest.txt") schema files, $(wc -c < "$OUT_DIR/baseline.sql") bytes"
