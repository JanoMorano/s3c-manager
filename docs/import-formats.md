# Import Formats

Service Catalogue v2 supports three import formats: CSV, JSON, and XLSX.

Example payloads are available in:

```text
testdata/examples/
```

---

## CSV Import

### Accepted Content Types

- `text/csv`
- `text/plain`

The delimiter is auto-detected (`;` or `,`). BOM is removed automatically.

### Endpoints

```text
POST /api/v1/import/services/csv
Authorization: Bearer <token>
Content-Type: text/csv
```

Dry-run endpoint:

```text
POST /api/v1/import/services/csv/dry-run
```

The dry-run returns a report without writing to the database.

### Required Columns

| Column | Type | Description |
|---|---|---|
| `service_id` | string | Unique service identifier |
| `title` | string | Service title |

### Recommended Columns

| Column | Type | Description |
|---|---|---|
| `service_type_code` | enum | `CF`, `ES`, `SS` |
| `service_status_code` | enum | `active`, `planned`, `retired`, `deprecated` |
| `short_description` | string | Short description (max 500 chars) |
| `global_service_group_code` | string | Reference-table code |
| `portfolio_group_code` | string | Portfolio group |
| `service_url` | URL | Service link |

### CSV Example

```csv
service_id;title;service_type_code;service_status_code;short_description
SVC-001;Active Directory;ES;active;Central directory service for authentication
SVC-002;Exchange Online;ES;active;Microsoft 365 email service
SVC-003;SharePoint Online;ES;active;Corporate intranet and document management
```

Repository file:

- `testdata/examples/services-minimal.csv`

### Taxonomy Resolution

The import engine resolves codes against reference tables. If a code does not exist:

- the field is stored as `NULL`
- a warning is stored in `import_issue`
- the import continues; it is not a fatal error

### Conflict Behavior

- if `service_id` does **not** exist: `INSERT`
- if `service_id` **does** exist: `UPDATE` (upsert)

---

## JSON Import

### Endpoint

```text
POST /api/v1/import/services
Content-Type: application/json
Authorization: Bearer <token>
```

### Structure

```json
{
  "items": [
    {
      "service_id": "SVC-001",
      "title": "Active Directory",
      "serviceType": "ES",
      "status": "active",
      "flavours": [
        {
          "service_unit": "User",
          "service_rate_eur": 2.5,
          "billing_period_code": "monthly"
        }
      ]
    }
  ],
  "relations": [
    {
      "from_service_id": "SVC-002",
      "to_service_id": "SVC-001",
      "relation_type_code": "depends_on"
    }
  ]
}
```

Repository file:

- `testdata/examples/services-minimal.json`

### Supported Field Aliases

The import engine accepts both snake_case and camelCase variants:

| Canonical | Accepted aliases |
|---|---|
| `service_id` | `serviceId` |
| `service_type_code` | `serviceType`, `service_type` |
| `service_status_code` | `status`, `service_status` |

### Minimal Relations JSON

```json
{
  "relations": [
    {
      "from_service_id": "SVC-002",
      "to_service_id": "SVC-001",
      "relation_type_code": "depends_on"
    }
  ]
}
```

Repository file:

- `testdata/examples/relations-minimal.json`

### Minimal C3 Taxonomy JSON

```json
{
  "items": [
    {
      "page_id": "BP-1000",
      "uuid": "11111111-1111-1111-1111-111111111111",
      "title": "Business Processes",
      "parent_id": null,
      "level": 1,
      "state": "approved",
      "domain_code": "BusinessProcesses"
    }
  ]
}
```

Repository file:

- `testdata/examples/c3-taxonomy-minimal.json`

---

## Import Pipeline

Every import goes through this pipeline:

```text
parse -> normalize -> taxonomy resolve -> upsert -> audit log -> batch summary
```

### Import Batch Tracking

Each import creates a record in `data.import_batch`:

- `batch_id` — batch UUID
- `filename` — source filename
- `imported_by` — importing username
- `rows_parsed` / `rows_inserted` / `rows_updated` / `rows_failed`
- `started_at` / `completed_at`

### Import Issues

Warnings and errors are stored in `data.import_issue`:

- `issue_type`: `warning` | `error` | `taxonomy_unresolved`
- `field_name` — field name
- `raw_value` — original value
- `message` — problem description

---

## Admin UI Import Screen

The graphical import screen is available at `/admin/import`.

Features:

- CSV upload
- dry-run preview with record counts, warnings, and fatal errors
- commit with result summary
- batch history with drill-down

## Capability Builder Import

The capability map can also be imported separately:

- `POST /api/v1/taxonomy/c3-capability-builder/csv`
- `POST /api/v1/taxonomy/c3-capability-builder/csv/dry-run`

Example CSV:

```csv
Page ID,UUID,Title,Parent ID,Level,State,Domain
BP-1000,11111111-1111-1111-1111-111111111111,Business Processes,,1,approved,BusinessProcesses
BP-1100,22222222-2222-2222-2222-222222222222,Operational Planning,BP-1000,2,approved,BusinessProcesses
```

---

## Limits

| Limit | Value |
|---|---|
| Max API file size | 5 MB |
| Max wizard file size | 50 MB hint, server limit remains 5 MB |
| Import API rate limit | 10 requests / 5 minutes / IP |
| Max `service_id` length | 100 chars |
| Max `title` length | 500 chars |
