# Operations Runbook

## Backups

Use the backup script before upgrades, schema changes, or any destructive maintenance:

```bash
./scripts/backup-postgres.sh
```

By default it writes a custom-format dump to `backups/<db>_<timestamp>.dump`.
You can pass an explicit path if you need to control the filename.

Recommended cadence:

- take a backup before every upgrade
- keep at least one recent off-host copy
- rehearse restores on a non-production clone regularly

## Restores

Restore from a custom dump or plain SQL backup:

```bash
./scripts/restore-postgres.sh backups/service_catalogue_20260411_120000.dump
```

Operational notes:

- stop the app container before restoring
- restore into the running `sc-postgres` container
- restart the app after the restore completes
- verify the app with `/api/health/ready` and `/api/v1/install/status`

## Practical Recovery Flow

```bash
docker compose stop app
./scripts/backup-postgres.sh
./scripts/restore-postgres.sh backups/<known-good>.dump
docker compose up -d app
```

If a restore is part of an upgrade rollback, use the last backup taken before the upgrade attempt.
