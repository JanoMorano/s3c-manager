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
DEMO_SEED_LOCALE=en
```

Then start the stack:

```bash
docker compose up -d
```

## What the Demo Data Includes

- 8 sample services across `active`, `planned`, `draft`, `deprecated`, and `retired`
- 3 demo portfolios: shared services, security services, and data services
- 12 service offerings and 12 pricing flavours
- owner assignments across more than 6 people/groups, including one intentionally ownerless draft service
- relations, SLA, ownership, availability, and a 3-level impact chain: Observability → Process Automation → Data Analytics → Platform Integration
- C3 entities
- Spiral 6 and Spiral 7 capability maps
- capability coverage examples: uncovered capability, over-covered capability, primary mapping, supporting mapping, and incomplete mapping
- readiness blockers and one readiness exception
- governance reviews and decision log examples

## Recommended Demo Paths

### Service Catalogue

1. Open `/services/list`
2. Open a service detail
3. Inspect `Readiness`, `Governance`, `Capabilities`, and `Dependencies` in Service 360
4. Switch to `Service Dependency Graph`

### Governance Cockpit

1. Open `/operations`
2. Review readiness, capability coverage, review deadlines, owner load, and recent decisions
3. Open `/operations/readiness`
4. Find the draft collaboration service blocker and the automation service exception
5. Open `/operations/reviews` and `/operations/decisions`

### C3

1. Open `/c3/dashboard`
2. Open `/c3/capability-map-spiral7`
3. Open `/c3/capability-map-spiral6`
4. Open `/c3/graph`

### Capability And Impact

1. Open `/capabilities/coverage`
2. Open `/capabilities/gaps` to see the uncovered demo capability
3. Open `/capabilities/overlaps` to see duplicated service support
4. Open `/services/impact` and run impact analysis from `DEMO-OBS-007`

### Imports

1. Open `/import/upload`
2. Upload the sample payloads from `testdata/examples/`
3. Compare dry-run and commit results

## Credentials

Use the administrator account you created in the install wizard, or an
explicitly provisioned admin account in your environment.

There is no shared default `admin / Admin123!` login on a clean install.
