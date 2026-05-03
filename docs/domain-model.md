# Domain Model

## Purpose

This document defines the canonical service and capability governance model for S3C Manager. The goal is to keep product language, database design, APIs, UI labels, imports, and reports aligned as the application grows.

## Canonical Terms

| Term | Definition | Notes |
|---|---|---|
| Service Portfolio | A governed collection of services managed as a portfolio for ownership, lifecycle, review, and investment decisions. | A portfolio groups services; it is not a ticket queue. |
| Business Service | A service described in terms of consumer value or business outcome. | May depend on technical or application services. |
| Technical Service | A service described in terms of technical enablement, platform, infrastructure, or operational support. | Should still have ownership and readiness metadata. |
| Application Service | A service exposed or enabled by a software application or application component. | Useful for Backstage, EA, and CMDB alignment. |
| Service Offering | A requestable or selectable variant of a service, usually with SLA, pricing, unit, support model, or delivery terms. | Existing flavours are treated as the current offering-like concept. |
| Capability | A stable ability the organization needs, independent of a specific service implementation. | Can be business, operational, technical, or C3-oriented. |
| C3 Capability | A command, control, and communication capability represented in the C3 taxonomy module. | Can be mapped to services and FMN Spiral structures. |
| FMN Spiral | A Spiral baseline or target context used to organize C3 capability readiness and coverage. | Spiral-specific readiness is an analysis dimension. |
| Owner | The accountable person or group for service correctness, lifecycle, and governance response. | Ownership must be visible and filterable. |
| Steward | A contributor responsible for maintaining part of a service record or taxonomy area. | Stewardship is operational; ownership is accountable. |
| Reviewer | A person or group assigned to validate service readiness, mapping, or governance evidence. | Reviewers participate in workflow; they do not replace owners. |
| Readiness Rule | A named, configurable rule that determines whether a service can be published or approved. | Rules return blockers, warnings, or pass states. |
| Governance Decision | An auditable approval, rejection, deferral, exception, or lifecycle decision. | Decisions must carry rationale and actor metadata. |
| Exception | A time-bound, auditable waiver for a readiness or governance rule. | Exceptions should expire and appear in readiness output. |

## Core Relationship Model

```text
Service Portfolio
  -> Service
      -> Service Offering
      -> SLA / Pricing / Support Model
      -> Owner / Steward / Reviewer
      -> Lifecycle / Review Due Date / Criticality
      -> Service Relations
      -> Capability Mappings
      -> C3 / FMN Mappings
      -> Readiness Results
      -> Governance Reviews
      -> Governance Decisions
```

## Service Types

S3C Manager can support multiple service perspectives without becoming a full enterprise architecture repository:

- **Business services** describe value and outcomes for consumers.
- **Technical services** describe enabling platforms, infrastructure, operational services, and shared capabilities.
- **Application services** describe application-backed service surfaces and integration points.

The initial implementation should preserve existing service type behavior and extend it only where needed for portfolio, readiness, and capability governance.

## Lifecycle Model

The canonical lifecycle stages are:

| Stage | Meaning |
|---|---|
| `draft` | service is being captured and is not ready for governance review |
| `design` | service definition is being prepared and mappings are expected to change |
| `active` | service is live, governed, and should satisfy readiness rules |
| `retiring` | service is still present but planned for removal or replacement |
| `retired` | service is no longer active and should not satisfy normal publication flows |

## Mapping Roles

Use these mapping roles for service-to-capability and service-to-C3 relationships:

| Role | Meaning |
|---|---|
| `primary` | the service primarily realizes or supports the capability |
| `supporting` | the service contributes to the capability but is not the main service |
| `enabling` | the service enables another service or capability indirectly |
| `dependent` | the service depends on the capability, C3 entity, or related service |

## Existing Schema Mapping

| Existing object | Canonical meaning | Target direction |
|---|---|---|
| `data.service_catalog` | canonical service record | extend only for service-owned metadata such as portfolio reference, lifecycle, criticality, review due date, and requestability |
| `data.service_flavour` | current offering-like model | treat as service offering foundation until a dedicated offering model is required |
| `data.service_sla` | SLA and support promise metadata | keep as service/offering support data |
| `data.service_relation` | service-to-service dependency and relationship graph | normalize relation kinds and reuse for impact analysis |
| `data.service_c3_mapping` | service-to-C3/capability relationship | extend mapping roles and use in coverage/readiness analysis |
| `backend/db/postgres/schema/20_capability_coverage_views.sql` | capability coverage analysis | evolve into the canonical coverage, gap, overlap, and consolidation view layer |
| `backend/db/postgres/schema/22_governance_views.sql` | governance reporting layer | evolve into readiness, review, owner-load, contract, and decision cockpit summaries |

## Migration Principle

Extend existing service catalogue tables only where the relationship is truly service-owned. Create dedicated tables for governance, reviews, decisions, exceptions, portfolio management, and cross-cutting analysis so the service record does not become an unbounded catch-all table.

## Readiness Rule Categories

Minimum readiness rules should cover:

- service has an accountable owner
- service has at least one offering or an explicit exception
- service has a lifecycle stage
- active or requestable service has SLA/support metadata or an explicit exception
- requestable service has pricing/contract metadata or an explicit exception
- service has a primary capability or C3 mapping where the C3 module is enabled
- service dependencies are classified
- service has a review due date

Readiness output should be explainable as named rule results, not as a single opaque score.

## Governance Decision Categories

Governance decisions should support:

- publish approval
- publish rejection
- readiness exception
- lifecycle transition
- mapping acceptance
- consolidation recommendation
- retirement recommendation
- deferral

Every decision should include actor, timestamp, decision type, affected service or capability, and rationale.

## Integration Boundary

S3C Manager may import or export useful metadata for adjacent tools, but those tools should not dictate the internal domain model.

| Adjacent tool category | Integration posture |
|---|---|
| ServiceNow CSDM | map concepts such as business service, technical service, application service, offering, and service owner |
| iTop / CMDB | map service catalogue, dependencies, contacts, contracts, and SLA-like data where available |
| ArchiRepo / ArchiMate tools | map capability, application, service, and relationship concepts at reference level |
| Backstage | exchange ownership, component/service metadata, and service catalogue YAML where useful |
| CSV/JSON | remain the baseline portable import/export format |
