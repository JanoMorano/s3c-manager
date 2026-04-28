# User Guide

## Application Purpose

Service Catalogue is a catalogue of services and, optionally, C3 taxonomy data. It is used to read and manage:

- service catalogue records with lifecycle, offerings, and support model
- requestability and consumer-facing service information
- relationships between services
- pricing and SLA variants
- C3 capabilities and C3 entities
- mappings between the service catalogue and the C3 taxonomy
- imports and audit history

## Roles and Permissions

- `viewer` — read-only access to catalogue data, C3 data, and dashboards
- `editor` — content management, imports, new records, and business-data editing
- `admin` — everything from `editor` plus users, groups, web/SSO settings, references, and installation management

## Main Navigation After Login

After login, the left sidebar exposes these sections:

- `Command Centre` — Catalogue, C3, Capability, Spiral, and Operations dashboards
- `Service Catalogue` — all services, services graph, dependency flow, and consolidation matrix
- `C3 Reference` — C3 lists, relation graph, and capability map reference views
- `FMN Spirals` — FMN spiral workspaces such as FMN Air C2
- `Administration` — system settings, users, import, content admin, and references

If the C3 module was disabled during installation, all C3 groups disappear from the UI automatically.

The quick user dropdown is deliberately small: it contains only **User Info** and **Log Out**. Language and persona preferences are managed on `/user-info` so user-driven settings live in one profile area instead of crowding the navigation.

---

## Service Catalogue

### Service List

Route:

```text
/services/list
```

The service list is the main working view. It supports:

- full-text search
- filtering by **status**, **portfolio**, **type**, **lifecycle state**, **requestable**, and **domain**
- lifecycle state filter with colour-coded dot indicators:
  - grey — draft
  - blue — under review
  - green — approved / live
  - amber — deprecated
  - red — retired
- requestable radio filter — show only requestable or non-requestable services
- URL-persisted filters — every filter combination is shareable via URL
- sorting by ID, title, portfolio, and status
- density toggle — comfortable or compact rows
- CSV export of the current filter result
- saved views — save and recall filter combinations from the filter rail

Each row shows: service ID, type chip, title, portfolio, domain dots, SLA availability, status pill with lifecycle dot, and owner.

### Services Dashboard

Route:

```text
/services/dashboard
```

The dashboard shows aggregated catalogue metrics including:

- total service count
- status distribution (active, draft, deprecated, retired)
- lifecycle state KPIs — how many services are in each lifecycle state
- requestable count — how many services are requestable
- type distribution
- governance and completeness indicators

### Services Graph View

Route:

```text
/services/graph
```

The global graph displays services and their relationships. The toolbar allows:

- `Connector type`
- `Line style`
- overlays such as `C3 Taxonomy` and `Flavours`
- PDF export

### Service Dependency Graph

Route:

```text
/services/{service_id}/graph
```

This view focuses on one service and its dependency subgraph.

`Depth` controls how many hops to expand:

- `1` — direct dependencies only
- `2` — direct dependencies plus immediate context
- `3` — widest subgraph for a single service

---

## Service Detail

Route:

```text
/services/{service_id}
```

The service detail page is structured in two layers: a header summary and a tab section below.

### Header Summary

The header always shows:

- service name and short description
- owner
- lifecycle state badge
- status pill
- requestable indicator — yes/no with request channel link
- primary offering name and lead time
- SLA/support summary

A lifecycle banner is shown at the top for **deprecated** or **retired** services so consumers immediately know the service is no longer recommended or available.

### Service Detail Tabs

| Tab | What it contains |
|---|---|
| **Overview** | Consumer value statement, key facts, SLA panel, operational metadata |
| **Offerings** | List of service offerings with title, description, requestability, approval, lead time, support tier, pricing |
| **Request & Eligibility** | Request channel, approval flow, fulfillment lead time, audience/eligibility rules |
| **Support** | Support model — owner, resolver group, hours, channel, escalation path, maintenance window |
| **Dependencies** | Service relations and dependency graph |
| **Governance** | C3 mappings, completeness score, readiness checks, ownership history, raw extended data |
| **Audit** | Change history and audit log |

