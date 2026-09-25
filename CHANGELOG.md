# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Changed
- Service relation types now have one source of truth, `shared/service-catalogue/relationTypes.json` (code, category, editable). Validation, the graph relation filter, readiness dependency counts, the service editor and the service detail read from it; a test keeps it aligned with the `ref_relation_type` seed. Relation types have Czech and English labels.
- `lifecycle_stage_code`, `review_due_at` and `portfolio_id` are now the canonical service fields (migration `35_canonical_service_fields.sql`). The legacy `lifecycle_state`, `service_status_code`, `next_review_due_at` and `portfolio_group_code` columns are kept in sync by a trigger in both directions, so imports and the lifecycle workflow keep working while readers drop their `COALESCE` fallbacks. Lifecycle filters still accept legacy values such as `live`.
- `v_owner_load` counts live services by `lifecycle_stage_code`, critical services by `criticality_code = 'mission_critical'` (previously service type `CF`/`CFS`) and overdue reviews by `review_due_at`.
- Graph edges use one visual channel per meaning: colour = relation category (three CVD-validated hues plus neutral, `--graph-series-*` tokens with dark-mode steps), line style = secondary distinction, width = mandatory, opacity = unverified. Previously mandatory edges were all red (overriding the type colour) and unverified edges overrode the type dash. Colour collisions (`provided_by`/`c3_parent`/`capability_application`) and C3 mapping styles for non-existent mapping codes are gone.
- The service overview graph defaults to a layered left-to-right layout by dependency (dagre); the portfolio grid remains as an option. Selecting a service highlights its upstream/downstream path (depth 1–5) and dims the rest.
- Service graphs and the C3 relation canvas show a legend listing only the encodings present; relation types are shown with localized labels.
- The service-level SLA has one source of truth: the primary `service_sla` row of a service (no offering). The `service_catalog` `sla_*` columns are a trigger-synced mirror (migration `36_service_sla_canonical.sql`), so the editor fields and the SLA records API always agree. `service_sla` gained `restoration_text` and `delivery_text`, exposed by the SLA records API.
- Offering request fields (`requestable`, `approval_required`, request channel, lead time) inherit from the service: an empty offering field means "inherit", a value overrides it (migration `37_offering_request_inheritance.sql`, view `v_service_offering_effective`). Offering values equal to the service value were reset to inherit, so no effective value changed. The offerings API returns `effective_*` values; the editor uses one shared offering form (previously duplicated for add/edit) with "inherit / yes / no" choices and shows inherited values.
- The seven C3 link tables have one read model, `v_c3_entity_link` (migration `38_c3_entity_link_view.sql`). The service graph, overview graph and C3 relation graph read it through `db/c3-entity-links.repo.js` instead of seven queries and seven mapping blocks each; their API output is unchanged (verified on demo data). `routes/graph.js` shrank from 905 to 497 lines.
- The service editor groups its 14 sections into tabs — Identity and value, Offerings and SLA, Ownership and support, Relations and C3 mapping, Evidence (admin) — instead of one long page with inconsistent numbering (1–5, 6b, 7, 6, 7c…). Hidden tabs stay mounted, so unsaved values are kept; tab badges aggregate section warnings and a failed submit opens the tab with the first error. Section titles are localized.
- Schema files are applied by a migration runner in `init/init-db-postgres.sh`: files in `backend/db/postgres/schema/` run in name order, each in one transaction, and are recorded with a checksum in `platform.schema_file_ledger`. Unchanged files are skipped on later starts, changed files are re-applied, `SCHEMA_REAPPLY_ALL=true` restores the old behaviour. New files no longer need to be listed in the init script.
- Module manifests: `30_reduction_domain_model_simplification.sql` belongs to the Management module, which owns the `readiness_rule` table it writes.

### Fixed
- Every container start re-ran all schema files, so data migration 30 reset the readiness rule configuration (enabled/blocking flags set by an administrator) on each restart.
- The editor's publish gate and request-access warnings now accept a request channel defined on an offering, matching the backend rule.
- Saving any change to a live service re-ran the "transition to live" gate and was rejected when the service had no support model; the gate now runs only on the transition itself.
- A requestable service whose request channel is defined only on its offerings was rejected on every save; offering channels now satisfy the rule.
- The service editor no longer silently rewrites a relation whose type is not in the editable subset (for example `uses` or `part_of`); the current type stays selectable.
- The graph `relation_type` filter accepted non-existent codes and rejected valid ones (`uses`, `part_of`, `provides`, …).
- `v_servicepublishreadiness` counted only three of the five dependency relation types.
- Fresh installs never applied `28_enterprise_governance_contracts.sql`, so `c3_board_state`, `v_c3_board_lane` and readiness rule explanation columns were missing. Service detail then silently showed no C3 mappings. The live parts are now split into `33_readiness_rule_explanations.sql` (Management) and `34_c3_board_state.sql` (C3 Taxonomy), wired into `init-db-postgres.sh` and the module entrypoints; the retired notification/request parts are dropped with `28`.
- Service detail reads the C3 board state from `v_c3_board_lane`, so C3 items added after migration also get a derived board state.
- Swallowed DB errors in service detail, service overview and the C3 dashboard board lanes are now logged.

## [1.2.2] — 2026-05-15

### Added
- Added v1.2.2 release notes under `docs/releases/v1.2.2.md`.
- Documented v1.2.2 as the active documentation/release-preparation baseline.

### Changed
- Updated active `docs/` version references so the current product surface is documented as v1.2.2.
- Synchronized generated UI text documentation state so the i18n catalogue has no missing or stale entries.
- Polished Czech and English UI copy for readiness, governance, capabilities, operations, installer, graph, and portfolio wording.

### Fixed
- Corrected Czech review wording from `V revize` to `V revizi`.
- Corrected English generated-text leftovers that still contained Czech phrases such as `CSV export selhal`.
- Clarified that removed API and legacy route surfaces remain outside the v1.2.2 final product surface.

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

[Unreleased]: https://github.com/example/service-catalogue/compare/v1.2.2...HEAD
[1.2.2]: https://github.com/example/service-catalogue/releases/tag/v1.2.2
[1.1.2]: https://github.com/example/service-catalogue/releases/tag/v1.1.2
[1.1.1]: https://github.com/example/service-catalogue/releases/tag/v1.1.1
[1.1.0]: https://github.com/example/service-catalogue/releases/tag/v1.1.0
[1.0.2]: https://github.com/example/service-catalogue/releases/tag/v1.0.2
[1.0.0-beta.1]: https://github.com/example/service-catalogue/releases/tag/v1.0.0-beta.1
[1.0.0]: https://github.com/example/service-catalogue/releases/tag/v1.0.0
