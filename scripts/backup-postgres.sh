#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-sc-postgres}"
DATABASE_NAME="${POSTGRES_DB:-service_catalogue}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_PATH="${1:-${BACKUP_DIR}/${DATABASE_NAME}_${TIMESTAMP}.dump}"

usage() {
  cat <<'EOF'
Usage: scripts/backup-postgres.sh [output.dump|-]

Creates a PostgreSQL custom-format backup from the running sc-postgres container.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

container_state="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [[ "$container_state" != "true" ]]; then
  echo "error: postgres container '$CONTAINER_NAME' is not running" >&2
  exit 1
fi

if [[ "$OUTPUT_PATH" != "-" ]]; then
  mkdir -p "$(dirname "$OUTPUT_PATH")"
  echo "Backing up ${DATABASE_NAME} from ${CONTAINER_NAME} to ${OUTPUT_PATH}"
  docker exec -i "$CONTAINER_NAME" sh -lc '
    set -eu
    db_password="${POSTGRES_PASSWORD:-}"
    if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
      db_password="$(cat "$POSTGRES_PASSWORD_FILE")"
    fi
    export PGPASSWORD="$db_password"
    pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl
  ' > "$OUTPUT_PATH"
  echo "Backup completed: $OUTPUT_PATH"
else
  echo "Backing up ${DATABASE_NAME} from ${CONTAINER_NAME} to stdout"
  docker exec -i "$CONTAINER_NAME" sh -lc '
    set -eu
    db_password="${POSTGRES_PASSWORD:-}"
    if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -f "$POSTGRES_PASSWORD_FILE" ]; then
      db_password="$(cat "$POSTGRES_PASSWORD_FILE")"
    fi
    export PGPASSWORD="$db_password"
    pg_dump -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl
  '
fi
