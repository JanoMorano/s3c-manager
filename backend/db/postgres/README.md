# Canonical PostgreSQL Layer

This directory contains the canonical PostgreSQL schema and seed layers for the final `app + postgres` runtime.

Contents:

- `schema/00_bootstrap.sql` through `schema/12_exports_retention.sql`
- `data/platform/seed_admin.sql`
- `data/test/test_seeds.sql`
- `data/c3/c3_entities.sql`
- `data/c3/c3_taxonomy.sql`
- `data/c3/c3_dashboard.sql`

Canonical project state:

- the root runtime uses [docker-compose.yml](/Users/janmoravec/Desktop/Service_Catalog/redesign3/docker-compose.yml)
- database initialization runs through [init/init-db-postgres.sh](/Users/janmoravec/Desktop/Service_Catalog/redesign3/init/init-db-postgres.sh)
- the middleware runtime uses `pg`
- health/readiness endpoints are:
  - `/api/health/live`
  - `/api/health/ready`
  - `/api/health/import`
- legacy and duplicate files are kept out of the active runtime under [_archive](/Users/janmoravec/Desktop/Service_Catalog/redesign3/_archive/README.md)

Reference documentation:

- [migration-plan.md](/Users/janmoravec/Desktop/Service_Catalog/redesign3/migration-plan.md)
