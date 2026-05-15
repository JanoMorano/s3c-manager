# Modules

S3C Manager is moving toward a modular architecture. The current implementation
keeps one codebase and shared PostgreSQL runtime, but makes ownership boundaries
explicit in code, installation state, navigation, API route mounting, DB module
entrypoints, and module-scoped runtime deployment profiles.

`platform.module_registry` remains the runtime source of truth for installed,
enabled, UI-visible, and API-enabled modules. Mandatory modules fall back to
enabled behavior for compatibility with existing v1.2.2 databases that do not
yet have the new registry rows.

## Module Boundaries

| Module code | Label | Required | Purpose |
| --- | --- | --- | --- |
| `DATABASE_LAYER` | Database Layer | Yes | PostgreSQL bootstrap, schemas, shared reference tables, migration/install metadata. |
| `PLATFORM_CORE` | Platform Core | Yes | Install/upgrade flow, auth, users, groups, SSO, audit, app config, health, shared guards. |
| `SERVICE_CATALOGUE_CORE` | Service Catalogue | Yes | Service catalogue, service detail/edit, offerings, SLA/support, relations, import/export. |
| `C3_TAXONOMY` | C3 Capability Taxonomy | No | C3 taxonomy, C3 entities, capabilities, maps, C3 imports, service-to-C3 mappings. |
| `MANAGEMENT` | Management Cockpit | Yes | Operations cockpit, readiness, reviews, decisions, owner load, portfolio, impact. |

`SERVICE_CATALOGUE_CORE` keeps its historical code for compatibility. In the new
architecture it means "Service Catalogue", not "the whole core platform".

## Dependency Direction

```text
DATABASE_LAYER
└─ PLATFORM_CORE
   ├─ SERVICE_CATALOGUE_CORE
   │  └─ MANAGEMENT
   └─ C3_TAXONOMY

MANAGEMENT may read C3 signals when C3_TAXONOMY is active, but it must not
require C3 to run.
```

## `DATABASE_LAYER`

Infrastructure module. It is not shown as a user-facing UI module.

### Functional Scope

- database bootstrap
- platform/data schema creation
- shared reference lookup tables
- migration and release metadata tables
- module registry and module installation history

### Main DB Slices

- `00_bootstrap`
- `01_platform`
- `02_ref`
- `10_indexes`
- `13_install_system`

## `PLATFORM_CORE`

Mandatory platform module. It owns cross-cutting application services and must
not depend on service catalogue, C3, or management behavior.

### Functional Scope

- install wizard and repair/upgrade state
- authentication, refresh sessions, users, groups, roles, SSO settings
- audit log and app configuration
- request context, health/readiness, shared security middleware
- shared frontend shell, auth guard, module-aware route guard, i18n bootstrap

### Main UI Routes

- `/login`
- `/search`
- `/install`
- `/user-info`
- `/administration`

### Main API Groups

- `/api/v1/install`
- `/api/v1/auth`
- `/api/v1/admin`
- `/api/v1/ref`
- `/api/v1/search`

## `SERVICE_CATALOGUE_CORE`

Mandatory business module for the service catalogue.

### Functional Scope

- service list, detail, editor, graph, and service-level impact inputs
- service offerings, SLA/support evidence, audience, operational links
- service ownership, relations, lifecycle, domains, and import evidence
- service import/export and catalogue quality checks

`service_c3_mapping` is still physically present in the current DB schema for
compatibility, but its logical owner is `C3_TAXONOMY`.

### Main Data

- `service_catalog`
- `service_relation`
- `service_relation_raw`
- `service_offering`
- `service_flavour` as legacy evidence
- `service_sla`
- `service_available_on`
- `service_role_assignment`
- `service_raw_field`
- `import_batch`
- `import_row`
- `import_issue`

### Main UI Routes

- `/catalogue`
- `/services/list`
- `/services/graph`
- `/services/{service_id}`
- `/services/{service_id}/edit`
- `/services/{service_id}/graph`
- `/management/new-service`
- `/import`
- `/import/upload`
- `/admin/import`
- `/administration/import`
- `/administration/catalogue-ref`

### Main API Groups

- `/api/v1/services`
- `/api/v1/flavours`
- `/api/v1/relations`
- `/api/v1/graph`
- `/api/v1/import`
- `/api/v1/export`
- `/api/v1/stats`

## `C3_TAXONOMY`

Optional domain module. C3 remains one cohesive module rather than being split
into smaller submodules.

### Functional Scope

- capability workspace
- coverage, gaps, and overlaps
- C3 taxonomy and capability maps
- C3 entity list/detail/edit workspaces
- C3 applications, data objects, services, and technology interactions
- C3 import, ArchiMate import, XLSX import, and capability builder flows
- service-to-C3 mappings and C3 graph extensions

### Main Data

- `c3_taxonomy`
- `c3_application`
- `c3_data_object`
- `c3_service`
- `c3_technology_interaction`
- `c3_entity_import_run`
- `c3_entity_import_issue`
- `c3_entity_spiral_membership`
- `service_c3_mapping`
- `taxonomy_mapping_audit`
- capability coverage/governance views

