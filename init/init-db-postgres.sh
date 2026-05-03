#!/bin/sh
set -eu

POSTGRES_HOST="${POSTGRES_HOST:-}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-service_catalogue}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
INIT_WITH_TEST_SEEDS="${INIT_WITH_TEST_SEEDS:-false}"
INIT_WITH_C3_ENTITY_SEEDS="${INIT_WITH_C3_ENTITY_SEEDS:-false}"
INIT_WITH_C3_BASELINE_TAXONOMY_SEED="${INIT_WITH_C3_BASELINE_TAXONOMY_SEED:-false}"
INIT_WITH_C3_TAXONOMY_XLSX_SEED="${INIT_WITH_C3_TAXONOMY_XLSX_SEED:-false}"
INIT_WITH_C3_CAPABILITY_MAP_SEED="${INIT_WITH_C3_CAPABILITY_MAP_SEED:-false}"

export PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"

SEED_ROOT="/shared/c3"

wait_for_postgres() {
  echo "⏳ Waiting for PostgreSQL..."
  if [ -n "$POSTGRES_HOST" ]; then
    until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
      echo "… PostgreSQL is not ready yet, waiting 2s"
      sleep 2
    done
  else
    until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
      echo "… PostgreSQL is not ready yet, waiting 2s"
      sleep 2
    done
  fi
  echo "✅ PostgreSQL ready"
}

build_psql_args() {
  if [ -n "$POSTGRES_HOST" ]; then
    printf -- "-h %s -p %s -U %s -d %s" "$POSTGRES_HOST" "$POSTGRES_PORT" "$POSTGRES_USER" "$POSTGRES_DB"
  else
    printf -- "-U %s -d %s" "$POSTGRES_USER" "$POSTGRES_DB"
  fi
}

run_psql() {
  label="$1"
  file="$2"
  echo "▶ $label..."
  # shellcheck disable=SC2086
  psql $(build_psql_args) -v ON_ERROR_STOP=1 -f "$file"
  echo "✅ $label OK"
}

run_psql_with_session_settings() {
  label="$1"
  file="$2"
  pgoptions="$3"
  echo "▶ $label..."
  # shellcheck disable=SC2086
  PGOPTIONS="$pgoptions" psql $(build_psql_args) -v ON_ERROR_STOP=1 -f "$file"
  echo "✅ $label OK"
}

run_node_script() {
  label="$1"
  script="$2"
  echo "▶ $label..."
  node "$script"
  echo "✅ $label OK"
}

require_seed_file() {
  file="$1"
  description="$2"
  if [ ! -f "$file" ]; then
    echo "❌ Missing ${description}: ${file}"
    echo "   Add the seed snapshot to the canonical shared/c3 directory or disable the corresponding INIT_WITH_* flag."
    exit 1
  fi
}

wait_for_postgres

if [ "$INIT_WITH_C3_ENTITY_SEEDS" = "true" ]; then
  require_seed_file "${SEED_ROOT}/c3-services-seed.json" "C3 services seed"
  require_seed_file "${SEED_ROOT}/c3-applications-seed.json" "C3 applications seed"
  require_seed_file "${SEED_ROOT}/c3-data-objects-seed.json" "C3 data objects seed"
  require_seed_file "${SEED_ROOT}/c3-technology-interactions-seed.json" "C3 technology interactions seed"
fi

if [ "$INIT_WITH_C3_BASELINE_TAXONOMY_SEED" = "true" ]; then
  require_seed_file "${SEED_ROOT}/c3-taxonomy-seed.json" "C3 baseline taxonomy seed"
fi

if [ "$INIT_WITH_C3_TAXONOMY_XLSX_SEED" = "true" ]; then
  require_seed_file "${SEED_ROOT}/c3-taxonomy-xlsx-import-seed.json" "C3 XLSX taxonomy seed"
fi

if [ "$INIT_WITH_C3_CAPABILITY_MAP_SEED" = "true" ]; then
  require_seed_file "${SEED_ROOT}/capability-map-spiral7.json" "C3 capability map Spiral 7 seed"
fi

