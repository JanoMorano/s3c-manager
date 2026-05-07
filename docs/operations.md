# Operations Runbook

## Locale Model

Operations should treat the application locale model as:

- canonical locales: `cs`, `en`
- persisted user preference: `platform.users.preferred_lang`
- browser/session locale cookie: `sc_locale`
- fallback order:
  1. authenticated user locale
  2. cookie locale
  3. browser `Accept-Language`
  4. system locale for CLI/demo seed flows
  5. fallback `cs`

There are no locale prefixes in application URLs. Demo data seeding follows the
resolved locale of the triggering request or the system locale when seeded from
CLI automation.

The historical `sk` and `de` catalogs were removed before the v1.2 handover.
Do not reintroduce them without a separate product decision and i18n plan.

## Backup

Create a timestamped PostgreSQL backup from the repository root:

```bash
./scripts/backup-postgres.sh
```

If you prefer the deployment helper wrapper, use:

```bash
./deploy.sh backup
```

The script writes a custom-format dump to `./backups/` by default. You can
override the destination if you need a controlled storage location:

```bash
./scripts/backup-postgres.sh --output-dir /var/backups/service-catalogue
./scripts/backup-postgres.sh --file /var/backups/service-catalogue/prod-20260411.dump
```

Recommended cadence:

- back up before every release upgrade
- keep at least one recent backup off-host
- automate the backup on a daily schedule for production

## Restore

Restore a dump into the running PostgreSQL container:

```bash
./scripts/restore-postgres.sh --file ./backups/service-catalogue_20260411_120000.dump
```

The deploy helper exposes the same flow:

```bash
./deploy.sh restore --file ./backups/service-catalogue_20260411_120000.dump --recreate-db
```

If you want a clean database before restoring, add `--recreate-db`:

```bash
./scripts/restore-postgres.sh --file ./backups/service-catalogue_20260411_120000.dump --recreate-db
```

Use plain SQL backups only when you need them for legacy tooling; custom-format
dumps are the default and preferred recovery path.

## Recovery Flow

Suggested maintenance sequence:

1. stop the app container if the change requires downtime
2. create or verify a fresh backup
3. restore into the target environment
4. restart the app container
5. verify `/api/health/ready`

Do not use `./deploy.sh rebuild-db` as a substitute for backup and restore.

## Rollout Plan: Pilot → Full Deployment

Use a phased rollout to reduce operational risk and validate content quality
before organization-wide adoption.

### Phase 1: Pilot

Scope the pilot to a smaller group (for example one department, one service
domain, or selected support teams) for 2-4 weeks.

Recommended pilot goals:

- validate discoverability of key knowledge content
- confirm reduced support demand for recurring questions
- capture top knowledge gaps from real user behavior

Track these KPIs during the pilot:

- completion rate of key user tasks
- reduction of repeated catalogue clarification questions
- most searched queries with no result
- article feedback score (`"Was this article helpful?"`)

Pilot exit criteria (example):

- stable or improving task completion trend
- measurable reduction of repeated catalogue clarification questions in top 3 recurring topics
- documented action list for no-result search queries
- article helpfulness score reaches agreed baseline

### Phase 2: Full Deployment

After pilot exit criteria are met, expand in waves:

1. onboarding of adjacent teams/domains
2. communication and enablement for new user groups
3. weekly KPI review during the first full-deployment month
4. transition to monthly optimization cadence

### Monthly KPI-Driven Prioritization

At the end of each month, prioritize backlog items by observed weakness:

1. **Key task completion**: improve flows where users fail or abandon tasks
2. **Repeated catalogue questions by topic**: add or revise content for high-volume themes
3. **No-result searches**: create new articles or synonyms for top missing terms
4. **Article helpfulness**: rewrite low-rated content and add missing context

Keep a short monthly report with:

- KPI snapshot and trend versus previous month
- top 5 gaps to fix next month
- owners, deadlines, and expected KPI impact per action

## Lab Load Test Snapshot (2026-04-28)

The application was tested in the local lab against the containerized stack with
authenticated, parallel users hitting catalogue, operations, service, and C3
read endpoints.

| Scenario | Duration | Parallel users | Requests | Errors | p95 latency | Result |
|---|---:|---:|---:|---:|---:|---|
| Baseline concurrency | 30 s | 30 | 1,438 | 0 | 35.5 ms | Stable |
| High concurrency | 30 s | 100 | 2,441 | 0 | 38 ms | Stable |

These numbers are lab evidence, not a production SLA. Production capacity must
still be validated with the target hardware, reverse proxy, database storage,
real data volume, TLS, and observability enabled.
