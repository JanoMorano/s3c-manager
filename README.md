# S3C Manager - Service & Capability Governance Cockpit

![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-2496ED)

Lightweight, self-hosted service and capability governance cockpit for organizations that need to map services to capability, C3, and FMN structures, manage readiness, coverage, ownership, and decisions without adopting a heavy enterprise platform.

> **Stack:** Next.js 16.2 · React 19.2 · Express 5.2 · PostgreSQL 16 · Docker Compose

## What's New in V1.2 Governance Cockpit

- Service 360 view with portfolio, offerings, owners, readiness, governance decisions, C3 mappings, dependencies, and audit context
- Decision Cockpit on `/operations` with readiness queue, capability coverage, review deadlines, owner load, and recent decisions
- configurable readiness rules and auditable exceptions for publishability decisions
- governance review queue and decision log for approve, reject, defer, retirement, and publish workflows
- capability coverage, gap, and overlap cockpit for C3/FMN structures, including uncovered and over-covered capability signals
- impact analysis for service and capability changes across dependencies, C3 entities, applications, and data objects
- import/export profiles for S3C JSON/CSV and Backstage catalog-info, with documented mappings for iTop, ServiceNow CSDM, and ArchiMate
- richer demo data: 8 lifecycle-diverse services, 12 offerings, portfolios, owners, readiness blockers, exceptions, governance reviews, decisions, coverage gaps, overlaps, and a 3-level dependency chain

See [Governance Cockpit](docs/governance-cockpit.md) for the end-to-end operating model.

## What's New in V1.1.2

- Service detail now opens with a relationship studio that explains value, owner, support path, C3 links, readiness, and admin actions in one readable view
- C3 Dashboard adds a manager/admin board for map coverage, unmapped evidence, import sync drift, validation findings, and taxonomy-to-impact story
- Capability hub and capability detail pages now show coverage, gaps, services, spirals, overlaps, and next admin actions as a plain-language decision layer
- Help and page documentation were expanded for onboarding, service management, and frontend route descriptions
- runtime, package, Docker, Portainer, install, and visible UI version metadata aligned to `1.1.2`

## Product Positioning

S3C Manager sits between ITSM/CMDB tools, enterprise architecture repositories, developer/software catalogues, and spreadsheet-based governance. It borrows service catalogue discipline from tools such as iTop and ServiceNow, capability and portfolio thinking from EA repositories, and ownership metadata patterns from developer catalogues such as Backstage.

It is not positioned as "competition-free". The product is intentionally narrower: it focuses on the service-capability governance use case where teams need a practical, self-hosted cockpit without rolling out a full enterprise ITSM or EA platform.

For the detailed product boundary, see [Product Positioning](docs/product-positioning.md) and [Domain Model](docs/domain-model.md).

## What It Is

S3C Manager provides:

- a governed IT, business, technical, and application service catalogue
- service portfolio, lifecycle, readiness, ownership, and review management
- service offerings, pricing, SLA, support model, and contract-oriented metadata
- relationship graphs between services, capabilities, C3 entities, applications, and data objects
- capability and C3/FMN coverage, gap, overlap, and consolidation analysis
- governance review, decision history, audit trails, and import pipelines
- an optional C3 module for Spiral 6, Spiral 7, and custom capability maps

## Who It Is For

- service owners and service delivery managers
- enterprise and solution architects
- IT governance teams
- defence / FMN / C3 taxonomy administrators

## What It Is Not

- not a ticketing system
- not an incident, problem, or change management suite
- not a full CMDB autodiscovery platform
- not a billing engine or procurement workflow
- not a generic ArchiMate modelling repository
- not a replacement for enterprise ITSM or EA platforms where those platforms are already the system of record

## Quick Start in 5 Minutes

```bash
git clone <repo-url>
cd s3c-manager
cp .env.example .env
# set JWT_SECRET and POSTGRES_PASSWORD / DB_PASSWORD
# for shared or remote bootstrap, also set INSTALL_SETUP_TOKEN
docker compose up -d
```

