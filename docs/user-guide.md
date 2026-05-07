# User Guide

## Application Purpose

S3C Manager is a service and capability governance cockpit. It helps users find services, understand ownership and lifecycle, maintain service evidence, map services to capabilities/C3/FMN structures, and record readiness, review, exception, and decision evidence.

It is not a fulfilment engine. Requests are handled through the service's request channel, usually an external URL, portal, e-mail, or service desk link.

## Roles and Permissions

- `viewer` - read-only catalogue, service detail, capability, and decision history access.
- `editor` - service editing, service creation, imports, mappings, reviews, and evidence maintenance.
- `admin` - editor capabilities plus users, groups, web/SSO, reference data, installation, and audit administration.

Personas help explain the UX, but RBAC roles control access.

## Main Navigation

The reduced application uses these canonical areas:

- `Catalogue` at `/catalogue` for consumers and broad service discovery.
- `Services` at `/services/list` and `/services/{service_id}` for service records, detail, graph, impact, and editor work.
- `Operations` at `/operations` for readiness blockers, reviews, decisions, owner load, and import/data-quality work.
- `Capabilities` at `/capabilities` for coverage, gaps, overlaps, and capability-linked service evidence.
- `C3` at `/c3/*` for expert C3/FMN reference and mappings when the module is enabled.
- `Import` at `/import` and `/import/upload` for controlled data intake.
- `Administration` at `/administration/*` for admin-only platform configuration.
- `Help` at `/help`; the application opens `/help-cs` or `/help-en` according to the current language.

## Service Lifecycle

The main service lifecycle values are:

| Lifecycle | Meaning | Typical next action |
|---|---|---|
| `draft` | Service is being prepared or still needs evidence. | Add owner, offering, SLA/support evidence, and capability mapping. |
| `live` | Service is active and visible as a usable catalogue item. | Keep ownership, SLA/support, mappings, and review evidence current. |
| `deprecated` | Service is still visible but planned for replacement or retirement. | Document replacement, impact, and decision rationale. |
| `retired` | Service is no longer available. | Keep historical evidence and links for audit. |

Review workflow states are separate from service lifecycle. A review can be `pending`, `in_review`, `approved`, `rejected`, `deferred`, or `cancelled` without creating a second service lifecycle truth.

## Finding And Understanding Services

Use `/catalogue` for the consumer view and `/services/list` for the working list.

The service list supports search and filters for portfolio, service type, lifecycle, requestability, and domain. Each row should answer four questions quickly:

- What is the service?
- Is it usable or still being prepared?
- Who owns it?
- What action is needed next?

The service detail page shows one lifecycle badge, consumer value, request channel, owner/support information, offerings, capability mappings, dependencies, readiness context, and recent governance evidence.

## Creating Or Updating A Service

1. Open `/management/new-service`.
2. Fill identity, description, access, classification, ownership, SLA/support, optional C3 mapping, and review summary.
3. Save the service and open `/services/{service_id}/edit`.
4. Add or update offerings, ownership, support model, SLA evidence, operational links, relations, and C3/capability mappings.
5. Resolve readiness blockers shown in the editor or `/operations/readiness`.
6. Request a review through `/operations/reviews` when the record is ready.

New service variants should be managed as service offerings. Legacy variant evidence may still appear as read-only evidence on older records, but it is not the preferred editing model.

## Readiness

The active readiness gate focuses on five fixable rules:

- service has owner
- service has offering or cost evidence
- service has lifecycle state
- service has primary capability mapping
- service has SLA/support evidence

A blocked service should be fixed in the service editor whenever possible. Exceptions should be time-bound, justified, and visible in the audit trail.

## Reviews And Decisions

Use `/operations/reviews` for workflow actions and `/operations/decisions` for the decision log.

Review actions are modal-driven so each status change has context and, when needed, rationale and evidence. Decision types are intentionally small:

- `publish`
- `exception`
- `lifecycle`
- `other`

Historical decision types remain readable, but new records should use the simplified set.

## Operations Cockpit

`/operations` is the daily action queue. It includes:

- readiness blockers
- governance reviews
- recent decisions
- owner load panel
- import and data-quality fixes
- lowest readiness services

It does not replace ITSM, billing, procurement, or incident workflows. It tells catalogue owners and administrators what must be fixed or decided inside S3C Manager.

## Capabilities And C3

Use `/capabilities` and related coverage/gap/overlap pages for capability manager work. Use `/c3/*` only when detailed C3/FMN reference data or expert mappings are needed.

Capability and C3 evidence should support service governance, not become a separate parallel application for ordinary consumers.

## Import And Export

Use `/import` for import review and `/import/upload` for controlled uploads. The import pipeline keeps batch, row, issue, and raw evidence so administrators can audit what changed.

Use export bundle/report endpoints for controlled integration with adjacent systems. Do not treat S3C Manager as the universal system of record.

## Help

The canonical user-facing help entry is `/help`. It redirects to the in-app
manual at `/help-cs` for Czech users and `/help-en` for English users.

The Markdown guides in `docs/` are the maintained documentation source. Old
DOCX manuals and release tarballs are release artifacts outside the main product
source tree.