### Consumer Value

The **Overview** tab prominently shows the `consumer_value` field — a plain-language explanation of the benefit the service delivers to the end user.

### Operational Links

The **Overview** and **Governance** tabs surface operational links:

- knowledge articles
- incident dashboard
- change calendar
- support documentation
- service review records

These are structured links pointing to external systems. No live integration is required — they work as curated reference links.

### Návod: Provázání služby s navazujícími entitami (objekt, klient, workflow, závislosti)

Tento postup je určený pro editory služeb, kteří chtějí navázat službu na provozní objekt, klientský kontext, workflow a technické/provozní závislosti.

#### 1) Povinné předpoklady před provázáním

Než začnete vytvářet vazby, ověřte:

- služba existuje v katalogu a není smazaná (`service_catalog.is_deleted = FALSE`),
- máte roli alespoň `editor` (vytváření/úpravy relací je editorská operace),
- cílová služba pro dependency relaci existuje (pro `from_service_id` i `to_service_id`),
- relace není self-loop (služba nesmí odkazovat sama na sebe),
- pro requestable scénáře má služba vyplněný request channel (`request_channel_type` nebo `request_channel_url`),
- pokud vazbu vážete k offeringu, offering musí patřit ke stejné službě (platí pro support model, audience policy i operational link).

#### 2) Povolené kombinace vazeb

> Praktické pravidlo: nejprve nastavte „kdo službu používá“ (klient), pak „jak se obsluhuje“ (workflow), nakonec „na čem stojí“ (závislosti).

| Typ vazby | Kam se zapisuje | Povolené kombinace |
|---|---|---|
| **Objekt** (např. CI, aplikace, dokumentace) | `service_operational_link` (`link_type`, `title`, `url`) | Může být na úrovni celé služby (`offering_id = NULL`) nebo konkrétního offeringu (`offering_id = <id stejné služby>`). |
| **Klient** (cílová skupina/eligibility) | `service_audience_policy` | Více záznamů je povoleno; lze kombinovat service-level i offering-level pravidla. Offering-level záznam musí odkazovat na offering stejné služby. |
| **Workflow** (request/provision/support tok) | primárně `request_channel_type` / `request_channel_url`, doplňkově `service_operational_link` | Povolené je mít zároveň request channel + více workflow odkazů (runbook, BPMN, approval flow). |
| **Závislosti** mezi službami | `service_relation` | Povolené typy relací: `depends_on`, `prerequisite`, `underlying`, `requires_account`, `uses`, `provides`, `provided_by`, `replaces`, `replaced_by`, `integrates_with`, `related_to`, `part_of`, `child_of`. |

Důležitý limit pro závislosti:

- aktivní relace je unikátní v kombinaci `(from_service_id, to_service_id, relation_type_code, pace_code_normalized)`,
- relaci lze znovu založit po „odpojení“ (soft delete), ale ne duplicitně paralelně.

#### 3) Co se stane při změně nebo odpojení vazby

- **Dependency relace (`service_relation`)**
  - odpojení přes DELETE je soft delete (`is_deleted = TRUE`),
  - relace se přestane zobrazovat v API/UI dotazech, které filtrují `is_deleted = FALSE`,
  - auditní stopa zůstává zachovaná.
- **Vazby navázané na offering (`support_model`, `audience_policy`, `operational_link`)**
  - při smazání offeringu se jeho navázané záznamy smažou automaticky (FK `ON DELETE CASCADE`),
  - při změně offeringu mimo „mateřskou“ službu DB update odmítne (kompozitní FK na `(offering_id, service_id)`).
