# TypeScript migration assessment

Date: 2026-05-14
Version context: S3C Manager 1.2.2 worktree

## What was safely converted now

- `frontend/next.config.js` was converted to `frontend/next.config.ts`.
- The frontend application surface is already TypeScript-first: no `.js` or `.jsx` files remain under `frontend/app`, `frontend/features`, `frontend/design-system`, `frontend/components`, `frontend/hooks` or `frontend/lib`.

## Why the remaining JavaScript should not be renamed blindly

The remaining JavaScript is not all the same kind of code. A direct rename would break runtime wiring in several places.

### Middleware runtime

`middleware/src` is CommonJS and is started directly by Docker through:

```sh
node /app/middleware/src/server.js
```

It has no TypeScript compiler step, no emitted `dist` directory, no Jest TypeScript transform and no runtime loader for `.ts` files in the Node 20 production image. Renaming these files to `.ts` now would break production startup, test discovery and module resolution.

### Shared i18n CommonJS modules

`shared/i18n/core.js`, `shared/i18n/catalog.js` and `shared/i18n/locales.js` are consumed by both Next.js TypeScript code and CommonJS middleware code. Converting them to TypeScript before introducing a dual build would break middleware `require(...)` calls.

### Dev scripts and tool configs

The remaining `.mjs` files are Node-executed tooling/config files: ESLint config, PostCSS config, frontend i18n scripts and root smoke/import helper scripts. Some could be converted later, but only after adding a stable TypeScript script runner or build step compatible with the Node 20 image and CI environment.

## Recommended next migration plan

1. Add a middleware TypeScript toolchain.

   Add `typescript`, `@types/node`, `@types/express`, `@types/jest`, `@types/supertest`, `@types/jsonwebtoken`, `@types/cors`, `@types/morgan`, `@types/compression`, `@types/passport`, `@types/passport-http` and related route/repo typings. Add `middleware/tsconfig.json` with an emitted `dist` target.

2. Update runtime wiring before file conversion.

   Add `middleware` scripts for `build`, `typecheck`, `start:prod`, keep `dev` working, and update `Dockerfile` plus `start.sh` to run compiled output only after tests pass.

3. Convert leaf modules first.

   Start with pure utilities and parsers such as capability slugs, query filters, i18n helpers, C3 route helpers and simple parsers. These have low coupling and reveal type boundaries early.

4. Convert services and repositories second.

   Add explicit DB row/result types, service DTOs and validation types. This is the biggest quality gain because most runtime risk is around nullable DB fields, dynamic payloads and imported catalogue data.

5. Convert Express routes after DTOs exist.

   Routes should get typed request bodies, query parameters, route params and response shapes. This should happen after repos/services have typed contracts, otherwise routes would become `any` wrappers.

6. Convert Jest tests last.

   Use `ts-jest`, Babel/SWC, or a compiled test strategy. Do this after middleware source compiles, so test conversion validates behavior rather than fighting test infrastructure.

7. Convert shared modules through a dual package boundary.

   Move shared i18n/service-catalogue code to TypeScript source with generated CommonJS output for middleware and direct TypeScript/ESM consumption for frontend.

## Current conclusion

The application is already TypeScript-first on the frontend. The only safe immediate conversion was the Next.js config. Full middleware conversion is valuable, but it is a separate platform migration, not a mechanical rename. The correct next step is to introduce a middleware TypeScript build pipeline and then convert by dependency layer.

## Architect impact assessment

### Decision

TypeScript migration has clear architectural value for a modern S3C Manager, but it should be treated as a controlled platform-modernization track after the current v1.2.2 stabilization, not as another reduction task and not as a one-shot rename of JavaScript files.

Recommended decision: proceed later in staged form, starting with middleware typecheck/build infrastructure and low-coupling utility modules. Do not convert the full middleware runtime until Docker startup, Jest, linting and production packaging run from compiled output.

### Why it matters

The strongest value is not cosmetic. The product now depends on many dynamic boundaries:

- database rows with nullable governance, C3, readiness and import fields
- Express request bodies and query parameters
- service DTOs returned to the Next.js frontend
- import payloads and C3 taxonomy records
- i18n catalog keys consumed across frontend and middleware
- auth/session/security middleware where small shape errors can become production defects

Typed contracts would reduce runtime surprises in exactly the places where this application is most sensitive: catalogue integrity, C3 mappings, readiness decisions, installer state, RBAC and import processing.

### Practical impact

The frontend is already modern enough from a TypeScript perspective. The remaining impact is mostly the middleware and shared package boundary.

Current verified state:

- frontend already builds as TypeScript/TSX through Next.js
- production Docker currently runs middleware directly with `node /app/middleware/src/server.js`
- middleware has no TypeScript compiler step, emitted `dist` directory or test transform
- middleware source and tests are still JavaScript/CommonJS
- shared i18n modules are CommonJS because both frontend and middleware consume them

That means a blind migration would likely break application startup, tests, Docker image packaging and `require(...)` resolution. A staged migration is valuable; a mechanical conversion is high risk with little immediate user-facing gain.

### Expected benefits

- safer refactoring of service, capability, C3 and readiness flows
- earlier detection of missing/renamed DB fields
- clearer API response contracts between middleware and frontend
- lower chance of installer/import regressions
- better maintainability for future security-hardening, observability and performance work
- better onboarding for future developers because route, repository and DTO contracts become explicit

### Main risks

- build pipeline complexity increases because middleware must compile before runtime
- Docker image and startup scripts must be changed carefully
- Jest must be configured for TypeScript or compiled tests
- CommonJS/ESM interop can create subtle runtime failures
- incomplete typing can create a false sense of safety if everything becomes `any`
- converting routes before repositories/DTOs exist would mostly move dynamic code into TypeScript without real quality gain

### Recommended scope

This should be a new plan outside reduction, for example `typescript-platform-hardening`.

Suggested order:

1. Add middleware `tsconfig.json`, typecheck script and build script while keeping JavaScript runtime unchanged.
2. Add `allowJs`/`checkJs` or equivalent transitional checks to expose issues without converting files.
3. Introduce typed DB row and DTO definitions for service catalogue, C3 taxonomy, readiness and installer flows.
4. Convert pure utilities and parsers first.
5. Convert repositories and services next.
6. Convert Express routes only after DTOs and repo contracts exist.
7. Convert tests after source compilation is stable.
8. Move shared i18n modules behind a dual CommonJS/TypeScript boundary.
9. Switch Docker/runtime to compiled middleware output only after smoke tests pass.

### Acceptance criteria

The migration should be considered successful only when:

- frontend build passes
- middleware lint, test and typecheck pass
- Docker image starts from compiled middleware output
- installer smoke test passes
- login/auth/session smoke test passes
- service list/detail/edit smoke test passes
- C3 list and capability map smoke test passes
- readiness and governance routes smoke test passes
- no production route or DB repository relies on broad `any` as its primary contract

### Final recommendation

Yes, this work has meaning for a modern application, especially for long-term governance, security and maintainability. It should not be done immediately as a broad conversion during v1.2.2 cleanup. The right timing is after v1.2.2 commit/release readiness, as a separate hardening roadmap with small safe milestones and rollback points.
