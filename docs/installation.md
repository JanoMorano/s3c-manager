# Installation Guide

## Requirements

- Docker Engine 24+
- Docker Compose v2.20+
- 2 vCPU minimum, 4 vCPU recommended
- 4 GB RAM minimum, 8 GB recommended
- 10 GB disk space

For local development without Docker:

- Node.js 20+
- PostgreSQL 16+

---

## Quick Install (Docker Compose)

### 1. Prepare the Environment

```bash
git clone https://github.com/example/service-catalogue.git
cd service-catalogue
cp .env.example .env
```

### 2. Configure `.env`

Required:

```env
# JWT signing secret — at least 32 random characters
JWT_SECRET=<openssl rand -base64 48>

# PostgreSQL password
DB_PASSWORD=your-secure-db-password
POSTGRES_PASSWORD=your-secure-db-password
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

### SSO (AD/LDAP via Reverse Proxy)

Set the following in `.env`:

```env
AUTH_SSO_ENABLED=true
AUTH_SSO_HEADER=x-remote-user
AUTH_SSO_DISPLAY_NAME_HEADER=x-remote-name
AUTH_SSO_EMAIL_HEADER=x-remote-email
```

The reverse proxy must forward `X-Remote-User` from an authenticated upstream context.

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
| `PORT` | `4000` | Express middleware port |
| `NEXT_PORT` | `3000` | Next.js port |
| `CORS_ORIGINS` | `http://localhost:8080` | Allowed CORS origins |
| `APP_RUN_DB_INIT` | `true` | Run database init on startup |

### Seed Flags

| Variable | Default | Description |
|---|---|---|
| `INIT_WITH_TEST_SEEDS` | `false` | load the demo catalogue and demo relationships |
| `INIT_WITH_C3_ENTITY_SEEDS` | `false` | load baseline C3 entities |
| `INIT_WITH_C3_BASELINE_TAXONOMY_SEED` | `false` | load baseline C3 taxonomy |
| `INIT_WITH_C3_TAXONOMY_XLSX_SEED` | `false` | use the taxonomy snapshot derived from XLSX imports |
| `INIT_WITH_C3_CAPABILITY_MAP_SEED` | `false` | load the baseline Spiral 7 capability map |

### SSO

| Variable | Default | Description |
|---|---|---|
| `AUTH_SSO_ENABLED` | `false` | Enable SSO through trusted headers |
| `AUTH_SSO_HEADER` | `x-remote-user` | Header carrying the username/principal |
| `AUTH_SSO_DISPLAY_NAME_HEADER` | `x-remote-name` | Header carrying the display name |
| `AUTH_SSO_EMAIL_HEADER` | `x-remote-email` | Header carrying the email address |

---

## Database Initialization

The database is initialized automatically on startup when `APP_RUN_DB_INIT=true`.
The init path seeds schemas, reference data, and module metadata only. It does
not create a reusable default administrator account.

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
06_pricing.sql           — ServiceFlavour and ServiceSla
07_domains.sql           — ServiceAvailableOn
08_ownership.sql         — assignments, mappings, raw fields
09_import.sql            — import pipeline tables
10_indexes.sql           — performance indexes
11_c3.sql                — C3 taxonomy module
12_exports_retention.sql — export and retention scheduler
13_install_system.sql    — install state machine and module registry
```

---

## Post-Install Verification

```bash
# Health check
curl http://localhost:8080/api/health/ready

# Install state
curl http://localhost:8080/api/v1/install/status

# Expected: { "status": "READY", "mode": "ready", ... }
```
