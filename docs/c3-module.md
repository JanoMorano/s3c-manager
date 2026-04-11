# C3 Module

## What the C3 Module Does

The optional `C3_TAXONOMY` module extends the application with:

- C3 taxonomy lists
- the C3 dashboard
- public detail pages and editors for `Services`, `Applications`, `Data Objects`, and `Technology Interactions`
- capability maps for:
  - `Spiral 6`
  - `Spiral 7`
- the capability builder and mappings to catalogue services

If the module is not activated during installation, both C3 UI and C3 APIs remain unavailable.

## Spiral 6 vs Spiral 7

### Spiral 6

- historical baseline snapshot
- route: `/c3/capability-map-spiral6`
- source: `shared/c3/capability-map-spiral6.json`
- intended as a read-only reference view

### Spiral 7

- active editable capability map
- route: `/c3/capability-map-spiral7`
- legacy alias: `/c3/capability-map`
- sources:
  - baseline seed `shared/c3/capability-map-spiral7.json`
  - runtime builder data in `data.c3_capability_builder`

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

## How to Load Your Own Data

Three supported approaches:

1. baseline JSON seed during init
2. admin builder at `/admin/c3-capability-builder`
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
- review service mappings through the C3 dashboard and capability map health blocks
