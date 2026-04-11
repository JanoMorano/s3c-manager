#!/bin/bash

set -euo pipefail

CONTAINER_NAME="${POSTGRES_CONTAINER_NAME:-sc-postgres}"
DATABASE_NAME="${POSTGRES_DB:-service_catalogue}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
OUTPUT_PATH=""

usage() {
  cat <<'EOF'
Usage: scripts/backup-postgres.sh [--output-dir DIR] [--file PATH] [--service NAME]

Create a timestamped PostgreSQL custom-format backup from the running container.

Options:
  -o, --output-dir DIR   Directory for timestamped dumps (default: ./backups)
  -f, --file PATH        Write to an explicit output file
  -s, --service NAME     Container name for PostgreSQL (default: sc-postgres)
  -h, --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -o|--output-dir)
      BACKUP_DIR="${2:-}"
      shift 2
      ;;
    -f|--file)
      OUTPUT_PATH="${2:-}"
      shift 2
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
      if [[ -z "$OUTPUT_PATH" && "$1" != -* ]]; then
        OUTPUT_PATH="$1"
        shift
      else
        echo "error: unknown argument '$1'" >&2
        usage >&2
        exit 1
      fi
      ;;
  esac
done

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
if [[ -z "$OUTPUT_PATH" ]]; then
  OUTPUT_PATH="${BACKUP_DIR}/${DATABASE_NAME}_${TIMESTAMP}.dump"
fi

container_state="$(docker inspect -f '{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)"
if [[ "$container_state" != "true" ]]; then
  echo "error: postgres container '$CONTAINER_NAME' is not running" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT_PATH")"
echo "Backing up ${DATABASE_NAME} from ${CONTAINER_NAME} to ${OUTPUT_PATH}"

dump_cmd='set -eu
if [ -n "${POSTGRES_PASSWORD_FILE:-}" ] && [ -r "${POSTGRES_PASSWORD_FILE}" ]; then
  export PGPASSWORD="$(cat "${POSTGRES_PASSWORD_FILE}")"
elif [ -n "${DB_PASSWORD_FILE:-}" ] && [ -r "${DB_PASSWORD_FILE}" ]; then
  export PGPASSWORD="$(cat "${DB_PASSWORD_FILE}")"
elif [ -n "${POSTGRES_PASSWORD:-}" ]; then
  export PGPASSWORD="${POSTGRES_PASSWORD}"
elif [ -n "${DB_PASSWORD:-}" ]; then
  export PGPASSWORD="${DB_PASSWORD}"
fi
exec pg_dump -h 127.0.0.1 -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-service_catalogue}" --format=custom --no-owner --no-acl'

umask 077
docker exec "$CONTAINER_NAME" sh -lc "$dump_cmd" > "$OUTPUT_PATH"
echo "Backup completed: $OUTPUT_PATH"
