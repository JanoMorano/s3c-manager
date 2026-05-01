# Integration Profiles

s3c-manager is a lightweight governance cockpit. It can exchange a compact service catalogue contract directly, and it can document alignment to heavier enterprise catalogues without pretending to replace them.

## Direct Profiles

### `s3c-service-catalogue-json`

Native JSON profile for service governance imports and exports.

Required service fields:

- `service_id`
- `title`

Supported shape:

```json
{
  "source_name": "services.json",
  "items": [
    {
      "service_id": "SVC-IAM",
      "title": "Identity Access Management",
      "portfolio_group_code": "Application Services",
      "service_type": "CF",
      "service_status": "active"
    }
  ],
  "relations": []
}
```

Use `/api/v1/import/services/dry-run` before `/api/v1/import/services`.

### `s3c-service-catalogue-csv`

Native CSV profile for bulk service rows.

Required columns:

- `service_id`
- `title`

Recommended columns:

- `portfolio_group_code`
- `service_type`
- `service_status`
- `service_owner`
- `service_manager`
- `business_owner`
- `lifecycle_stage_code`
- `prerequisites_json`

Use `/api/v1/import/services/csv/dry-run?profile=s3c-service-catalogue-csv` before `/api/v1/import/services/csv`.

### `backstage-catalog-info`

Direct Backstage Component profile for ownership metadata exchange.

Supported import fields:

- `metadata.name`
- `metadata.title`
- `metadata.description`
- `metadata.annotations.s3c/service-id`
- `spec.type`
- `spec.lifecycle`
- `spec.owner`
- `spec.system`

Backstage to s3c-manager mapping:

| Backstage field | s3c-manager field |
| --- | --- |
| `metadata.annotations.s3c/service-id` | `service_id` |
| `metadata.title` or `metadata.name` | `title` |
| `metadata.description` | `summary` |
| `spec.type` | `service_type` |
| `spec.lifecycle` | `service_status` |
| `spec.owner` | `service_owner` |
| `spec.system` | `portfolio_group_code` |

Export endpoint:

- `/api/v1/export/backstage/catalog-info`

Import endpoint:

- `/api/v1/import/services/dry-run?profile=backstage-catalog-info`
- `/api/v1/import/services?profile=backstage-catalog-info`

## Reference Mappings

The profiles below are documentation mappings. They are not full connectors in this release.

### `archimate-reference`

Use this mapping when s3c-manager data needs to line up with an architecture repository or ArchiMate model.

| s3c-manager concept | ArchiMate reference concept |
| --- | --- |
| Service | Application Service / Technology Service / Business Service |
| Capability | Capability |
| Portfolio group | Grouping / Plateau / Architecture layer convention |
| Service relation | Serving / Flow / Access / Association |
| Decision | Assessment / Requirement / Constraint evidence |
| Readiness | Assessment result or implementation status attribute |

Practical guidance:

- Keep ArchiMate as the architecture model of record.
- Keep s3c-manager as the service/capability readiness cockpit.
- Exchange stable IDs and URLs rather than diagram layout.

### `itop-reference`

Use this mapping when aligning with iTop CMDB/service catalogue records.

| s3c-manager concept | iTop reference concept |
| --- | --- |
| Service | Service |
| Service owner / manager | Contact / Team ownership fields |
| Service relation | Dependency between CIs or service dependencies |
| Portfolio group | Service family or catalogue grouping |
| Readiness / coverage | Operational status and governance attributes |
| Decision | Linked document, change, or governance record |

Practical guidance:

- Keep iTop as CMDB/ITSM operational inventory when it is already deployed.
- Use s3c-manager for capability coverage, readiness gaps, and decision traceability.
- Import/export only stable service IDs and ownership fields unless a dedicated connector is added.

### `servicenow-csdm-reference`

Use this mapping when a ServiceNow CSDM model is the enterprise system of record.

| s3c-manager concept | CSDM reference concept |
| --- | --- |
| Service | Business Service / Application Service / Technical Service |
| Capability | Business Capability |
| Portfolio group | Service Portfolio / Taxonomy grouping |
| Service owner | Owned by / Managed by ownership fields |
| Service relation | Service offering, depends on, or CI relationship |
| Readiness | Lifecycle, operational status, governance attributes |
| Decision | Linked governance/change/architecture decision record |

Practical guidance:

- Keep ServiceNow as the workflow and system-of-record platform if already mandated.
- Use s3c-manager for a focused self-hosted view of capability coverage, readiness, ownership, and decisions.
- Treat CSDM synchronization as an integration project with scoped field ownership rules.

## Export Endpoints

- `/api/v1/export/services`
- `/api/v1/export/portfolio`
- `/api/v1/export/capabilities/coverage`
- `/api/v1/export/readiness`
- `/api/v1/export/decisions`
- `/api/v1/export/governance-report`
- `/api/v1/export/backstage/catalog-info`

## Dry-Run First

Every import flow should run a dry-run before commit. Dry-run records source hash, profile, row counts, unresolved references, and stub candidates so administrators can decide whether the import is safe.
