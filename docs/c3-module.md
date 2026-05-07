# C3 Module

## What the C3 Module Does

The optional `C3_TAXONOMY` module extends the application with:

- C3 taxonomy lists
- C3 entity detail pages plus authenticated editors for `Services`, `Applications`, `Data Objects`, and `Technology Interactions`
- capability maps for:
  - `Spiral 6`
  - `Spiral 7`
- the capability builder and mappings to catalogue services

If the module is not activated during installation, both C3 UI and C3 APIs remain unavailable.

At API level, C3 read and edit endpoints are part of the authenticated application API. Common read endpoints include:

- `GET /api/v1/taxonomy/c3/types`
- `GET /api/v1/taxonomy/c3/statuses`
- `GET /api/v1/taxonomy/c3/parent-options`
- `GET /api/v1/taxonomy/security-classifications`
- `GET /api/v1/taxonomy/c3`
- detail lookups by code for services, applications, data objects, and technology interactions

Capability maps, C3 entity workspaces, and capability-builder domains are served behind the authenticated app shell and require a logged-in user.

## Spiral 6 vs Spiral 7

### Spiral 6

- historical baseline snapshot
- route: `/c3/capability-map-spiral6`
- source: `shared/c3/capability-map-spiral6.json`
- intended as a read-only reference view

### Spiral 7

- active editable capability map
- route: `/c3/capability-map-spiral7`
- sources:
  - baseline seed `shared/c3/capability-map-spiral7.json`
  - runtime builder data in `data.c3_capability_builder`

The old `/c3/capability-map` compatibility route is not part of the v1.2 final surface.

## Activation During Installation

1. Run a clean deployment.
2. In the install wizard, enable the `C3 Taxonomy` module.
3. If you want preloaded C3 data, use these flags:

```env
INIT_WITH_C3_ENTITY_SEEDS=true
INIT_WITH_C3_BASELINE_TAXONOMY_SEED=true
INIT_WITH_C3_CAPABILITY_MAP_SEED=true
```

Optional XLSX-derived taxonomy snapshot:

```env
INIT_WITH_C3_TAXONOMY_XLSX_SEED=true
```

## Seed Sources

Canonical seed root:

```text
shared/c3/
```

Required baseline snapshots:

- `c3-services-seed.json`
- `c3-applications-seed.json`
- `c3-data-objects-seed.json`
- `c3-technology-interactions-seed.json`
- `c3-taxonomy-seed.json`
- `capability-map-spiral7.json`

Optional:

- `c3-taxonomy-xlsx-import-seed.json`
- `capability-map-spiral6.json`
- `import-csv/*.csv`

## Capability Map

The map renders the capability tree by:

- domain
- levels 1-4
- spiral
- mappings to catalogue services

Application behavior:

- Spiral 6 stays a read-only baseline
- Spiral 7 is the active builder layer with editable service mappings
- capability-map and C3 workspace pages are only rendered after application sign-in

## Capability Coverage

Production capability coverage is exposed through the generic capability endpoints and the capability pages. The legacy FMN Air C2 web route `/c3/fmn-air-c2` is intentionally not part of production navigation.

Use the generic capability endpoints:

```text
GET /api/v1/capabilities/by-slug/:slug/coverage?spiral=Spiral_5
GET /api/v1/capabilities/by-slug/:slug/gaps?spiral=Spiral_5
GET /api/v1/capabilities/by-slug/:slug/duplicate-coverage?spiral=Spiral_5
GET /api/v1/capabilities/by-slug/:slug/consolidation-candidates?spiral=Spiral_5
```

The current implementation deliberately keeps PDF storage/viewer out of v1.1.2 scope. Evidence document rows are generated from imported C3 taxonomy, spiral membership, and service mappings, and they intentionally do not contain developer-local PDF paths. If future FMN PDFs are imported as structured documents, they should be connected through the generic evidence model without reintroducing route-specific constants or route-specific dashboards.

## How to Load Your Own Data

Three supported approaches:

1. baseline JSON seed during init
2. admin builder at `/administration/c3-capability-builder`
3. capability builder CSV/JSON import endpoints

## Import Scenarios

### Taxonomy Baseline

- use `shared/c3/c3-taxonomy-seed.json`
- taxonomy is seeded during init

### XLSX-Derived Taxonomy

- generate `shared/c3/c3-taxonomy-xlsx-import-seed.json`
- enable `INIT_WITH_C3_TAXONOMY_XLSX_SEED=true`

### Capability Builder Import

- UI: admin capability builder
- API:
  - `/api/v1/taxonomy/c3-capability-builder/csv`
  - `/api/v1/taxonomy/c3-capability-builder/csv/dry-run`
  - `/api/v1/taxonomy/c3-capability-builder/sync`

## Recommended Operating Model

- keep Spiral 6 as a read-only historical reference
- use Spiral 7 as the active working map
- audit imports and builder changes
- review service mappings through the C3 entity workspace and capability map health blocks
