#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# check-versions.sh — Service Catalogue dependency version monitor
#
# Checks the latest stable versions of all project dependencies and compares
# them against what is currently used. Highlights outdated packages.
#
# Usage:
#   ./scripts/check-versions.sh              # full report
#   ./scripts/check-versions.sh --outdated   # show only outdated packages
#   ./scripts/check-versions.sh --json       # JSON output for automation
#   ./scripts/check-versions.sh --markdown   # markdown table for docs/issues
#
# Requirements: curl, jq, node (for npm queries)
# ══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Parse flags ──────────────────────────────────────────────────────────────
ONLY_OUTDATED=false
OUTPUT_JSON=false
OUTPUT_MD=false
for arg in "$@"; do
  case "$arg" in
    --outdated)  ONLY_OUTDATED=true ;;
    --json)      OUTPUT_JSON=true ;;
    --markdown)  OUTPUT_MD=true ;;
    --help|-h)
      echo "Usage: $0 [--outdated] [--json] [--markdown]"
      echo "  --outdated   Show only packages with available updates"
      echo "  --json       Output as JSON array"
      echo "  --markdown   Output as markdown table"
      exit 0
      ;;
  esac
done

# ── Colors (disabled for non-TTY / piped output) ────────────────────────────
if [ -t 1 ]; then
  RED='\033[0;31m'; YEL='\033[0;33m'; GRN='\033[0;32m'
  CYA='\033[0;36m'; BLD='\033[1m'; RST='\033[0m'
else
  RED=''; YEL=''; GRN=''; CYA=''; BLD=''; RST=''
fi

# ── Helpers ──────────────────────────────────────────────────────────────────

# Get latest stable version of an npm package
npm_latest() {
  local pkg="$1"
  curl -s "https://registry.npmjs.org/${pkg}/latest" 2>/dev/null \
    | jq -r '.version // empty' 2>/dev/null || echo "?"
}

# Get latest stable Docker Hub tag for official images
docker_latest() {
  local image="$1"
  local major_filter="${2:-}"
  # Use Docker Hub API v2 to get tags
  local tags
  tags=$(curl -s "https://hub.docker.com/v2/repositories/library/${image}/tags/?page_size=100&ordering=last_updated" 2>/dev/null \
    | jq -r '.results[].name' 2>/dev/null || echo "")

  if [ -z "$tags" ]; then
    echo "?"
    return
  fi

  # Filter for stable tags (X.Y.Z or X.Y.Z-alpine, no rc/beta/alpha)
  local latest
  if [ -n "$major_filter" ]; then
    latest=$(echo "$tags" \
      | grep -E "^${major_filter}\.[0-9]+(\.[0-9]+)?(-alpine)?$" \
      | grep -v -E '(rc|beta|alpha|dev|nightly)' \
      | sort -V \
      | tail -1)
  else
    latest=$(echo "$tags" \
      | grep -E '^[0-9]+\.[0-9]+(\.[0-9]+)?(-alpine)?$' \
      | grep -v -E '(rc|beta|alpha|dev|nightly)' \
      | sort -V \
      | tail -1)
  fi
  echo "${latest:-?}"
}

# Get latest Node.js LTS version
node_latest_lts() {
  curl -s "https://nodejs.org/dist/index.json" 2>/dev/null \
    | jq -r '[.[] | select(.lts != false)] | .[0].version // empty' 2>/dev/null \
    | sed 's/^v//' || echo "?"
}

# Extract clean version from npm range specifier (^2.3.0 -> 2.3.0)
clean_version() {
  echo "$1" | sed -E 's/^[\^~>=<]*//' | sed -E 's/\s.*//'
}

