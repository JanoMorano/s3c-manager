# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

No unreleased changes yet.

## [1.2.1] — 2026-05-14

### Added
- Added v1.2.1 release notes under `docs/releases/v1.2.1.md`.
- Documented v1.2.1 as the active documentation/release-preparation baseline.

### Changed
- Updated active `docs/` version references so the current product surface is documented as v1.2.1.
- Synchronized generated UI text documentation state so the i18n catalogue has no missing or stale entries.
- Polished Czech and English UI copy for readiness, governance, capabilities, operations, installer, graph, and portfolio wording.

### Fixed
- Corrected Czech review wording from `V revize` to `V revizi`.
- Corrected English generated-text leftovers that still contained Czech phrases such as `CSV export selhal`.
- Clarified that removed API and legacy route surfaces remain outside the v1.2.1 final product surface.

## [1.1.2] — 2026-05-03

### Added
- Layout v2 governance shell based on `LAYOUT_PROPOSAL.md`, `LAYOUT_PROPOSAL2.md`, `layout-mockup.html`, and `layout-mockup-v2.html`.
- Service 360 Relationship Studio with business/technical views, readiness context, lifecycle signal, C3 mappings, dependencies, support path, and audit context.
- Operations cockpit pages for readiness, reviews, decision log, owner load, impact analysis, and personal task queues.
- C3 and capability workspaces for board-style governance, graph exploration, entity detail/edit/code-edit flows, coverage, gaps, overlaps, and spiral context.
- Administration, import, search, and onboarding refinements, including user KPI counters, saved searches, import wizard flow, and horizontal new-service progress.
- Frontend route documentation under `docs/desctiption/` for the application page surface.

### Changed
- Service, C3, capability, operations, import, and administration pages now use the governance cockpit UX: manager-readable context first, admin action queues second, detailed evidence preserved underneath.
- Service editor behavior now follows the v2 rules for sticky save states, publish gates, read-only Service ID styling, requestable warnings, lifecycle transitions, and collection editing.
- Reviews use modal-driven status changes with rationale, evidence, defer expiry, side-effect-free readiness pre-flight, and decision log preview.
- Product/runtime defaults, visible Help badge, package metadata, Docker Compose, Portainer stack, install fallback, `.env.example`, release notes, and platform seed version aligned to `1.1.2`.
- README release highlights now describe the full Layout v2 Governance Cockpit release.

### Fixed
- Restored functional routes and outputs for `/operations/readiness`, `/services/impact`, `/services/graph`, `/import`, `/operations/reviews`, `/administration/users`, `/management/new-service`, C3 entity detail, and `/operations/decisions`.
- Fixed token/style-rule regressions and production TypeScript build blockers introduced during the UI refresh.
- Kept the redesign within the existing API/data model where possible and verified the release candidate with production build, style lint, Docker health smoke, HTTP route smoke, and focused Playwright coverage.

## [1.1.1] — 2026-04-28

### Added
- Dynamic C3 Capability Map creation from the Capability Builder, including custom map routes such as `/c3/capability-map-spiral99`.
- C3 dashboard drilldown for top parent capabilities.
- Operations cockpit tabs for Health, Governance, Pricing, Owners, and C3 mapping.
- Lab load-test evidence for 30 and 100 parallel users.

### Changed
- Sidebar brand no longer includes the app version; the current product version is shown above Help as `v.1.1.1`.
- Product/runtime defaults aligned to application version `1.1.1`.

## [1.1.0] — 2026-04-27

### Added
- Generic evidence document/source records in capability coverage payloads and the capability `Documents` tab.
- Local-account Playwright E2E covering service mapping preview → save → capability dashboard confirmation.
- Local-account Playwright regression covering the simplified user dropdown actions.
- i18n keys for C3 taxonomy list controls and the service editor C3 mapping preview flow.

### Changed
- Legacy FMN Air C2 coverage endpoint now acts as a compatibility adapter over the generic capability coverage engine.
- FMN Air C2 legacy response no longer exposes developer-local PDF paths or route-specific hardcoded requirement constants.
- Legacy FMN Air C2 alias accepts both canonical abbreviated and imported long Level-3 capability slugs.
- User dropdown now keeps only `User Info` and `Log Out`; language and persona settings remain in the user information area.

