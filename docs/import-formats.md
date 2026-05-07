# Import Formats

## Purpose

S3C Manager imports service, relation, offering, owner, SLA/support, and C3/capability evidence. Import is a controlled data-quality workflow, not a replacement for the source systems that own fulfilment, billing, procurement, or incident processes.

## Canonical UI Routes

- `/import` - import review and data-quality workspace
- `/import/upload` - controlled upload flow
- `/administration/import` - admin import profiles and troubleshooting evidence

## Service JSON Import

Endpoint:

```text
POST /api/v1/import/services
Content-Type: application/json
```

Minimal structure:

```json
{
  "items": [
    {
      "service_id": "SVC-001",
      "title": "Identity Access Management",
      "service_type": "platform",
      "lifecycle_state": "draft",
      "requestable": true,
      "request_channel_url": "https://example.test/request/iam",
      "service_owner": "owner@example.com",
      "offerings": [
        {
          "offering_code": "standard",
          "title": "Standard access",
          "requestable": true,
          "lead_time_text": "2 business days"
        }
      ],
      "sla": {
        "availability": 99.5,
        "support_hours": "Business hours"
      }
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

Lifecycle values for service imports should be `draft`, `live`, `deprecated`, or `retired`. Legacy lifecycle/status values may be read and normalized by the application, but new import profiles should produce canonical values.

Legacy `flavours` may still be accepted as historical variant evidence when an older source file contains them. New profiles should prefer `offerings`.

## C3 Taxonomy JSON

```json
{
  "items": [
    {
      "page_id": "BP-1000",
      "uuid": "11111111-1111-1111-1111-111111111111",
      "title": "Business Processes",
      "parent_id": null,
      "level": 1,
      "state": "live",
      "domain_code": "BusinessProcesses"
    }
  ]
}
```

Repository example:

- `testdata/examples/c3-taxonomy-minimal.json`

## Import Pipeline

Every import goes through this pipeline:

```text
parse -> normalize -> taxonomy resolve -> dry-run/preview -> upsert -> audit log -> batch summary
```

Each import creates records for:

- `data.import_batch`
- `data.import_row`
- `data.import_issue`
- source hash/raw evidence tables where the import profile supports them

Do not drop import evidence during ordinary cleanup. It is required for auditability and troubleshooting.

## Capability Builder CSV

Endpoint examples:

- `POST /api/v1/taxonomy/c3-capability-builder/csv`
- `POST /api/v1/taxonomy/c3-capability-builder/csv/dry-run`

Example CSV:

```csv
Page ID,UUID,Title,Parent ID,Level,State,Domain
BP-1000,11111111-1111-1111-1111-111111111111,Business Processes,,1,live,BusinessProcesses
BP-1100,22222222-2222-2222-2222-222222222222,Operational Planning,BP-1000,2,live,BusinessProcesses
```

## Practical Rules

- Use dry-run before commit for production imports.
- Keep `service_id` stable; it is the upsert key.
- Prefer service offerings over legacy variant evidence.
- Prefer canonical lifecycle values.
- Treat warnings as data-quality work, not as UI decoration.
- Review import issues from `/import` and deeper admin evidence from `/administration/import`.
