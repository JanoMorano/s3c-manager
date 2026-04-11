# Development Conventions

Project coding guide for Service Catalogue v2.

## Stack

- frontend: Next.js 15, React 19, TypeScript
- middleware: Node.js, Express, PostgreSQL `pg`
- database: PostgreSQL 16 with `platform` and `data` schemas

## General Principles

- the codebase must remain reproducible through `docker compose up -d`
- no secrets, exports, or binary artifacts in the repository
- keep one canonical seed source: `shared/c3/`
- model or API changes must ship with matching docs and tests

## Frontend

- use TypeScript and avoid unnecessary `any`
- new routes must use canonical URLs, not legacy aliases
- import `Link` through the shared wrapper when the project uses a custom prefetch policy
- enforce access control with role helpers and install/module status, not by hiding buttons alone
- use CSS Modules and design tokens for repeated styles

## Middleware

- parameterized SQL only
- every new endpoint must have:
  - a happy path
  - an auth or permission failure case
  - explicit error handling
- do not add hidden auth bypasses for development; tests should use real JWTs, explicit fixtures, or mocked middleware as appropriate
- always respect the `C3_TAXONOMY` module gate for C3 APIs
- do not bring legacy MSSQL compatibility layers back into the active tree

## Backend / SQL

- add new DB changes to `backend/db/postgres/schema/`
- seed data belongs in `backend/db/postgres/data/`
- init must remain idempotent
- keep SQL files readable and grouped by functional area

## Repo Hygiene

The active tree must not contain:

- files like `* 2.tsx`, `* 2.js`, `* 2.md`
- `.DS_Store`
- `.next`, `.npm`, `Library`, `coverage`
- binary build artifacts such as `*.tar`, `*.zip`, `*.docx`

Local or historical material belongs in `_archive/` or outside the repository.

## Documentation

When product behavior changes, update:

- `README.md` for quick start and product positioning
- `docs/installation.md` for environment and deployment changes
- `docs/import-formats.md` for import payload changes
- `docs/c3-module.md` whenever C3 behavior changes

## Pre-Commit Testing

```bash
cd frontend && npm run lint && npm run build
cd ../middleware && npm test -- --runInBand
cd .. && bash scripts/check-repo-hygiene.sh
```

## Review Checklist

- the commit does not contain local artifacts
- the change does not reintroduce legacy routes or duplicate files
- feature and module gating is respected
- documentation matches the real runtime
- imports and demo data have stable examples
