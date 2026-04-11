#!/bin/sh
set -eu

MIDDLEWARE_PORT="${PORT:-4000}"
FRONTEND_PORT="${NEXT_PORT:-3000}"
MIDDLEWARE_URL="${MIDDLEWARE_URL:-http://127.0.0.1:${MIDDLEWARE_PORT}}"

shutdown() {
  kill "${BACKEND_PID:-0}" "${FRONTEND_PID:-0}" 2>/dev/null || true
}

trap shutdown INT TERM

echo "=== Service Catalogue — PostgreSQL start ==="

if [ "${APP_RUN_DB_INIT:-true}" = "true" ]; then
  echo "▶ Starting PostgreSQL init..."
  export POSTGRES_HOST="${POSTGRES_HOST:-${DB_HOST:-postgres}}"
  export POSTGRES_PORT="${POSTGRES_PORT:-${DB_PORT:-5432}}"
  export POSTGRES_DB="${POSTGRES_DB:-${DB_NAME:-service_catalogue}}"
  export POSTGRES_USER="${POSTGRES_USER:-${DB_USER:-postgres}}"
  export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-${DB_PASSWORD:-postgres}}"
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
