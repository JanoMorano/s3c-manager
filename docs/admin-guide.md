# Admin Guide

## Document Purpose

This guide describes the operation, configuration, and administration of the Service Catalogue runtime. It is intended for:

- `admin` users managing the system
- `editor` users handling content management
- deployment and operations administrators

## Current Runtime Model

The canonical deployment uses two containers:

- `app` — Next.js frontend, Express middleware, init and seed logic, retention scheduler
- `postgres` — `platform` schema (system), `data` schema (business data)

---

## Main Administrative Areas

### Administration

Route:

```text
/administration
```

Contains:

- `User Management`
- `Group Management`
- `Web` (SSO settings)
- `Installation & Modules`
- `Catalogue Column Edit`
- `C3 Column Edit`
- `C3 Capability Builder`
- `Import History`
- `Import Audit`
- `Audit Logs`

### Content Admin

Route:

```text
/management
```

Available to `editor` and `admin`. Provides:

- `New Service` — launches the Service Onboarding Wizard
- `New C3 Capability`
- `Import CSV/JSON/XLSX`

---

## Roles and Permissions

- `viewer` — read-only access to business data and dashboards
- `editor` — can edit services, C3 entities, capabilities, and imports
- `admin` — manages users, groups, web/SSO settings, references, installation workflows, and audit

---

## Service Catalogue Administration

### Service Onboarding Wizard

Route:

```text
/management/new-service
```

The wizard guides editors through structured service creation in 7–8 steps depending on whether C3 module is enabled:

1. **Identity** — service_id, title, type, status, lifecycle state
2. **Description** — short_description, business_summary, consumer_value
3. **Access** — requestable flag, request_channel_url, approval_required, fulfillment_lead_time, target_audience
4. **Classification** — portfolio_group, network domains, service lines
5. **Ownership** — service_owner (email), review_owner, next_review_due_at
6. **SLA** — availability percentage, RTO, RPO, support_hours, support_tier, support_channel
7. **C3 Mapping** — C3 taxonomy UUID selection (only visible when C3 module is installed)
8. **Review** — full summary before submission

Every field includes an inline ITIL hint and a `?` tooltip with a detailed explanation. Placeholders are shown in blue italic to guide editors on expected format.

After the wizard completes, the editor is redirected to the full service editor for offerings and support model.

### Service Editor

Route:

```text
/services/{service_id}/edit
```

The editor organises fields in sections. Since ITIL phases 1–8, these sections include:

**Identity & Lifecycle**
- service_id, title, type, status
- `lifecycle_state` — draft / under_review / approved / live / deprecated / retired
- Lifecycle transitions are validated — a service cannot move to `live` without meeting minimum completeness requirements

**Business Description**
- short_description, business_summary
- `consumer_value` — plain-language benefit statement shown prominently to service consumers

**Requestability & Audience**
- `requestable` toggle — when enabled, request_channel_url is required
- request_channel_url, approval_required, fulfillment_lead_time_text
- target_audience, eligibility_rules

**Service Offerings**
Each service can have multiple offerings. Per offering:
- offering_code, title, description
- requestable, approval_required, lead_time_text
- target_audience, support_tier, billing_model, price_reference
- is_default flag, status

The default offering is surfaced in the service list and detail header.

**Support Model**
- support_owner_name / support_owner_email
- resolver_group, support_hours, support_channel
- escalation_path, maintenance_window, service_review_cadence

**SLA**
- sla_availability, sla_rto, sla_rpo, sla_restoration_text, sla_delivery_text
- scope_text, operational_notes_raw

**Ownership**
- service_owner, review_owner, next_review_due_at

**Operational Links**
Structured URL references for:
- knowledge articles
- incident dashboard
- change calendar
- support documentation
- service review records

**Relations & Domains**
- network domain availability
- service-to-service relations (dependency, integration, replacement)

**C3 Mappings** (when C3 module is enabled)
- primary C3 capability
- additional mappings
- PACE categories
- readiness and validation warnings

**Validation & Completeness**
- completeness score
- readiness checks

### Lifecycle Governance

Lifecycle states and their meaning:

| State | Meaning | Transition rules |
|---|---|---|
| `draft` | Being prepared | Initial state, open to any edit |
| `under_review` | Under review | Requires title, owner, type |
| `approved` | Approved | Requires business_summary, lifecycle |
| `live` | Active | Requires completeness minimum; sets publish date |
| `deprecated` | Scheduled for retirement | Requires replacement service or justification |
| `retired` | No longer available | Terminal state; consumer banner shown |