Then open:

- `http://localhost:8080`
- the first run redirects to `/install`
- create the first admin account in the install wizard; there is no shared default admin
- first-login password change is available as a wizard option for the first local admin

If `INSTALL_SETUP_TOKEN` is configured, pre-READY install write actions require
the `x-install-setup-token` header. `/api/v1/install/status` stays public so the
wizard can detect the current install mode.

## Language Model

The application uses canonical locales `cs` and `en` with no locale prefix in
the URL structure.

Locale resolution order:

1. authenticated user preference `preferred_lang`
2. locale cookie `sc_locale`
3. browser/system language (`Accept-Language` or system locale for CLI/demo seed)
4. fallback `cs`

Legacy values such as `cz`, `cze`, and `cs-CZ` are normalized to `cs`.
Changing the language in the user profile updates both the persisted user
preference and the locale cookie. Demo seed content follows the resolved locale
used by the install or seed request.

If you want a full demo environment immediately:

```bash
APP_RUN_DB_INIT=true
INIT_WITH_TEST_SEEDS=true
INIT_WITH_C3_ENTITY_SEEDS=true
INIT_WITH_C3_BASELINE_TAXONOMY_SEED=true
INIT_WITH_C3_CAPABILITY_MAP_SEED=true
DEMO_SEED_LOCALE=en
```

## Requirements

| Area | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 10 GB | 20 GB |
| Docker | 24+ | latest stable |
| Compose | v2.20+ | latest stable |

Tested on:

- Ubuntu 22.04
- macOS 14+
- Windows 11 + WSL2
- QNAP Container Station / Portainer

## Architecture

```text
Browser
  -> Next.js frontend (:3000 in container)
  -> Express middleware (:4000 in container)
  -> PostgreSQL 16 (schemas `platform`, `data`)
```

Canonical runtime:

- `app` = Next.js 16.2 + React 19.2 frontend and Express 5.2 middleware in one image
- `postgres` = PostgreSQL 16

Runtime dependency versions are controlled by the committed package manifests and lockfiles.

## Main Features

- Service Catalogue: list, detail, edit, history, dashboard
- Service Graph: full catalogue graph and per-service dependency graph
- Pricing & SLA: flavours, billing model, support windows
- Service Governance: readiness signals, ownership, review evidence, and decision support
- Capability Governance: capability coverage, gaps, overlaps, and consolidation evidence
- Imports: CSV/JSON dry-run + commit + audit trail
- C3 Taxonomy: Spiral 6 and Spiral 7 capability maps, C3 entities, and C3 dashboard
- Administration: users, groups, web settings, installation/modules, and reference data

## Modules

| Module | Mandatory | Description |
|---|---|---|
| `SERVICE_CATALOGUE_CORE` | Yes | service catalogue, relations, pricing, imports |
| `C3_TAXONOMY` | No | C3 taxonomy, capability map, C3 dashboard |

If `C3_TAXONOMY` is not enabled during installation, the application runs as a pure Service Catalogue deployment without C3 navigation, C3 dashboards, or C3 API overlays.

## Configuration

Configuration is provided through `.env` or Docker/Portainer environment variables.

Minimum required variables:

| Variable | Description |
|---|---|
| `JWT_SECRET` | JWT signing secret, at least 32 random characters |
| `POSTGRES_PASSWORD` | PostgreSQL password |
| `DB_PASSWORD` | the same password for the application layer |
| `INSTALL_SETUP_TOKEN` | recommended for shared/remote bootstrap to lock pre-READY install write routes |

See the full list in [docs/installation.md](docs/installation.md).

## v1.1 Preview Screenshots

The `screenshots/v1.1-en` folder contains English screenshots from the current v1.1 application. They show the real UI after the capability cockpit redesign, including the installer, service onboarding, operations cockpit, service graph, and dependency flow view.

