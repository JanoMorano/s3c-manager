# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Install wizard — 11-step first-run setup flow (`/install`)
- Install state machine — 9 states from `NOT_INSTALLED` to `READY` with install locking
- Module registry — `SERVICE_CATALOGUE_CORE` (mandatory) and `C3_TAXONOMY` (optional)
- Schema migration baseline — 14 migrations tracked in `platform.schema_migrations`
- Authentication failure logging — failed logins recorded in `platform.audit_log`
- Admin Installation & Modules page — `/admin/installation` with installation state and repair flow
- Docker Compose secrets model — documented pattern for file-based secrets
- CSV import wizard — client-side parse preview and post-install import flow
- System config endpoint — `POST /api/v1/install/config` stores values in `platform.app_config`

### Changed
- `AppShell` — conditional layout: `/install` is fullscreen, everything else uses the standard shell
- `AuthGuard` — installation state guard redirects to `/install` when status is `NOT_INSTALLED`
- `docker-compose.yml` — added a documented top-level secrets example

### Fixed
- Install wizard step 2 — editable fields instead of a static info panel
- Install wizard step 9 — real preview with record counts, columns, and warnings

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

[Unreleased]: https://github.com/example/service-catalogue/compare/v1.0.0-beta.1...HEAD
[1.0.0-beta.1]: https://github.com/example/service-catalogue/releases/tag/v1.0.0-beta.1
[1.0.0]: https://github.com/example/service-catalogue/releases/tag/v1.0.0
