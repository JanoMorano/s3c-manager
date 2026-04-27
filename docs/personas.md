# Product Personas for s3c-manager v1.1.0

Personas are UX lenses over the same RBAC-secured data. They do not grant permissions.

| Persona | Daily job | Show first | De-emphasize | Default landing |
|---|---|---|---|---|
| Consumer | Find a useful service and request access | Catalogue, service value, request path | Governance debt, raw C3 tables | `/catalogue` |
| Service Owner | Keep owned services publishable and mapped | Inbox, readiness blockers, service editor | Enterprise-wide admin metrics | `/catalogue?view=owner` |
| Capability Manager | Assess spiral readiness, gaps, overlaps, consolidation | Spirals, capabilities, heatmaps, fulfillment plan | Raw service admin unless drilling down | `/spirals/active`, fallback `/spirals`, then `/catalogue` |
| Administrator | Operate the catalogue platform and data quality | Operations, import, users, reference data | Consumer marketing copy | `/operations` |

Route visibility matrix:

| Route | Consumer | Service Owner | Capability Manager | Administrator |
|---|---|---|---|---|
| `/catalogue` | Primary | Primary owner view | Secondary | Secondary |
| `/services/*` | Primary read/request | Primary edit/own | Drilldown | Full |
| `/capabilities/*` | Linked evidence only | Secondary | Primary | Primary |
| `/spirals/*` | Hidden unless linked | Secondary | Primary | Primary |
| `/operations` | Hidden | Contextual tasks | Secondary | Primary |
| `/administration` | Hidden | Hidden | Expert/reference | Primary |
| `/c3/*` | Expert link only | Expert link only | Expert/reference overflow | Expert/reference overflow |

`/c3` remains an expert/reference area. It must not become the primary journey for any persona.
