# Upgrade Guide

---

## Upgrade Process

The system detects upgrades automatically on startup. The `UPGRADE_REQUIRED` state means that the application version is newer than the version recorded in the database.

### Automatic Detection

```text
detectInstallMode() returns:
  mode: 'upgrade'
  status: 'UPGRADE_REQUIRED'
```

The application redirects the user to `/install`, where the wizard performs the upgrade flow.

### Manual Upgrade

```bash
# 1. Back up the database before every upgrade
docker exec sc-postgres pg_dump -U postgres service_catalogue > backup_$(date +%Y%m%d).sql

# 2. Update images
docker compose pull
docker compose up -d

# 3. The application detects the version mismatch automatically
# 4. Open http://localhost:8080 — the app redirects to the install wizard in upgrade mode
```

---

## Schema Migrations

Schema migrations are tracked in `platform.schema_migrations`. Each SQL file creates a corresponding record:

```sql
SELECT migration_name, status, applied_at
FROM platform.schema_migrations
ORDER BY applied_at;
```

### Adding a New Migration

1. Create a SQL file with the next number, for example `14_new_feature.sql`
2. Add it to `init-db-postgres.sh`
3. Insert a record into `platform.schema_migrations` from the migration or seed layer

---

## Rollback

Service Catalogue v2 does **not** support automatic rollback. Schema migrations are one-way.

Before every upgrade:

```bash
# Backup
docker exec sc-postgres pg_dump -U postgres service_catalogue > backup_pre_upgrade.sql

# Manual rollback, if necessary
docker exec sc-postgres psql -U postgres service_catalogue < backup_pre_upgrade.sql
```

---

## Versioning

Format: `MAJOR.MINOR.PATCH` (Semantic Versioning)

| Change type | Example | Compatibility |
|---|---|---|
| PATCH (1.0.x) | bug fix, CSS | fully backward compatible |
| MINOR (1.x.0) | new feature, new module | backward compatible, additive migrations possible |
| MAJOR (x.0.0) | schema rewrite, breaking API change | requires a managed manual upgrade |

---

## Post-Upgrade Checks

```bash
# Verify install state
curl http://localhost:8080/api/v1/install/status
# Expected: { "status": "READY" }

# Verify version
curl http://localhost:8080/api/v1/install/summary | jq .app_version

# Health check
curl http://localhost:8080/api/health/ready
```
