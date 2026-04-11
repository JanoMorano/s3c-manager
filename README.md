# S3C Manager - Service Catalogue & Capability Connector Manager

![CI](https://img.shields.io/badge/CI-GitHub%20Actions-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Docker](https://img.shields.io/badge/docker-ready-2496ED)

Enterprise service catalogue for service governance, dependency graphs, pricing/SLA management, and an optional C3 taxonomy module.

> **Stack:** Next.js 15 · Node.js / Express · PostgreSQL 16 · Docker Compose

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
cd redesign3
cp .env.example .env
# set JWT_SECRET and POSTGRES_PASSWORD / DB_PASSWORD
docker compose up -d
```

Then open:

- `http://localhost:8080`
- the first run redirects to `/install`
- default admin credentials after a clean install: `admin / Admin123!`

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

See the full list in [docs/installation.md](docs/installation.md).

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

- JWT or trusted-header SSO
- RBAC: `viewer`, `editor`, `admin`
- audit log for mutations and authentication failures
- secrets kept outside source code
- GitHub Security Advisories for disclosure

## Note About Badges and Release URLs

After the first push to GitHub, replace the placeholder CI badge with the real workflow badge URL of your repository.
