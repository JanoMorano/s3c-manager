#!/bin/sh
set -eu

MIDDLEWARE_PORT="${PORT:-4000}"
FRONTEND_PORT="${NEXT_PORT:-3000}"
MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://127.0.0.1:${MIDDLEWARE_PORT}}"

read_secret_file() {
  secret_path="$1"
  if [ -z "${secret_path}" ]; then
    return 0
  fi
  if [ ! -r "${secret_path}" ]; then
    echo "Secret file is not readable: ${secret_path}" >&2
    exit 1
  fi
  tr -d '\r' < "${secret_path}" | sed -e 's/[[:space:]]*$//'
}

resolve_secret_env() {
  target_var="$1"
  file_var="$2"
  fallback_value="$3"
  current_value="$(printenv "${target_var}" 2>/dev/null || true)"
  file_path="$(printenv "${file_var}" 2>/dev/null || true)"

  if [ -n "${file_path}" ]; then
    resolved_value="$(read_secret_file "${file_path}")"
  elif [ -n "${current_value}" ]; then
    resolved_value="${current_value}"
  else
    resolved_value="${fallback_value}"
  fi

  export "${target_var}=${resolved_value}"
}

shutdown() {
  kill "${BACKEND_PID:-0}" "${FRONTEND_PID:-0}" 2>/dev/null || true
}

trap shutdown INT TERM

echo "=== Service Catalogue — PostgreSQL start ==="

resolve_secret_env JWT_SECRET JWT_SECRET_FILE ""
resolve_secret_env DB_PASSWORD DB_PASSWORD_FILE "${DB_PASSWORD:-${POSTGRES_PASSWORD:-postgres}}"
resolve_secret_env POSTGRES_PASSWORD POSTGRES_PASSWORD_FILE "${POSTGRES_PASSWORD:-${DB_PASSWORD:-postgres}}"

if [ "${APP_RUN_DB_INIT:-true}" = "true" ]; then
  echo "▶ Starting PostgreSQL init..."
  export POSTGRES_HOST="${POSTGRES_HOST:-${DB_HOST:-postgres}}"
  export POSTGRES_PORT="${POSTGRES_PORT:-${DB_PORT:-5432}}"
  export POSTGRES_DB="${POSTGRES_DB:-${DB_NAME:-service_catalogue}}"
  export POSTGRES_USER="${POSTGRES_USER:-${DB_USER:-postgres}}"
  /app/init/init-db-postgres.sh
else
  echo "▶ PostgreSQL init skipped (APP_RUN_DB_INIT=false)"
fi

echo "▶ Starting middleware on port ${MIDDLEWARE_PORT}..."
PORT="${MIDDLEWARE_PORT}" node /app/middleware/src/server.js &
BACKEND_PID=$!

echo "▶ Starting Next.js frontend on port ${FRONTEND_PORT}..."
PORT="${FRONTEND_PORT}" HOSTNAME="0.0.0.0" MIDDLEWARE_URL="${MIDDLEWARE_URL}" node /app/frontend/server.js &
FRONTEND_PID=$!

echo "✅ Service Catalogue is running"
echo "Frontend:  http://localhost:${FRONTEND_PORT}"
echo "API:       http://localhost:${MIDDLEWARE_PORT}"

while kill -0 "${BACKEND_PID}" 2>/dev/null && kill -0 "${FRONTEND_PID}" 2>/dev/null; do
  sleep 2
done

shutdown
wait "${BACKEND_PID}" 2>/dev/null || true
wait "${FRONTEND_PID}" 2>/dev/null || true
exit 1