Transition validation blocks advancement — the API rejects invalid transitions and returns a descriptive error. The editor surfaces these as inline validation messages.

Deprecated and retired services show a prominent banner on the detail page warning consumers.

### Services Dashboard

Route:

```text
/services/dashboard
```

Since ITIL phase additions, the dashboard includes:

- **Lifecycle KPIs** — count of services in each lifecycle state
- **Requestable count** — how many services are flagged as requestable
- Status distribution, type distribution, governance completeness
- Services with missing consumer_value or support model
- Services approaching review date

---

## C3 Administration

### Capability List and Editor

List: `/c3/list`  
Editor: `/c3/{uuid}/edit`

Capability detail and editing use a standardised section layout with validation blocks.

### C3 Entity Editors

Dedicated editors exist for:

- `Applications` — `/admin/c3-application/{code}`
- `Data Objects` — `/admin/c3-data-objects/{code}`
- `Services` — `/admin/c3-services/{code}`
- `Technology Interactions` — `/admin/c3-technology-interactions/{code}`

### Capability Builder

Route: `/admin/c3-capability-builder`

Used for:

- editing the final capability map
- changing the capability map page title
- managing Spiral 6 and Spiral 7 baseline branches

Public maps: `/c3/capability-map-spiral6`, `/c3/capability-map-spiral7`

---

## Installation and Modules

### Installation & Modules

Route: `/admin/installation`

Typical uses:

- inspect installation state
- verify release/schema handshake
- run repair flows
- restore demo data
- activate modules and review module state
- coordinate backups and restores during maintenance windows

Operations runbook: [docs/operations.md](operations.md)

### First-Run Installation

When `APP_RUN_DB_INIT=true`, the init script runs:

```text
/app/init/init-db-postgres.sh
```

It always creates the core schema and conditionally applies seed data based on flags. Does not create a reusable default admin account.

If `INSTALL_SETUP_TOKEN` is set, pre-READY install write routes require the `x-install-setup-token` header.

### Seed Flags

- `APP_RUN_DB_INIT`
- `INIT_WITH_TEST_SEEDS`
- `INIT_WITH_C3_ENTITY_SEEDS`
- `INIT_WITH_C3_BASELINE_TAXONOMY_SEED`
- `INIT_WITH_C3_TAXONOMY_XLSX_SEED`
- `INIT_WITH_C3_CAPABILITY_MAP_SEED`

Practical combinations:

- clean schema without C3: `APP_RUN_DB_INIT=true`, all `INIT_WITH_* = false`
- full C3 baseline: enable the required `INIT_WITH_C3_*` flags
- demo data: `INIT_WITH_TEST_SEEDS=true`

### Schema Migrations

ITIL phase migrations are applied automatically on startup in order:

- `15_itil_catalogue_phase1.sql` — adds service_offerings, support_model, audience_policy, operational_links, lifecycle fields, requestability fields
- `16_consumer_value.sql` — adds consumer_value column to services

See [upgrade.md](upgrade.md) for the full migration workflow.

---

## Admin sekce (CZ)

### 1) Podporované prostředí a předpoklady instalace

Pro provoz v produkci i testu používejte minimálně:

- Docker Engine 24+
- Docker Compose v2.20+
- 2 vCPU / 4 GB RAM minimum (doporučeno 4 vCPU / 8 GB RAM)
- min. 10 GB volného místa pro aplikaci, databázi a zálohy
- nastavené tajné klíče: `JWT_SECRET`, `DB_PASSWORD`, `POSTGRES_PASSWORD`

Doporučení:

- pro sdílené prostředí vždy zapnout `INSTALL_SETUP_TOKEN`
- používat HTTPS přes reverzní proxy
- ověřit dostupnost portu aplikace a DB konektivity před startem instalace

### 2) Instalační postup krok za krokem

1. Připravte `.env` (tajné klíče, hesla DB, volitelně instalační token).
2. Spusťte stack (`docker compose up -d`).
3. Sledujte logy inicializace (`docker compose logs -f app`) a vyčkejte na dokončení bootstrapu.
4. Otevřete aplikaci na `/install`.
5. Dokončete wizard: konfigurace, vytvoření prvního admin účtu, kontrola DB, výběr modulů.
6. (Volitelně) proveďte úvodní import dat.
7. Ověřte stav instalace na `READY`.

### 3) Import dat (formáty, mapování sloupců, validace, rollback)

#### Podporované formáty

