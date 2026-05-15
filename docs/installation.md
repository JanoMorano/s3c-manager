# Installation Guide

## Requirements

- Docker Engine 24+
- Docker Compose v2.20+
- 2 vCPU minimum, 4 vCPU recommended
- 4 GB RAM minimum, 8 GB recommended
- 10 GB disk space

For local development without Docker:

- Node.js 20.9+ minimum, Node.js 25.6+ recommended for the current dependency baseline
- PostgreSQL 16+

Current application package baseline:

| Area | Version baseline |
|---|---|
| Application release | 1.2.2 |
| Frontend runtime | Next.js 16.2, React 19.2, TypeScript 6.0 |
| Frontend styling | Tailwind CSS 4.2, `@tailwindcss/postcss` 4.2, CSS Modules |
| Middleware runtime | Express 5.2, PostgreSQL `pg` 8.20 |
| Test tooling | Playwright 1.59, Jest 30.3, Frontend ESLint 9.39, Middleware ESLint 10.2 |

The exact package versions are controlled by `frontend/package-lock.json` and `middleware/package-lock.json`.

---

## Quick Install (Docker Compose)

### 1. Prepare the Environment

```bash
git clone https://github.com/example/service-catalogue.git
cd s3c-manager
cp .env.example .env
```

### 2. Configure `.env`

Required:

```env
# JWT signing secret — at least 32 random characters.
# Production startup refuses empty, weak, or placeholder-like values.
JWT_SECRET=<openssl rand -base64 48>

# PostgreSQL password
DB_PASSWORD=your-secure-db-password
POSTGRES_PASSWORD=your-secure-db-password

# Recommended for shared or remote bootstrap
INSTALL_SETUP_TOKEN=<openssl rand -hex 32>
```

### 3. Start the Stack

```bash
docker compose up -d
```

### 4. Wait for Initialization

```bash
docker compose logs -f app
# Wait for the install flow or server startup logs
```

### 5. Complete the Wizard

Open `http://localhost:8080`. The application redirects to `/install` on first run.

The wizard handles:

1. base application configuration
2. secret validation
3. first admin account creation, including an optional first-login password change requirement
4. database connectivity checks
5. module selection (`Core` mandatory, `C3` optional)
6. optional initial data import
7. transition to the `READY` state

Clean installs do not ship a shared default admin account. The first usable admin
is created in this wizard; there is no implicit bootstrap admin path.

If `INSTALL_SETUP_TOKEN` is configured, pre-READY install write routes require
the `x-install-setup-token` header. The install wizard still reads
`/api/v1/install/status` publicly for mode detection. If you leave
`INSTALL_SETUP_TOKEN` unset, bootstrap remains publicly writable until the
system reaches `READY`, which is suitable only for local or otherwise isolated
deployments.

### Language and Locale Resolution

The UI and API share the same canonical locale model:

- supported locales: `cs`, `en`
- no locale prefixes in routes
- locale resolution order:
  1. authenticated user `preferred_lang`
  2. locale cookie `sc_locale`
  3. browser `Accept-Language`
  4. fallback `cs`

Legacy Czech values such as `cz`, `cze`, and `cs-CZ` are normalized to `cs`. Retired SK/DE values now fall back to `cs`; existing user preferences are normalized by `31_locale_cs_en_only.sql`.

During first install there is no authenticated user yet, so the wizard locale
comes from the `sc_locale` cookie, browser header, or the CZE/ENG selector on
the first installer window. If demo data seeding is enabled during install, the
demo dataset is created in that resolved locale.

### C3 Taxonomy Module

The module selection step allows:

- `SERVICE_CATALOGUE_CORE`
- `C3_TAXONOMY`

If `C3_TAXONOMY` is not enabled:

- the `C3 Taxonomy` menu is hidden
- the `C3 Capability Map` menu is hidden
- C3 overlays in service graphs and C3 APIs remain disabled

If you want the C3 module pre-populated on first startup, use:

```env
INIT_WITH_C3_ENTITY_SEEDS=true
INIT_WITH_C3_BASELINE_TAXONOMY_SEED=true
INIT_WITH_C3_CAPABILITY_MAP_SEED=true
```

Optional XLSX-derived taxonomy seed:

```env
INIT_WITH_C3_TAXONOMY_XLSX_SEED=true
```

See [docs/c3-module.md](c3-module.md) for details.

---

## Production Deployment

### Docker Secrets (Recommended)

Use file-based secrets instead of plain environment variables. The runtime
supports `*_FILE` variables for `JWT_SECRET`, `DB_PASSWORD`, and
`POSTGRES_PASSWORD`:

```bash
mkdir -p secrets
chmod 700 secrets
echo "$(openssl rand -base64 48)" > secrets/jwt_secret.txt
echo "your-db-password" > secrets/db_password.txt
chmod 600 secrets/*.txt
```

Then pass the mounted secret file paths through the environment, for example:

```env
JWT_SECRET_FILE=/run/secrets/jwt_secret
DB_PASSWORD_FILE=/run/secrets/db_password
POSTGRES_PASSWORD_FILE=/run/secrets/db_password
```

Keep the files outside the repository and rotate them together when the database
password changes.