# Compare semver: returns "current", "patch", "minor", "major"
compare_versions() {
  local current="$1" latest="$2"
  [ "$current" = "?" ] || [ "$latest" = "?" ] && echo "unknown" && return
  [ "$current" = "$latest" ] && echo "current" && return

  local cur_major cur_minor cur_patch lat_major lat_minor lat_patch
  IFS='.' read -r cur_major cur_minor cur_patch <<< "$(echo "$current" | sed 's/[^0-9.]//g')"
  IFS='.' read -r lat_major lat_minor lat_patch <<< "$(echo "$latest" | sed 's/[^0-9.]//g')"

  cur_major=${cur_major:-0}; cur_minor=${cur_minor:-0}; cur_patch=${cur_patch:-0}
  lat_major=${lat_major:-0}; lat_minor=${lat_minor:-0}; lat_patch=${lat_patch:-0}

  if [ "$lat_major" -gt "$cur_major" ] 2>/dev/null; then echo "major"; return; fi
  if [ "$lat_minor" -gt "$cur_minor" ] 2>/dev/null; then echo "minor"; return; fi
  if [ "$lat_patch" -gt "$cur_patch" ] 2>/dev/null; then echo "patch"; return; fi
  echo "current"
}

# ── Collect dependencies from package.json files ────────────────────────────

declare -a RESULTS=()  # "layer|package|current|latest|update_type"

check_npm_deps() {
  local layer="$1" pkg_json="$2"
  [ ! -f "$pkg_json" ] && return

  local deps
  deps=$(jq -r '
    (.dependencies // {}) + (.devDependencies // {})
    | to_entries[] | "\(.key)|\(.value)"
  ' "$pkg_json" 2>/dev/null || true)

  local total count=0
  total=$(echo "$deps" | wc -l | tr -d ' ')

  while IFS='|' read -r name version; do
    [ -z "$name" ] && continue
    count=$((count + 1))

    # Progress indicator (only on TTY, not JSON/MD)
    if [ -t 1 ] && [ "$OUTPUT_JSON" = false ] && [ "$OUTPUT_MD" = false ]; then
      printf "\r  ${CYA}[%s]${RST} Checking %d/%d: %s ...          " "$layer" "$count" "$total" "$name" >&2
    fi

    local current latest update_type
    current=$(clean_version "$version")
    latest=$(npm_latest "$name")
    update_type=$(compare_versions "$current" "$latest")

    RESULTS+=("${layer}|${name}|${current}|${latest}|${update_type}")
  done <<< "$deps"

  if [ -t 1 ] && [ "$OUTPUT_JSON" = false ] && [ "$OUTPUT_MD" = false ]; then
    printf "\r%80s\r" "" >&2
  fi
}

# ── Check infrastructure versions ───────────────────────────────────────────

check_infra() {
  if [ -t 1 ] && [ "$OUTPUT_JSON" = false ] && [ "$OUTPUT_MD" = false ]; then
    printf "  ${CYA}[infra]${RST} Checking Node.js, PostgreSQL, Alpine ...  " >&2
  fi

  # Node.js
  local node_current="20"
  local node_latest
  node_latest=$(node_latest_lts)
  local node_latest_major
  node_latest_major=$(echo "$node_latest" | cut -d. -f1)
  RESULTS+=("infra|node|${node_current}|${node_latest} (LTS)|$([ "$node_current" = "$node_latest_major" ] && echo 'current' || echo 'major')")

  # PostgreSQL
  local pg_current="16"
  local pg_latest
  pg_latest=$(docker_latest "postgres" "")
  local pg_latest_clean
  pg_latest_clean=$(echo "$pg_latest" | sed 's/-alpine//')
  local pg_latest_major
  pg_latest_major=$(echo "$pg_latest_clean" | cut -d. -f1)
  RESULTS+=("infra|postgres|${pg_current}|${pg_latest_clean}|$([ "$pg_current" = "$pg_latest_major" ] && echo 'current' || echo 'major')")

  if [ -t 1 ] && [ "$OUTPUT_JSON" = false ] && [ "$OUTPUT_MD" = false ]; then
    printf "\r%80s\r" "" >&2
  fi
}

# ── Output formatters ───────────────────────────────────────────────────────

output_table() {
  local has_outdated=false

  printf "\n${BLD}Service Catalogue — Dependency Version Report${RST}\n"
  printf "Generated: $(date '+%Y-%m-%d %H:%M')\n\n"

  local current_layer=""
  for entry in "${RESULTS[@]}"; do
    IFS='|' read -r layer name current latest update_type <<< "$entry"

    [ "$ONLY_OUTDATED" = true ] && [ "$update_type" = "current" ] && continue

    if [ "$layer" != "$current_layer" ]; then
      current_layer="$layer"
      printf "\n${BLD}═══ %s ═══${RST}\n" "$(echo "$layer" | tr '[:lower:]' '[:upper:]')"
      printf "  %-35s %-14s %-14s %s\n" "Package" "Current" "Latest" "Status"
      printf "  %-35s %-14s %-14s %s\n" "───────────────────────────────────" "──────────────" "──────────────" "──────────"
    fi

    local status_str
    case "$update_type" in
      current) status_str="${GRN}✓ up to date${RST}" ;;
      patch)   status_str="${YEL}↑ patch${RST}"; has_outdated=true ;;
      minor)   status_str="${YEL}↑ minor${RST}"; has_outdated=true ;;
      major)   status_str="${RED}↑ MAJOR${RST}"; has_outdated=true ;;
      *)       status_str="? unknown" ;;
    esac

    printf "  %-35s %-14s %-14s %b\n" "$name" "$current" "$latest" "$status_str"
  done

  printf "\n"
  if [ "$has_outdated" = true ]; then
    printf "${YEL}⚠  Some dependencies have updates available.${RST}\n"
    printf "   Run with ${BLD}--outdated${RST} to see only outdated packages.\n\n"
  else
    printf "${GRN}✓  All dependencies are up to date.${RST}\n\n"
  fi
}

