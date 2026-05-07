#!/bin/bash

set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-sc-postgres}"
DATABASE_NAME="${POSTGRES_DB:-service_catalogue}"

usage() {
  cat <<'HELP'
Usage: scripts/pre-upgrade-audit.sh [--service NAME] [--database NAME]

Run a read-only PostgreSQL audit before applying the reduction upgrade.
The script prints JSON with counts that determine whether manual export or
rollback preparation is required before running cleanup migrations.

Environment:
  POSTGRES_CONTAINER_NAME   PostgreSQL container name (default: sc-postgres)
  POSTGRES_DB               Database name (default: service_catalogue)
HELP
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -s|--service)
      CONTAINER_NAME="${2:-}"
      shift 2
      ;;
    -d|--database)
      DATABASE_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument '$1'" >&2
      usage >&2
      exit 1
      ;;
  esac
done

container_state="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [[ "$container_state" != "true" ]]; then
  echo "error: postgres container '$CONTAINER_NAME' is not running" >&2
  exit 1
fi

setup_secret_cmd='set -eu
if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -r "${POSTGRES_PASSWORD_FILE}" ]; then
  export PGPASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
elif [ -n "${DB_PASSWORD_FILE:-}" ] && [ -r "${DB_PASSWORD_FILE}" ]; then
  export PGPASSWORD="$(cat "${DB_PASSWORD_FILE}")"
elif [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export PGPASSWORD="${POSTGRES_PASSWORD}"
elif [ -n "${DB_PASSWORD:-}" ]; then
  export PGPASSWORD="${DB_PASSWORD}"
fi'

run_sql() {
  local sql="$1"
  docker exec -i "$CONTAINER_NAME" sh -lc "${setup_secret_cmd}
exec psql -h 127.0.0.1 -U \"\${POSTGRES_USER:-postgres}\" -d \"${DATABASE_NAME}\" -At --set ON_ERROR_STOP=on" <<< "$sql"
}

scalar_sql() {
  local value
  value="$(run_sql "$1" | tr -d '[:space:]')"
  printf '%s' "${value:-0}"
}

table_exists() {
  [[ "$(scalar_sql "SELECT CASE WHEN to_regclass('$1') IS NULL THEN 0 ELSE 1 END;")" == "1" ]]
}

column_exists() {
  local schema="$1"
  local table="$2"
  local column="$3"
  [[ "$(scalar_sql "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = '$schema' AND table_name = '$table' AND column_name = '$column';")" != "0" ]]
}

count_table() {
  local fqtn="$1"
  if table_exists "$fqtn"; then
    scalar_sql "SELECT COUNT(*) FROM $fqtn;"
  else
    printf '0'
  fi
}

count_nonempty_column() {
  local schema="$1"
  local table="$2"
  local column="$3"
  if table_exists "$schema.$table" && column_exists "$schema" "$table" "$column"; then
    scalar_sql "SELECT COUNT(*) FROM $schema.$table WHERE NULLIF(BTRIM($column::text), '') IS NOT NULL;"
  else
    printf '0'
  fi
}

service_count=0
legacy_lifecycle='{}'
if table_exists 'data.service_catalog'; then
  service_count="$(scalar_sql "SELECT COUNT(*) FROM data.service_catalog WHERE COALESCE(is_deleted, FALSE) = FALSE AND COALESCE(is_stub, FALSE) = FALSE;")"
  legacy_lifecycle="$(run_sql "
    WITH lifecycle_values AS (
      SELECT LOWER(COALESCE(lifecycle_state, lifecycle_stage_code, service_status_code, '')) AS state
      FROM data.service_catalog
      WHERE COALESCE(is_deleted, FALSE) = FALSE
    ), counted AS (
      SELECT state, COUNT(*) AS count
      FROM lifecycle_values
      WHERE state IN ('planned','design','under_review','approved','active','published','production','retiring')
      GROUP BY state
    )
    SELECT COALESCE(jsonb_object_agg(state, count ORDER BY state), '{}'::jsonb)::text FROM counted;
  ")"
fi

unsupported_lang='{}'
if table_exists 'platform.users' && column_exists 'platform' 'users' 'preferred_lang'; then
  unsupported_lang="$(run_sql "
    WITH counted AS (
      SELECT LOWER(preferred_lang) AS lang, COUNT(*) AS count
      FROM platform.users
      WHERE NULLIF(BTRIM(COALESCE(preferred_lang, '')), '') IS NOT NULL
        AND split_part(LOWER(REPLACE(preferred_lang, '_', '-')), '-', 1) NOT IN ('cs','en')
      GROUP BY LOWER(preferred_lang)
    )
    SELECT COALESCE(jsonb_object_agg(lang, count ORDER BY lang), '{}'::jsonb)::text FROM counted;
  ")"
fi

preferred_persona_count=0
if table_exists 'platform.users' && column_exists 'platform' 'users' 'preferred_persona'; then
  preferred_persona_count="$(scalar_sql "SELECT COUNT(*) FROM platform.users WHERE preferred_persona IS NOT NULL;")"
fi

cat <<JSON
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "container": "$CONTAINER_NAME",
  "database": "$DATABASE_NAME",
  "service_count": $service_count,
  "cut_field_counts": {
    "value_proposition": $(count_nonempty_column data service_catalog value_proposition),
    "business_purpose": $(count_nonempty_column data service_catalog business_purpose),
    "service_features_raw": $(count_nonempty_column data service_catalog service_features_raw),
    "customer_type_json": $(count_nonempty_column data service_catalog customer_type_json)
  },
  "legacy_lifecycle_counts": $legacy_lifecycle,
  "retired_object_row_counts": {
    "platform.notification": $(count_table platform.notification),
    "platform.user_notification": $(count_table platform.user_notification),
    "platform.user_preferences": $(count_table platform.user_preferences),
    "data.service_request": $(count_table data.service_request),
    "data.vendor": $(count_table data.vendor),
    "data.contract": $(count_table data.contract),
    "data.contract_service_link": $(count_table data.contract_service_link),
    "data.contract_capability_link": $(count_table data.contract_capability_link)
  },
  "unsupported_preferred_lang_counts": $unsupported_lang,
  "preferred_persona_rows": $preferred_persona_count,
  "recommendation": "If any count is non-zero for data you still need, export it before applying cleanup migrations and keep a tested restore path."
}
JSON
