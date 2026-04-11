# Modules

Service Catalogue uses a module registry in `platform.module_registry`. A module record describes what is installed, seeded, enabled in the API, and visible in the UI.

## Tracked Module Dimensions

Each module record tracks at least:

- `module_code`
- `module_label`
- `is_mandatory`
- `enabled`
- `schema_installed`
- `reference_seed_installed`
- `business_data_present`
- `ui_visible`
- `api_enabled`
- `version`

## `SERVICE_CATALOGUE_CORE`

Mandatory. It cannot be disabled.

### Functional Scope

- service list
- service detail
- service editing
- services, flavours, and SLA
- service relations and graphs
- ownership and domain availability
- Service Catalogue import
- dashboards and validation views

### Main Data

Key tables include:

- `service_catalog`
- `service_relation`
- `service_relation_raw`
- `service_flavour`
- `service_sla`
- `service_available_on`
- `service_role_assignment`
- `service_c3_mapping`
- `service_raw_field`
- `import_batch`
- `import_row`
- `import_issue`

### Main UI Routes

- `/services/list`
- `/services/dashboard`
- `/services/graph`
- `/services/{service_id}`
- `/services/{service_id}/edit`
- `/services/{service_id}/graph`

### Main API Groups

- `/api/v1/services`
- `/api/v1/flavours`
- `/api/v1/relations`
- `/api/v1/stats`
- `/api/v1/import`
- `/api/v1/graph`

## `C3_TAXONOMY`

Optional. Enables C3 capabilities, C3 entities, capability maps, and related imports.

### Functional Scope

- C3 capability list and detail
- C3 dashboard
- C3 graph
- C3 entity lists and details
- Spiral 6 capability map
- Spiral 7 capability map
- capability builder
- service-to-capability mapping

### Main Data

Key tables include:

- `c3_taxonomy`
- `c3_application`
- `c3_data_object`
- `c3_service`
- `c3_technology_interaction`
- `c3_technology_interaction_service_link`
- `c3_technology_interaction_application_link`
- `c3_technology_interaction_data_object_link`
- `c3_capability_builder`
- `c3_capability_application_link`
- `c3_capability_data_object_link`
- `c3_capability_tin_link`
- `c3_capability_c3_service_link`
- `c3_entity_import_run`
- `c3_entity_import_issue`

### Spiral Model

The capability map supports two baselines:

- `Spiral_6`
- `Spiral_7`

Public routes:

- `/c3/capability-map-spiral6`
- `/c3/capability-map-spiral7`

### Main UI Routes

- `/c3/list`
- `/c3/dashboard`
- `/c3/graph`
- `/c3/{uuid}`
- `/c3/{uuid}/edit`
- `/c3/services`
- `/c3/applications`
- `/c3/data-objects`
- `/c3/technology-interactions`
- `/admin/c3`
- `/admin/c3-services`
- `/admin/c3-application`
- `/admin/c3-data-objects`
- `/admin/c3-technology-interactions`
- `/admin/c3-capability-builder`

### Main API Groups

- `/api/v1/taxonomy/c3/*`
- `/api/v1/taxonomy/c3-services*`
- `/api/v1/taxonomy/c3-application*`
- `/api/v1/taxonomy/c3-data-objects*`
- `/api/v1/taxonomy/c3-technology-interactions*`
- `/api/v1/taxonomy/c3-capability-builder*`
- `/api/v1/capability-links`

## Module Lifecycle

Typical flow:

1. the module is registered in `module_registry`
2. schema layers are applied during install or repair
3. reference seeds populate lookup data and metadata
4. business data can stay empty or be seeded/imported
5. UI and API are only exposed when the module is active

## Seeds and Business Data

Modules must distinguish between:

- core schema
- reference seed
- business data

This is especially important for C3 because of:

- `INIT_WITH_C3_ENTITY_SEEDS`
- `INIT_WITH_C3_BASELINE_TAXONOMY_SEED`
- `INIT_WITH_C3_TAXONOMY_XLSX_SEED`
- `INIT_WITH_C3_CAPABILITY_MAP_SEED`
- `INIT_WITH_TEST_SEEDS`

## Practical Administration

### Where to Check Module State

- `/admin/installation`
- `/api/v1/install/status`
- `/api/v1/install/summary`

### Where to Check Business Data

- Service Catalogue:
  - `/services/dashboard`
  - `/services/list`
- C3:
  - `/c3/dashboard`
  - `/c3/list`
  - `/admin/c3-capability-builder`

## Adding a New Module

1. create the schema and seed layer
2. register the module in `module_registry`
3. wire it into install and repair flows
4. add frontend navigation
5. add health and audit logic
6. update documentation and import/export behavior