run_psql "pg bootstrap — schemas + extensions" /pgdb/schema/00_bootstrap.sql
run_psql "pg platform — AppConfig, Users, RefreshTokens, AuditLog" /pgdb/schema/01_platform.sql
run_psql "pg ref — reference lookups" /pgdb/schema/02_ref.sql
run_psql "pg groups — AppGroup, AppGroupPermission, AppUserGroup" /pgdb/schema/03_groups.sql
echo "▶ pg platform seed — skipped (first admin is created in the install wizard)"
run_psql "pg core — ServiceCatalog" /pgdb/schema/04_core.sql
run_psql "pg graph — ServiceRelation + ServiceRelationRaw" /pgdb/schema/05_graph.sql
run_psql "pg pricing — ServiceFlavour + ServiceSla" /pgdb/schema/06_pricing.sql
run_psql "pg domains — ServiceAvailableOn" /pgdb/schema/07_domains.sql
run_psql "pg ownership — ServiceRoleAssignment + ServiceC3Mapping + ServiceRawField" /pgdb/schema/08_ownership.sql
run_psql "pg import — ImportBatch + ImportRow + ImportIssue" /pgdb/schema/09_import.sql
run_psql "pg indexes — performance indexes" /pgdb/schema/10_indexes.sql
run_psql "pg C3 — taxonomy, entities, links, builder, completeness" /pgdb/schema/11_c3.sql
run_psql "pg exports+retention — canonical routes, manifests, archive/export views" /pgdb/schema/12_exports_retention.sql
run_psql "pg install system — state machine, migrations, modules, release metadata" /pgdb/schema/13_install_system.sql
run_psql "pg spiral versioning — fmn_spiral columns, Spiral_7 seed" /pgdb/schema/14_spiral_versioning.sql
run_psql "pg ITIL catalogue phase 1 — offerings, support, audience, operational links" /pgdb/schema/15_itil_catalogue_phase1.sql
run_psql "pg consumer_value additive column" /pgdb/schema/16_consumer_value.sql
run_psql "pg spiral membership — entity to spiral coverage" /pgdb/schema/17_spiral_membership.sql
run_psql "pg user persona — user-driven UX preference" /pgdb/schema/18_user_persona.sql
run_psql "pg capability abbreviations — Level-3 slugs" /pgdb/schema/19_capability_abbreviations.sql
run_psql "pg capability coverage — generic helper views" /pgdb/schema/20_capability_coverage_views.sql
run_psql "pg contract governance — vendors, contracts, findings" /pgdb/schema/21_contract_governance.sql
run_psql "pg governance views — risk radar, owner load, overlap advisor" /pgdb/schema/22_governance_views.sql
run_psql "pg service portfolio — portfolio and lifecycle foundation" /pgdb/schema/23_service_portfolio.sql
run_psql "pg readiness rules — configurable readiness and exceptions" /pgdb/schema/24_readiness_rules.sql
run_psql "pg capability governance — coverage cockpit views" /pgdb/schema/25_capability_governance.sql
run_psql "pg governance workflow — reviews and decisions" /pgdb/schema/26_governance_workflow.sql
run_psql "pg impact analysis — dependency and capability traversal views" /pgdb/schema/27_impact_analysis.sql

if [ "$INIT_WITH_C3_ENTITY_SEEDS" = "true" ]; then
  run_psql "pg C3 entities seed — baseline snapshot" /pgdb/data/c3/c3_entities.sql
else
  echo "▶ pg C3 entities seed — skipped (INIT_WITH_C3_ENTITY_SEEDS=false)"
fi

if [ "$INIT_WITH_C3_TAXONOMY_XLSX_SEED" = "true" ]; then
  run_psql_with_session_settings \
    "pg C3 taxonomy seed — XLSX import snapshot" \
    /pgdb/data/c3/c3_taxonomy.sql \
    "-c app.taxonomy_seed_key=c3.taxonomy.xlsx-import.v1 -c app.taxonomy_seed_source=shared/c3/c3-taxonomy-xlsx-import-seed.json -c app.taxonomy_seed_path=/shared/c3/c3-taxonomy-xlsx-import-seed.json"
elif [ "$INIT_WITH_C3_BASELINE_TAXONOMY_SEED" = "true" ]; then
  run_psql_with_session_settings \
    "pg C3 taxonomy seed — baseline snapshot" \
    /pgdb/data/c3/c3_taxonomy.sql \
    "-c app.taxonomy_seed_key=c3.taxonomy.baseline.v1 -c app.taxonomy_seed_source=shared/c3/c3-taxonomy-seed.json -c app.taxonomy_seed_path=/shared/c3/c3-taxonomy-seed.json"
else
  echo "▶ pg C3 taxonomy seed — skipped (INIT_WITH_C3_BASELINE_TAXONOMY_SEED=false and INIT_WITH_C3_TAXONOMY_XLSX_SEED=false)"
fi

run_psql_with_session_settings \
  "pg C3 dashboard seed — capability map baseline" \
  /pgdb/data/c3/c3_dashboard.sql \
  "-c app.seed_capability_builder=${INIT_WITH_C3_CAPABILITY_MAP_SEED}"

if [ "$INIT_WITH_TEST_SEEDS" = "true" ]; then
  run_node_script "pg test seeds — demo dataset" /app/middleware/src/scripts/seed-demo-data.js
else
  echo "▶ pg test seeds — skipped (INIT_WITH_TEST_SEEDS=false)"
fi

echo "✅ PostgreSQL core + C3 initialization completed"
