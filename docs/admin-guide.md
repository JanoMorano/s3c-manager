# Admin Guide

## Document Purpose

This guide describes the operation, configuration, and administration of the current PostgreSQL-based Service Catalogue runtime. It is intended for:

- `admin`
- `editor` users handling content management
- deployment and operations administrators

## Current Runtime Model

The canonical deployment uses two containers:

- `app`
- `postgres`

`app` contains:

- the Next.js frontend
- the Express middleware
- init and seed logic
- the retention scheduler

`postgres` contains:

- the `platform` schema
- the `data` schema
- persistent system and business data

## Main Administrative Areas

### Administration

Route:

```text
/administration
```

The main administration area contains:

- `User Management`
- `Group Management`
- `Web`
- `Installation & Modules`
- `Catalogue Column Edit`
- `C3 Column Edit`
- `C3 Capability Builder`
- `Import History`
- `Import Audit`
- `Audit Logs`

### Content Admin

Route:

```text
/management
```

This area is aimed primarily at the `editor` role and provides:

- `New Service`
- `New C3 Capability`
- `Import CSV/JSON/XLSX`

## Roles and Permissions

- `viewer` — read-only access to business data and dashboards
- `editor` — can edit services, C3 entities, capabilities, and imports
- `admin` — manages users, groups, web/SSO settings, references, installation workflows, and audit

Notes for C3 editors:

- the capability editor and C3 entity editors are available to both `editor` and `admin`
- system-level and reference-data interventions remain `admin` responsibilities

## Installation and Modules

### Installation & Modules

Route:

```text
/admin/installation
```

Typical uses:

- inspect installation state
- verify release/schema handshake
- run repair flows
- restore demo data
- activate modules and review module state
- coordinate backups and restores during maintenance windows
- rehearse restores before upgrades or `./deploy.sh rebuild-db`

Operations runbook:

- [docs/operations.md](operations.md)

### First-Run Installation

When `APP_RUN_DB_INIT=true`, the init script runs:

```text
/app/init/init-db-postgres.sh
```

It always creates the core schema and conditionally applies seed data based on flags.
It does not create a reusable default admin account.

If `INSTALL_SETUP_TOKEN` is set, pre-READY install write routes require the
`x-install-setup-token` header. This affects:

- `/api/v1/install/start`
- `/api/v1/install/bootstrap-admin`
- `/api/v1/install/config`
- `/api/v1/install/modules`
- `/api/v1/install/execute`
- `/api/v1/install/reset`
- `/api/v1/install/check-db`

`/api/v1/install/status` remains public so the wizard can detect install mode.

If the install flow seeds demo data, it uses the resolved request locale from
the wizard (`preferred_lang` when authenticated, otherwise `sc_locale`, then
`Accept-Language`, then `cs`).

### Seed Flags

Current seed behavior is controlled by:

- `APP_RUN_DB_INIT`
- `INIT_WITH_TEST_SEEDS`
- `INIT_WITH_C3_ENTITY_SEEDS`
- `INIT_WITH_C3_BASELINE_TAXONOMY_SEED`
- `INIT_WITH_C3_TAXONOMY_XLSX_SEED`
- `INIT_WITH_C3_CAPABILITY_MAP_SEED`

Practical combinations:

- clean schema without C3 data:
  - `APP_RUN_DB_INIT=true`
  - all `INIT_WITH_* = false`
- baseline C3 initialization:
  - enable the required `INIT_WITH_C3_*` flags
- demo data for onboarding:
  - `INIT_WITH_TEST_SEEDS=true`

### Where Seed Files Must Exist

The canonical seed root is:

```text
shared/c3/
```

Typical files:

- `c3-taxonomy-seed.json`
- `c3-taxonomy-xlsx-import-seed.json`
- `c3-services-seed.json`
- `c3-applications-seed.json`
- `c3-data-objects-seed.json`
- `c3-technology-interactions-seed.json`
- `capability-map-spiral6.json`
- `capability-map-spiral7.json`

If a seed flag is enabled and the corresponding file is missing, init fails in a controlled way.

## Users, Groups, and SSO

### User Management

Route:

```text
/administration/users
```

Administrators manage:

- local accounts
- AD/SSO-backed accounts
- role assignments
- account activity and basic profile data
- user language preference (`cs` / `en`)

Language preference behavior:

- the canonical user locale is stored in `preferred_lang`
- the web UI also keeps a locale cookie `sc_locale`
- when a signed-in user changes language on `/user-info`, both the DB preference
  and the cookie are refreshed
- legacy values such as `cz` or `cze` are normalized to `cs`

### Group Management

Route:

```text
/admin/groups
```

Groups provide more granular permissions across both catalogue and C3 areas.

### Web / SSO

Route:

```text
/administration/web
```

Managed runtime parameters:

- trusted-header SSO
- principal header mapping
- display name
- email
- given name
- surname
- department

Relevant environment variables:

- `AUTH_SSO_ENABLED`
- `AUTH_SSO_HEADER`
- `AUTH_SSO_DISPLAY_NAME_HEADER`
- `AUTH_SSO_EMAIL_HEADER`
- `AUTH_SSO_GIVEN_NAME_HEADER`
- `AUTH_SSO_SURNAME_HEADER`
- `AUTH_SSO_DEPARTMENT_HEADER`
- `AUTH_SSO_TRUSTED_PROXY_HEADER`
- `AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET`