output_json() {
  local first=true
  echo "["
  for entry in "${RESULTS[@]}"; do
    IFS='|' read -r layer name current latest update_type <<< "$entry"
    [ "$ONLY_OUTDATED" = true ] && [ "$update_type" = "current" ] && continue

    [ "$first" = true ] && first=false || echo ","
    printf '  {"layer":"%s","package":"%s","current":"%s","latest":"%s","update":"%s"}' \
      "$layer" "$name" "$current" "$latest" "$update_type"
  done
  echo ""
  echo "]"
}

output_markdown() {
  echo "# Dependency Version Report"
  echo ""
  echo "Generated: $(date '+%Y-%m-%d %H:%M')"
  echo ""

  local current_layer=""
  for entry in "${RESULTS[@]}"; do
    IFS='|' read -r layer name current latest update_type <<< "$entry"
    [ "$ONLY_OUTDATED" = true ] && [ "$update_type" = "current" ] && continue

    if [ "$layer" != "$current_layer" ]; then
      current_layer="$layer"
      echo ""
      echo "## $(echo "$layer" | sed 's/./\U&/')"
      echo ""
      echo "| Package | Current | Latest | Status |"
      echo "|---------|---------|--------|--------|"
    fi

    local status_icon
    case "$update_type" in
      current) status_icon="✅ current" ;;
      patch)   status_icon="🟡 patch" ;;
      minor)   status_icon="🟠 minor" ;;
      major)   status_icon="🔴 MAJOR" ;;
      *)       status_icon="❓ unknown" ;;
    esac

    echo "| \`$name\` | $current | $latest | $status_icon |"
  done
  echo ""
}

# ── Main ─────────────────────────────────────────────────────────────────────

main() {
  if [ -t 1 ] && [ "$OUTPUT_JSON" = false ] && [ "$OUTPUT_MD" = false ]; then
    printf "\n${BLD}Checking dependency versions ...${RST}\n\n" >&2
  fi

  # Check npm dependencies
  check_npm_deps "frontend" "$PROJECT_ROOT/frontend/package.json"
  check_npm_deps "middleware" "$PROJECT_ROOT/middleware/package.json"

  # Check infrastructure
  check_infra

  # Output
  if [ "$OUTPUT_JSON" = true ]; then
    output_json
  elif [ "$OUTPUT_MD" = true ]; then
    output_markdown
  else
    output_table
  fi
}

main