- **Změna lifecycle na `live`**
  - systém může blokovat přechod bez provozní připravenosti (typicky chybějící offering/support model u requestable služby),
  - pokud máte zapnuté readiness policy na relace/dependencies, chybějící vazby se projeví jako blocker/warning.

#### 4) Řešení konfliktů nebo duplicitních vazeb

Když narazíte na konflikt:

1. **Duplicitní dependency relace**
   Zkontrolujte, zda už neexistuje stejná aktivní kombinace `from + to + relation_type + pace`. Pokud ano, místo nové relace upravte `relation_note`, `impact_level`, `is_mandatory` nebo `is_verified`.
2. **Neplatná vazba na offering**
   Ověřte, že `offering_id` patří skutečně k dané službě. Pokud ne, založte vazbu znovu pod správnou službou/offeringem.
3. **Konflikt importu vs. ruční editace**
   U importu platí upsert logika nad relacemi; při nesouladu preferujte jednotný zdroj pravdy (buď import kontrakt, nebo ruční governance) a druhý tok dočasně zmrazte.
4. **Kolize typů relací**
   Pokud máte zároveň `depends_on` i `underlying` pro stejné dva uzly, ponechte pouze semanticky přesnější typ a druhou relaci odpojte, aby graf nebyl „přesycený“.

#### 5) Reálné scénáře: správně vs. špatně

##### Scénář A — Service Desk + IAM

**Správně**
- `IT-SVC-001 (Service Desk)` má relaci `depends_on` na `IT-SVC-014 (IAM)`.
- Má operational link `link_type=workflow`, `title=Account approval flow`, URL na schvalovací proces.
- Pro VIP offering má samostatné audience policy (klient = management).

**Špatně**
- Stejná dependency relace je založena 2× se stejným `pace_code` (duplicitní edge).
- Workflow link je uložen jako plain text bez URL (nelze použít jako provozní odkaz).
- Audience policy pro VIP offering odkazuje na offering jiného service_id.

##### Scénář B — Collaboration Platform

**Správně**
- `DIG-COLLAB` má `underlying` vazbu na `INF-STORAGE`.
- `requestable=true` a vyplněný request channel URL na katalog požadavků.
- V governance jsou dva operational links: „KB objekt“ a „Change workflow“.

**Špatně**
- Služba je nastavena jako `requestable=true`, ale bez request channel (validace blokuje konzistentní publikaci).
- Vazba na `INF-STORAGE` je omylem `related_to` místo `underlying`, což zkreslí dependency pohled.
- Při refaktoru je offering smazán bez kontroly dopadu; tím se automaticky odstraní i jeho support/audience/link vazby.

---

## Service Lifecycle

Services progress through a defined lifecycle:

| State | Meaning |
|---|---|
| `draft` | Being prepared, not yet published |
| `under_review` | Under editorial or governance review |
| `approved` | Approved but not yet live |
| `live` | Active and available to consumers |
| `deprecated` | Still functional but scheduled for retirement |
| `retired` | No longer available |

Transition rules are enforced — a service cannot go `live` without meeting minimum data completeness requirements. The lifecycle state is always visible in the list (dot indicator), in the detail header, and in search.

---

## Service Offerings

A service can have one or more **service offerings** representing distinct requestable variants.

Each offering shows:

- title and description
- requestable flag
- approval required indicator
- expected lead time
- target audience
- support tier
- pricing reference or billing model
- default offering flag

The primary (default) offering is surfaced in the service header for quick consumer access.

---

## Service Onboarding Wizard

Route:

```text
/management/new-service
```

The **New Service Wizard** guides content editors through creating a well-formed service catalogue entry in structured steps:

| Step | Content |
|---|---|
| 1 — Identity | Service ID, title, type, status, lifecycle |
| 2 — Description | Short description, business summary, consumer value |
| 3 — Access | Requestable toggle, request channel, approval, lead time, audience |
| 4 — Classification | Portfolio, domains, service lines |
| 5 — Ownership | Service owner (email), review owner, next review date |
| 6 — SLA | Availability, RTO, RPO, support hours, support tier, support channel |
| 7 — C3 Mapping | C3 taxonomy items (shown only when C3 module is enabled) |
| Review | Full summary before submission |

