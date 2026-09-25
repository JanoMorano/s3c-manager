#!/bin/sh
set -eu

POSTGRES_HOST="${POSTGRES_HOST:-}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-service_catalogue}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
INIT_WITH_TEST_SEEDS="${INIT_WITH_TEST_SEEDS:-false}"
INIT_WITH_C3_ENTITY_SEEDS="${INIT_WITH_C3_ENTITY_SEEDS:-false}"
INIT_WITH_C3_BASELINE_TAXONOMY_SEED="${INIT_WITH_C3_BASELINE_TAXONOMY_SEED:-false}"
INIT_WITH_C3_TAXONOMY_XLSX_SEED="${INIT_WITH_C3_TAXONOMY_XLSX_SEED:-false}"
INIT_WITH_C3_CAPABILITY_MAP_SEED="${INIT_WITH_C3_CAPABILITY_MAP_SEED:-false}"

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

SEED_ROOT="/shared/c3"

wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL..."
  if [ -n "$POSTGRES_HOST" ]; then
    until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
      echo "… PostgreSQL is not ready yet, waiting 2s"
      sleep 2
    done
  else
    until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
      echo "… PostgreSQL is not ready yet, waiting 2s"
      sleep 2
    done
  fi
  echo "✅ PostgreSQL ready"
}

build_psql_args() {
  if [ -n "$POSTGRES_HOST" ]; then
    printf -- "-h %s -p %s -U %s -d %s" "$POSTGRES_HOST" "$POSTGRES_PORT" "$POSTGRES_USER" "$POSTGRES_DB"
  else
    printf -- "-U %s -d %s" "$POSTGRES_USER" "$POSTGRES_DB"
  fi
}

run_psql() {
  label="$1"
  file="$2"
  echo "▶ $label..."
  # shellcheck disable=SC2086
  psql $(build_psql_args) -v ON_ERROR_STOP=1 -f "$file"
  echo "✅ $label OK"
}

SCHEMA_DIR="${SCHEMA_DIR:-/pgdb/schema}"
SCHEMA_BASELINE_DIR="${SCHEMA_BASELINE_DIR:-/pgdb/baseline}"
SCHEMA_REAPPLY_ALL="${SCHEMA_REAPPLY_ALL:-false}"
SCHEMA_USE_BASELINE="${SCHEMA_USE_BASELINE:-true}"

psql_query() {
  # shellcheck disable=SC2086
  psql $(build_psql_args) -v ON_ERROR_STOP=1 -q -A -t "$@"
}

# Schema migration runner.
# Every file in $SCHEMA_DIR is applied in file-name order, in its own
# transaction, and recorded in platform.schema_file_ledger with its sha256.
# On the next start an unchanged file is skipped; a changed file is applied
# again (schema files are written to be idempotent). This replaces
# re-running every file on every start, which also reset data migrations
# such as the readiness rule configuration.
# SCHEMA_REAPPLY_ALL=true re-applies every file (previous behaviour).
#
# On an empty database the baseline ($SCHEMA_BASELINE_DIR/baseline.sql, built
# by scripts/build-schema-baseline.sh) is restored first and the schema files
# listed in its manifest are recorded as applied, so a fresh install does not
# replay the whole chain. SCHEMA_USE_BASELINE=false replays the chain instead.
apply_schema_baseline() {
  if [ "$SCHEMA_USE_BASELINE" != "true" ] || [ ! -f "$SCHEMA_BASELINE_DIR/baseline.sql" ] || [ ! -f "$SCHEMA_BASELINE_DIR/manifest.txt" ]; then
    return 0
  fi
  fresh="$(psql_query -c "SELECT NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN ('platform', 'data'))")"
  if [ "$fresh" != "t" ]; then
    return 0
  fi

  echo "▶ schema baseline ($(wc -l < "$SCHEMA_BASELINE_DIR/manifest.txt") files)"
  # shellcheck disable=SC2086
  psql $(build_psql_args) -v ON_ERROR_STOP=1 --single-transaction -q -f "$SCHEMA_BASELINE_DIR/baseline.sql" >/dev/null
  ensure_schema_ledger
  while read -r checksum name; do
    [ -n "$name" ] || continue
    psql_query -c "INSERT INTO platform.schema_file_ledger (file_name, checksum)
      VALUES ('${name}', '${checksum}') ON CONFLICT (file_name) DO NOTHING;" >/dev/null
  done < "$SCHEMA_BASELINE_DIR/manifest.txt"
  echo "✅ schema baseline restored"
}

ensure_schema_ledger() {
  psql_query -c "CREATE SCHEMA IF NOT EXISTS platform;
    CREATE TABLE IF NOT EXISTS platform.schema_file_ledger (
      file_name   VARCHAR(200) PRIMARY KEY,
      checksum    CHAR(64)     NOT NULL,
      applied_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
      apply_count INTEGER      NOT NULL DEFAULT 1
    );" >/dev/null
}