### Main UI Routes

- `/capabilities`
- `/capabilities/{slug}`
- `/c3/list`
- `/c3/{uuid}`
- `/c3/{uuid}/edit`
- `/c3/capability-map-spiral7`
- `/c3/capability-map-spiral6`
- `/c3/services`
- `/c3/applications`
- `/c3/data-objects`
- `/c3/technology-interactions`
- `/spirals`
- `/administration/c3-ref`
- `/administration/c3-capability-builder`

### Main API Groups

- `/api/v1/capabilities`
- `/api/v1/spirals`
- `/api/v1/taxonomy/c3*`
- `/api/v1/taxonomy/spiral*`
- `/api/v1/taxonomy/import-runs*`
- `/api/v1/graph/c3-relations`

## `MANAGEMENT`

Mandatory governance and operations module over the service catalogue. It can
enrich outputs with C3 signals when `C3_TAXONOMY` is enabled, but all core
management workflows must still function without C3.

### Functional Scope

- operations cockpit
- readiness gates and exceptions
- governance reviews and decisions
- owner load and personal task queues
- portfolio views
- impact analysis and management dashboards

### Main Data

- `service_portfolio`
- `readiness_rule`
- `readiness_exception`
- `governance_review`
- `governance_decision`
- contract/governance views
- impact analysis views

### Main UI Routes

- `/cockpit/my-tasks`
- `/operations`
- `/operations/readiness`
- `/operations/reviews`
- `/operations/decisions`
- `/operations/owner-load`
- `/portfolio`
- `/portfolio/{code}`

### Main API Groups

- `/api/v1/dashboard`
- `/api/v1/governance`
- `/api/v1/portfolio`
- `/api/v1/readiness`
- `/api/v1/impact`

## Current Implementation Notes

- Backend route mounting is now grouped through `middleware/src/modules/api-route-groups.js`.
- Backend module definitions live in `middleware/src/modules/manifest.js`.
- Backend API ownership is split into module route owners:
  - `middleware/src/modules/core/routes.js`
  - `middleware/src/modules/core/search.routes.js`
  - `middleware/src/modules/service-catalogue/routes.js`
  - `middleware/src/modules/c3-taxonomy/routes.js`
  - `middleware/src/modules/management/routes.js`
- Backend module API payloads are serialized through
  `middleware/src/modules/module-serialization.js`, so `/install/modules`,
  `/install/status`, and `/install/summary` expose the same manifest fields.
- Frontend route ownership lives in `frontend/features/modules/manifest.ts`.
- Frontend domain ownership lives in
  `frontend/features/modules/domain-modules.ts`.
- The install wizard module step calls `/api/v1/install/modules` and renders the
  returned module plan instead of hard-coding the Service Catalogue/C3 pair.
- The install wizard stepper/content dispatch is driven by
  `INSTALL_WIZARD_MANIFEST` in `frontend/app/install/page.tsx`; module content is
  loaded from the backend module manifest payload.
- `/api/v1/install/status` and `/api/v1/install/summary` return module
  registry state enriched with manifest metadata such as kind, dependencies,
  optional integrations, route prefixes, and DB slices.
- The install flow activates mandatory modules and optionally activates
  `C3_TAXONOMY`.
- Startup synchronizes manifest-defined module rows into
  `platform.module_registry` without overwriting existing enabled/UI/API state.
- Physical DB ownership is split under `backend/db/postgres/modules`. Each
  module has a `module.sql` entrypoint that includes its owned legacy schema
  slices, and `backend/db/postgres/modules/manifest.json` maps module codes to
  the SQL slices.
- Global search is exposed through `/api/v1/search/global` and
  `/api/v1/search/suggest`. Results are returned as ordered module/help groups
  so the top navigation autocomplete and `/search` page use the same search
  contract.
- Build/deploy module units are defined in `modules/build-units.json` and
  `deploy/modules/docker-compose.modules.yml`. Each unit starts the shared image
  with `S3C_ACTIVE_MODULES`, so a runtime instance mounts only its declared API
  module. This is still a shared-code modular deployment model, not a fully
  extracted microservice estate.
- Boundary validation is enforced by `scripts/validate-module-boundaries.mjs`
  and can be run from both middleware and frontend via `npm run lint:modules`
  once dependencies/package tooling are available.

## Validation Contract

Run this from the repository root:

```bash
node scripts/validate-module-boundaries.mjs
```

The validator checks:

- every backend module has a DB module manifest, boundary rule, and build unit
- every SQL slice in `backend/db/postgres/schema` has exactly one module owner
- backend DB slices match `middleware/src/modules/manifest.js`
- module SQL entrypoints include their declared source slices
- `api-route-groups.js` delegates route ownership to module route files
- deploy module units exist and point to real owner files
- deploy module units declare `active_modules`
- `deploy/modules/docker-compose.modules.yml` configures `S3C_ACTIVE_MODULES`
  for each module runtime