Every field has an **inline ITIL hint** explaining its purpose and a **`?` tooltip** with a longer explanation. Fields show blue italic placeholder text as guidance for example values.

After the wizard completes, the editor is redirected to the full service editor to add offerings, support model details, and operational links.

---

## C3 Taxonomy

### All C3 List

Route:

```text
/c3/list
```

Filters available:

- full-text search
- C3 taxonomy type
- state
- parent capability
- quick views

### C3 Dashboard

Route:

```text
/c3/dashboard
```

Dashboard blocks:

- Status Breakdown
- Needs Mapping
- Most Mapped Items
- Coverage by Application
- Sync Status
- Capability Map Health
- Import & Sync Drift
- Link Health
- Review / Validation

### C3 Capability Detail

Route:

```text
/c3/{uuid}
```

Section order:

1. classification & hierarchy
2. identity
3. description
4. source & data quality
5. relationships & capability completeness
6. structured data

The relationships section includes Service Catalogue mappings.

### C3 Entity Views

Available for:

- `C3 Technology Interactions` — `/c3/technology-interactions`
- `C3 Services` — `/c3/services`
- `C3 Data Objects` — `/c3/data-objects`
- `C3 Applications` — `/c3/applications`

### C3 Capability Map

Routes:

```text
/c3/capability-map-spiral6
/c3/capability-map-spiral7
```

- `Spiral 6` — historical snapshot
- `Spiral 7` — current baseline capability map

From the map you can open the capability detail, linked catalogue records, and child lists.

---

## Imports

Route:

```text
/import/upload
```

Supported import targets:

- Service Catalogue CSV/JSON
- C3 Taxonomy CSV/JSON/XLSX
- C3 Applications, Data Objects, Services, and Technology Interactions
- C3 Capability Map CSV/JSON
- FMN spiral taxonomy XLSX reports

The import UI supports dry-run, commit, import history, and issue logs with warning and error detail.

---

## Search

Global search is available in the top-right area. Results are grouped by:

- services
- C3 capabilities
- C3 entities
- capability builder

Each result links to the appropriate detail page.

---

## Common User Scenarios

### Find a Service and Check Its Request Path

1. Open `/services/list`
2. Enable the `Requestable only` filter or search by name
3. Open the service detail
4. Open the **Request & Eligibility** tab
5. Follow the request channel link or contact the listed support owner

### Understand What a Service Delivers

1. Open the service detail
2. Read the **consumer_value** statement on the Overview tab
3. Review the **Offerings** tab for available variants and lead times

### Check Service Lifecycle Status

1. In `/services/list` the lifecycle dot is visible per row
2. Filter by lifecycle state using the Lifecycle filter group
3. On the service detail the lifecycle badge is in the header — deprecated/retired show a warning banner

### Add a New Service via the Wizard

1. Open `/management`
2. Click `New Service`
3. Complete all wizard steps — use the inline `?` hints for ITIL guidance
4. Submit — you are redirected to the full editor for offerings and support model

### Find a Capability and Its Mappings

1. Open `/c3/list`
2. Filter by capability type or parent
3. Open the capability detail
4. Check `Relationships & capability completeness` for catalogue mappings

---

## If Something Does Not Work

- if the administration menu does not appear after login, reload the page and verify the user role
- if a service detail shows `deprecated` or `retired` banner unexpectedly, check the lifecycle field in the editor
- if the `Requestable only` filter returns no results, no services have `requestable = true` set yet
- if a detail page or editor returns `404`, verify the service_id exists
- if a graph shows too little data, check `C3 Taxonomy`, `Flavours`, and `Depth` toggles
- if an import ends with warnings, review the reference data and the import issue log