apply_schema_files() {
  apply_schema_baseline
  ensure_schema_ledger

  applied=0
  skipped=0
  for file in $(find "$SCHEMA_DIR" -maxdepth 1 -name '*.sql' | sort); do
    name="$(basename "$file")"
    checksum="$(sha256sum "$file" | cut -d ' ' -f 1)"
    recorded="$(psql_query -c "SELECT checksum FROM platform.schema_file_ledger WHERE file_name = '${name}'")"

    if [ "$recorded" = "$checksum" ] && [ "$SCHEMA_REAPPLY_ALL" != "true" ]; then
      skipped=$((skipped + 1))
      continue
    fi

    if [ -z "$recorded" ]; then
      echo "▶ schema ${name} (new)"
    elif [ "$recorded" != "$checksum" ]; then
      echo "▶ schema ${name} (changed)"
    else
      echo "▶ schema ${name} (reapply)"
    fi
    # shellcheck disable=SC2086
    psql $(build_psql_args) -v ON_ERROR_STOP=1 --single-transaction -q -f "$file"
    psql_query -c "INSERT INTO platform.schema_file_ledger (file_name, checksum)
      VALUES ('${name}', '${checksum}')
      ON CONFLICT (file_name) DO UPDATE SET
        checksum = EXCLUDED.checksum,
        applied_at = CURRENT_TIMESTAMP,
        apply_count = platform.schema_file_ledger.apply_count + 1;" >/dev/null
    applied=$((applied + 1))
  done
  echo "✅ schema files: ${applied} applied, ${skipped} unchanged"
}

run_psql_with_session_settings() {
  label="$1"
  file="$2"
  pgoptions="$3"
  echo "▶ $label..."
  # shellcheck disable=SC2086
  PGOPTIONS="$pgoptions" psql $(build_psql_args) -v ON_ERROR_STOP=1 -f "$file"
  echo "✅ $label OK"
}

run_node_script() {
  label="$1"
  script="$2"
  echo "▶ $label..."
  node "$script"
  echo "✅ $label OK"
}

require_seed_file() {
  file="$1"
  description="$2"
  if [ ! -f "$file" ]; then
    echo "❌ Missing ${description}: ${file}"
    echo "   Add the seed snapshot to the canonical shared/c3 directory or disable the corresponding INIT_WITH_* flag."
    exit 1
  fi
}

wait_for_postgres

if [ "$INIT_WITH_C3_ENTITY_SEEDS" = "true" ]; then
  require_seed_file "${SEED_ROOT}/c3-services-seed.json" "C3 services seed"
  require_seed_file "${SEED_ROOT}/c3-applications-seed.json" "C3 applications seed"
  require_seed_file "${SEED_ROOT}/c3-data-objects-seed.json" "C3 data objects seed"
  require_seed_file "${SEED_ROOT}/c3-technology-interactions-seed.json" "C3 technology interactions seed"
fi

if [ "$INIT_WITH_C3_BASELINE_TAXONOMY_SEED" = "true" ]; then
  require_seed_file "${SEED_ROOT}/c3-taxonomy-seed.json" "C3 baseline taxonomy seed"
fi

if [ "$INIT_WITH_C3_TAXONOMY_XLSX_SEED" = "true" ]; then
  require_seed_file "${SEED_ROOT}/c3-taxonomy-xlsx-import-seed.json" "C3 XLSX taxonomy seed"
fi

if [ "$INIT_WITH_C3_CAPABILITY_MAP_SEED" = "true" ]; then
  require_seed_file "${SEED_ROOT}/capability-map-spiral7.json" "C3 capability map Spiral 7 seed"
fi

echo "▶ pg platform seed — skipped (first admin is created in the install wizard)"
apply_schema_files

if [ "$INIT_WITH_C3_ENTITY_SEEDS" = "true" ]; then
  run_psql "pg C3 entities seed — baseline snapshot" /pgdb/data/c3/c3_entities.sql
else
  echo "▶ pg C3 entities seed — skipped (INIT_WITH_C3_ENTITY_SEEDS=false)"
fi

if [ "$INIT_WITH_C3_TAXONOMY_XLSX_SEED" = "true" ]; then
  run_psql_with_session_settings \
    "pg C3 taxonomy seed — XLSX import snapshot" \
    /pgdb/data/c3/c3_taxonomy.sql \
    "-c app.taxonomy_seed_key=c3.taxonomy.xlsx-import.v1 -c app.taxonomy_seed_source=shared/c3/c3-taxonomy-xlsx-import-seed.json -c app.taxonomy_seed_path=/shared/c3/c3-taxonomy-xlsx-import-seed.json"
elif [ "$INIT_WITH_C3_BASELINE_TAXONOMY_SEED" = "true" ]; then
  run_psql_with_session_settings \
    "pg C3 taxonomy seed — baseline snapshot" \
    /pgdb/data/c3/c3_taxonomy.sql \
    "-c app.taxonomy_seed_key=c3.taxonomy.baseline.v1 -c app.taxonomy_seed_source=shared/c3/c3-taxonomy-seed.json -c app.taxonomy_seed_path=/shared/c3/c3-taxonomy-seed.json"
else
  echo "▶ pg C3 taxonomy seed — skipped (INIT_WITH_C3_BASELINE_TAXONOMY_SEED=false and INIT_WITH_C3_TAXONOMY_XLSX_SEED=false)"
fi

run_psql_with_session_settings \
  "pg C3 dashboard seed — capability map baseline" \
  /pgdb/data/c3/c3_dashboard.sql \
  "-c app.seed_capability_builder=${INIT_WITH_C3_CAPABILITY_MAP_SEED}"

if [ "$INIT_WITH_TEST_SEEDS" = "true" ]; then
  run_node_script "pg test seeds — demo dataset" /app/middleware/src/scripts/seed-demo-data.js
else
  echo "▶ pg test seeds — skipped (INIT_WITH_TEST_SEEDS=false)"
fi

echo "✅ PostgreSQL core + C3 initialization completed"