### Fixed
- C3 taxonomy list visible labels now use the shared i18n catalog instead of mixed Czech/English literals.

## [1.0.2] — 2026-04-25

### Added
- ITIL-Ready Service Catalogue — Lifecycle, Offerings & Service Onboarding
- full ITIL catalogue capabilities: service lifecycle governance, service offerings, support model, requestability, consumer value, audience and eligibility, and operational links
- guided New Service Wizard with inline ITIL hints and richer onboarding defaults
- business-focused service detail tabs: `Overview`, `Offerings`, `Request & Eligibility`, `Support`, and `Governance`
- backend validation and regression coverage for lifecycle readiness, offerings, support, audience, operational links, and dashboard statistics
- WebKit browser fallback prepared for Playwright E2E on environments where Chromium is restricted

### Changed
- UI foundation modernised with shadcn/ui components and Tailwind CSS tokens
- service detail reorganised into a business-first experience while preserving governance depth
- install/runtime defaults aligned to application version `1.0.2` and schema version `2.2.1`
- Docker and Portainer examples updated for the `v1.0.2` release line

### Fixed
- `16_consumer_value.sql` now records a valid `schema_migrations` row
- service create flow no longer fails on SQL placeholder mismatch
- demo seed relation type `provided_by` is now consistently supported across DB references, validation, graph routes, and frontend types
- install and authenticated smoke flows revalidated on a `READY` instance with demo data

## [1.0.0-beta.1] — 2026-04-10

### Added
- GitHub readiness cleanup: repo hygiene guard, issue templates, and release workflow
- public-facing documentation for users, administrators, the C3 module, demo scenarios, and import examples
- CI guard against legacy duplicates and local artifacts

### Changed
- README rewritten as a public quick start with a clearer product scope
- frontend and middleware versions aligned to `1.0.0-beta.1`
- `.dockerignore` and repo metadata tightened for a public repository

### Fixed
- removed legacy `* 2.*` files and local artifacts from the active tree
- release bundle and Portainer/QNAP documentation made anonymous and reproducible

---

## [1.0.0] — 2024-01-01

### Added
- Initial Service Catalogue v2 release
- Service entity model — graph + pricing + SLA + taxonomy
- `ServiceRelation` with provenance tracking (`is_inferred`, `parse_confidence`, `is_verified`)
- `ServiceRelationRaw` for semi-structured raw relation capture
- `ServiceFlavour` — pricing layer with service units, billing periods, and costs
- `ServiceSla` — SLA child table with support window, availability, and restoration targets
- `ServiceAvailableOn` — M:N domains such as Relay, Cloud, Grid, Prism, and Helix
- `ServiceRoleAssignment` — role-based ownership such as service owner and service delivery manager
- Import pipeline — CSV/JSON bulk import with dry-run, `import_batch`, `import_row`, and `import_issue`
- C3 Taxonomy module — capability entities, mappings, and graph support
- RBAC — `viewer`, `editor`, and `admin`
- SSO support — trusted headers from reverse proxy / ADFS
- Audit log — full mutation trail in `platform.audit_log`
- Design tokens — CSS custom properties for color, spacing, radius, and typography
- Dashboard — KPI tiles, distribution charts, and review due lists

[Unreleased]: https://github.com/example/service-catalogue/compare/v1.2.1...HEAD
[1.2.1]: https://github.com/example/service-catalogue/releases/tag/v1.2.1
[1.1.2]: https://github.com/example/service-catalogue/releases/tag/v1.1.2
[1.1.1]: https://github.com/example/service-catalogue/releases/tag/v1.1.1
[1.1.0]: https://github.com/example/service-catalogue/releases/tag/v1.1.0
[1.0.2]: https://github.com/example/service-catalogue/releases/tag/v1.0.2
[1.0.0-beta.1]: https://github.com/example/service-catalogue/releases/tag/v1.0.0-beta.1
[1.0.0]: https://github.com/example/service-catalogue/releases/tag/v1.0.0