| Screenshot | What it shows |
|---|---|
| [00-install.png](screenshots/v1.1-en/00-install.png) | First-run installer with setup steps, local deployment configuration, module readiness, and execution feedback before the application is marked ready. |
| [01-new-service.png](screenshots/v1.1-en/01-new-service.png) | New Service onboarding flow for creating a business service, including service identity, ownership, requestability, consumer value, C3 mapping, and review-oriented fields. |
| [02-operations.png](screenshots/v1.1-en/02-operations.png) | Operations cockpit for service governance: KPI cards, readiness signals, decision queues, evidence lists, lifecycle cleanup, pricing patrol, and owner-oriented actions. |
| [03-service-graph.png](screenshots/v1.1-en/03-service-graph.png) | Service graph view showing service relationships, dependency context, graph controls, and visual navigation across linked services. |
| [04-service-dep.png](screenshots/v1.1-en/04-service-dep.png) | Dependency Flow view showing how consumer needs, business services, enabling services, C3 capabilities, and FMN requirements connect end-to-end. |

These screenshots are static preview assets. To interact with the product, run the application locally with Docker Compose and open `http://localhost:8080`.

## Documentation

- [User Guide](docs/user-guide.md)
- [Admin Guide](docs/admin-guide.md)
- [Installation](docs/installation.md)
- [Governance Cockpit](docs/governance-cockpit.md)
- [Product Positioning](docs/product-positioning.md)
- [Domain Model](docs/domain-model.md)
- [C3 Module](docs/c3-module.md)
- [Import Formats](docs/import-formats.md)
- [Modules](docs/modules.md)
- [Demo Guide](DEMO.md)
- [Upgrade Guide](docs/upgrade.md)

## Import Examples

Imports are available through the admin UI and API.

Example payloads:

- [testdata/examples/services-minimal.csv](testdata/examples/services-minimal.csv)
- [testdata/examples/services-minimal.json](testdata/examples/services-minimal.json)
- [testdata/examples/relations-minimal.json](testdata/examples/relations-minimal.json)
- [testdata/examples/c3-taxonomy-minimal.json](testdata/examples/c3-taxonomy-minimal.json)

For details, see [docs/import-formats.md](docs/import-formats.md).

## Development

```bash
cd middleware && npm ci && npm test
cd ../frontend && npm ci && npm run lint && npm run build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for coding and review rules.

## Security

See [SECURITY.md](SECURITY.md).

- cookie-backed JWT session or trusted-header SSO behind a trusted proxy boundary
- RBAC: `viewer`, `editor`, `admin`
- audit log for mutations and authentication failures
- production secrets should be supplied through env vars or mounted secret files
- production TLS termination is expected on a reverse proxy in front of the app
- GitHub Security Advisories for disclosure
- local development and tests must use the normal login flow, explicit JWTs, or mocked auth; there is no `DEBUG_BYPASS_AUTH` path

## Support development

<table>
  <tr>
    <td align="center"><strong>$4 - Czech wire transfer</strong></td>
    <td align="center"><strong>$10 - Czech wire transfer</strong></td>
    <td align="center"><strong>$20 - Czech wire transfer</strong></td>
    <td align="center"><strong>Revolut support</strong></td>
  </tr>
  <tr>
    <td><a href="https://github.com/JanoMorano/s3c-manager/blob/main/donations/Coffee_4USD.png"><img src="donations/Coffee_4USD.png" width="150"></a></td>
    <td><a href="https://github.com/JanoMorano/s3c-manager/blob/main/donations/Coffee_10USD.png"><img src="donations/Coffee_10USD.png" width="150"></a></td>
    <td><a href="https://github.com/JanoMorano/s3c-manager/blob/main/donations/Coffee_20USD.png"><img src="donations/Coffee_20USD.png" width="150"></a></td>
    <td><a href="https://github.com/JanoMorano/s3c-manager/blob/main/donations/revolut_qr.jpg"><img src="donations/revolut_qr.jpg" width="150"></a></td>
    
  </tr>
</table>

## Note About Badges and Release URLs

After the first push to GitHub, replace the placeholder CI badge with the real workflow badge URL of your repository.