- CSV (`text/csv`, `text/plain`)
- JSON (`application/json`)
- XLSX
- ArchiMate XML (`application/xml`, `text/xml`) pro C3 cíle

#### Mapování sloupců a polí

- CSV a XLSX mapují primárně na canonical názvy (`service_id`, `title`, …).
- JSON akceptuje canonical názvy i aliasy (`serviceId`, `serviceType`, `status`).
- U C3 XML se mapují identifikátory, názvy, popisy a metadata na C3 taxonomy pole.

#### Validace při importu

Import pipeline:

`parse -> normalize -> taxonomy resolve -> upsert -> audit log -> batch summary`

Validace zahrnuje:

- povinná pole (typicky `service_id`, `title`)
- datové typy a formát hodnot
- referenční/taxonomické kódy (neznámé kódy = warning, neblokují celý běh)
- kolize klíčů řešené upsertem (`INSERT`/`UPDATE`)

#### Rollback po importu

- automatický rollback importu není podporován jako jediné tlačítko v UI
- bezpečný návrat se provádí obnovou databáze ze zálohy před importem
- pro kontrolu dopadu používejte dry-run endpointy/importní náhled před ostrým během

#### Kontrolní checklist před importem

- [ ] Existuje aktuální záloha databáze (ideálně čerstvá, mimo hostitele).
- [ ] Byl proveden dry-run se stejným souborem a bez kritických chyb.
- [ ] Soubor má očekávaný formát (oddělovač, kódování, hlavičky, datové typy).
- [ ] Povinné sloupce/pole jsou vyplněné (`service_id`, `title`, …).
- [ ] Referenční kódy (taxonomy, status, typy) odpovídají hodnotám v systému.
- [ ] Je potvrzené importní okno a odpovědná osoba pro případ rollbacku.

#### Kontrolní checklist po importu

- [ ] Import batch je dokončen bez fatálních chyb.
- [ ] `rows_failed` je 0 nebo je zdokumentován akceptovaný rozsah chyb.
- [ ] Warnings z `import_issue` jsou vyhodnoceny a mají plán nápravy.
- [ ] Náhodný vzorek importovaných záznamů byl funkčně ověřen v UI.
- [ ] Auditní stopa (`import_batch`, audit log) je kompletní.
- [ ] V případě problému je připravený a otestovaný postup obnovy ze zálohy.

### 4) Aktualizace / verzování

- aplikace používá SemVer (`MAJOR.MINOR.PATCH`)
- při rozdílu verze aplikace a DB stavu se aktivuje režim upgrade (`UPGRADE_REQUIRED`)
- před každým upgradem je povinná záloha DB
- migrace jsou jednosměrné, sledované v `platform.schema_migrations`

Praktický postup:

1. vytvořit zálohu
2. nasadit nové image (`docker compose pull && docker compose up -d`)
3. dokončit upgrade flow ve wizardu
4. ověřit `READY`, health endpointy a stav migrací

### 5) Zálohování a obnova

Primární skripty:

- `./scripts/backup-postgres.sh`
- `./scripts/restore-postgres.sh`

Zásady:

- zálohovat minimálně před každým releasem a před větším importem
- uchovávat minimálně jednu kopii mimo cílový host
- pravidelně testovat obnovu v neprodukčním prostředí
- `deploy.sh rebuild-db` nepoužívat jako náhradu backup/restore procesu

### 6) Řešení běžných chyb

Nejčastější situace a reakce:

- **Instalace se neodemkne /install write endpointy**
  - zkontrolovat `INSTALL_SETUP_TOKEN` a posílanou hlavičku `x-install-setup-token`
- **Import hlásí mnoho warningů taxonomy_unresolved**
  - ověřit mapování referenčních kódů, případně doplnit reference před dalším během
- **Po upgrade je stav `UPGRADE_REQUIRED` stále aktivní**
  - zkontrolovat logy migrací a tabulku `platform.schema_migrations`
- **Aplikace není READY po restore**
  - ověřit konzistenci dumpu, DB přihlašovací údaje a readiness endpoint
- **SSO login nefunguje**
  - zkontrolovat trusted proxy hlavičky a sdílené tajemství mezi proxy a aplikací

---

## Users, Groups, and SSO

### User Management

Route: `/administration/users`

Administrators manage:

- local accounts and AD/SSO-backed accounts
- role assignments
- account activity and profile data
- user language preference (`cs` / `en` / `sk` / `de`)
- persona preference for user-driven dashboard mode

Language preference behavior:

