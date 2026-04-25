# Demo Guide

## Static Preview (no install required)

Before running the application, you can explore it through three self-contained HTML demo pages. Open them directly in a browser — no server, no Docker, no credentials needed.

| File | Description |
|---|---|
| [demo/01-install.html](demo/01-install.html) | Installation wizard — 11 interactive steps with live progress, connectivity checks, module selection, and execution log |
| [demo/02-catalogue.html](demo/02-catalogue.html) | Service catalogue — filter rail, lifecycle badges, requestability, KPI dashboard, full service detail with all 6 tabs |
| [demo/03-new-service.html](demo/03-new-service.html) | New service wizard — 8-step onboarding with ITIL field hints, C3 mapping, and live review summary |

The fastest way to understand the application is to run it with demo data.

## Demo Mode

Set the following in `.env`:

```env
APP_RUN_DB_INIT=true
INIT_WITH_TEST_SEEDS=true
INIT_WITH_C3_ENTITY_SEEDS=true
INIT_WITH_C3_BASELINE_TAXONOMY_SEED=true
INIT_WITH_C3_CAPABILITY_MAP_SEED=true
```

Then start the stack:

```bash
docker compose up -d
```

## What the Demo Data Includes

- sample services in the catalogue
- relations and flavours
- SLA, ownership, and availability
- C3 entities
- Spiral 6 and Spiral 7 capability maps
- a service dependency graph for a single service

## Recommended Demo Paths

### Service Catalogue

1. Open `/services/list`
2. Open a service detail
3. Switch to `Service Dependency Graph`

### C3

1. Open `/c3/dashboard`
2. Open `/c3/capability-map-spiral7`
3. Open `/c3/capability-map-spiral6`
4. Open `/c3/graph`

### Imports

1. Open `/import/upload`
2. Upload the sample payloads from `testdata/examples/`
3. Compare dry-run and commit results

## Credentials

Use the administrator account you created in the install wizard, or an
explicitly provisioned admin account in your environment.

There is no shared default `admin / Admin123!` login on a clean install.