Operational notes:

- the backend trusts SSO identity headers only when the trusted proxy header is
  present and its shared secret matches
- browser auth uses `HttpOnly` cookies for access and refresh tokens
- the frontend keeps only a small user snapshot in `sessionStorage`; JWTs are
  not persisted in browser storage

## Service Catalogue Administration

### Services

Primary business editor:

```text
/services/{service_id}/edit
```

Editors or administrators maintain:

- identification
- lifecycle
- ownership
- domains
- flavours
- SLA
- relations
- C3 mappings
- validation and completeness score

### Graphs

Operational graph views:

- `/services/graph`
- `/services/{service_id}/graph`

Both support:

- `Connector type`
- `Line style`
- PDF export

## C3 Administration

### Capability List and Editor

List:

```text
/c3/list
```

Capability editor:

```text
/c3/{uuid}/edit
```

Capability detail and editing use a unified section layout with validation blocks.

### C3 Entity Editors

Dedicated editors exist for:

- `Applications`
- `Data Objects`
- `Services`
- `Technology Interactions`

Admin routes:

```text
/admin/c3-application/{code}
/admin/c3-data-objects/{code}
/admin/c3-services/{code}
/admin/c3-technology-interactions/{code}
```

These editors use the same full-page layout as the capability editor.

### Capability Builder

Route:

```text
/admin/c3-capability-builder
```

Used for:

- editing the final capability map
- changing the capability map page title
- managing Spiral 6 and Spiral 7 baseline branches

Public maps:

```text
/c3/capability-map-spiral6
/c3/capability-map-spiral7
```

## Dashboards and Control Views

### Services Dashboard

Route:

```text
/services/dashboard
```

Used for:

- catalogue KPI overview
- governance monitoring
- identifying incomplete services

### C3 Dashboard

Route:

```text
/c3/dashboard
```

Current blocks:

- `Status Breakdown`
- `Needs Mapping`
- `Most Mapped Items`
- `Coverage by Application`
- `Sync Status`
- `Capability Map Health`
- `Import & Sync Drift`
- `Link Health`
- `Review / Validation`

Operational meaning:

- `Capability Map Health` shows builder node coverage against service mappings
- `Import & Sync Drift` shows the latest import and mapping lag
- `Link Health` shows the amount of capability links into C3 entities
- `Review / Validation` shows missing metadata and review-state gaps

## Imports and Audit

### Import Upload

Route:

```text
/import/upload
```

Supported import groups:

- Service Catalogue
- C3 Taxonomy
- FMN Spirals

Supported formats depend on target:

- `CSV`
- `JSON`
- `XLSX`

The flow uses:

- dry-run
- sync
- commit
- issue reporting

### Import Audit

Routes:

```text
/import
/admin/import
```

Used for:

- batch history
- warning/error issue logs
- import troubleshooting
- detail views for specific runs

## References and Lookup Data

### Catalogue Column Edit

Route:

```text
/admin/catalogue-ref
```

Used for:

- service types
- service status
- relation types
- portfolio groups
- service lines
- other catalogue reference tables

### C3 Column Edit

Route:

```text
/admin/c3-ref
```

Used for:

- C3 mapping types
- capability domains
- other C3 reference values

## Runtime Environment Variables

Most important runtime variables:

- `DATABASE_URL`
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `ENABLE_RETENTION_SCHEDULER`
- `RETENTION_RUNNER_NAME`
- `RETENTION_RUNNER_KIND`
- `RETENTION_PURGE_INTERVAL_SECONDS`
- `RETENTION_HEARTBEAT_TTL_SECONDS`

## QNAP / Portainer Notes

QNAP deployment uses:

- `portainer-stack.yml`
- `.env.qnap`
- the bundle created by `build-amd64.sh`

Important variables:

- `QNAP_DATA_DIR`
- `QNAP_NETWORK_NAME`
- `APP_STATIC_IP`
- `POSTGRES_STATIC_IP`
- `QNAP_DNS`

If `POSTGRES_PASSWORD` differs from the password used when the volume was created for the first time, PostgreSQL rejects the login. In that case:

- reuse the original password
- or change the password inside the database
- or remove the volume and run a clean init

## Recommended Operational Checks

After deployment verify:

```text
/api/health/live
/api/health/ready
/api/health/import
```

Basic checklist:

1. `app` and `postgres` are healthy
2. login works
3. `/services/list` returns data
4. `/c3/list` returns data
5. Spiral 6 and Spiral 7 capability maps load
6. the import upload page matches the user role
7. the administration menu is visible only to authorized roles

## Common Problems

### C3 Seed Files Not Found

Symptom:

- init reports a missing file in `shared/c3`

Fix:

- add the required seed files
- or disable the corresponding `INIT_WITH_*` flag

### Password Authentication Failed for User `postgres`

Cause:

- the existing PostgreSQL volume was created with a different password than the current environment

Fix:

- reuse the original password
- or change the password inside the database
- or remove the volume and redeploy cleanly

### C3 Editor Opens but Save Fails

Current behavior:

- the C3 entity update API now uses `canEdit`
- therefore both `editor` and `admin` can save changes

### Capability Map or Dashboard Is Empty

Check:

- seed flags
- presence of files in `shared/c3`
- `C3 Capability Builder` state
- import runs and seed status
