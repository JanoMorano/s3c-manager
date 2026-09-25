# Canonical PostgreSQL Layer

This directory contains the PostgreSQL schema, the schema baseline and the seed
layers for the `app + postgres` runtime.

## Layout

| Path | Content |
|---|---|
| `schema/NN_*.sql` | The migration chain. Files are applied in file-name order; every file is idempotent. |
| `baseline/baseline.sql` | Generated `pg_dump` (schema + reference data) of the chain listed in `baseline/manifest.txt`. |
| `baseline/manifest.txt` | `sha256 file` of every schema file contained in the baseline. |
| `modules/*/module.sql`, `modules/manifest.json` | Ownership of schema files per application module (validated by `scripts/validate-module-boundaries.mjs`). |
| `data/c3/*.sql` | Optional C3 seeds (entities, taxonomy, capability map), enabled by `INIT_WITH_C3_*`. |
| `data/test/test_seeds.sql`, `data/platform/seed_admin.sql` | Legacy artifacts, not executed by the init flow. The first admin is created in the install wizard. |

## How the schema is applied

`init/init-db-postgres.sh` runs on container start (`APP_RUN_DB_INIT=true`):

1. **Empty database** (no `platform`/`data` schema): `baseline/baseline.sql` is
   restored in one transaction and the files from `manifest.txt` are recorded
   in `platform.schema_file_ledger` as applied. `SCHEMA_USE_BASELINE=false`
   replays the chain instead.
2. **Every start**: each `schema/*.sql` file is compared with the ledger by
   sha256. New or changed files are applied (one transaction each) and
   recorded; unchanged files are skipped. `SCHEMA_REAPPLY_ALL=true` re-applies
   all files. A failing file stops start-up and is not recorded.
3. The optional C3 seeds run afterwards.

## Changing the schema

- Add a new file `schema/NN_description.sql` with the next number; write it
  idempotently (`IF NOT EXISTS`, `CREATE OR REPLACE`, guarded updates) and
  register it in `platform.schema_migrations` at the end of the file.
- Assign the file to its module in `modules/manifest.json`,
  `modules/<module>/module.sql` and `middleware/src/modules/manifest.js`.
- Do not edit an applied data migration unless re-running it is intended:
  an edited file is applied again on every existing installation.
- New files do not require a baseline rebuild. If you edit a file that the
  baseline covers, rebuild it (the test `schema-init-wiring` checks this):

  ```bash
  docker run --rm -d --name s3c-baseline -e POSTGRES_PASSWORD=x -p 55432:5432 postgres:16-alpine
  PGHOST=127.0.0.1 PGPORT=55432 PGUSER=postgres PGPASSWORD=x PGDATABASE=postgres \
    ./scripts/build-schema-baseline.sh
  docker stop s3c-baseline
  ```

  Rebuilding periodically also folds newer files into the baseline so fresh
  installs replay fewer files.
