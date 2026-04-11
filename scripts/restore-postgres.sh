#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-sc-postgres}"
DATABASE_NAME="${POSTGRES_DB:-service_catalogue}"
INPUT_PATH="${1:-}"

usage() {
  cat <<'EOF'
Usage: scripts/restore-postgres.sh <backup.dump|backup.sql>

Restores a PostgreSQL backup into the running sc-postgres container.
Use .dump/.backup for pg_restore or .sql for plain psql restores.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "$INPUT_PATH" ]]; then
  usage >&2
  exit 1
fi

container_state="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [[ "$container_state" != "true" ]]; then
  echo "error: postgres container '$CONTAINER_NAME' is not running" >&2
  exit 1
fi

if [[ ! -f "$INPUT_PATH" ]]; then
  echo "error: backup file '$INPUT_PATH' does not exist" >&2
  exit 1
fi

case "$INPUT_PATH" in
  *.sql)
    echo "Restoring SQL backup ${INPUT_PATH} into ${CONTAINER_NAME}"
    docker exec -i "$CONTAINER_NAME" sh -lc '
      set -eu
      db_password="${POSTGRES_PASSWORD:-}"
      if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
        db_password="$(cat "$POSTGRES_PASSWORD_FILE")"
      fi
      export PGPASSWORD="$db_password"
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --set ON_ERROR_STOP=on --single-transaction
    ' < "$INPUT_PATH"
    ;;
  *.sql.gz)
    echo "Restoring gzipped SQL backup ${INPUT_PATH} into ${CONTAINER_NAME}"
    gzip -dc "$INPUT_PATH" | docker exec -i "$CONTAINER_NAME" sh -lc '
      set -eu
      db_password="${POSTGRES_PASSWORD:-}"
      if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
        db_password="$(cat "$POSTGRES_PASSWORD_FILE")"
      fi
      export PGPASSWORD="$db_password"
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --set ON_ERROR_STOP=on --single-transaction
    '
    ;;
  *)
    echo "Restoring custom-format backup ${INPUT_PATH} into ${CONTAINER_NAME}"
    docker exec -i "$CONTAINER_NAME" sh -lc '
      set -eu
      db_password="${POSTGRES_PASSWORD:-}"
      if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
        db_password="$(cat "$POSTGRES_PASSWORD_FILE")"
      fi
      export PGPASSWORD="$db_password"
      pg_restore -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --no-acl --exit-on-error
    ' < "$INPUT_PATH"
    ;;
esac

echo "Restore completed into ${DATABASE_NAME}"
