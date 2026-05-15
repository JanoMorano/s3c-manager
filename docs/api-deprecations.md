# Removed API Endpoints

Reduction release: `v1.1.3-reduction`
Physical removal: `v1.2.2 final sunset state`
Reason: this handover has no production compatibility window and no external consumers to preserve.

These endpoints no longer return controlled `410 ENDPOINT_RETIRED` responses. They are intentionally removed from the mounted API surface; callers should use the listed replacement workflow or endpoint.

| Removed endpoint | Methods | Replacement | Notes |
|---|---:|---|---|
| `/api/v1/notifications/*` | all | `/api/v1/dashboard/inbox`, operations/governance queues | Notification inbox/bell is not part of the product boundary. |
| `/api/v1/service-requests/*` | all | service `request_channel_url` | Internal fulfilment workflow was removed; request execution belongs in external ITSM. |
| `/api/v1/import/bulk-folder/dry-run` | POST | `/api/v1/import/services/csv/dry-run` | Server-side folder scanning was removed; use explicit uploaded CSV evidence. |
| `/api/v1/import/bulk-folder/commit` | POST | `/api/v1/import/services/csv` | Use controlled upload/import execution. |
| `/api/v1/auth/me/persona` | GET, PUT | `/api/v1/auth/me` | Persona is not a runtime state axis. |
| `/api/v1/auth/preferences/:key` | GET, PUT | `PUT /api/v1/auth/preferences` | Only language/theme preference updates remain. |
| `/api/v1/governance/risk-radar` | GET | `/api/v1/governance/owner-load`, `/api/v1/readiness/summary` | Replaced by action queues and readiness signals. |
| `/api/v1/governance/contract-overlap` | GET | `/api/v1/governance/owner-load` | Procurement/contract cockpit is outside the core product. |
| `/api/v1/governance/renewal-calendar` | GET | `/api/v1/governance/reviews` | Review queues replace standalone calendar workflow. |
| `/api/v1/governance/advisor` | GET | `/api/v1/operations`, governance decisions | Advisor/finding surface is outside the reduced cockpit. |
| `/api/v1/governance/findings/:id/dismiss` | POST | audited governance decision | Dismissal without decision log is removed. |
| `/api/v1/export/route-metadata` | GET | `/api/v1/export/manifest` | Route metadata compatibility export removed. |
| `/api/v1/export/taxonomy` | GET | `/api/v1/export/capability-map-hierarchy` | Taxonomy export collapsed into capability/C3 exports. |
| `/api/v1/export/graph-overview` | GET | `/api/v1/export/bundle` | Standalone graph export removed. |
| `/api/v1/export/services` | GET | `/api/v1/export/backstage/catalog-info` | Service export narrowed to preserved bundle/backstage contracts. |
| `/api/v1/export/portfolio` | GET | `/api/v1/export/governance-report` | Portfolio evidence lives in the governance report. |
| `/api/v1/export/readiness` | GET | `/api/v1/export/governance-report` | Readiness evidence lives in the governance report. |
| `/api/v1/export/decisions` | GET | `/api/v1/export/governance-report` | Decision evidence lives in the governance report. |
| `/api/v1/export/pricing` | GET | `/api/v1/export/bundle` | Legacy variant evidence remains in bundle only. |
| `/api/v1/export/sla` | GET | `/api/v1/export/bundle` | SLA evidence remains in bundle/reporting. |
| `/api/v1/export/archive-audit-reporting` | GET | `/api/v1/export/bundle` | Archive reporting compatibility export removed. |
| `/api/v1/stats/export` | GET | `/api/v1/export/bundle` | Bulk stats export removed. |
| `/api/v1/stats/domains` | GET | `/api/v1/stats/dashboard` | Standalone domain stats removed. |
| `/api/v1/stats/recalculate` | POST | `/api/v1/readiness/summary` | Synchronous recalculation endpoint removed. |

Core kept API groups are: auth/session, services, capabilities/C3, graph/impact, governance reviews/decisions/owner-load, readiness, import upload/dry-run/commit, export manifest/bundle/governance-report/capability-map/backstage, admin/reference data, search and health.
