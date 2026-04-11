#!/bin/bash

set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-sc-postgres}"
DATABASE_NAME="${POSTGRES_DB:-service_catalogue}"
INPUT_PATH=""
RECREATE_DB=false

usage() {
  cat <<'EOF'
Usage: scripts/restore-postgres.sh [--file PATH] [--recreate-db] [--service NAME]

Restore a PostgreSQL backup into the running container.

Options:
  -f, --file PATH        Backup file to restore (required)
  -r, --recreate-db      Drop and recreate the target database first
  -s, --service NAME     Container name for PostgreSQL (default: sc-postgres)
  -h, --help             Show this help

Supported formats:
  - custom pg_dump archives (.dump, .backup, .tar) via pg_restore
  - plain SQL dumps (.sql) via psql
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -f|--file)
      INPUT_PATH="${2:-}"
      shift 2
      ;;
    -r|--recreate-db)
      RECREATE_DB=true
      shift
      ;;
    -s|--service)
      CONTAINER_NAME="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [[ -z "$INPUT_PATH" && "$1" != -* ]]; then
        INPUT_PATH="$1"
        shift
      else
        echo "error: unknown argument '$1'" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

if [[ -z "$INPUT_PATH" ]]; then
  echo "error: backup file is required" >&2
  usage >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "error: backup file '$INPUT_PATH' does not exist" >&2
  exit 1
fi

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

if [[ "$RECREATE_DB" == "true" ]]; then
  echo "Recreating ${DATABASE_NAME} before restore"
  docker exec "$CONTAINER_NAME" sh -lc "${setup_secret_cmd}
dropdb -h 127.0.0.1 -U \"\${POSTGRES_USER:-postgres}\" --if-exists --force \"\${POSTGRES_DB:-service_catalogue}\"
createdb -h 127.0.0.1 -U \"\${POSTGRES_USER:-postgres}\" \"\${POSTGRES_DB:-service_catalogue}\""
fi

case "$INPUT_PATH" in
  *.sql)
    echo "Restoring SQL backup ${INPUT_PATH} into ${CONTAINER_NAME}"
    docker exec -i "$CONTAINER_NAME" sh -lc "${setup_secret_cmd}
exec psql -h 127.0.0.1 -U \"\${POSTGRES_USER:-postgres}\" -d \"\${POSTGRES_DB:-service_catalogue}\" --set ON_ERROR_STOP=on --single-transaction" < "$INPUT_PATH"
    ;;
  *.sql.gz)
    echo "Restoring gzipped SQL backup ${INPUT_PATH} into ${CONTAINER_NAME}"
    gzip -dc "$INPUT_PATH" | docker exec -i "$CONTAINER_NAME" sh -lc "${setup_secret_cmd}
exec psql -h 127.0.0.1 -U \"\${POSTGRES_USER:-postgres}\" -d \"\${POSTGRES_DB:-service_catalogue}\" --set ON_ERROR_STOP=on --single-transaction"
    ;;
  *)
    echo "Restoring custom-format backup ${INPUT_PATH} into ${CONTAINER_NAME}"
    docker exec -i "$CONTAINER_NAME" sh -lc "${setup_secret_cmd}
exec pg_restore -h 127.0.0.1 -U \"\${POSTGRES_USER:-postgres}\" -d \"\${POSTGRES_DB:-service_catalogue}\" --clean --if-exists --no-owner --no-acl --exit-on-error" < "$INPUT_PATH"
    ;;
esac

echo "Restore completed into ${DATABASE_NAME}"