### Reverse Proxy (nginx Example)

```nginx
server {
    listen 443 ssl;
    server_name sc.example.com;

    ssl_certificate     /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

The application does not terminate TLS itself. In production, use HTTPS on the
reverse proxy so browser auth cookies can be marked `Secure`.

### SSO (AD/LDAP via Reverse Proxy)

Set the following in `.env`:

```env
AUTH_SSO_ENABLED=true
AUTH_SSO_HEADER=x-remote-user
AUTH_SSO_DISPLAY_NAME_HEADER=x-remote-name
AUTH_SSO_EMAIL_HEADER=x-remote-email
AUTH_SSO_TRUSTED_PROXY_HEADER=x-sso-proxy-secret
AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET=<shared-secret-between-proxy-and-app>
```

The reverse proxy must forward `X-Remote-User` from an authenticated upstream
context and inject the trusted-proxy secret header. The backend rejects SSO
requests when the trusted-proxy header is missing or the secret does not match.

### Backup and Restore

Before the first production upgrade, rehearse the restore flow in
[docs/operations.md](operations.md). The supported scripts are:

- `./scripts/backup-postgres.sh`
- `./scripts/restore-postgres.sh`

Recommended cadence:

- take a backup before every upgrade
- keep at least one recent off-host copy
- rehearse restores on a non-production clone regularly
- treat `./deploy.sh rebuild-db` as a destructive reset, not a backup path

---

## Environment Variables

### Required

| Variable | Description | Example |
|---|---|---|
| `JWT_SECRET` | JWT signing key (min. 32 chars) | `openssl rand -base64 48` |
| `DB_PASSWORD` | PostgreSQL password | `securepassword123` |
| `JWT_SECRET_FILE` | File path containing the JWT secret | `/run/secrets/jwt_secret` |
| `DB_PASSWORD_FILE` | File path containing the DB password | `/run/secrets/db_password` |
| `POSTGRES_PASSWORD_FILE` | File path containing the DB password for the postgres service | `/run/secrets/db_password` |
| `INSTALL_SETUP_TOKEN` | Extra shared secret for pre-READY install writes | `openssl rand -hex 32` |

### Database Configuration

| Variable | Default | Description |
|---|---|---|
| `DB_HOST` | `postgres` | PostgreSQL hostname |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_NAME` | `service_catalogue` | Database name |
| `DB_USER` | `postgres` | Database user |
| `DB_SSL` | `false` | Enforce SSL connection |
| `DB_SSL_INSECURE_SKIP_VERIFY` | `false` | Allow self-signed DB TLS only in local/dev environments |

### Application

| Variable | Default | Description |
|---|---|---|
| `APP_VERSION` | `1.2.2` | Application release version used by install/upgrade detection and visible release metadata |
| `PORT` | `4000` | Express middleware port |
| `NEXT_PORT` | `3000` | Next.js port |
| `CORS_ORIGINS` | `http://localhost:8080` | Allowed CORS origins |
| `APP_RUN_DB_INIT` | `true` | Run database init on startup |
| `RATE_LIMIT_API_MAX` | `6000` | Maximum API requests per minute per client IP; sized for shared office NAT and load tests of 100 parallel users |

### Seed Flags

| Variable | Default | Description |
|---|---|---|
| `INIT_WITH_TEST_SEEDS` | `false` | load the demo catalogue and demo relationships |
| `INIT_WITH_C3_ENTITY_SEEDS` | `false` | load baseline C3 entities |
| `INIT_WITH_C3_BASELINE_TAXONOMY_SEED` | `false` | load baseline C3 taxonomy |
| `INIT_WITH_C3_TAXONOMY_XLSX_SEED` | `false` | use the taxonomy snapshot derived from XLSX imports |
| `INIT_WITH_C3_CAPABILITY_MAP_SEED` | `false` | load the baseline Spiral 7 capability map |
| `DEMO_SEED_LOCALE` | system locale | force demo service copy locale, for example `en` or `cs` |

When `INIT_WITH_TEST_SEEDS=true`, the demo dataset contains 8 services, 3 portfolios, 12 service offerings, 12 legacy variant evidence records, owners, readiness blockers, a readiness exception, governance reviews, decisions, capability coverage examples, and a 3-level dependency chain. Enable the C3 seed flags as well when you want the demo capability maps and C3 entity evidence to be visible immediately.

### SSO

| Variable | Default | Description |
|---|---|---|
| `AUTH_SSO_ENABLED` | `false` | Enable SSO through trusted headers |
| `AUTH_SSO_HEADER` | `x-remote-user` | Header carrying the username/principal |
| `AUTH_SSO_DISPLAY_NAME_HEADER` | `x-remote-name` | Header carrying the display name |
| `AUTH_SSO_EMAIL_HEADER` | `x-remote-email` | Header carrying the email address |
| `AUTH_SSO_GIVEN_NAME_HEADER` | `x-remote-given-name` | Header carrying the given name |
| `AUTH_SSO_SURNAME_HEADER` | `x-remote-surname` | Header carrying the surname |
| `AUTH_SSO_DEPARTMENT_HEADER` | `x-remote-department` | Header carrying the department |
| `AUTH_SSO_SHARED_SECRET_HEADER` | `x-sso-secret` | Proxy-boundary header required before SSO identity headers are trusted |
| `AUTH_SSO_SHARED_SECRET` | unset | Shared secret expected in the trusted proxy header |

