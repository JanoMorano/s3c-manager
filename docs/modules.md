# Modules

S3C Manager uses `platform.module_registry` to track installed, enabled, seeded, UI-visible, and API-enabled modules.

## `SERVICE_CATALOGUE_CORE`

Mandatory. It cannot be disabled.

### Functional Scope

- service list, detail, editor, graph, and impact analysis
- service offerings, SLA/support evidence, ownership, relations, and domain availability
- readiness rules and exceptions
- governance reviews and decisions
- operations cockpit and owner load panel
- service portfolio views
- service import/export and audit evidence

Legacy `service_flavour` data may remain as read-only historical variant evidence. New service variants should use `service_offering`.

### Main Data

- `service_catalog`
- `service_relation`
- `service_relation_raw`
- `service_offering`
- `service_flavour` as legacy evidence
- `service_sla`
- `service_available_on`
- `service_role_assignment`
- `service_c3_mapping`
- `service_portfolio`
- `readiness_rule`
- `readiness_exception`
- `governance_review`
- `governance_decision`
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
- `/portfolio`
- `/operations`
- `/operations/readiness`
- `/operations/reviews`
- `/operations/decisions`
- `/import`
- `/import/upload`

### Main API Groups

- `/api/v1/services`
- `/api/v1/relations`
- `/api/v1/stats`
- `/api/v1/import`
- `/api/v1/graph`
- `/api/v1/portfolio`
- `/api/v1/readiness`
- `/api/v1/governance`
- `/api/v1/impact`

## `C3_TAXONOMY`

Optional. Enables C3 capabilities, C3 entities, capability maps, and related imports.

### Functional Scope

- capability workspace
- coverage, gaps, and overlaps
- C3 entity list/detail/edit workspaces
- C3 entity workspaces and capability maps
- C3/capability import and builder flows

### Main UI Routes

- `/capabilities`
- `/c3/list`
- `/c3/{uuid}`
- `/c3/capability-map-spiral7`
- `/c3/capability-map-spiral6`
- `/c3/services`
- `/c3/applications`
- `/c3/data-objects`
- `/c3/technology-interactions`
- `/administration/c3-ref`
- `/administration/c3-capability-builder`

Coverage, gaps and overlaps are folded into the canonical `/capabilities` workspace. Removed `/admin/*`, `/c3/graph`, and separate `/capabilities/{coverage,gaps,overlaps}` frontend aliases are not part of the v1.2 final surface.
