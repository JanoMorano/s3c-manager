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

- local login: bcrypt with 12 rounds, rate limit 20 attempts / 15 minutes
- SSO: trusted headers from a reverse proxy (`x-remote-user`) plus a shared
  proxy-boundary secret (`AUTH_SSO_TRUSTED_PROXY_SHARED_SECRET`) carried in
  `AUTH_SSO_TRUSTED_PROXY_HEADER` (default `x-sso-proxy-secret`) before trusted
  identity headers are accepted
- JWT access token: 60 minutes, HS256
- JWT refresh token: 7 days, hash stored in DB and revocable
- browser sessions use `HttpOnly` cookies (`sc_access_token`,
  `sc_refresh_token`) with `SameSite=Lax`; `Secure` is enabled automatically in
  production
- login and refresh responses still return token fields for compatibility, but
  browser session continuity relies on the cookies
- failed login attempts are written to `platform.audit_log`

### Authorization

- RBAC: `viewer` (read), `editor` (mutations), `admin` (administration)
- protected endpoints use `requireAuth` plus RBAC checks
- install endpoints are state-dependent: `/api/v1/install/status` stays public,
  while pre-READY mutating install routes can be locked behind
  `INSTALL_SETUP_TOKEN`

### Secrets Management

- recommended: Docker Compose secrets mounted as files and passed through
  `JWT_SECRET_FILE`, `DB_PASSWORD_FILE`, and `POSTGRES_PASSWORD_FILE`
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

- the application itself listens on HTTP; use TLS termination on a reverse
  proxy such as nginx or Traefik for production
- trusted-header SSO must be allowed only through a proxy that injects the
  configured shared-secret header; the backend rejects missing or mismatched
  secrets before reading identity headers
- if `INSTALL_SETUP_TOKEN` is not configured, pre-READY bootstrap write routes
  stay reachable without that extra shared secret; that mode is intended only
  for isolated or local installs
- CORS origins explicitly whitelisted through `CORS_ORIGINS`
- Helmet.js middleware provides CSP and related browser hardening headers; HSTS
  should be enforced at the HTTPS reverse-proxy boundary

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
