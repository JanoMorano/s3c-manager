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
./scripts/backup-postgres.sh

# 2. Update images
docker compose pull
docker compose up -d

# 3. The application detects the version mismatch automatically
# 4. Open http://localhost:8080 — the app redirects to the install wizard in upgrade mode
```

---

## Upgrade to 1.1.2

Version `1.1.2` is an additive governance cockpit and Layout v2 release. It does
not replace the existing service catalogue data model, but it adds the contracts
needed for the new UI behavior:

- per-user notification inbox and read/unread state
- user preferences for view mode and future saved UI settings
- lightweight service request log
- readiness rule explanation fields for human-readable remediation
- C3 board state separate from imported/source taxonomy status

Before upgrading:

1. Back up PostgreSQL.
2. Pull or build the `v1.1.2` application image.
3. Confirm `.env` or deployment variables use `APP_VERSION=1.1.2`.
4. Start the stack and let the install/upgrade flow apply migration `28_enterprise_governance_contracts.sql`.

After upgrading, verify:

- `/api/v1/install/status`
- `/api/v1/install/summary`
- `/operations/readiness`
- `/operations/reviews`
- `/operations/decisions`
- `/services/impact`
- `/services/graph`
- `/import`
- `/administration/users`

---

## Schema Migrations

Schema migrations are tracked in `platform.schema_migrations`. Each SQL file creates a corresponding record:

```sql
SELECT migration_name, status, applied_at
FROM platform.schema_migrations
ORDER BY applied_at;
```

### Applied Migrations

| File | Description |
|---|---|
| `01` – `13` | Core schema, references, C3 taxonomy, graphs |
| `15_itil_catalogue_phase1.sql` | ITIL-ready catalogue foundation — adds `service_offering`, `service_support_model`, `service_audience_policy`, `service_operational_link`; adds lifecycle, requestability, support, and audience fields to `service_catalog` |
| `16_consumer_value.sql` | Adds `consumer_value` column to `service_catalog` |
| `17_spiral_membership.sql` | Adds C3 entity membership in FMN spirals |
| `18_service_governance_views.sql` | Adds service governance helper views |
| `19_capability_abbreviations.sql` | Adds capability abbreviation support |
| `20_capability_coverage_views.sql` | Adds capability requirement and coverage helper views |
| `21_governance_risk_views.sql` | Adds risk radar, owner-load, renewal, and advisor views |
| `22_governance_views.sql` | Adds service publish readiness view |
| `23_service_portfolio.sql` | Adds `service_portfolio`, service lifecycle metadata, review due dates, and criticality |
| `24_readiness_rules.sql` | Adds `readiness_rule` and `readiness_exception` |
| `25_capability_governance.sql` | Adds coverage, gap, and overlap governance views |
| `26_governance_workflow.sql` | Adds `governance_review` and `governance_decision` |
| `27_impact_analysis.sql` | Adds recursive service impact analysis views |
| `28_enterprise_governance_contracts.sql` | Adds per-user notifications, user preferences, service request log, readiness explanations, and C3 board state |

### What Migration 15 Adds

`15_itil_catalogue_phase1.sql` extends the service catalogue with:

**New tables:**

- `data.service_offering` — requestable service variants (offering_code, title, requestable, approval_required, lead_time_text, support_tier_code, is_default, status)
- `data.service_support_model` — support ownership and operating model (support_owner_name, resolver_group, support_hours_code, support_channel, escalation_path, maintenance_window, review_cadence)
- `data.service_audience_policy` — audience and eligibility (audience_type, business_unit, region_code, eligibility_rule, notes)
- `data.service_operational_link` — operational reference links (link_type, title, url, sort_order)

**New columns on `data.service_catalog`:**

- `lifecycle_state` — ITIL lifecycle (draft / under_review / approved / live / deprecated / retired)
- `business_summary`, `consumer_value` — business-facing description fields
- `requestable`, `request_channel_url`, `request_channel_type`, `approval_required`
- `fulfillment_lead_time_text`
- `target_audience_summary`
- `review_owner_user_id`, `next_review_due_at`

**Backward compatibility:** all new columns are nullable with sensible defaults; no existing column is removed or renamed; existing API endpoints continue to work.

### Governance Cockpit Schema Additions

The governance cockpit release is additive. It introduces:

- portfolios and service lifecycle metadata for portfolio governance
- structured service offerings beside pricing flavours
- readiness rules and time-bound exceptions
- governance reviews and decision log rows
- capability coverage, gap, overlap, and readiness views
- recursive impact analysis across service relationships and C3 evidence

Before upgrading, take a database backup. After upgrading, verify `/operations`, `/operations/readiness`, `/operations/reviews`, `/operations/decisions`, `/capabilities/coverage`, and `/services/impact`.

### Adding a New Migration

1. Create a SQL file with the next number, for example `17_new_feature.sql`
2. Add it to `init/init-db-postgres.sh`
3. Insert a record into `platform.schema_migrations` from the migration or seed layer

---

## Rollback

Service Catalogue does **not** support automatic rollback. Schema migrations are one-way.

Before every upgrade:

```bash
# Backup
./scripts/backup-postgres.sh backups/backup_pre_upgrade.dump

# Manual rollback if necessary
./scripts/restore-postgres.sh backups/backup_pre_upgrade.dump
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

# Verify release version
curl http://localhost:8080/api/v1/install/summary | jq .app_version

# Health check
curl http://localhost:8080/api/health/ready

# Verify ITIL migrations applied
psql -c "SELECT migration_name, status FROM platform.schema_migrations ORDER BY applied_at" 
# Should include migrations 15 through 28 with status = 'applied'
```