Legacy aliases `AUTH_SSO_TRUSTED_PROXY_HEADER` and
`AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET` are still accepted for backward
compatibility.

---

## Database Initialization

The database is initialized automatically on startup when `APP_RUN_DB_INIT=true`.
The init path seeds schemas, reference data, and module metadata only. It does
not create a reusable default administrator account.

`backend/db/postgres/data/platform/seed_admin.sql` may still exist in the
repository as a legacy artifact, but the canonical init script skips it.

The canonical directory for file-based C3 snapshots is:

```text
shared/c3/
```

Typical files:

- `c3-taxonomy-seed.json`
- `c3-services-seed.json`
- `c3-applications-seed.json`
- `c3-data-objects-seed.json`
- `c3-technology-interactions-seed.json`
- `capability-map-spiral7.json`
- optionally `c3-taxonomy-xlsx-import-seed.json`

If any `INIT_WITH_C3_*` flag is enabled and the required file is missing, the init process now fails fast with a clear error.

When `INIT_WITH_TEST_SEEDS=true`, demo data is seeded through the same logic used by the admin action `Installation & Modules → Restore test data`. Clean deploys and post-install demo seeding therefore use the same dataset.

Manual init:

```bash
docker exec sc-app sh /app/init/init-db-postgres.sh
```

SQL file order:

```text
00_bootstrap.sql         — extensions and schemas
01_platform.sql          — users, app_config, audit_log
02_ref.sql               — reference tables
03_groups.sql            — group entities
04_core.sql              — Service Catalogue core
05_graph.sql             — ServiceRelation and ServiceRelationRaw
06_pricing.sql           — legacy ServiceFlavour evidence and ServiceSla
07_domains.sql           — ServiceAvailableOn
08_ownership.sql         — assignments, mappings, raw fields
09_import.sql            — import pipeline tables
10_indexes.sql           — performance indexes
11_c3.sql                — C3 taxonomy module
12_exports_retention.sql — export and retention scheduler
13_install_system.sql    — install state machine and module registry
14_spiral_versioning.sql — Spiral versioning on C3 entities
15_itil_catalogue_phase1.sql — additive ITIL-ready catalogue Phase 1 schema
16_consumer_value.sql — consumer value field on services
17_spiral_membership.sql — C3 entity membership in FMN spirals
18_service_governance_views.sql — service governance helper views
19_capability_abbreviations.sql — capability abbreviations
20_capability_coverage_views.sql — capability coverage helper views
21_governance_risk_views.sql — governance risk and owner-load views
22_governance_views.sql — service publish readiness view
23_service_portfolio.sql — portfolios and service lifecycle metadata
24_readiness_rules.sql — readiness rules and exceptions
25_capability_governance.sql — coverage, gap, and overlap views
26_governance_workflow.sql — reviews and decision log
27_impact_analysis.sql — recursive service/capability impact analysis
28_enterprise_governance_contracts.sql — notifications, preferences, request log, C3 board state
```

---

## Troubleshooting

### "The setup token is missing or invalid"

This error appears on the `/install` page when `INSTALL_SETUP_TOKEN` is set in
`.env` but the wizard cannot read it — most commonly because the value is missing
or the container was not restarted after the variable was added.

**Fix:**

1. Add the variable to `.env`:

   ```env
   INSTALL_SETUP_TOKEN=pick-any-secret-string
   ```

2. Recreate the app container so it picks up the new value (`restart` is not
   enough — environment variables are only injected at container creation):

   ```bash
   docker compose up -d --force-recreate app
   ```

3. Open `http://localhost:8080/install` and enter the **same string** in the
   setup token field.

The token is only enforced while the system is in pre-`READY` state. Once the
install wizard completes and the system transitions to `READY`, the token is no
longer checked and can be removed from `.env`.

If you intentionally omit `INSTALL_SETUP_TOKEN`, the install wizard is publicly
writable until `READY` — acceptable for local or isolated deployments, but not
recommended for anything network-accessible.

---

### Docker bind-mount error on macOS (`/Volumes/…`)

```
error while creating mount source path '/host_mnt/Volumes/…/shared': file exists
```

Docker Desktop cannot mount paths from secondary volumes (`/Volumes/<disk>/…`)
unless the disk is explicitly allowed.

**Fix:**

1. Docker Desktop → **Settings → Resources → File Sharing**
2. Click **+** and add the disk root, e.g. `/Volumes/MAC_DATA`
3. Click **Apply & Restart**
4. Run `docker compose up postgres` again

Alternatively, switch to VirtioFS: Settings → General → Virtual file sharing
implementation → VirtioFS, then Apply & Restart.

---

## Post-Install Verification

```bash
# Health check
curl http://localhost:8080/api/health/ready

# Install state
curl http://localhost:8080/api/v1/install/status

# Expected: { "status": "READY", "mode": "ready", ... }
```
