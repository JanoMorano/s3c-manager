# Product Positioning

## Product Sentence

S3C Manager is a lightweight, self-hosted service and capability governance cockpit for organizations that need to map services to capability, C3, and FMN structures, manage readiness, coverage, ownership, and decisions without adopting a heavy enterprise platform.

## Category

S3C Manager sits between four established tool categories:

| Category | Typical tools | What S3C Manager borrows | What S3C Manager avoids |
|---|---|---|---|
| ITSM / CMDB | ServiceNow, iTop, Jira Service Management Assets | service catalogue discipline, ownership, SLA, dependencies, auditability | incident management, request fulfilment, autodiscovery, broad asset inventory |
| Enterprise architecture repository | LeanIX, Ardoq, Bizzdesign, ArchiRepo, ABACUS | capability maps, application/service alignment, portfolio views, impact thinking | generic modelling workbench, full ArchiMate repository replacement |
| Developer portal / software catalogue | Backstage | ownership metadata, discoverability, component/service links | developer-only scope, plugin marketplace dependency |
| Local governance spreadsheets | Excel, SharePoint, Confluence, PowerBI | low-friction adoption and transparency | uncontrolled data model, manual reconciliation, weak audit trail |

The product should not claim that there is no competition. The stronger claim is that existing tools usually solve adjacent problems, while S3C Manager is optimized for the narrow service-capability governance use case.

## What It Is

S3C Manager is:

- a service portfolio and catalogue for business, technical, and application services
- a capability and C3/FMN alignment cockpit
- a readiness and publishing gate for governed services
- a coverage, gap, overlap, and consolidation analysis tool
- an ownership, review, and decision trail for service governance
- a self-hosted application that can be adopted beside existing ITSM, CMDB, EA, and developer portal tools

## What It Is Not

S3C Manager is not:

- a ticketing system
- an incident, problem, or change management suite
- a full CMDB autodiscovery platform
- a billing engine
- a procurement workflow
- a generic ArchiMate modelling repository
- a replacement for enterprise ITSM or EA platforms where those platforms are already the system of record

## Primary Users

| User | Main jobs |
|---|---|
| Service owner | understand service readiness, missing metadata, dependencies, review status, and ownership obligations |
| Service delivery manager | monitor portfolio health, SLA/pricing completeness, requestability, lifecycle, and review deadlines |
| Enterprise architect | map services to capabilities, detect gaps and overlaps, reason about impact and consolidation |
| C3/FMN taxonomy administrator | maintain capability maps, Spiral alignment, C3 entities, and service mappings |
| Governance team | review exceptions, approvals, decisions, audit history, and unresolved blockers |

## Jobs To Be Done

- When a new service is proposed, users can place it into the portfolio, assign owners, define offerings, map capabilities, and understand what is missing before publication.
- When a capability map changes, users can see which services are affected, which capabilities are uncovered, and where duplicate support exists.
- When governance review is due, users can see the readiness blockers, evidence, owners, exceptions, and decision history in one place.
- When an organization already has ServiceNow, iTop, LeanIX, ArchiRepo, Backstage, or spreadsheets, users can import/export enough metadata to keep S3C Manager useful without making it the universal system of record.

## Product Principles

- **Governance first:** prioritize decisions, readiness, evidence, coverage, and accountability over broad asset inventory.
- **Capability aware:** service records should connect to capability and C3/FMN structures, not live as isolated rows.
- **Self-hosted by default:** installation, demo data, and upgrade paths must remain simple for local and controlled environments.
- **Interoperable, not dominant:** import/export profiles should integrate with adjacent tools without forcing their full data models inside S3C Manager.
- **Operational density:** cockpit screens should be compact, filterable, and useful for repeated work.
- **Auditability:** governance changes, exceptions, imports, and decisions should leave traceable evidence.

## Positioning Statement

Use this wording for product communication:

> S3C Manager is a lightweight self-hosted service and capability governance cockpit. It helps organizations map services to capability, C3, and FMN structures, manage readiness and ownership, identify coverage gaps and overlaps, and record governance decisions without adopting a heavy enterprise ITSM or EA platform.
