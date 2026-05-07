#!/usr/bin/env bash
set -Eeuo pipefail

FRONTEND_URL="${FRONTEND_URL:-http://localhost:8080}"
API_LIVE_URL="${API_LIVE_URL:-http://localhost:8080/api/health/live}"
API_READY_URL="${API_READY_URL:-http://localhost:8080/api/health/ready}"
SERVICE_LIST_URL="${SERVICE_LIST_URL:-http://localhost:8080/api/v1/services}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-sc-postgres}"
APP_CONTAINER="${APP_CONTAINER:-sc-app}"
AUTO_START_STACK="${AUTO_START_STACK:-false}"
COMPOSE_CMD="${COMPOSE_CMD:-docker compose}"

PASS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
RESULTS=()

green() { printf '\033[32m%s\033[0m\n' "$*"; }
red() { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
blue() { printf '\033[34m%s\033[0m\n' "$*"; }

record_pass() { PASS_COUNT=$((PASS_COUNT+1)); RESULTS+=("PASS | $1"); green "PASS: $1"; }
record_fail() { FAIL_COUNT=$((FAIL_COUNT+1)); RESULTS+=("FAIL | $1 | $2"); red "FAIL: $1"; [ -n "${2:-}" ] && red "  $2"; }
record_skip() { SKIP_COUNT=$((SKIP_COUNT+1)); RESULTS+=("SKIP | $1 | $2"); yellow "SKIP: $1"; [ -n "${2:-}" ] && yellow "  $2"; }

http_code() {
  local url="$1"
  curl -sS -o /tmp/smoke_body.$$ -w "%{http_code}" "$url" || true
}

container_running() {
  docker ps --format '{{.Names}}' | grep -qx "$1"
}

maybe_start_stack() {
  if [ "$AUTO_START_STACK" = "true" ]; then
    $COMPOSE_CMD up -d --build app postgres
  fi
}

test_1_stack_startup() {
  blue "Smoke test 1 — Stack startup"
  if container_running "$APP_CONTAINER" && container_running "$POSTGRES_CONTAINER"; then
    record_pass "Stack startup"
  else
    record_fail "Stack startup" "sc-app nebo sc-postgres neběží"
  fi
}

test_2_postgres_health() {
  blue "Smoke test 2 — PostgreSQL health"
  if docker exec -i "$POSTGRES_CONTAINER" psql -U postgres -d service_catalogue -c "SELECT 1;" >/tmp/smoke_pg.$$ 2>/tmp/smoke_pg_err.$$; then
    record_pass "PostgreSQL health"
  else
    record_fail "PostgreSQL health" "$(cat /tmp/smoke_pg_err.$$ 2>/dev/null || true)"
  fi
}

test_3_api_live() {
  blue "Smoke test 3 — API liveness"
  local code
  code="$(http_code "$API_LIVE_URL")"
  if [ "$code" = "200" ]; then
    record_pass "API liveness"
  else
    record_fail "API liveness" "HTTP $code $(cat /tmp/smoke_body.$$ 2>/dev/null || true)"
  fi
}

test_4_api_ready() {
  blue "Smoke test 4 — API readiness"
  local code
  code="$(http_code "$API_READY_URL")"
  if [ "$code" = "200" ]; then
    record_pass "API readiness"
  else
    record_fail "API readiness" "HTTP $code $(cat /tmp/smoke_body.$$ 2>/dev/null || true)"
  fi
}

test_5_frontend() {
  blue "Smoke test 5 — Frontend availability"
  local code
  code="$(http_code "$FRONTEND_URL")"
  if [ "$code" = "200" ] || [ "$code" = "304" ] || [ "$code" = "307" ]; then
    record_pass "Frontend availability"
  else
    record_fail "Frontend availability" "HTTP $code"
  fi
}

test_6_service_list() {
  blue "Smoke test 6 — Service list"
  local code
  code="$(http_code "$SERVICE_LIST_URL")"
  if [ "$code" = "200" ] || [ "$code" = "401" ]; then
    record_pass "Service list reachability"
  else
    record_fail "Service list reachability" "HTTP $code $(cat /tmp/smoke_body.$$ 2>/dev/null || true)"
  fi
}

manual_test() {
  local num="$1"
  local name="$2"
  blue "Smoke test $num — $name"
  if [ ! -t 0 ]; then
    record_skip "$name" "Manual test not executed in non-interactive mode."
    return
  fi
  yellow "Manual test required."
  read -r -p "Result for '$name' [p=pass / f=fail / s=skip]: " ans
  case "$(printf '%s' "$ans" | tr '[:upper:]' '[:lower:]')" in
    p) record_pass "$name" ;;
    f) read -r -p "Failure note: " note; record_fail "$name" "$note" ;;
    *) record_skip "$name" "Manual test not executed." ;;
  esac
}

print_summary() {
  echo
  blue "================ SUMMARY ================"
  printf 'PASS: %s\nFAIL: %s\nSKIP: %s\n' "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT"
  echo
  printf '%s\n' "${RESULTS[@]}"
  echo "========================================"
}

cleanup() {
  rm -f /tmp/smoke_body.$$ /tmp/smoke_pg.$$ /tmp/smoke_pg_err.$$ 2>/dev/null || true
}
trap cleanup EXIT

main() {
  maybe_start_stack
  test_1_stack_startup
  test_2_postgres_health
  test_3_api_live
  test_4_api_ready
  test_5_frontend
  test_6_service_list
  manual_test 7 "Detail služby"
  manual_test 8 "Save služby"
  manual_test 9 "C3 stránky"
  manual_test 10 "Restart persistence"
  print_summary
  if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
