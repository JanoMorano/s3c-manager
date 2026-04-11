# Contributing Guide

## How to Contribute

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/short-description`
3. Implement your changes (see [conventions below](#conventions))
4. Add or update tests
5. Open a Pull Request against `main`

### Branches

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable code |
| `feature/*` | New features |
| `fix/*` | Bug fixes |
| `chore/*` | Tooling, dependency, and refactor work |
| `release/*` | Release preparation |

### Branch Protection (`main`)

- All PRs require code review (minimum 1 approval)
- CI must pass before merge:
  - `repo-hygiene`
  - `frontend-typecheck`
  - `frontend-lint`
  - `middleware-tests`
  - `app-e2e`
- Force push to `main` is forbidden
- Deleting `main` is forbidden

## Conventions

### Commit Messages

```text
<type>(<scope>): <short description>

[optional body]
```

Types: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`

Examples:

```text
feat(install): add editable configuration fields to step 2
fix(auth): log AUTH_FAILURE to audit_log on invalid password
chore(deps): upgrade bcrypt to 5.1.1
```

### Coding Standards

**Backend (Node.js / Express):**

- `'use strict'` at the top of every file
- async/await everywhere, no `.then()` chains
- parameterized SQL only, no string concatenation
- secrets and passwords must never appear in logs
- use `try/catch` in every route handler and pass `next(err)` to error middleware

**Frontend (Next.js / TypeScript):**

- use strict TypeScript, avoid `any` unless justified
- use `'use client'` only where needed
- prefer CSS Modules over repeated inline styles
- use design tokens from `tokens.css`, not hardcoded colors or sizes

### Database Schemas

- add new tables to the appropriate file under `backend/db/postgres/schema/`
- file numbering defines apply order
- add the corresponding record to `platform.schema_migrations` in `13_install_system.sql`
- do not introduce `DROP` statements without a migration path

### Testing

```bash
# Middleware unit tests
cd middleware && npm test

# E2E (Playwright)
cd frontend && npm run test:e2e

# Repo hygiene
cd .. && bash scripts/check-repo-hygiene.sh
```

New endpoints must have:

- a happy path test
- an error case test such as 401, 422, or 500

## Development Environment

```bash
# Prerequisites
node --version  # 20+
psql --version  # 16+

# Run locally
docker compose up postgres -d
cd middleware && npm install && npm run dev
cd frontend && npm install && npm run dev
```

## Code Review Checklist

- [ ] No secrets or passwords in code
- [ ] SQL queries are parameterized
- [ ] Error handling is complete
- [ ] Sensitive operations are written to `audit_log`
- [ ] TypeScript types are correct
- [ ] CSS uses design tokens

## Contact

Questions about contributions: GitHub Issues with the `contribution` label.
