# Upgrade Guide

## Before Upgrading

1. Create a PostgreSQL backup with `./scripts/backup-postgres.sh`.
2. Run `./scripts/pre-upgrade-audit.sh` and save the JSON output with the backup.
3. Record the current application image/tag and database dump location.
4. Stop non-essential import jobs.
5. Communicate that `/help` is the locale-aware help entry, `/help-cs` and `/help-en` are the canonical static help surfaces, and `/administration/*` is the canonical admin namespace.

## How Schema Migrations Are Applied

On start (`APP_RUN_DB_INIT=true`) `init/init-db-postgres.sh` applies the files in `backend/db/postgres/schema/` in file-name order. Each file runs in its own transaction and is recorded with its sha256 checksum in `platform.schema_file_ledger`:

- a new file is applied and recorded;
- an unchanged file is skipped on later starts;
- a changed file is applied again (schema files are written to be idempotent);
- a failing file stops the start-up and is not recorded, so it is retried on the next start.

A fresh, empty database is created from `backend/db/postgres/baseline/baseline.sql` (a generated dump of the chain) and only the files newer than the baseline are applied; `SCHEMA_USE_BASELINE=false` replays the whole chain instead. Existing databases never use the baseline.

The first start after upgrading to this runner applies every file once (the previous behaviour on every start) and records them. Set `SCHEMA_REAPPLY_ALL=true` to force re-applying all files. Before the runner, data migrations such as `30_reduction_domain_model_simplification.sql` ran on every start and reset the readiness rule configuration; they now run once.

New schema changes go into a new file with the next two-digit prefix; do not edit an applied data migration unless re-running it is intended.

## Reduction Migrations

Apply migrations in order through the normal init/upgrade flow.

| Migration | Purpose | Data risk |
|---|---|---|
| `29_reduction_low_risk_cleanup.sql` | Removes retired notification/preferences/request objects, orphan archive export views, and `preferred_persona`. | Requires backup; intended to drop only already-retired objects. |
| `30_reduction_domain_model_simplification.sql` | Keeps historical lifecycle/status/decision data and enables only five active readiness rules. | Non-destructive for service and decision history. |

## Post-Upgrade Verification

Run these checks after deployment:

```bash
./scripts/post-upgrade-validate.sh
npm --prefix middleware test -- services-phase1-validation governance-repo
npm --prefix middleware test -- services-phase1-routes services-routes governance-workflow readiness-rules exports-routes import-routes stats-routes demo-data-seed
npm --prefix frontend run lint:i18n
```

Then smoke these routes in the browser:

- `/catalogue`
- `/services/list`
- `/operations`
- `/operations/readiness`
- `/operations/reviews`
- `/operations/decisions`
- `/import`
- `/administration/users`
- `/administration/web`
- `/help`
- `/help-cs`
- `/help-en`

## Expected Behaviour After Upgrade

- Service lifecycle uses `draft`, `live`, `deprecated`, and `retired` as the main UI truth.
- Review workflow remains separate from service lifecycle.
- Decision types use `publish`, `exception`, `lifecycle`, and `other`.
- Legacy variant evidence remains historical/read-only evidence; new variants use service offerings.
- Service request and notification APIs are physically removed in the v1.2.2 final surface.
- Removed endpoint replacements are listed in `docs/api-deprecations.md`.
- Old manual compatibility links are removed; use `/help`, `/help-cs`, or `/help-en`.
- `/admin/*` and other legacy frontend aliases are removed from the Next.js redirect table.

## Rollback

If migration or smoke fails:

1. Stop the app container.
2. Restore the pre-upgrade PostgreSQL dump.
3. Revert the application image/tag.
4. Restart the stack.
5. Re-run `/api/health/ready` and the browser smoke list.
