# Demo Guide

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