- canonical user locale stored in `preferred_lang`
- web UI keeps locale cookie `sc_locale`
- when a signed-in user changes language on `/user-info`, both DB preference and cookie are refreshed
- legacy values (`cz`, `cze`) are normalised to `cs`; `svk` to `sk`; `ger` / `deu` to `de`
- language and persona controls are intentionally placed on `/user-info`, not in the quick user dropdown

### Group Management

Route: `/admin/groups`

Groups provide more granular permissions across catalogue and C3 areas.

### Web / SSO

Route: `/administration/web`

Managed parameters:

- trusted-header SSO
- principal header mapping (display name, email, given name, surname, department)

Relevant environment variables:

- `AUTH_SSO_ENABLED`
- `AUTH_SSO_HEADER`
- `AUTH_SSO_DISPLAY_NAME_HEADER`
- `AUTH_SSO_EMAIL_HEADER`
- `AUTH_SSO_GIVEN_NAME_HEADER`
- `AUTH_SSO_SURNAME_HEADER`
- `AUTH_SSO_DEPARTMENT_HEADER`
- `AUTH_SSO_SHARED_SECRET_HEADER`
- `AUTH_SSO_SHARED_SECRET`

Operational notes:

- the backend trusts SSO identity headers only when the trusted proxy header is present and its shared secret matches
- browser auth uses `HttpOnly` cookies for access and refresh tokens
- the frontend keeps only a small user snapshot in `sessionStorage`; JWTs are not persisted in browser storage

---

## Imports and Audit

### Import Upload

Route: `/import/upload`

Supported import groups:

- Service Catalogue — CSV, JSON
- C3 Taxonomy — CSV, JSON, XLSX
- FMN Spirals

Flow: dry-run → sync → commit → issue reporting

### Import Audit

Routes: `/import`, `/admin/import`

Used for batch history, warning/error issue logs, and troubleshooting specific runs.

---

## References and Lookup Data

### Catalogue Column Edit

Route: `/admin/catalogue-ref`

Manages: service types, service status codes, relation types, portfolio groups, service lines, and other catalogue reference tables.

### C3 Column Edit

Route: `/admin/c3-ref`

Manages: C3 mapping types, capability domains, and other C3 reference values.

---

## Runtime Environment Variables

Key runtime variables:

- `DATABASE_URL`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET`
- `CORS_ORIGINS`
- `ENABLE_RETENTION_SCHEDULER`
- `RETENTION_RUNNER_NAME`, `RETENTION_RUNNER_KIND`
- `RETENTION_PURGE_INTERVAL_SECONDS`, `RETENTION_HEARTBEAT_TTL_SECONDS`

---

## QNAP / Portainer Notes

QNAP deployment uses:

- `portainer-stack.yml`
- `.env.qnap`
- the bundle created by `build-amd64.sh`

Important variables: `QNAP_DATA_DIR`, `QNAP_NETWORK_NAME`, `APP_STATIC_IP`, `POSTGRES_STATIC_IP`, `QNAP_DNS`

If `POSTGRES_PASSWORD` differs from the password used when the volume was first created, PostgreSQL rejects the login. Fix: reuse the original password, change it inside the DB, or remove the volume and run a clean init.

---

## Recommended Operational Checks

After deployment verify:

```text
/api/health/live
/api/health/ready
/api/health/import
```

Basic checklist:

1. `app` and `postgres` containers are healthy
2. login works
3. `/services/list` returns data
4. lifecycle and requestable filters return expected results
5. `/c3/list` returns data (when C3 module is enabled)
6. Spiral 6 and Spiral 7 capability maps load
7. import upload page matches the user role
8. administration menu is visible only to authorised roles
9. New Service wizard loads at `/management/new-service`

---

## Common Problems

### Service Cannot Transition to `live`

Cause: minimum completeness requirements are not met.

Fix: open the service editor, check the Validation & Completeness section, fill all required fields, then retry the lifecycle transition.

### C3 Seed Files Not Found

Symptom: init reports a missing file in `shared/c3`

Fix: add the required seed files or disable the corresponding `INIT_WITH_*` flag.

### Password Authentication Failed for User `postgres`

Cause: existing PostgreSQL volume was created with a different password.

Fix: reuse the original password, change it inside the database, or remove the volume and redeploy cleanly.

### C3 Editor Opens but Save Fails

Current behavior: the C3 entity update API uses `canEdit`, so both `editor` and `admin` can save. Verify the user role if save fails.

### Capability Map or Dashboard Is Empty

Check: seed flags, presence of files in `shared/c3`, C3 Capability Builder state, and import runs.
