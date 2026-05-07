# Canonical PostgreSQL Layer

This directory contains the canonical PostgreSQL schema and seed layers for the
final `app + postgres` runtime.

Contents:

- `schema/00_bootstrap.sql` through `schema/30_reduction_domain_model_simplification.sql`
- `data/test/test_seeds.sql`
- `data/c3/c3_entities.sql`
- `data/c3/c3_taxonomy.sql`
- `data/c3/c3_dashboard.sql`
- legacy artifact: `data/platform/seed_admin.sql` remains in the tree but is
  not executed by the canonical init flow

Canonical project state:

- the root runtime uses [docker-compose.yml](../../../docker-compose.yml)
- database initialization runs through [init/init-db-postgres.sh](../../../init/init-db-postgres.sh)
- the middleware runtime uses `pg`
- health/readiness endpoints are:
  - `/api/health/live`
  - `/api/health/ready`
  - `/api/health/import`
- clean bootstrap creates the first admin through the install wizard, not
  through `seed_admin.sql`
