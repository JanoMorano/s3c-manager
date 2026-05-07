# Admin Guide

## Document Purpose

This guide describes administration and operation of the reduced S3C Manager runtime. It is intended for:

- `admin` users managing users, roles, reference data, installation, imports, and audit
- `editor` users handling catalogue content and imports
- deployment and operations administrators

## Runtime Model

The canonical deployment uses two containers:

- `app` - Next.js frontend, Express middleware, init/seed logic, and scheduled maintenance helpers
- `postgres` - `platform` schema for system data and `data` schema for catalogue/governance data

Back up PostgreSQL before every upgrade or DB cleanup stage.

## Canonical Administrative Routes

| Area | Route | Purpose |
|---|---|---|
| Administration overview | `/administration` | Admin entry point |
| Users | `/administration/users` | Accounts, roles, providers, activation |
| Groups | `/administration/groups` | RBAC groups and membership |
| Web / SSO | `/administration/web` | Login modes, trusted headers, SSO/web settings |
| Reference data | `/administration/catalogue-ref` | Catalogue reference values |
| C3 reference | `/administration/c3-ref` | Expert C3 reference values |
| C3 capability builder | `/administration/c3-capability-builder` | Expert capability map maintenance |
| Import profiles | `/administration/import` | Admin import evidence and profiles |
| Installation | `/administration/installation` | Install status, modules, seed/repair flows |

`/admin/*` frontend aliases were removed in the v1.2 final sunset cleanup. New documentation, bookmarks, and user communication must use `/administration/*`.

## Roles

- `viewer` - read-only catalogue and evidence access.
- `editor` - can create/edit services, mappings, imports, reviews, and decisions where permitted.
- `admin` - can manage users, groups, web/SSO, reference data, installation state, and audit views.

Personas do not grant permissions. RBAC roles and group permissions do.

## Service Administration

### New Service

Route: `/management/new-service`

The wizard captures identity, description, access, classification, ownership, SLA/support evidence, optional C3 mapping, and a review summary. After creation, the editor continues in `/services/{service_id}/edit`.

### Service Editor

Route: `/services/{service_id}/edit`

The editor is the canonical place to maintain:

- identity and canonical lifecycle
- business description and consumer value
- request channel and audience/eligibility information
- service offerings
- ownership and review owners
- SLA/support evidence
- operational links
- service relations and domain availability
- primary capability or C3 mapping
- readiness and governance evidence

Legacy variant evidence can remain visible as read-only historical evidence. New service variants should use service offerings.

## Lifecycle Governance

Canonical service lifecycle states are:

| State | Meaning | Admin expectation |
|---|---|---|
| `draft` | Service is being prepared. | Missing evidence is expected but should be visible. |
| `live` | Service is active. | Ownership, offering, SLA/support, and mapping evidence must stay current. |
| `deprecated` | Service is planned for replacement or retirement. | Link replacement/impact/decision rationale. |
| `retired` | Service is no longer available. | Preserve history and audit evidence. |

Review workflow status is separate from lifecycle and belongs to `/operations/reviews`.

## Readiness Rules And Exceptions

The active readiness gate contains five fixable rules:

- service has owner
- service has offering or cost evidence
- service has lifecycle state
- service has primary capability mapping
- service has SLA/support evidence

Disabled historical rules remain in the database for rollback/audit context but do not block publication.

Exceptions should be temporary, justified, and audited. Prefer fixing service data over creating exceptions.

## Governance Reviews And Decisions

- Reviews live on `/operations/reviews`.
- Decisions live on `/operations/decisions`.
- Decision types are `publish`, `exception`, `lifecycle`, and `other`.
- Rejected/deferred decisions need rationale.
- Exceptions and lifecycle decisions should include expiry, replacement, or impact evidence when relevant.

## Import Administration

Use `/import` and `/import/upload` for normal import operations. Use `/administration/import` for deeper admin evidence, import profiles, and troubleshooting.

The import pipeline preserves batch, row, issue, raw field, and source evidence. Do not delete import evidence as part of ordinary catalogue cleanup.

## Help And Documentation Governance

The canonical in-app help entry is `/help`, which redirects by locale to `/help-cs`
or `/help-en`. Do not maintain a separate manual compatibility as a second
source of truth.

Markdown files in `docs/` are the primary documentation source. Old generated
DOCX manuals and release tarballs are release artifacts, not source files in the
main repository tree.

For every release:

- update both `/help-cs` and `/help-en` content when user-facing behavior changes
- update `docs/user-guide.md` and this admin guide when workflows or routes change
- add release notes with migration and smoke-test impact
- do not document removed frontend route aliases as active compatibility paths

## Upgrade Checklist

1. Create a PostgreSQL backup.
2. Apply schema migrations in order through the init/upgrade flow.
3. Verify `/api/health/ready`.
4. Verify `/api/v1/install/status`.
5. Smoke `/catalogue`, `/services/list`, `/operations`, `/operations/readiness`, `/operations/reviews`, `/operations/decisions`, `/import`, `/administration/users`, `/help-cs`, `/help-en`, and `/help`.
6. Run middleware tests and frontend lint/i18n checks.
7. Confirm `frontend/next-env.d.ts` was not left pointing at `.next/dev` after local dev smoke.
