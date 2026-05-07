#!/bin/bash

set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-sc-postgres}"
DATABASE_NAME="${POSTGRES_DB:-service_catalogue}"
APP_BASE_URL="${APP_BASE_URL:-}"

usage() {
  cat <<'HELP'
Usage: scripts/post-upgrade-validate.sh [--service NAME] [--database NAME]

Run post-upgrade validation after reduction migrations. The script is read-only
for PostgreSQL and prints JSON with DB, migration, and optional HTTP health checks.

Environment:
  POSTGRES_CONTAINER_NAME   PostgreSQL container name (default: sc-postgres)
  POSTGRES_DB               Database name (default: service_catalogue)
  APP_BASE_URL              Optional app base URL, e.g. http://localhost:8080
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

retired_objects_present="$(scalar_sql "
  SELECT
      (CASE WHEN to_regclass('platform.notification') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('platform.user_notification') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('platform.user_preferences') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.service_request') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.service_request_number_seq') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.v_importbatcharchiveexport') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.v_importrowarchiveexport') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.v_importissuearchiveexport') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.v_taxonomymappingauditarchiveexport') IS NULL THEN 0 ELSE 1 END) +
      (CASE WHEN to_regclass('data.v_graphlayoutauditarchiveexport') IS NULL THEN 0 ELSE 1 END);
")"

preferred_persona_present=0
if table_exists 'platform.users' && column_exists 'platform' 'users' 'preferred_persona'; then
  preferred_persona_present=1
fi

fk_not_valid="$(scalar_sql "SELECT COUNT(*) FROM pg_constraint WHERE contype = 'f' AND convalidated = FALSE;")"

migration_29=0
migration_30=0
schema_present=0
if table_exists 'platform.schema_migrations'; then
  schema_present=1
  migration_29="$(scalar_sql "SELECT COUNT(*) FROM platform.schema_migrations WHERE migration_key = '29_reduction_low_risk_cleanup';")"
  migration_30="$(scalar_sql "SELECT COUNT(*) FROM platform.schema_migrations WHERE migration_key = '30_reduction_domain_model_simplification';")"
fi

services_total=0
sample_missing_core=0
if table_exists 'data.service_catalog'; then
  schema_present=1
  services_total="$(scalar_sql "SELECT COUNT(*) FROM data.service_catalog WHERE COALESCE(is_deleted, FALSE) = FALSE AND COALESCE(is_stub, FALSE) = FALSE;")"
  sample_missing_core="$(scalar_sql "
    WITH sample AS (
      SELECT service_id, title, lifecycle_state, lifecycle_stage_code, service_status_code
      FROM data.service_catalog
      WHERE COALESCE(is_deleted, FALSE) = FALSE AND COALESCE(is_stub, FALSE) = FALSE
      ORDER BY updated_at DESC NULLS LAST, id DESC
      LIMIT 10
    )
    SELECT COUNT(*) FROM sample
    WHERE NULLIF(BTRIM(COALESCE(service_id, '')), '') IS NULL
       OR NULLIF(BTRIM(COALESCE(title, '')), '') IS NULL
       OR NULLIF(BTRIM(COALESCE(lifecycle_state, lifecycle_stage_code, service_status_code, '')), '') IS NULL;
  ")"
fi

readiness_enabled=0
if table_exists 'data.readiness_rule'; then
  readiness_enabled="$(scalar_sql "SELECT COUNT(*) FROM data.readiness_rule WHERE enabled = TRUE;")"
fi

health_status='not_configured'
if [[ -n "$APP_BASE_URL" ]] && command -v curl >/dev/null 2>&1; then
  if curl -fsS --max-time 10 "$APP_BASE_URL/api/health/ready" >/dev/null; then
    health_status='ok'
  else
    health_status='failed'
  fi
fi

status='pass'
if [[ "$schema_present" == "0" ]]; then
  status='warn'
elif [[ "$migration_29" == "0" || "$migration_30" == "0" ]]; then
  status='fail'
elif [[ "$retired_objects_present" != "0" || "$preferred_persona_present" != "0" || "$fk_not_valid" != "0" ]]; then
  status='fail'
elif table_exists 'data.readiness_rule' && [[ "$readiness_enabled" == "0" ]]; then
  status='fail'
elif [[ "$health_status" == "failed" ]]; then
  status='fail'
fi

cat <<JSON
{
  "generated_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "container": "$CONTAINER_NAME",
  "database": "$DATABASE_NAME",
  "status": "$status",
  "checks": {
    "schema_present": $schema_present,
    "retired_objects_present": $retired_objects_present,
    "preferred_persona_column_present": $preferred_persona_present,
    "foreign_keys_not_validated": $fk_not_valid,
    "migration_29_present": $migration_29,
    "migration_30_present": $migration_30,
    "services_total": $services_total,
    "sample_missing_core_fields": $sample_missing_core,
    "readiness_enabled_rules": $readiness_enabled,
    "health_ready": "$health_status"
  }
}
JSON
