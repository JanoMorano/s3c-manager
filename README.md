# S3C Manager - Service Catalogue & Capability Connector Manager

![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-2496ED)

Enterprise service catalogue for service governance, dependency graphs, pricing/SLA management, and an optional C3 taxonomy module.

> **Stack:** Next.js 15 · Node.js / Express · PostgreSQL 16 · Docker Compose

## What's New in V1.1.0

- capability-driven decision cockpit for Catalogue, Operations, C3, Capabilities, Spirals, and FMN Air C2
- generic Level-3 capability coverage, overlap, gap, duplicate coverage, and consolidation evidence views
- real NATO/C3 import smoke, local-account regression tests, light/dark tokens, and `cs` / `en` / `sk` / `de` i18n support

## What It Is

Service Catalogue v2 provides:

- an IT and business service catalogue
- relationship graphs between services and C3 entities
- pricing, flavours, SLA, and ownership management
- governance review, audit trails, and import pipelines
- an optional C3 module for Spiral 6 and Spiral 7 capability maps

## Who It Is For

- service owners and service delivery managers
- enterprise and solution architects
- IT governance teams
- defence / FMN / C3 taxonomy administrators

## What It Is Not

- not a ticketing system
- not a full CMDB autodiscovery platform
- not a billing engine or procurement workflow

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

- `app` = Next.js + middleware in one image
- `postgres` = PostgreSQL 16

## Main Features

- Service Catalogue: list, detail, edit, history, dashboard
- Service Graph: full catalogue graph and per-service dependency graph
- Pricing & SLA: flavours, billing model, support windows
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

## Interactive Demo (no install required)

Three self-contained HTML pages that show exactly what the application looks like before you run it. Open them directly in a browser — no server needed.

| Page | What it shows |
|---|---|
| [demo/01-install.html](https://janomorano.github.io/s3c-manager/demo/01-install.html) | 11-step installation wizard with live stepper, connectivity checks, module selection, and execution log |
| [demo/02-catalogue.html](https://janomorano.github.io/s3c-manager/demo/02-catalogue.html) | Service catalogue list with filters, lifecycle/requestability badges, KPI dashboard, and a full service detail slide-over with 6 tabs (Overview, Offerings, Request, Support, Ops, Governance) |
| [demo/03-new-service.html](https://janomorano.github.io/s3c-manager/demo/03-new-service.html) | 8-step service onboarding wizard — Service ID, Business Summary, Consumer Value, Requestability, C3 mapping, and final review |

All three pages are linked to each other via navigation in the top-right corner.

## Documentation

- [User Guide](docs/user-guide.md)
- [Admin Guide](docs/admin-guide.md)
- [Installation](docs/installation.md)
- [C3 Module](docs/c3-module.md)
- [Import Formats](docs/import-formats.md)
- [Modules](docs/modules.md)
- [Demo Guide](DEMO.md)
- [Development Conventions](docs/dev-conventions.md)
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

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/dev-conventions.md](docs/dev-conventions.md) for coding and review rules.

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
