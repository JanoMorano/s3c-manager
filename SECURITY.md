# Security Policy

## Supported Versions

| Version | Security Support |
|---|---|
| 1.x | ✅ Active |
| < 1.0 | ❌ Unsupported |

## Reporting a Vulnerability

**Do not report security vulnerabilities through public GitHub Issues.**

Please use **[GitHub Security Advisories](../../security/advisories/new)** instead by clicking **Report a vulnerability** on the repository Security tab.

Include:

- a vulnerability description
- reproduction steps
- potential impact
- a suggested fix, if available

Expect a response within 5 business days.

## Security Model

### Authentication

- local login: bcrypt with 12 rounds, rate limit 5 attempts / 15 minutes
- SSO: trusted headers from a reverse proxy (`x-remote-user`) plus a shared
  proxy-boundary secret (`AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET`) carried in a
  dedicated header before trusted identity headers are accepted
- JWT access token: 60 minutes, RS256 or HS256
- JWT refresh token: 30 days, hash stored in DB and revocable
- failed login attempts are written to `platform.audit_log`

### Authorization

- RBAC: `viewer` (read), `editor` (mutations), `admin` (administration)
- every endpoint explicitly declares its required role
- admin functions require the `admin` role

### Secrets Management

- no secrets in source code or Docker images
- recommended: Docker Compose secrets mounted under `/run/secrets/` and passed
  through `JWT_SECRET_FILE`, `DB_PASSWORD_FILE`, and `POSTGRES_PASSWORD_FILE`
- alternative: strong environment variables in an isolated `.env` file
- `JWT_SECRET` should contain at least 32 random characters, for example
  `openssl rand -base64 48`

### Audit Trail

- every mutation (CREATE/UPDATE/DELETE) is written to `platform.audit_log`
- authentication failures are recorded with source IP and user agent
- the audit log is append-only for the application user

### Database Hardening

- separate `platform` and `data` schemas
- least privilege in production; the app user should not have DDL permissions
- parameterized queries everywhere, no SQL string concatenation

### Network Layer

- recommended: TLS termination on a reverse proxy such as nginx or Traefik
- trusted-header SSO must be allowed only through a proxy that injects the
  configured shared-secret header; the backend rejects missing or mismatched
  secrets before reading identity headers
- CORS origins explicitly whitelisted through `CORS_ORIGINS`
- Helmet.js middleware for security headers such as CSP, HSTS, and X-Frame-Options

### Backup and Recovery

- PostgreSQL backups are required before upgrades and before destructive reset
  flows such as `./deploy.sh rebuild-db`
- backup cadence should be at least daily for production
- restore rehearsals should be performed regularly, at minimum monthly
- keep at least one recent backup off-host or off-node
- treat `./scripts/restore-postgres.sh` as the supported recovery path

## Security Contacts

- security reports: GitHub Security Advisories
- general questions: GitHub Issues with the `security` label
