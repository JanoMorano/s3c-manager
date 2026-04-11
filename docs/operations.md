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
