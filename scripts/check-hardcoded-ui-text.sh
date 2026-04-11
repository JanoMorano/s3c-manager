#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGETS=(
  frontend/app/components
  frontend/app/login
  frontend/app/install
  frontend/app/administration
  frontend/app/user-info
)

if rg -n "[Á-ž]" "${TARGETS[@]}" \
  --glob '!**/*.css' \
  --glob '!**/*.module.css' \
  --glob '!**/*.spec.ts' \
  --glob '!**/*.test.ts' \
  --glob '!**/test-results/**'
then
  echo
  echo "Hardcoded UI text detected in guarded shell/auth/install/admin/profile surfaces."
  echo "Move user-facing copy into shared i18n message keys before merging."
  exit 1
fi

echo "No hardcoded UI text detected in guarded shell/auth/install/admin/profile surfaces."
