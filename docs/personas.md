# Product Personas for s3c-manager v1.2.1

Personas are UX lenses over the same RBAC-secured data. They do not grant permissions.

| Persona | Daily job | Show first | De-emphasize | Default landing |
|---|---|---|---|---|
| Consumer | Find a useful service and understand how to request or use it | Catalogue, service value, request channel, lifecycle | Governance debt, raw C3/reference tables | `/catalogue` |
| Service Owner | Keep owned services publishable and mapped | My Tasks, service editor, readiness blockers, ownership, offerings | Enterprise-wide admin metrics | `/cockpit/my-tasks` |
| Capability Manager | Assess coverage, gaps, overlaps, and impact | Capabilities workspace, coverage, service mappings, impact analysis | Raw service admin unless drilling down | `/capabilities` |
| Administrator | Operate the catalogue platform and data quality | Operations, import, users, web/SSO, reference data, installation | Consumer marketing copy | `/operations` |

Route visibility matrix:

| Route | Consumer | Service Owner | Capability Manager | Administrator |
|---|---|---|---|---|
| `/catalogue` | Primary | Primary owner context | Secondary | Secondary |
| `/services/list` | Browse/filter | Working list | Drilldown | Full |
| `/services/*` | Primary read/request | Primary edit/own | Drilldown | Full |
| `/cockpit/my-tasks` | Hidden | Primary | Secondary | Secondary |
| `/operations` | Hidden | Contextual tasks | Secondary | Primary |
| `/operations/readiness` | Hidden | Primary for blockers | Secondary | Primary |
| `/operations/reviews` | Hidden | Review participation | Secondary | Primary |
| `/operations/decisions` | Read linked decisions | Read/write by permission | Primary evidence | Primary evidence |
| `/capabilities/*` | Linked evidence only | Secondary | Primary | Primary |
| `/c3/*` | Expert link only | Expert link only | Expert/reference overflow | Expert/reference overflow |
| `/import` | Hidden | Contextual data quality | Contextual evidence | Primary data quality |
| `/administration/*` | Hidden | Hidden | Hidden except expert delegation | Primary |
| `/management/new-service` | Hidden | Primary create flow | Secondary create flow | Full |

Canonical route families:

- `/catalogue` is the consumer-facing catalogue.
- `/services/*` is service detail, list, graph, impact, and editor context.
- `/operations/*` is the action queue for readiness, reviews, decisions, owner load, and data quality.
- `/capabilities/*` is the capability manager workspace.
- `/c3/*` is expert/reference overflow, not a primary journey.
- `/administration/*` is the canonical administration namespace.
- `/admin/*` frontend aliases are not part of the v1.2.1 final surface.
