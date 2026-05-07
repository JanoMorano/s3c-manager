# Governance Cockpit

S3C Manager is a lightweight, self-hosted service and capability governance cockpit. The cockpit helps teams answer four operational questions without adopting a heavy ITSM, CMDB autodiscovery, or enterprise architecture repository:

- Which services are ready to publish?
- Which capabilities are uncovered, over-covered, or blocked by readiness?
- Who owns the service, review, and decision?
- What changes when a service or capability changes?

## Cockpit Entry

Route:

```text
/operations
```

The Decision Cockpit shows:

- Governance Health
- Readiness Queue
- Capability Coverage
- Review Deadlines
- Owner Load
- Recent Decisions

Each signal links to the deeper operational page that owns the work.

## Recommended Operating Flow

1. Create or import the service record.
2. Add at least one service offering and SLA/cost evidence.
3. Assign owner, steward, or reviewer roles.
4. Map the service to a primary capability or C3 item.
5. Open Service 360 and resolve readiness blockers.
6. Request governance review.
7. Approve, reject, or defer the decision with rationale.
8. Inspect capability coverage, gaps, and overlaps.
9. Run impact analysis before lifecycle, dependency, or capability changes.

## Key Pages

| Area | Route | Purpose |
|---|---|---|
| Decision Cockpit | `/operations` | first operational screen after login |
| Readiness Queue | `/operations/readiness` | named rule results, blockers, warnings, and exceptions |
| Governance Reviews | `/operations/reviews` | review request, assignment, status, and deadlines |
| Decision Log | `/operations/decisions` | auditable approval, rejection, deferral, and retirement decisions |
| Capability Workspace | `/capabilities` | coverage, gaps, overlaps, readiness, and mapped service evidence |
| Global Service Graph | `/services/graph` | portfolio-level dependency and C3 relationship reading |
| Service Graph | `/services/{service_id}/graph` | upstream/downstream impact paths for one service |
| Service 360 | `/services/{service_id}` | one service's owners, offerings, mappings, readiness, decisions, dependencies, and audit |

## Readiness Semantics

Readiness is evaluated as named rules. The default rules cover:

- service has owner
- service has offering
- service has lifecycle stage
- service has primary capability mapping
- service has complete primary capability
- service has SLA or valid exception
- service has dependency classification
- service has review date
- requestable service has offering evidence or valid exception

Exceptions are auditable, rule-specific, and can expire. Use them for time-bound governance waivers, not as a substitute for service data.

## Decision Semantics

Governance decisions are intentionally narrow:

- `approved` means the service can proceed for the selected decision type.
- `rejected` means the service must be corrected before proceeding.
- `deferred` means a known blocker is accepted temporarily with rationale.
- `cancelled` means the workflow is intentionally closed without approval.

Reject and defer decisions should always include rationale that a future reviewer can understand.

## Demo Data

With `INIT_WITH_TEST_SEEDS=true`, the demo dataset includes:

- 8 services across active, planned, draft, deprecated, and retired states
- 3 portfolios and more than 6 owners/groups
- 12 service offerings and 12 legacy variant evidence records
- one draft service with readiness blockers
- one readiness exception for a planned automation service
- governance reviews and decision log entries
- C3/FMN coverage examples: uncovered, over-covered, primary, supporting, and incomplete mappings
- a 3-level dependency chain for impact analysis

Set `DEMO_SEED_LOCALE=en` to force English demo copy. If omitted, the seed uses the app/system locale and falls back to `cs`.

## Product Boundary

Use S3C Manager when the problem is service-capability governance, readiness, ownership, coverage, and decision traceability.

Use another system when you need:

- ticketing, incident, problem, or change execution
- automated CMDB discovery and reconciliation
- procurement or billing workflow
- a generic ArchiMate modelling repository
- a full enterprise ITSM or EA platform as the system of record
