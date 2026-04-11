#!/bin/sh

set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

fail=0

existing_paths() {
  for path in "$@"; do
    if [ -e "$path" ]; then
      printf '%s\n' "$path"
    fi
  done
}

list_candidate_paths() {
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git ls-files --cached --others --exclude-standard
    return
  fi

  paths="$(existing_paths frontend middleware backend shared scripts .github docs testdata)"
  if [ -n "$paths" ]; then
    find $paths \
      \( -path '*/node_modules/*' -o -path '*/.next/*' -o -path '*/coverage/*' \) -prune -o \
      -print
  fi
}

print_matches() {
  message="$1"
  shift
  matches="$("$@" || true)"
  if [ -n "$matches" ]; then
    echo "❌ $message"
    echo "$matches"
    fail=1
  fi
}

print_candidate_matches() {
  message="$1"
  pattern="$2"
  matches="$(list_candidate_paths | grep -E "$pattern" || true)"
  if [ -n "$matches" ]; then
    echo "❌ $message"
    echo "$matches"
    fail=1
  fi
}

print_candidate_matches "Legacy duplicate files (* 2.*) found in the commit candidate set." \
  '(^|/)[^/]* 2\.(js|jsx|ts|tsx|css|md)$'

print_candidate_matches "Local macOS artifacts (.DS_Store) found in the commit candidate set." \
  '(^|/)\.DS_Store$'

print_candidate_matches "Frontend build/cache artifacts must not be committed to the repository." \
  '^frontend/(\.next|\.npm|Library|tsconfig\.tsbuildinfo)(/|$)'

print_candidate_matches "Repository root contains binary or local artifacts that do not belong in a public commit." \
  '^([^/]+\.(tar|tar\.gz|tgz|zip|docx|log)|\.DS_Store)$'

if [ "$fail" -ne 0 ]; then
  echo "Repo hygiene check failed."
  exit 1
fi

echo "Repo hygiene check OK."
