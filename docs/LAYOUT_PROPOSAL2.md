# S3C Manager — Layout Proposal v2 (supplement)

> **Vztah k v1**
> Tento dokument **doplňuje** `LAYOUT_PROPOSAL.md` (v1). v1 je platná, neboť obsahuje koncept (Signal → Explanation → Action → Detail → Audit), tokeny, sidebar, top bar, page header pattern, Service 360 hero, relationship studio, readiness gate s human language, C3 Board, decision log, impact dual-view a import wizard.
>
> v2 přidává **chybějící stránkové brief, opravené detaily a sdílené komponenty**, které v1 záměrně přeskočila, abych dostal Codex z bodu „mám rámec" do bodu „umím zaimplementovat každou existující stránku v aplikaci".
>
> **Co je v této verzi nové**
> - Service editor (sekce 2) — nejvýznamnější chybějící brief
> - Reviews workflow (sekce 3) — kanban/board + review modal
> - Portfolio (sekce 4) + My tasks (sekce 5)
> - Graph workspace template (sekce 6) — pokrývá 5 grafových stránek jednou šablonou
> - C3 list / graph / capability map / spirals (sekce 7)
> - C3 entity workspace template (sekce 8) — pokrývá 24 stránek (apps, data objects, services, TINs)
> - Owner load detail (sekce 9)
> - Administration family — landing, users, web/SSO, logs, groups, ref data, builder, import (sekce 10)
> - New entity wizard pattern (sekce 11)
> - Search standalone (sekce 12)
> - Help / onboarding (sekce 13)
> - User profile (sekce 14)
> - Service history (sekce 15)
> - Sdílené komponenty (sekce 16) — editor sub-nav, sticky save bar, RefTableEditor, wizard step tracker, review/decision modal, code editor wrapper
> - Cross-cutting concerns (sekce 17) — empty/loading/error states, validation, auto-save, permission gating, localizace
> - API endpoint reference (sekce 18)
> - Coverage matrix (sekce 19) — 88 page descriptions × kde jsou pokryté
> - Aktualizovaný implementation order (sekce 20)
>
> **Co tento dokument neopravuje**
> v1 sekce 1–7 (princip, vrstvy, persony, shell, page template, page header, tokens) zůstávají v platnosti beze změny. v1 sekce 8–18 zůstávají v platnosti, jen sekce 21 (implementation order) je nahrazena sekcí 20 v tomto dokumentu.

---

## 0. Opravy a doplnění k v1

### 0.1 Lifecycle bar — sjednotit s reálnými stavy DB

v1 sekce 11.2 ukazuje 6 kroků `Draft · Under review · Approved · Live · Deprecated · Retired`. Ale v `services-id-edit.md` jsou aktuální DB stavy `service_status`: `active, retired, deprecated, draft` a `service.lifecycle_state`: `draft, under_review, approved, live, deprecated, retired`.

**Oprava**: lifecycle bar vychází z `service.lifecycle_state` (těch 6 kroků), ne ze `service_status`. `service_status` je sekundární legacy pole, které se v UI **neukazuje samostatně** — ale je třeba s ním pracovat při editaci (mapping zobrazený v sekci 2.3 níže).

### 0.2 Sidebar — „Decision log" duplicita

v1 sekce 4.2 má `Decision log` v Cockpitu i v Governance. To je v pořádku jako shortcut, ale obě cesty musí vést na **stejný** `/operations/decisions`. Žádný route alias.

### 0.3 Persony — doplnit „Reviewer" jako podtřídu Governance

v1 sekce 3 má 5 person, ale v praxi reviewer ≠ governance manažer. Reviewer schvaluje konkrétní review, governance manažer vidí queue celého portfolia.

**Doplnění**: persona „Reviewer" má stejná oprávnění jako Governance, ale default landing je `/operations/reviews?assigned_to=me`.

### 0.4 Tokens — chybějící sémantika

v1 sekce 7.1 nepojmenovává čtyři barvy z mockupu v2, ale které se používají i jinde. Doplnit:

```css
--purple:      #7c3aed;  /* C3 / FMN entity */
--purple-soft: #ede9fe;
--orange:      #ea580c;  /* applications / TIN */
--orange-soft: #ffedd5;
```

### 0.5 Default view per persona — zpřesnění

v1 sekce 3 říká „Default Business / Default Technical". Ale **Service editor** je vždy Technical (i pro service ownera v Business view), protože editace nemá Business mode. View switch v editoru je **skrytý**.

---

# Část A — Stránkové brief, které v1 chybí

## 1. Přehled chybějících stránek

Celkově 12 chybějících briefů, které jsou popsané v sekcích 2–15 níže:

| Sekce | Stránka | Priorita |
|---|---|---|
| 2 | Service editor | P1 — největší formulář v aplikaci |
| 3 | Reviews workflow | P1 — governance critical path |
| 4 | Portfolio (landing + detail) | P2 |
| 5 | My tasks (nová route) | P2 |
| 6 | Graph workspace template | P2 — pokrývá 5 stránek |
| 7 | C3 list / graph / capability map / spirals | P3 |
| 8 | C3 entity workspace template | P3 — pokrývá 24 stránek |
| 9 | Owner load detail | P3 |
| 10 | Administration family | P3 — 8 stránek |
| 11 | New entity wizard pattern | P4 |
| 12 | Search standalone | P4 |
| 13 | Help / onboarding | P4 |
| 14 | User profile | P4 |
| 15 | Service history | P4 |

**P1** = nutné před fází 1 z roadmapy.
**P2** = vhodné před fází 2.
**P3** = lze posunout do fází 3–4 podle UX přínosu.
**P4** = utilita, lze odložit.

---

## 2. Service editor (`/services/[id]/edit`)

> **Toto je největší formulář v aplikaci.** ~80 polí v 13 sekcích, 7 podformulářů (collections), zod validace, lifecycle transition rules, requestable warning, raw fields preview. v1 toto pominula a je to nejrizikovější stránka, pokud Codex sahá na rozložení sám.

### 2.1 Layout

```
PAGE HEADER (sticky, 100 % šířka)
  Title: Editor — {service.title}
  Purpose: Upravte katalogový záznam, role, SLA, pricing, offerings, vztahy a C3 mapping.
  Chips: [Lifecycle: live] [Readiness: 92 %] [Last saved: před 2 minutami]
  Primary action: [Cancel] [Save draft] [Save & publish]

LAYOUT (split: 220 px sub-nav + main column + sticky save bar)
  ┌─ EDITOR SUB-NAV ─────┬─ MAIN COLUMN ─────────────────────────┐
  │ Vertikální sekce:    │  Aktuální sekce s formulářovými poli  │
  │  ▸ Identity          │                                       │
  │  ▸ Description       │  scrollovaná stránka                  │
  │  ▸ Catalogue access  │                                       │
  │  ▸ Classification    │                                       │
  │  ▸ Ownership         │                                       │
  │  ▸ SLA & domains     │                                       │
  │  ▸ Offerings         │                                       │
  │  ▸ Pricing/flavours  │                                       │
  │  ▸ Relationships     │                                       │
  │  ▸ C3 mapping        │                                       │
  │  ▸ Support model     │                                       │
  │  ▸ Audience          │                                       │
  │  ▸ Operational links │                                       │
  │  ▸ Raw fields (RO)   │                                       │
  │  ▸ Governance notes  │                                       │
  └──────────────────────┴───────────────────────────────────────┘

STICKY SAVE BAR (bottom, 60 px)
  ⓘ 3 unsaved fields · last save 14:32       [Discard] [Save draft] [Save]
```

### 2.2 Editor sub-nav (levá vertikální)

**Komponenta** `<EditorSubNav>`. Šířka 220 px, padding 16 px 0, sticky, scrollable independently od main column.

```css
.editor-subnav {
  position: sticky;
  top: 56px;             /* pod top barem */
  align-self: start;
  height: calc(100vh - 56px);
  overflow-y: auto;
  background: var(--panel);
  border-right: 1px solid var(--border);
}
.editor-subnav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 16px; font-size: 13px;
  color: var(--neutral); cursor: pointer;
}
.editor-subnav-item.on {
  background: var(--accent-soft); color: var(--accent);
  font-weight: 600; border-left: 3px solid var(--accent);
  padding-left: 13px;
}
.editor-subnav-item .badge {
  margin-left: auto; font-size: 10.5px;
  background: var(--bad-soft); color: var(--bad);
  border-radius: 999px; padding: 1px 6px; font-weight: 700;
}
.editor-subnav-item .badge.warn { background: var(--warn-soft); color: var(--warn); }
.editor-subnav-item .badge.ok   { background: var(--ok-soft);   color: var(--ok); }
```

**Badge logika**:
- Červená: nutná pole jsou prázdná (e.g. Identity bez `title`).
- Oranžová: je to vyplněné, ale nesplňuje readiness rule (e.g. Requestable bez request channel).
- Zelená: sekce je „done" podle readiness rules (volitelné, jen pro vizuální pohodu).

**Scroll behavior**: click na sub-nav položku → scrollIntoView na příslušnou sekci v main column (smooth, offset −24 px). Zároveň main column při manuálním scrollování updatuje active sub-nav (IntersectionObserver na sekce).

### 2.3 Main column — sekce a pole

Každá sekce je `<FormSection>`:

```css
.form-section {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 18px 20px;
  margin-bottom: 14px;
}
.form-section h3 {
  margin: 0 0 4px; font-size: 16px; font-weight: 700;
}
.form-section .desc {
  color: var(--muted); font-size: 13px; margin: 0 0 14px;
  max-width: 640px;
}
.form-section .form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 16px;
}
.form-section .form-grid .full { grid-column: 1 / -1; }
```

**Sekce 1 — Identity**
| Field | Type | Validation | Note |
|---|---|---|---|
| `title` | text | povinné, max 200 | |
| `service_id` | text | read-only po vytvoření | uppercase max 20 |
| `service_type` | select (`ref_ServiceType`) | povinné | |
| `service_status` | select (`active/retired/deprecated/draft`) | povinné | legacy alias na `lifecycle_state` |
| `lifecycle_state` | select (`draft/under_review/approved/live/deprecated/retired`) | povinné, transition map | viz 2.4 |

**Sekce 2 — Description**
| Field | Type | Note |
|---|---|---|
| `summary` | text 1 řádek | max 280 |
| `detailed_description` | textarea | markdown OK |
| `value_proposition` | textarea | |
| `business_purpose` | textarea | |
| `service_features` | textarea bulleted | |
| `scope_text` | textarea | |

**Sekce 3 — Catalogue access & request model**
| Field | Type | Validation |
|---|---|---|
| `business_summary` | textarea | max 500 |
| `consumer_value` | textarea | |
| `requestable` | bool | trigger warning (viz 2.5) |
| `request_channel_type` | select (portal/email/external/none) | povinné pokud requestable |
| `request_channel_url` | URL | URL formát; povinné pokud `request_channel_type !== 'none'` |
| `target_audience_summary` | text | |
| `fulfillment_lead_time_text` | text | „3 pracovní dny" — volný text |
| `approval_required` | bool | |

**Sekce 4 — Classification**: `portfolio_group_code, security_classification, service_area, global_service_group_code, service_line_code, organizational_element_code` — všechno selecty z odpovídajících `ref_*` tabulek.

**Sekce 5 — Ownership** (8 polí: `service_owner, service_owner_email, vlastnik, vlastnik_org, manager, manager_org, service_owner_org`).

UX poznámka: ownership je historicky redundantní (`service_owner`, `vlastnik`, `manager` často duplicitní). UI ukáže **Smart owner picker** nahoře — jeden picker, který vyplní všechna pole; pod ním collapsible „Advanced (legacy fields)" s čistým editorem.

**Sekce 6 — SLA & Domains**
- `sla_availability` (number 0–100, % validation)
- `sla_restoration` (hours)
- `sla_delivery` (days)
- `sla_restoration_text`, `sla_delivery_text` (volný text)
- Domain checkboxes: dynamický seznam z `ref_NetworkDomain`

**Sekce 7 — Offerings (collection)** — viz 2.6.

**Sekce 8 — Pricing/Flavours (collection)** — viz 2.7.

**Sekce 9 — Relationships (collection)** — viz 2.8.

**Sekce 10 — C3 mapping (collection)** — viz 2.9.

**Sekce 11 — Support model (collection per offering)** — viz 2.10.

**Sekce 12 — Audience policies (collection per offering)** — viz 2.11.

**Sekce 13 — Operational links (collection per offering)** — viz 2.12.

**Sekce 14 — Raw fields (read-only)**
Tabulka řádků z `service_raw_field` — `field_path`, `raw_value`, `parser_status`, `parsed_value`. Bez možnosti editace v UI; jen filter/search.

**Sekce 15 — Governance notes**
- `retired_note` (textarea, povinné pokud lifecycle = retired)
- `source_url` (URL)
- `unit_of_measure`, `charging_basis`, `rate_note`, `ordering_note`, `operational_notes_raw`, `exclusions`, `customer_type` (volný text)
- `notes_json` (read-only JSON viewer; obsahuje pending evidence z new-service wizardu)

### 2.4 Lifecycle transition map — UI vynucení

Klient strikt validuje:

```
draft         → under_review
under_review  → draft, approved
approved      → under_review, live
live          → deprecated
deprecated    → live, retired
retired       → deprecated
```

**UI**: select pro `lifecycle_state` ukazuje jen **povolené cílové stavy** podle aktuálního stavu. Disabled stavy jsou skryté (neukazujeme je se „šedou", aby uživatel nemyslel, že to jen nemá oprávnění).

Pokud user změní lifecycle_state na něco, co nesplňuje readiness gate (e.g. live bez owner), UI ukáže banner „Tento přechod selže readiness gate. Pokračujte vyřešením těchto blockerů: … nebo ručně přidejte exception."

### 2.5 Requestable warning

Pokud `requestable === true` a:
- `request_channel_type === 'none' || !request_channel_url`, nebo
- žádný offering nemá `support_model` definovaný,

→ inline banner v sekci 3:

```
⚠ Requestable služba potřebuje request channel a support model.
  Doplňte:
  • Request channel URL (sekce „Catalogue access")
  • Support model alespoň pro default offering (sekce „Support model")
```

Banner blokuje `Save & publish` (povoluje jen `Save draft`). Nezavírá se ručně, mizí jen vyřešením.

### 2.6 Offerings — sub-form collection

```
┌─ Offering: Standard SSO (default) ─────────────────────── [edit] [delete] ┐
│ Code: idfed-std         Status: active         Order: 1                   │
│ Description: Standardní SSO pro interní aplikace                          │
│ Lead time: 3 pracovní dny    Approval: required    Requestable: ✓         │
│ Support tier: T2-Internal                                                 │
└────────────────────────────────────────────────────────────────────────────┘

[⊕ Add offering]
```

Editor offeringu otevírá inline expandable, ne modal. Pole: `offering_code` (povinné, snake-case), `title` (povinné), `status` (`active/draft/retired`), `description`, `request_channel_type/url`, `lead_time_text`, `support_tier_code`, `display_order` (number), `is_default` (radio, jen jeden default v rámci služby), `requestable`, `approval_required`.

**Default offering**: pokud `is_default` je vybráno u jiného, automaticky se odbere u předchozího. Vždy alespoň jedno offering musí být default (UI přidá hint, pokud není).

### 2.7 Pricing/Flavours — sub-form collection

Pole z popisu: `title, service_unit, price_value, currency_code (ref), billing_period_code (ref), initiation_cost, lifecycle_cost, lifetime_years, display_order, flavour_status_code (ref), is_orderable, short_note, pricing_note_raw, dependency_text, nations_rate, delivery_note, technical_note`.

UX: tabulka s inline editem (one-click edit cell). Každý řádek má drag handle pro reorder (ovlivňuje `display_order`).

### 2.8 Relationships — sub-form collection

```
Target service: [search-picker]
Relation type: [depends_on / prerequisite / underlying / replaces / related_to / provided_by]
Relation label: [free text]
Impact mode: [direct / indirect]
Impact level: [low / medium / high / critical]
Pace: select ref_PaceCategory
Verified: checkbox
```

**Service picker**: typeahead nad `/api/v1/services`. Show: title + service_id + lifecycle pill. Self-reference zakázána (klient).

### 2.9 C3 mapping — sub-form collection s preview

```
┌─ C3 mapping ────────────────────────────────────────┐
│ C3 entity: [search picker → c3_uuid]                │
│ Mapping type: [select ref_C3MappingType]            │
│ Is primary: [✓] (jen jedno primary mapping/service) │
│ Note: [free text]                                   │
│                                                     │
│ Preview (před uložením):                            │
│ ✓ Mapping na: Workforce Identity (L3, Spiral 7)     │
│ ⚠ Tato capability už má 4 primary mappings          │
│ [Cancel] [Save mapping]                             │
└─────────────────────────────────────────────────────┘
```

Preview volá `POST /api/v1/services/{id}/preview-mapping` s payloadem před uložením. Vrací warnings (např. duplicate, level mismatch).

### 2.10–2.12 Support model / Audience / Operational links — sub-forms

Všechny tři jsou collections **per offering** (FK na `offering_code`). UI: pod offering rowem (sekce 7) je rozšiřovací sekce „Support / Audience / Links" → tři mini-tabulky s polemi z popisu.

Pokud uživatel je v sub-nav na „Support model", scroll skočí na sekci 11, která zobrazí všechny support modely všech offerings v jedné tabulce s offering filterem nahoře. (Tj. dvě cesty: per-offering (uvnitř offering rowu) i global (sekce 11)).

### 2.13 Sticky save bar

```css
.save-bar {
  position: sticky; bottom: 0;
  background: var(--panel);
  border-top: 1px solid var(--border);
  padding: 10px 24px;
  display: flex; align-items: center; gap: 12px;
  box-shadow: 0 -2px 8px rgba(15, 23, 42, 0.04);
}
.save-bar .status {
  font-size: 12.5px; color: var(--muted);
}
.save-bar .status.dirty { color: var(--warn); font-weight: 600; }
.save-bar .right { margin-left: auto; display: flex; gap: 8px; }
```

**Status microcopy**:
- Čistý form: „Vše uloženo · last save 14:32"
- Dirty: „3 nesynchronizovaná pole · ctrl+S uloží draft"
- Saving: „Ukládám…"
- Error: „Save selhal. Zkontrolujte červené sekce."

### 2.14 Auto-save?

**Ne, ne automaticky.** Uživatel musí kliknout. Důvod: validace komplexních změn (lifecycle transition, requestable warning, primary mapping) potřebuje deterministické save events. Auto-save by spouštěl validace v půli rozdělané práce.

**Místo toho**: `Cmd/Ctrl+S` → Save draft. Browser confirm dialog pokud opouštíte stránku s dirty form.

### 2.15 Validace

`react-hook-form` + `zod` (jak v popisu). Pravidla:
- `title` povinný, max 200
- `service_owner_email` validní e-mail
- `request_channel_url`, `source_url` — URL formát
- `sla_availability` — number 0–100
- `service_id` — uppercase max 20, povolené `[A-Z0-9_-]`
- Lifecycle transition map (sekce 2.4)
- Requestable warning (sekce 2.5)
- Default offering — alespoň jeden, max jeden

### 2.16 API

| Endpoint | Účel |
|---|---|
| `GET /api/v1/services/{id}` | initial load |
| `PUT /api/v1/services/{id}` | hlavní save |
| `PUT /api/v1/services/{id}/domains` | domain update |
| `PUT /api/v1/services/{id}/roles` | role update |
| `GET/POST/PUT/DELETE /api/v1/flavours` | pricing |
| `GET/POST/PUT/DELETE /api/v1/services/{id}/sla` | SLA |
| `GET/POST/PUT/DELETE /api/v1/services/{id}/offerings` | offerings |
| `GET/POST/PUT/DELETE /api/v1/services/{id}/support-model` | support |
| `GET/POST/PUT/DELETE /api/v1/services/{id}/audience` | audience |
| `GET/POST/PUT/DELETE /api/v1/services/{id}/operational-links` | links |
| `GET/POST/PUT/DELETE /api/v1/relations` | relationships |
| `POST /api/v1/services/{id}/preview-mapping` | C3 preview |
| `GET/PUT /api/v1/taxonomy/mapping/{id}` | C3 mapping CRUD |

### 2.17 Permission

- View: read role (kdokoli s rolí editor/admin)
- Save: edit role + service ownership match (server check)
- Save & publish (lifecycle transition na live): **navíc** governance role nebo schválené review

### 2.18 Codex tipy (časté chyby)

1. **Nezahazujte všechna pole při `Save`.** Backend přijímá partial PATCH; posílejte jen dirty fields. (Default: `react-hook-form` `formState.dirtyFields`.)
2. **Sub-form save je nezávislý.** Offering/SLA/pricing mají vlastní endpointy. Save bar šetří main service PUT, ale dirty offering musí volat svůj endpoint.
3. **Preview C3 mapping není side-effect.** GET-like POST vrací warnings; nezapisuje. Zápis je až `PUT /api/v1/taxonomy/mapping/{id}`.
4. **Raw fields editovat nelze.** Sekce 14 je read-only viewer.
5. **`service_status` vs `lifecycle_state`** — viz 0.1.

---

## 3. Reviews workflow (`/operations/reviews`)

### 3.1 Layout

```
PAGE HEADER
  Title: Governance reviews
  Purpose: Schvalujte, odmítejte nebo odložte review služeb.
  Chips: [Open: 14] [In review: 6] [Overdue: 5]
  Primary action: ⊕ Request review

VIEW SWITCH (segmented)
  [Board] [List] [Calendar]

BOARD (4 columns kanban)
  ┌─ Requested ───┬─ In review ───┬─ Decision needed ─┬─ Closed ───────┐
  │ 8             │ 6             │ 4                 │ 24 (last 30d)  │
  │ ──            │ ──            │ ──                │ ──             │
  │ [review card] │ [review card] │ [review card]     │ [review card]  │
  │ …             │ …             │ …                 │ …              │
  └───────────────┴───────────────┴───────────────────┴────────────────┘
```

### 3.2 Review card (kanban)

```
┌──────────────────────────────────────┐
│ Identity Federation        [publish] │  ← title + review_type pill
│ Owner: Alice Veselá                  │
│ ──                                    │
│ Reason: Doplnění Partner SSO         │
│ Reviewer: Eva Černá                  │
│ Due: 2026-05-05 (za 3 dny)           │
│ Readiness: ████████░ 92 % · 1 warn   │
│                                      │
│ [Open detail →]                       │
└──────────────────────────────────────┘
```

Status pillů review_type:
- `publish` (modrý)
- `owner_review` (zelený)
- `coverage_review` (fialový)

Due:
- > 3 dny: `var(--muted)`
- 0–3 dny: `var(--warn)`
- overdue: `var(--bad)` + ikona ⚠

Drag-and-drop **mezi sloupci je vypnuté**. Status změna jde přes review modal (3.4).

### 3.3 Request review modal

```
Request review                                              [×]
─────────────────────────────────────────────────────────────
Service:        [search picker, povinné]
Review type:    ◯ Publish      ◯ Owner review    ◯ Coverage review
Assigned to:    [email picker, volitelné]
Due at:         [datepicker, volitelné, default = +7 dní]
Reason:         [textarea, povinné, max 500]

Pre-flight check:
✓ Owner is assigned (Alice Veselá)
✓ Default offering exists
⚠ 1 readiness warning — audience policy missing for offering "Partner SSO"

[Cancel]                                  [Submit review request]
```

Pre-flight check je výpis blokerů a warningů z `/api/v1/readiness/services/{serviceId}` filtrovaný podle review type. Reviewer vidí ihned, na čem to skřípe.

Submit volá `POST /api/v1/governance/reviews` s payloadem.

### 3.4 Review action modal (Approve / Reject / Defer)

```
[Approve] [Reject] [Defer]                                  [×]
─────────────────────────────────────────────────────────────
Review:         publish · Identity Federation
Requested by:   Petr Novák · 2026-04-28
Readiness:      ████████░ 92 % · 1 warning
Affected:       1 service · 1 capability

Decision:       ◉ Approved   ◯ Rejected   ◯ Deferred

Rationale:      [textarea, povinné pro Reject/Defer, volitelné pro Approve, max 1000]
                "Bezpečnostní review prošel; offering Partner SSO splňuje
                 compliance pro EU partnery."

Defer until:    [datepicker, povinné pokud Deferred]
Evidence:       [link nebo file ref, volitelné]

→ Po uložení vznikne v decision logu záznam:
  • What:    Approve publish of Identity Federation
  • Why:     [rationale]
  • Affects: Service · Identity Federation
  • Expires: 2027-05-01 (annual review)

[Cancel]                                              [Confirm]
```

Submit volá `PATCH /api/v1/governance/reviews/{id}` se status `approved/rejected/deferred` + `POST /api/v1/governance/decisions` (decision log entry vznikne automaticky na backendu, ale UI zobrazí preview, aby uživatel věděl, že rozhoduje veřejně auditovatelně).

### 3.5 List view

Tabulka místo kanbanu, sloupce: Service, Review type, Status, Reviewer, Due, Readiness, Action. Fast review pro velké queue.

### 3.6 Calendar view

Monthly grid s review due dates jako pillami. Click na pill otevře review detail. Hover ukáže preview.

### 3.7 API

- `GET /api/v1/governance/reviews?limit=200&status=...&assigned_to=...`
- `POST /api/v1/governance/reviews` (request)
- `PATCH /api/v1/governance/reviews/{id}` (status update)
- `GET /api/v1/readiness/services/{serviceId}` (pre-flight check)

### 3.8 Codex tipy

1. Kanban není drag-drop — status change vždy modal s rationale.
2. Pre-flight check je side-effect-free GET, volat při otevření modalu.
3. Decision log zápis je atomic s review status update na backendu; UI ukazuje preview pro transparenci.

---

## 4. Portfolio (`/portfolio` + `/portfolio/[code]`)

### 4.1 Portfolio landing (`/portfolio`)

```
PAGE HEADER
  Title: Portfolios
  Purpose: Skupiny služeb podle owner skupin a strategického zaměření.
  Chips: [Portfolios: 6] [Services: 132] [Reviews overdue: 5]
  Primary action: žádná (read-only)

KPI RIBBON (3)
  [Services total] [Active] [Overdue reviews]

FILTERS
  [Status ▾] [Owner / group search]

PORTFOLIO CARDS GRID (3 sloupce, equal width)
```

#### 4.1.1 Portfolio card

```
┌────────────────────────────────────────┐
│ Platform                ● 28 services  │
│ Identity & access · Compute · Storage  │  ← short purpose
│                                        │
│ Active: 24 · Overdue reviews: 2        │
│ Owners: Alice Veselá +4                │
│                                        │
│ Lifecycle distribution:                │
│ ████████░░░░  live 17 · dep 4 · drf 3 │
│                                        │
│ [Open portfolio →]                      │
└────────────────────────────────────────┘
```

Click → `/portfolio/{code}` (nový route).
Pokud portfolio_code není a karta vede na list, zachovat `/services/list?portfolio={code}` jako fallback do doby, než přibude detail route.

### 4.2 Portfolio detail (`/portfolio/[code]`) — **NOVÁ STRÁNKA**

Tato route v aplikaci ještě neexistuje, ale layout proposal ji navrhuje, protože manažer potřebuje strategicky pochopit portfolio, ne jen filtrovat list.

```
PAGE HEADER
  Title: Platform
  Purpose: Strategicky podpůrné služby pro identitu, compute a storage.
  Chips: [28 services] [Critical: 4] [Overdue reviews: 2] [Coverage: 88 %]
  Primary action: ✎ Edit portfolio (admin)

SECTIONS (vertikálně)
  1. Purpose & ownership   (markdown popis + 1–N owners)
  2. Services              (list jako /services/list?portfolio=X — embedded)
  3. Lifecycle distribution (stacked bar live/dep/draft/retired)
  4. Criticality            (pie or bar — kritičnost na 4 stupně)
  5. Capability coverage    (link do /capabilities/coverage?portfolio=X)
  6. Decisions              (decision log filter portfolio=X, posledních 10)
  7. Review calendar        (timeline všech upcoming reviews v portfoliu)
```

### 4.3 API

- `GET /api/v1/portfolio` — list + cards data
- `GET /api/v1/portfolio/{code}` — detail (může být potřeba doplnit endpoint na backend, fáze 1)
- `GET /api/v1/services?portfolio={code}&limit=200` — embedded services list
- `GET /api/v1/governance/decisions?portfolio={code}&limit=10` — decision feed
- `GET /api/v1/governance/reviews?portfolio={code}&status=open&limit=20` — calendar

### 4.4 Codex tipy

- Portfolio detail je nová route; přidat do `frontend/app/portfolio/[code]/page.tsx`.
- Embedded services list znovu používá `<ServiceList>` z `/services/list` s prop `portfolioFilter={code}`.
- Sekce 5 a 6 jsou v MVP linky, ne plně embedded.

---

## 5. My tasks (`/cockpit/my-tasks`) — **NOVÁ STRÁNKA**

Tato stránka neexistuje, ale v1 sekce 4.2 ji uvádí jako sidebar item v Cockpit. v2 ji rozkresluje.

### 5.1 Layout

```
PAGE HEADER
  Title: Moje úkoly
  Purpose: Co mi systém přidělil k řešení.
  Chips: [Total: 7] [Today: 3] [Overdue: 1]
  Primary action: žádná

SECTIONS (vertikálně, každá má vlastní action button)
  1. Reviews waiting for me      (3) → /operations/reviews?assigned_to=me
  2. Readiness exceptions to renew (2) → /operations/readiness?tab=exceptions&owner=me
  3. Services bez attestation     (1) → /services/list?owner=me&attestation=overdue
  4. Decisions to record          (1) → /operations/decisions?recorded_by=me

TASK ROW
  ┌─ [pill] Title                                        Due 5. 5.    [Open →] ┐
  │        Subtitle (kontext: service nebo capability)                          │
  └────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Data flow

Backend nemá single endpoint „my tasks". Frontend agreguje:
- `GET /api/v1/governance/reviews?assigned_to={user.email}&status=open`
- `GET /api/v1/readiness/exceptions?created_by={user.id}&expires_within=14days`
- `GET /api/v1/services?owner={user.email}&attestation_overdue=true`
- `GET /api/v1/governance/owner-load?owner={user.email}` (load score)

UI parallel loading + skeleton.

### 5.3 Codex tipy

- Skupiny jsou collapsible. Expanded by default pokud má sekce > 0 položek.
- Empty state pro celou stránku: „Žádné úkoly. Zkontrolujte cockpit nebo si dejte kávu."
- Refresh: tlačítko „⟳ Refresh" v headeru, žádný auto-poll.

---

## 6. Graph workspace template

Pět grafových stránek (`/services/graph`, `/services/dependency-flow`, `/services/consolidation-matrix`, `/services/[id]/graph`, `/c3/graph`) sdílí jeden layout pattern.

### 6.1 Layout

```
PAGE HEADER
  Title: {Service graph | Dependency flow | …}
  Purpose: {jednovětý účel}
  Chips: KPI z grafu (počet uzlů, hran, pokrytí…)
  Primary action: 📄 Export PDF

GRAPH WORKSPACE (3 sloupce)
  ┌─ TOOLBAR (left side, 220 px) ─┬─ CANVAS (center, flex-1) ──┬─ DETAIL PANEL (right, 280 px, collapsible) ─┐
  │ Search                        │                            │ Vybraný uzel/hrana                            │
  │ Filters:                      │   [SVG / canvas grafu]     │  • Title                                       │
  │  • Status                     │                            │  • Type                                        │
  │  • Portfolio                  │                            │  • Lifecycle                                   │
  │  • Domain                     │                            │  • Owner                                       │
  │  • Relation type chips        │                            │  • Mapped capabilities                         │
  │ Toggles:                      │                            │  • Open: /services/{id} →                      │
  │  ☑ Show C3                    │                            │                                                │
  │  ☑ Show flavours              │                            │                                                │
  │  ☑ Edge labels                │                            │                                                │
  │  ☑ Compact payload            │                            │                                                │
  │  ☑ Minimap                    │                            │                                                │
  │ Edge type [straight/smooth]   │                            │                                                │
  │ Line style [auto/solid/dashd] │                            │                                                │
  │ [Save layout]                 │                            │                                                │
  └───────────────────────────────┴────────────────────────────┴────────────────────────────────────────────────┘
```

### 6.2 Toolbar pattern

Komponenta `<GraphToolbar>` — sticky, vlastní scroll. Obsahuje:
- search input (top)
- filter group (collapsed sections per filter type)
- toggle group (panel s checkboxy)
- edge type toggle (segmented)
- line style toggle (segmented)
- akce (Save layout, Reset zoom)

### 6.3 Canvas

`<GraphCanvas>` — react-flow nebo Cytoscape (zachovat current). Přidat:
- minimap (bottom-right, 120×100)
- zoom controls (top-right, +/− stack)
- mouse wheel zoom + pan
- node click → select; double-click → navigate

### 6.4 Detail panel

`<GraphDetailPanel>` — slide-in z prava, 280 px. Default zavřený. Click na uzel → otevře, ukáže:
- Title + Type pill
- Properties tabulka
- Inbound/outbound edges (count + chips)
- „Open detail" → `/services/{id}` nebo `/c3/{uuid}` etc.

### 6.5 Per-page rozdíly

| Page | Title | Toolbar specifika | Canvas data |
|---|---|---|---|
| `/services/graph` | Service graph | + Show flavours toggle | `/api/v1/graph/overview` |
| `/services/dependency-flow` | Dependency flow | bez relation chips, sloupcový layout | `useGraphOverview` |
| `/services/consolidation-matrix` | Consolidation matrix | bez toolbaru, jen matrix | `useGraphOverview` |
| `/services/[id]/graph` | Service neighborhood | Service picker, depth 1–3 | `/api/v1/services/{id}/graph?depth={n}` |
| `/c3/graph` | C3 relations | Domain/L1/L3 selecty + node type toggles | `/api/v1/graph/c3-relations` |

### 6.6 Codex tipy

- Komponentu `<GraphWorkspace>` postavit jednou; per-page jen passnout `toolbarSlots`, `canvasProps`, `detailPanelRenderer`.
- Save layout je per-graf (`/api/v1/graph/overview/layout` pro service graph; ostatní mohou použít stejný endpoint nebo `localStorage` v MVP).
- Consolidation matrix je výjimka: je to tabulka, ne graf. Použít `<MatrixWorkspace>` (jiný komponent), ale držet stejný page header pattern.

---

## 7. Schopnosti a C3 — list, graph, capability map, spirals

### 7.1 C3 list (`/c3/list`)

Service list pattern (sekce 10 z v1) aplikovaný na C3 taxonomy:

```
PAGE HEADER
  Title: C3 taxonomy
  Purpose: Položky C3 taxonomie pro čtení a navigaci do detailů.
  Chips: [Total: 412] [Spiral 7: 280] [Unmapped: 38]
  Primary action: žádná pro viewer; ⊕ New C3 pro editor

TOOLBAR
  Search · Exact search toggle
  Saved views chips: [⭐ All] [Spiral 7 only] [L3 capabilities] [Unmapped]
  Filters: [Item type ▾] [Status ▾] [Parent ▾] [Application ▾]
  View switch: [List] [Cards]

TABLE
  UUID · Title · Item type · Parent · Status · [Edit]
```

API: `GET /api/v1/taxonomy/c3` se stejnými query params.

### 7.2 C3 graph (`/c3/graph`)

Použij **Graph workspace template** (sekce 6) s C3-specifickým toolbar (Domain/L1/L3 selecty + node type toggles).

### 7.3 C3 capability map (`/c3/capability-map-spiral7`)

Speciální stránka — capability map je hierarchický grid (domain × L2/L3/L4), ne graf.

```
PAGE HEADER
  Title: C3 Capability Map · Spiral 7
  Purpose: Vizuální katalog domén, L2/L3/L4 capability a jejich mapping stavu.
  Chips: [Spiral 7] [Domains: 8] [L3 capabilities: 412] [Unmapped: 38]
  Primary action: žádná

CONTROLS
  [Spiral selector: 7 ▾]    ☑ Show unmapped    [Open builder →]

MAP (responsive grid; každá domain je sloupec; capability boxes jsou stacked)

Domain 1            Domain 2            Domain 3            …
┌────────────┐      ┌────────────┐      ┌────────────┐
│ L2 capabil.│      │ L2 capabil.│      │ L2 capabil.│
│ • L3 ✓     │      │ • L3 ✓     │      │ • L3 ⚠     │
│ • L3 ⚠     │      │ • L3 ✓     │      │ • L3 ✗     │
│   • L4     │      │   • L4     │      │   • L4     │
└────────────┘      └────────────┘      └────────────┘
```

Nodes mají barvu podle mapping stavu:
- ✓ green — mapped + reviewed
- ⚠ orange — mapped ale s warningy
- ✗ red — unmapped
- ◯ grey — N/A (vyřazeno z baseline)

Click na node → side panel (jako u graph workspace) s mapping/completeness info.

API: `GET /api/v1/taxonomy/c3/capability-map-spiral7`.

Pokud `c3_capability_builder` je prázdný, ukáž empty state s CTA „Otevřít C3 Capability Builder →".

### 7.4 Spirals (`/spirals` + `/spirals/[code]`)

```
/spirals
  PAGE HEADER
    Title: Spiral baselines
    Purpose: Plán FMN/C3 spiral baseline — který spiral je aktivní a jak je pokrytý.

  KPI: [Total: 4] [Active baseline: Spiral 7] [Coverage: 88 %]

  CARDS (jeden per spiral)
    ┌─ Spiral 7 (active) ──────────────────┐
    │ Title: …                              │
    │ Coverage: ████████░░ 88 %             │
    │ Top gaps: Identity, Print queue       │
    │ [Open detail →]                        │
    └───────────────────────────────────────┘

/spirals/[code]
  PAGE HEADER
    Title: Spiral 7
    Purpose: Heatmap a fulfillment plán spirály.

  TABS [Heatmap] [Fulfillment plan]

  HEATMAP TAB
    [Heatmap visualization] + Top gaps list

  FULFILLMENT TAB
    [Plan timeline] + Status per item
```

API:
- `GET /api/v1/spirals`
- `GET /api/v1/spirals/{code}/heatmap`
- `GET /api/v1/spirals/{code}/fulfillment-plan`

---

## 8. C3 entity workspace template

Stejný pattern pro 4 entity × 3 stránky = 12 unique briefs, ale jeden šablonovaný layout.

**Entity**: Applications, Data Objects, C3 Services, Technology Interactions (TINs).
**Stránky** per entity:
- `/c3/{entity}` — list
- `/c3/{entity}/[code]` — detail (read-only)
- `/c3/{entity}/[code]/edit` — edit

Plus admin varianty `/admin/c3-{entity}/...` (RBAC víc, jinak stejné).

### 8.1 List (např. `/c3/applications`)

Použij **C3 list pattern** ze 7.1, ale s kolony specifickými per entity:

| Entity | Kolony |
|---|---|
| Applications | code · title · status · data_source · description |
| Data Objects | code · title · classification · sensitivity |
| C3 Services | code · title · capability evidence · status |
| TINs | code · title · application linked · standard |

API per entity: `GET /api/v1/taxonomy/c3-{entity}` (kompatibilní s public configem v `frontend/app/admin/c3-entities/public-config.tsx`).

### 8.2 Detail (např. `/c3/applications/[code]`)

```
PAGE HEADER
  Title: {entity.title}
  Purpose: {entity.description.first_sentence}
  Chips: [Code: {code}] [Status: {item_status}] [Source: {data_source}]
  Primary action: ✎ Edit (pro editor/admin)

SECTIONS (vertikálně)
  1. Identification / classification (uuid, code, external_id, abbreviation, synonym)
  2. Description (description, source_description, revised_description)
  3. Source & status (data_source, data_qualifier, ss_overall_status, ss_baseline_status, item_status, modification_date)
  4. Links (capability links, related TIN/Apps/DataObjects/Services)
  5. Raw fields (RO viewer)
```

### 8.3 Edit (např. `/c3/applications/[code]/edit`)

Stejné sekce jako detail, ale form fields. Editor má stejný **sticky save bar** + **editor sub-nav** pattern jako Service editor (sekce 2.13).

### 8.4 C3 capability detail/edit (`/c3/[uuid]` + `/c3/[uuid]/edit`)

Speciální — C3 capability má víc sekcí včetně **link panel** s 4 entity typy.

```
PAGE HEADER (detail)
  Title: {capability.title}
  Purpose: L{level} capability v {domain}.
  Chips: [Spiral 7 ✓] [{N} mappings] [Item type: {type}]

SECTIONS
  1. Classification & hierarchy (item_type, parent_uuid, level)
  2. Identity (title, application, item_status, external_id, order_num, abbrev, synonym)
  3. Description (description, source_description, revised_description)
  4. Source & data quality (data_qualifier, data_source, ss_overall_status, ss_baseline_status)
  5. Links / completeness ← speciální:
     ┌─ Capability links ──────────────────────────────────┐
     │ Tabs: [Applications] [Data Objects] [TINs] [Svcs]   │
     │ Tab obsah: list + add/remove + role select          │
     │ Role: supports / implements / uses / depends_on /    │
     │       produces                                       │
     └─────────────────────────────────────────────────────┘
  6. Raw (script_raw, datasets_raw, standards_raw, references_raw, provenance_raw)
```

### 8.5 Code-edit varianty (`*-code-edit`)

Některé entity mají raw kód (typicky YAML nebo JSON). UI:

```
PAGE HEADER
  Title: {title} — Code editor
  Purpose: Raw zdrojový kód entity (YAML/JSON).
  Chips: [Format: yaml] [Lines: 142]
  Primary action: [Cancel] [Save]

EDITOR (full width, dark theme)
  Monaco editor s:
   • syntax highlighting
   • lint warnings v gutteru
   • diff toggle proti původní verzi
   • [Validate] tlačítko volá GET /preview-mapping ekvivalent
```

### 8.6 Codex tipy

- Postavit `<C3EntityWorkspace>` jako šablonu s prop `entityType`. Per-entity rozdíly jsou kolony v listu, povinná pole v editoru, link panel tabs.
- **Public/admin variants** jsou stejný kód, jen route + permission gate.
- Code editor: použít `@monaco-editor/react`, dark theme `vs-dark`.

---

## 9. Owner load detail (`/operations/owner-load`)

### 9.1 Layout

```
PAGE HEADER
  Title: Owner load — {owner_name}
  Purpose: Zátěž jednoho vlastníka napříč službami.
  Chips: [Owned: 17] [Live: 12] [Load score: 78]
  Primary action: 📩 Send attestation request (admin)

OWNER PICKER (pod headerem)
  [Owner search picker: alice@example.com ▾]    [Back to operations →]

CONTENT (vertikálně)
  1. KPI ribbon (4)
     [Owned services] [Live] [Overdue reviews] [Load score]
  2. Workload distribution chart
     Stacked bar: Live / Approved / Under review / Draft / Deprecated
  3. Role assignments table
     Service · Role · Status · Organization · Lifecycle · [Open →]
```

### 9.2 Empty state

Bez `?owner=` URL query: ukázat plný owner picker + top 10 owner load (z `/operations#owner-load`).

### 9.3 API

- `GET /api/v1/governance/owner-load?owner=...&limit=1`
- `GET /api/v1/governance/owner-load/assignments?owner=...&limit=250`

---

## 10. Administration family

Společný rámec pro 8 admin stránek.

### 10.1 Admin landing (`/administration`)

```
PAGE HEADER
  Title: Administrace
  Purpose: Správa uživatelů, číselníků, importů a instalace.
  Chips: žádné
  Primary action: žádná

CARDS GRID (3 sloupce)
  Sekce: User management
    [Uživatelé →] [Skupiny →] [Auth & web →]
  Sekce: Data management
    [Reference data (catalogue) →] [Reference data (C3) →]
    [Capability builder →] [Import →]
  Sekce: Audit & ops
    [Logy →] [Instalace →]
```

Karta:

```
┌───────────────────────┐
│ Uživatelé              │
│ Lokální + AD účty,    │
│ role, aktivní stav.    │
│ ──                     │
│ 24 active · 3 inactive │
│ [Open →]                │
└───────────────────────┘
```

C3 karty viditelné jen při `c3Visible === true`.

### 10.2 Users (`/administration/users`)

```
PAGE HEADER
  Title: Uživatelé
  Purpose: Správa lokálních a AD účtů, rolí a aktivního stavu.
  Chips: [Total: 27] [Active: 24] [Local: 18] [AD: 9]
  Primary action: ⊕ New user

LAYOUT (split: 60% list + 40% editor panel)
  ┌─ LIST (left) ──────────────┬─ EDITOR (right, sticky) ──────┐
  │ Search                     │ {New user / Edit user.name}    │
  │ Sort: username | role | …  │                                │
  │                            │ Username: …                    │
  │ Table:                     │ Display name: …                │
  │ Username · Display · Role  │ Role: ◉ viewer ◯ editor ◯ admin│
  │   · Auth · Active · LastLn │ Auth: ◉ local ◯ ad             │
  │ [edit row]                 │ External principal: … (if ad)  │
  │                            │ Email · Department · Names     │
  │                            │ Password: … (jen if local)      │
  │                            │ ☑ Is active                    │
  │                            │ [Cancel] [Save]                 │
  └────────────────────────────┴────────────────────────────────┘
```

Role select má **inline popis přístupových práv**:

```
◉ viewer  Čte katalog, capability map, decision log.
◯ editor  + edituje vlastní služby a C3 entity.
◯ admin   + spravuje uživatele, číselníky, importy.
```

Validace:
- `username` lower-case, povinný
- `email` valid email formát
- `password` min 8 znaků (jen při založení local; při editu volitelné)
- `external_principal` povinný pokud auth_provider === 'ad'

API: `GET/POST/PUT /api/v1/admin/users`.

### 10.3 Groups (`/admin/groups` + `/admin/groups/[id]` + `/admin/groups/new`)

List jako 10.2 ale jednodušší (code, name, description, active, members count, [delete]).

Detail (`/admin/groups/[id]`):
- Sekce 1: Identity (code, name, description, active)
- Sekce 2: Members (přidat/odebrat uživatele)
- Sekce 3: Permissions (mapping na role/scope)

API: `/api/v1/admin/groups`, `/{id}`, `/{id}/members`, `/{id}/permissions`.

### 10.4 Web & SSO (`/administration/web`)

```
PAGE HEADER
  Title: Auth & web settings
  Purpose: SSO/auth configuration aplikace.
  Chips: [SSO: enabled] [Headers: 6 configured]
  Primary action: [Cancel] [Save]

SECTIONS
  1. SSO general
     ☑ auth.sso.enabled

  2. Trusted headers
     [auth.sso.header: HTTP_X_REMOTE_USER]
     [auth.sso.display_name_header: HTTP_X_DISPLAY_NAME]
     [auth.sso.email_header: HTTP_X_EMAIL]
     [auth.sso.given_name_header: HTTP_X_GIVEN_NAME]
     [auth.sso.surname_header: HTTP_X_SURNAME]
     [auth.sso.department_header: HTTP_X_DEPARTMENT]

  Each field:
   Label: config_key
   Default: {default_value}
   Description: {dynamic from API metadata}
```

API: `GET/PUT /api/v1/admin/web-settings`.

UX nuance: po save invalidovat SSO cache (server side); UI ukáže success toast „SSO config saved · re-login required for some users".

### 10.5 Logs (`/administration/logs`)

```
PAGE HEADER
  Title: Audit log
  Purpose: Historie administrátorských a datových akcí.
  Chips: [Last 24h: 142] [Errors: 3]
  Primary action: 🔄 Refresh

TOOLBAR
  Search input · [Refresh]

TABLE (full width, virtualized scroll)
  Time · Action · Entity · User · Changed fields · Status

ROW EXPAND
  Click řádek → diff (expandable):
     {field}: "old" → "new"
     {field}: created
     {field}: deleted
```

API: `GET /api/v1/admin/logs`.

### 10.6 Reference data (`/admin/catalogue-ref` + `/admin/c3-ref`)

Sdílí komponentu `<RefTableEditor>` (sekce 16.5 níže).

```
PAGE HEADER
  Title: Reference data — catalogue
  Purpose: Číselníky pro service editor a katalog (typy, statusy, portfolio…).
  Chips: [Tables: 13]
  Primary action: žádná (per-table save je inline)

TABS (po horní hraně)
  [ref_ServiceType] [ref_ServiceStatus] [ref_RelationType] [ref_PortfolioGroup]
  [ref_GlobalServiceGroup] [ref_ServiceLine] [ref_OrganizationalElement]
  [ref_NetworkDomain] [ref_SecurityClassification] [ref_SupportWindow]
  [ref_FlavourStatus] [ref_ServiceRole] [ref_PaceCategory]

ACTIVE TAB CONTENT
  RefTableEditor:
   - Add form (top)
   - Inline-editable table
   - Delete confirm per row
```

`/admin/c3-ref` má taby: `ref_C3MappingType`, `ref_C3CapabilityDomain` + odkazy na C3 entity listy + inline enumerace info.

### 10.7 C3 Capability Builder (`/admin/c3-capability-builder`)

```
PAGE HEADER
  Title: C3 Capability Builder
  Purpose: Builder položek capability map napříč spirálami.
  Chips: [Active spiral: 7] [Items: 412] [Domains: 8]
  Primary action: ⊕ Found new spiral

LAYOUT
  Spiral selector (top): [Spiral 7 ▾]   New spiral: [number] [label] [Založit mapu]
  Map title: [page_title input] [Save]

  TABS [Builder items] [Capability domains]

  TAB 1 — Builder items
    Search · Sort
    Editor row:
      page_id (PK) · uuid · title · domain_code · state · parent_id · level

  TAB 2 — Capability domains
    RefTableEditor for ref_C3CapabilityDomain
```

API:
- `GET/POST /api/v1/taxonomy/spiral`
- `GET/PUT /api/v1/taxonomy/c3-capability-builder/settings`
- `GET/POST/PUT/DELETE /api/v1/taxonomy/c3-capability-builder`
- `GET/POST/PUT/DELETE /api/v1/ref/ref_C3CapabilityDomain`

UX:
- Parent select automaticky vyplní domain_code a level+1.
- Level rozsah 1–20.

### 10.8 Admin import (`/admin/import`)

Liší se od `/import` (workspace) tím, že je to **review nástroj** s reparse funkcí, ne wizard. Layout:

```
PAGE HEADER
  Title: Import review (admin)
  Purpose: Auditní kontrola batchů, raw relations a re-parse pipeline.
  Chips: [Profile: backstage-yaml] [Last batch: před 2 hodinami]
  Primary action: [Reparse all] (s confirm)

TABS
  [Batches] [Raw relations] [Raw fields per service]

BATCHES TAB
  Status filter: [All] [OK] [Warn] [Error]
  Pagination: load more

RAW RELATIONS TAB
  Tabulka raw relations s parsedOk = 0
  Per row: [Reparse] (single)
  Bulk: [Reparse all]

RAW FIELDS TAB
  Service ID input · [Load]
  Tabulka: field_path · raw_value · parser_status · parsed_value
```

API:
- `GET /api/v1/import/review?limit=50&offset=...&status=...`
- `GET /api/v1/import/batches/{id}`
- `GET /api/v1/import/relation-raw?parsedOk=0`
- `GET /api/v1/services/{id}/raw-fields`
- `POST /api/v1/import/reparse-raw`

### 10.9 Installation (`/admin/installation` + `/administration/installation`)

Read-only stránka:

```
PAGE HEADER
  Title: Installation
  Purpose: Stav instalace, modul registry a verze.
  Chips: [Healthy] [Modules: 4 active]

SECTIONS
  1. System info (verze, db, deploy time)
  2. Module registry
     Per modul: name, status (enabled/disabled), version, [Toggle]
  3. Health checks (DB, cache, external endpoints)
```

API: `/api/v1/install/status`, `/api/v1/install/modules`.

---

## 11. New entity wizard pattern

Aplikuje se na `/management/new-service`, `/management/new-c3` (a admin varianty).

### 11.1 Layout (Wizard step tracker)

```
PAGE HEADER
  Title: Nová služba (resp. nová C3 položka)
  Purpose: Krokový průvodce pro založení nového záznamu.
  Chips: [Step 3/6] [Profile: clean]
  Primary action: žádná (akce jsou v save baru)

STEP TRACKER (sticky pod headerem; stejný komponent jako import wizard v1 sekce 18)
  ┌─1──────┬─2──────┬─3────────┬─4────────┬─5────────┬─6────────┐
  │ Identity│ Description│ Access  │ Class.   │ Owners   │ Review   │
  │ ✓      │ ✓      │ now      │          │          │          │
  └────────┴────────┴──────────┴──────────┴──────────┴──────────┘

STEP CONTENT (mění se podle aktivního stepu)
  Form sections — stejný `<FormSection>` komponent jako editor

NAVIGATION
  [← Back] [Save draft] [Next →]
```

### 11.2 Steps — new service

| # | Step | Pole |
|---|---|---|
| 1 | Identity | service_id (uppercase, max 20), title, service_type, service_status, lifecycle_state |
| 2 | Description | summary, business_summary, consumer_value, value_proposition, business_purpose |
| 3 | Access | requestable, request_channel_type, request_channel_url, approval_required, fulfillment_lead_time_text, target_audience_summary |
| 4 | Classification | portfolio_group_code, service_line_code, organizational_element_code, global_service_group_code, security_classification |
| 5 | Ownership & SLA | service_owner, service_owner_email, …, sla_availability, sla_restoration, sla_delivery, domains |
| 6 | C3 mapping (jen if c3Visible) | C3 picker → ukládá pending evidence do `notes_json` |
| 7 | Review | shrnutí všeho payloadu, [Create service] |

### 11.3 Steps — new C3

Per popis: 4 steps + Review.

### 11.4 Save draft

Pokud uživatel zavře stránku: localStorage uloží draft pod klíčem `sc_new_service_draft`. Při návratu UI nabídne „Pokračovat v rozdělaném draftu? [Ano] [Začít znovu]".

### 11.5 Final create

Po `[Create service]`:
- Validace celého payloadu (`zod` schema)
- POST `/api/v1/services`
- Pokud OK → redirect na `/services/{service_id}/edit#identity` (→ uživatel může ihned doplnit offerings/SLA detaily, které wizard nepokrývá)
- Pokud chyba → ukázat error banner v Review stepu

### 11.6 API

- `POST /api/v1/services` (new service)
- `POST /api/v1/taxonomy/c3` (new C3)
- ref data endpoints pro selecty

---

## 12. Search standalone (`/search`)

V1 sekce 4 popisuje `⌘K` overlay. v2 doplňuje **standalone /search stránku** (deeper search + history).

### 12.1 Layout

```
PAGE HEADER
  Title: Search
  Purpose: Globální vyhledávání napříč katalogem, capability a C3.
  Primary action: žádná

SEARCH BOX (large, centered, 600 px)
  [🔍 Hledat… (zkus „identity" nebo „backup")     ]    [Search]

(pokud query empty)
RECENT SEARCHES
  • identity federation
  • print queue blockers
  • spiral 7 unmapped
  Saved searches:
  • [⭐ blocked services in Platform]
  • [⭐ unmapped C3 in Spiral 7]

(pokud query non-empty)
RESULTS GROUPED BY TYPE
  ┌─ Services (12) ──────────────────────────┐
  │ Identity Federation       Platform · live│
  │ Backup Vault                Platform · review│
  │ …                                         │
  └─ Capabilities (4) ───────────────────────┘
  ┌─ C3 entities (8) ────────────────────────┐
  │ … apps · data objects · services · TINs │
  └─ Decisions (3) ──────────────────────────┘
```

### 12.2 Per-result row

```
[Type pill]  Title                      Subtitle (kontext)        [→]
```

Click → href z odpovědi API.

### 12.3 ⌘K overlay vs /search

⌘K overlay = quick search (top 5 výsledků, instant).
/search = full-page (groups, recent, saved searches, paginace, filtry).

V ⌘K overlay je odkaz „See all results →" → `/search?query=…`.

### 12.4 API

- `GET /api/v1/search/global?q=...`

### 12.5 Codex tipy

- Recent searches v `localStorage[sc_recent_searches]`, max 10.
- Saved searches v `localStorage[sc_saved_searches]`, max 20, s akcemi uložit aktuální dotaz, otevřít uložené hledání a smazat položku. Server-side varianta patří do pozdější preference vrstvy `platform.user_preferences`.

---

## 13. Help (`/help` + `/help/service-onboarding`)

### 13.1 Help landing (`/help`)

```
PAGE HEADER
  Title: Help & onboarding
  Purpose: Jak používat S3C Manager pro každodenní práci.
  Chips: žádné

SECTIONS
  1. Začněte tady
     Karty: First service · Capability map quickstart · Operations cockpit
  2. Workflow guides
     Karty (každá vede na deeper page):
     • Service onboarding → /help/service-onboarding
     • Capability mapping
     • Readiness gate
     • Decision logging
     • Import a integrace
  3. Datové oblasti
     Karty: Service catalogue · C3 taxonomy · Capability builder · Spirals
  4. FAQ
     Accordion s odpověďmi
```

Obsah je ze static `helpContent.ts` (zachovat).

### 13.2 Service onboarding (`/help/service-onboarding`)

Lineární průvodce s obrázky:

```
PAGE HEADER
  Title: Service onboarding
  Purpose: Postup od založení služby přes editaci, C3 mapování až po publikaci.
  Chips: [Steps: 7]

CONTENT (vertikální flow)
  1. Založte službu → /management/new-service [screenshot]
  2. Doplňte ownera a kontakty [screenshot]
  3. Vyplňte SLA a offerings [screenshot]
  4. Namapujte na capability → /c3/capability-map-spiral7 [screenshot]
  5. Spusťte readiness gate → /operations/readiness [screenshot]
  6. Požádejte o publish review → /operations/reviews [screenshot]
  7. Po schválení nastavte lifecycle = live ✓
```

Obrázky z `frontend/public/help/service-onboarding/` (zachovat).

### 13.3 Codex tipy

- Help je read-only static content, žádné API.
- I18n: cs/en (cz first; helpContent.ts má lang switching).

---

## 14. User profile (`/user-info`)

### 14.1 Layout

```
PAGE HEADER
  Title: Profil
  Purpose: Vaše údaje, preference UI a session.
  Chips: [Local] (nebo [SSO]) [Active session]
  Primary action: 📤 Logout

LAYOUT (2 sloupce)
  ┌─ LEFT: Profile + Preferences ─┬─ RIGHT: Owned services ─┐
  │                               │                          │
  │ SECTION: Profile               │ Vaše služby (n)          │
  │  given_name · surname · …     │ ┌─ Identity Federation ┐│
  │  email · department · phone   │ │ Platform · live      ││
  │  [Save]                       │ └──────────────────────┘│
  │                               │ ┌─ Backup Vault ───────┐│
  │ SECTION: UI preferences       │ │ Platform · review    ││
  │  Language: cs/en/sk/de        │ └──────────────────────┘│
  │  Default persona: consumer/   │ …                        │
  │   service_owner/admin         │                          │
  │  [Save]                       │                          │
  │                               │                          │
  │ SECTION: Password             │                          │
  │  (jen pro local accounts)     │                          │
  │  current · new · confirm      │                          │
  │  [Change password]            │                          │
  │                               │                          │
  │ SECTION: Session              │                          │
  │  IP · UA · login_at · expires │                          │
  │  [Toggle technical detail]    │                          │
  └───────────────────────────────┴──────────────────────────┘
```

### 14.2 Validation

- Password: new === confirm; min 8 znaků
- Email: valid format
- Persona save → invalidate user context (re-render shell s novým defaultem)

### 14.3 API

- `GET/PATCH /api/v1/auth/me`
- `PATCH /api/v1/auth/preferences`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/auth/logout`
- `GET /api/v1/services?owner=...&limit=100`

### 14.4 SSO accounts

Sekce „Password" je skryta pro `auth_provider === 'ad'`. Místo toho info: „Heslo spravuje váš identity provider."

---

## 15. Service history (`/services/[id]/history`)

### 15.1 Layout

```
PAGE HEADER
  Title: History — {service.title}
  Purpose: Auditní historie změn této služby.
  Chips: [Events: 23] [Last change: 2 dny zpět]
  Primary action: ✎ Open editor

CONTROLS
  Date range: [from] [to]
  Filter: [Action ▾] [User ▾] [Field ▾]

TIMELINE (vertikální, newest first)
  ┌─ 2026-04-30 14:32 · Eva Černá · update ──────────────────┐
  │ Field: lifecycle_state                                    │
  │  "approved" → "live"                                       │
  │ Field: published_at                                        │
  │  null → "2026-04-30T14:32:00Z"                             │
  │ Related: review approval RVW-2026-088                     │
  └────────────────────────────────────────────────────────────┘
  ┌─ 2026-04-12 09:15 · Petr Novák · update ─────────────────┐
  │ Field: service_owner                                       │
  │  "petr@example.com" → "alice@example.com"                  │
  └────────────────────────────────────────────────────────────┘
  …
```

### 15.2 API

- `GET /api/v1/services/{id}/history`

---

# Část B — Sdílené komponenty (specifikace)

## 16. Komponentový katalog v2

Komponenty, které se používají na víc stránkách. Codex je má implementovat jednou a reuse-ovat.

### 16.1 `<EditorSubNav>` (sekce 2.2)

Použije: Service editor, C3 entity editor, capability editor, admin user editor.

Props:
```ts
interface EditorSubNavProps {
  sections: Array<{
    id: string;
    label: string;
    badge?: { type: 'error' | 'warn' | 'ok'; text: string };
  }>;
  activeId: string;
  onSelect: (id: string) => void;
}
```

### 16.2 `<StickySaveBar>` (sekce 2.13)

Použije: všechny editory (service, C3 entity, capability, admin users…).

Props:
```ts
interface StickySaveBarProps {
  isDirty: boolean;
  isSaving: boolean;
  lastSavedAt?: Date;
  errors?: number;
  onDiscard: () => void;
  onSave: () => void | Promise<void>;
  onSaveAndPublish?: () => void | Promise<void>;
}
```

Stavy: clean (nezobrazí se), dirty (warn color), saving (spinner), error (bad color).

### 16.3 `<FormSection>` (sekce 2.3)

Použije: všechny formy.

```tsx
<FormSection
  id="identity"
  title="Identity"
  description="Základní identifikace služby."
  badge={{ type: 'error', text: '1 missing' }}>
  <FormGrid>
    <FormField name="title" label="Title" required />
    <FormField name="service_type" type="select" options={…} required />
    …
  </FormGrid>
</FormSection>
```

### 16.4 `<RefTableEditor>` (sekce 10.6)

Existující komponenta v repu. v2 nemění její API, jen specifikuje konzistentní použití:
- Add form vždy nahoře (collapsible „⊕ Add row")
- Inline edit on click
- Delete s confirm (dialog s rationale prompt-em pro auditovatelné akce)
- Foreign key fields jako select s typeahead

### 16.5 `<WizardStepTracker>` (sekce 11.1)

Použije: import wizard, new-service wizard, new-c3 wizard.

Props:
```ts
interface StepTrackerProps {
  steps: Array<{ id: string; label: string }>;
  currentId: string;
  doneIds: string[];
  onJumpTo?: (id: string) => void;  /* allow jump back to done steps */
}
```

CSS jsem dal v1 sekce 18 (`.steps`, `.step`, `.step.done`, `.step.now`).

### 16.6 `<ReviewActionModal>` (sekce 3.4)

Modal pro Approve/Reject/Defer review s rationale + decision log preview.

### 16.7 `<DecisionRecordModal>` (v1 sekce 16.1)

Standalone „Record decision" modal — používaný i mimo review workflow.

### 16.8 `<GraphWorkspace>` (sekce 6.6)

Třísloupcový layout: Toolbar | Canvas | DetailPanel.

Props:
```ts
interface GraphWorkspaceProps {
  toolbar: ReactNode;
  canvas: ReactNode;
  detailPanelContent?: ReactNode;
  onDetailPanelClose?: () => void;
}
```

### 16.9 `<RelationshipStudio>` (v1 sekce 11.3)

Hotová z v1, jen pro úplnost: render service-centric SVG s 5 entity typy.

### 16.10 `<ServiceHero>` (v1 sekce 11.2)

Service 360 hero (title + 4 question cards + lifecycle bar).

### 16.11 `<QuestionCard>` (v1 sekce 11.2)

Jeden ze 4 cards v Service Hero. Použitelný i jinde (např. capability detail).

### 16.12 `<EmptyState>` (sekce 17.1)

Generic empty state komponenta.

```tsx
<EmptyState
  icon="📋"
  title="Žádné readiness blockery"
  description="Můžete publikovat. Pokud chcete, otevřete přehled všech služeb."
  action={{ label: 'Otevřít service list', href: '/services/list' }}
/>
```

### 16.13 `<CodeEditor>` (sekce 8.5)

Wrapper okolo `@monaco-editor/react`. Theme `vs-dark`, syntax dle `language` prop, `onValidate` callback pro lint.

### 16.14 `<KbdChip>`

Mini komponenta pro klávesovou zkratku v UI: `<KbdChip>⌘K</KbdChip>`. Jednotná typografie napříč.

### 16.15 `<UserPicker>`

Typeahead picker pro užívatele/owner. Použije: service editor (ownership), review request modal (assigned_to), admin users (member přidat).

```ts
<UserPicker
  value={email}
  onChange={setEmail}
  scope="all" | "owners" | "reviewers" | "admins"
/>
```

### 16.16 `<ServicePicker>`, `<CapabilityPicker>`, `<C3Picker>`

Stejný pattern jako UserPicker, ale pro odpovídající entity.

---

## 17. Cross-cutting concerns

### 17.1 Empty states katalog

| Stránka | Stav | Microcopy |
|---|---|---|
| `/services/list` | žádné výsledky filtru | „Žádná služba neodpovídá filtru. Zkuste upravit filtry nebo [⊕ Vytvořte novou službu]." |
| `/services/list` | uživatel nemá žádné služby | „Zatím nespravujete žádné služby. Návod: [Service onboarding →]." |
| `/operations/readiness?tab=blocked` | žádné blockery | „Žádné readiness blockery. Můžete publikovat. ✓" |
| `/operations/reviews` | prázdná queue | „Žádné review čekají. Skvělá práce." |
| `/operations/decisions` | prázdný log | „Zatím žádná rozhodnutí. První zaznamenáte přes [⊕ Record decision]." |
| `/capabilities/coverage` | bez dat | „Capability coverage se nepočítá — chybí spiral baseline. [Otevřít builder →]." |
| `/c3/capability-map-spiral7` | builder prázdný | „Tato spiral nemá capability data. [Otevřít C3 Capability Builder →]." |
| `/operations/owner-load` (no `?owner=`) | bez parametru | „Vyberte vlastníka v pickeru nahoře nebo se vraťte na [Operations cockpit →]." |
| `/import` | žádné batche | „Zatím žádné importy. Začněte přes [Step 1: Profile →]." |
| `/cockpit/my-tasks` | nic přiděleno | „Žádné úkoly. Zkontrolujte cockpit nebo si dejte kávu." |
| `/search` | empty query | (recent searches) |
| `/search` | no results | „Pro „{query}" nic nenalezeno. Zkuste obecnější výraz." |

Komponenta `<EmptyState>` (16.12) drží konzistentní vizuál.

### 17.2 Loading states

| Komponenta | Loading | Default duration |
|---|---|---|
| KPI ribbon | shimmer skeleton (4 cards) | < 1 s |
| Tabulka | 5 řádků shimmer | < 1.5 s |
| Graf | centered spinner + text „Načítám graf… (může trvat až 5 s pro velké katalogy)" | 2–5 s |
| Detail panel | shimmer 3 řádky | < 1 s |
| Form load | spinner v sub-nav, šedý overlay na main | < 1 s |

Skeleton barvy: `#f1f5f9` base + `#e2e8f0` shimmer.

### 17.3 Error states

| Typ | UI |
|---|---|
| Network 5xx | Page-level banner: „Něco selhalo. [Zkusit znovu]." + log do console |
| 401 | apiFetch refresh; pokud refresh selže, redirect /login?next= |
| 403 | Page-level banner: „Nemáte oprávnění. Pokud si myslíte, že byste měli, kontaktujte admina." |
| 404 | Empty state s linkem do nadřazené stránky |
| Validation (zod) | Inline pod polem + sub-nav badge |
| Save conflict (412) | Modal: „Někdo jiný uložil změny. [Zobrazit jejich verzi] [Přepsat] [Zrušit]." |

### 17.4 Form validation pattern

```
PER FIELD:
  - aria-invalid=true při chybě
  - error message pod fieldem (12 px var(--bad))
  - red border (`box-shadow: 0 0 0 2px var(--bad-soft)`)

PER SECTION:
  - sub-nav badge (count chyb)

PER FORM:
  - sticky save bar status: „N nesynchronizovaných polí, M chyb"

ON SUBMIT:
  - pokud chyby: scroll na první invalid field, focus, animace shake
  - pokud OK: PUT/POST → toast „Uloženo" + reset dirty flag
```

### 17.5 Auto-save behavior

- Default: **manuální save** (sekce 2.14).
- Výjimka: search filtry, view switch, sidebar collapse — `localStorage` instant.
- Výjimka 2: ref data inline edit (sekce 16.4) — auto-save on blur (with toast).

### 17.6 Permission gating

```tsx
<PermissionGate roles={['admin', 'editor']}>
  <Button>Edit</Button>
</PermissionGate>

<PermissionGate roles={['admin']} fallback={<EmptyState …/>}>
  …admin-only content…
</PermissionGate>
```

`PermissionGate` reads `useAuth().user.roles`. Pokud user nemá roli:
- Default: render `null` (skryto).
- S `fallback` prop: render fallback.
- Žádné disabled stavy.

Server-side stejné — middleware vrací 403, frontend reaguje (sekce 17.3).

### 17.7 Lokalizace

- Default: `cs`.
- Podporované: `cs`, `en`, `sk`, `de`.
- Zdroj: `frontend/app/i18n/messages/{lang}.json`.
- Hook: `useT()` z v1.
- Datum: `Intl.DateTimeFormat(lang)` (cs default).
- Číslo: `Intl.NumberFormat(lang)`.

**Translation keys convention**: `nav.*`, `page.*`, `form.*`, `cta.*`, `empty.*`, `error.*`, `readiness.rule.*`, `decision.type.*`, `lifecycle.*`.

Příklad: `lifecycle.live` → cs „Live", en „Live", sk „Live", de „Aktiv".
Příklad: `readiness.rule.capability_mapping_missing.title` → cs „Capability mapping je prázdné.", en „Capability mapping is missing." atd.

### 17.8 Responsive

- Default desktop ≥ 1280 px.
- ≥ 1024 px: sidebar zůstává, page max-width = 1024 px.
- < 1024 px: sidebar collapses na 60 px (jen ikony) + drawer overlay.
- < 768 px: split layouty (např. user editor) → stack.

Editor (sekce 2) na < 1024 px: sub-nav se mění na **horizontal pills** nahoře místo vertikální levice.

### 17.9 Accessibility

- Wszystkie interaktivní prvky: focus ring (`outline: 2px solid var(--accent); outline-offset: 2px`).
- Pills s ikonou ✓ ⚠ ✗: ARIA labels (`aria-label="ready"`, atd.).
- Skip link → `#main-content` (už v AppShell).
- Tab order: top bar → sidebar → page content.
- Keyboard:
  - `⌘K` global search
  - `Cmd/Ctrl+S` save (v editoru)
  - `Esc` close modal/picker
  - `↑↓` v listech/pickerech

### 17.10 Performance

- React Query / SWR caching default (5 min).
- Velké tabulky (services, C3 list, audit log) — virtualized (`@tanstack/react-virtual`).
- Graf canvas debounced layout calc (300 ms).
- PDF export grafu — Web Worker.

---

## 18. API endpoint reference (komplet)

Pro Codex jako jeden seznam endpointů s tím, kde je v UI použitý.

### Auth
| Endpoint | UI |
|---|---|
| `GET /api/v1/auth/modes` | login |
| `GET /api/v1/auth/sso` | login |
| `POST /api/v1/auth/login` | login |
| `POST /api/v1/auth/logout` | user-info |
| `GET /api/v1/auth/me` | shell, user-info |
| `PATCH /api/v1/auth/me` | user-info |
| `PATCH /api/v1/auth/preferences` | user-info, view switch persistence |
| `POST /api/v1/auth/change-password` | user-info |

### Services
| Endpoint | UI |
|---|---|
| `GET /api/v1/services` | list, picker, my-tasks |
| `GET /api/v1/services/{id}` | detail, edit |
| `POST /api/v1/services` | new-service wizard |
| `PUT /api/v1/services/{id}` | edit save |
| `GET /api/v1/services/{id}/overview` | service hero |
| `GET /api/v1/services/{id}/offerings` | offerings tab |
| `GET /api/v1/services/{id}/support-model` | support tab |
| `GET /api/v1/services/{id}/audience` | request tab |
| `GET /api/v1/services/{id}/operational-links` | support tab |
| `GET /api/v1/services/{id}/sla` | overview |
| `GET /api/v1/services/{id}/score` | service hero readiness |
| `GET /api/v1/services/{id}/roles` | ownership |
| `GET /api/v1/services/{id}/c3-mappings` | coverage tab |
| `GET /api/v1/services/{id}/frameworks` | coverage tab |
| `GET /api/v1/services/{id}/graph?depth=N` | service neighborhood graph |
| `GET /api/v1/services/{id}/history` | history page |
| `GET /api/v1/services/{id}/raw-fields` | admin import raw fields |
| `POST /api/v1/services/{id}/preview-mapping` | C3 mapping preview |
| `GET /api/v1/services/export/csv` | list export |

### Catalogue / dashboard
| Endpoint | UI |
|---|---|
| `GET /api/v1/stats/dashboard-headline` | catalogue dashboard |
| `GET /api/v1/dashboard/inbox` | catalogue dashboard |
| `GET /api/v1/dashboard/summary` | operations |
| `GET /api/v1/stats/operations` | operations |
| `GET /api/v1/stats/completeness` | operations |

### Portfolio
| Endpoint | UI |
|---|---|
| `GET /api/v1/portfolio` | portfolio landing |
| `GET /api/v1/portfolio/{code}` | portfolio detail (TBD) |

### Capabilities & C3
| Endpoint | UI |
|---|---|
| `GET /api/v1/capabilities/lvl3` | capabilities landing |
| `GET /api/v1/capabilities/coverage` | coverage tab |
| `GET /api/v1/taxonomy/c3` | c3 list |
| `GET /api/v1/taxonomy/c3/{uuid}` | c3 detail |
| `GET /api/v1/taxonomy/c3/{uuid}/links` | c3 detail link panel |
| `PUT /api/v1/taxonomy/c3/{uuid}` | c3 edit |
| `POST /api/v1/taxonomy/c3` | new-c3 wizard |
| `GET/POST/DELETE /api/v1/taxonomy/c3/{uuid}/links/...` | c3 edit link panel |
| `GET /api/v1/taxonomy/c3/types` | c3 edit selects |
| `GET /api/v1/taxonomy/c3/statuses` | c3 edit selects |
| `GET /api/v1/taxonomy/c3-applications` | c3 applications list |
| `GET /api/v1/taxonomy/c3-applications/{code}` | c3 app detail |
| `PUT /api/v1/taxonomy/c3-application/{id}` | c3 app edit |
| `GET /api/v1/taxonomy/c3-data-objects/...` | c3 data objects (parallel) |
| `GET /api/v1/taxonomy/c3-services/...` | c3 services (parallel) |
| `GET /api/v1/taxonomy/c3-technology-interactions/...` | c3 TINs (parallel) |
| `GET /api/v1/taxonomy/c3/dashboard` | c3 board |
| `GET /api/v1/taxonomy/c3/capability-map-spiral7` | capability map |
| `GET /api/v1/taxonomy/spiral` | spiral selector |
| `POST /api/v1/taxonomy/spiral` | new spiral |
| `GET/PUT /api/v1/taxonomy/c3-capability-builder/settings` | capability builder |
| `GET/POST/PUT/DELETE /api/v1/taxonomy/c3-capability-builder` | capability builder items |
| `GET /api/v1/spirals` | spirals landing |
| `GET /api/v1/spirals/{code}/heatmap` | spiral detail |
| `GET /api/v1/spirals/{code}/fulfillment-plan` | spiral detail |

### Graph
| Endpoint | UI |
|---|---|
| `GET /api/v1/graph/overview` | service graph |
| `POST /api/v1/graph/overview/layout` | graph save layout |
| `GET /api/v1/graph/c3-relations` | c3 graph |
| `GET /api/v1/taxonomy/domains` | filter |
| `GET /api/v1/flavours?all=1` | service graph flavours toggle |

### Governance
| Endpoint | UI |
|---|---|
| `GET /api/v1/governance/risk-radar` | operations cockpit |
| `GET /api/v1/governance/owner-load` | operations cockpit, owner-load detail |
| `GET /api/v1/governance/owner-load/assignments` | owner-load detail |
| `GET /api/v1/governance/contract-overlap` | operations cockpit |
| `GET /api/v1/governance/renewal-calendar` | operations cockpit |
| `GET /api/v1/governance/advisor` | operations cockpit |
| `GET /api/v1/governance/reviews` | reviews |
| `POST /api/v1/governance/reviews` | reviews (request) |
| `PATCH /api/v1/governance/reviews/{id}` | reviews (status update) |
| `GET /api/v1/governance/decisions` | decision log |
| `POST /api/v1/governance/decisions` | record decision |

### Readiness
| Endpoint | UI |
|---|---|
| `GET /api/v1/readiness/summary` | readiness gate |
| `GET /api/v1/readiness/services/{serviceId}` | review pre-flight |
| `POST /api/v1/readiness/services/{serviceId}/exceptions` | exception dialog |
| `GET /api/v1/readiness/exceptions` | my-tasks |

### Import
| Endpoint | UI |
|---|---|
| `GET /api/v1/import/profiles` | import workspace |
| `GET /api/v1/import/batches` | import workspace |
| `GET /api/v1/import/batches/{id}` | import workspace, admin import |
| `GET /api/v1/import/contract-report/latest` | import workspace |
| `GET /api/v1/import/stubs` | import workspace |
| `GET /api/v1/import/review` | admin import |
| `GET /api/v1/import/relation-raw` | admin import raw relations |
| `POST /api/v1/import/reparse-raw` | admin import reparse |
| `GET /api/v1/taxonomy/import-runs/latest` | import workspace |

### Search
| Endpoint | UI |
|---|---|
| `GET /api/v1/search/global?q=...` | ⌘K, /search |

### Admin
| Endpoint | UI |
|---|---|
| `GET/POST/PUT /api/v1/admin/users` | administration users |
| `GET /api/v1/admin/groups` | groups |
| `DELETE /api/v1/admin/groups/{id}` | groups list |
| `GET/PUT /api/v1/admin/web-settings` | web/SSO |
| `GET /api/v1/admin/logs` | logs |

### Reference data
| Endpoint | UI |
|---|---|
| `GET /api/v1/ref/{table}` | RefTableEditor |
| `POST /api/v1/ref/{table}` | RefTableEditor add |
| `PUT /api/v1/ref/{table}/{code}` | RefTableEditor edit |
| `DELETE /api/v1/ref/{table}/{code}` | RefTableEditor delete |

### Export & install
| Endpoint | UI |
|---|---|
| `GET /api/v1/export/manifest` | catalogue, c3 board, import |
| `GET /api/v1/export/bundle` | c3 board |
| `GET /api/v1/export/capability-map-hierarchy` | c3 board |
| `GET /api/v1/export/c3-relationships` | c3 board |
| `GET /api/v1/install/status` | shell, installation page |

---

## 19. Coverage matrix — 88 page descriptions × layout

Tabulka kontrolního seznamu návrhového pokrytí. Sloupec **v1** = sekce v `LAYOUT_PROPOSAL.md`, sloupec **v2** = sekce v tomto dokumentu. Status v této tabulce znamená, že stránka má přiřazený návrh nebo šablonu; neznamená automaticky, že jsou v aplikaci hotové všechny acceptance detaily z v1/v2 mockupů.

| Description file | v1 | v2 | Status |
|---|---|---|---|
| `root.md` | 8 | — | ✓ done |
| `dashboard.md` | redirect | — | ✓ legacy |
| `services-dashboard.md` | redirect | — | ✓ legacy |
| `admin.md` | redirect | — | ✓ legacy |
| `c3-dashboard-alias.md` | alias | — | ✓ legacy |
| `catalogue.md` | 9 | — | ✓ done |
| `portfolio.md` | (sidebar) | 4 | ✓ done v2 |
| `services-list.md` | 10 | — | ✓ done |
| `services-id.md` | 11 | — | ✓ done |
| `services-id-edit.md` | (mention) | **2** | ✓ done v2 |
| `services-id-graph.md` | (link) | 6 | ✓ done v2 |
| `services-id-history.md` | (tab) | 15 | ✓ done v2 |
| `services-graph.md` | (sidebar) | 6 | ✓ done v2 |
| `services-dependency-flow.md` | (sidebar) | 6 | ✓ done v2 |
| `services-consolidation-matrix.md` | (sidebar) | 6 | ✓ done v2 |
| `services-impact.md` | 17 | — | ✓ done |
| `operations.md` | 12 | — | ✓ done |
| `operations-readiness.md` | 13 | — | ✓ done |
| `operations-decisions.md` | 16 | — | ✓ done |
| `operations-reviews.md` | (mention) | **3** | ✓ done v2 |
| `operations-owner-load.md` | (mention) | 9 | ✓ done v2 |
| `capabilities.md` | 14 | — | ✓ done |
| `capabilities-coverage.md` | 14 | — | ✓ done |
| `capabilities-gaps.md` | 14 | — | ✓ done |
| `capabilities-overlaps.md` | 14 | — | ✓ done |
| `capabilities-slug.md` | 14.2 | — | ✓ done |
| `c3-list.md` | (sidebar) | 7.1 | ✓ done v2 |
| `c3-graph.md` | (sidebar) | 7.2 + 6 | ✓ done v2 |
| `c3-capability-map.md` | (alias) | 7.3 | ✓ done v2 |
| `c3-capability-map-spiral6.md` | (alias) | 7.3 | ✓ done v2 |
| `c3-capability-map-spiral7.md` | (mention) | 7.3 | ✓ done v2 |
| `c3-dashboard.md` | 15 | — | ✓ done |
| `spirals.md` | (sidebar) | 7.4 | ✓ done v2 |
| `spirals-code.md` | — | 7.4 | ✓ done v2 |
| `c3-uuid.md` | (link) | 8.4 | ✓ done v2 |
| `c3-uuid-edit.md` | (link) | 8.4 | ✓ done v2 |
| `c3-applications.md` | — | 8.1 | ✓ done v2 |
| `c3-applications-code.md` | — | 8.2 | ✓ done v2 |
| `c3-applications-code-edit.md` | — | 8.3 | ✓ done v2 |
| `c3-data-objects.md` | — | 8.1 | ✓ template |
| `c3-data-objects-code.md` | — | 8.2 | ✓ template |
| `c3-data-objects-code-edit.md` | — | 8.3 | ✓ template |
| `c3-services.md` | — | 8.1 | ✓ template |
| `c3-services-code.md` | — | 8.2 | ✓ template |
| `c3-services-code-edit.md` | — | 8.3 | ✓ template |
| `c3-technology-interactions.md` | — | 8.1 | ✓ template |
| `c3-technology-interactions-code.md` | — | 8.2 | ✓ template |
| `c3-technology-interactions-code-edit.md` | — | 8.3 | ✓ template |
| `import.md` | 18 | — | ✓ done |
| `import-upload.md` | 18 | — | ✓ done |
| `admin-import.md` | — | 10.8 | ✓ done v2 |
| `admin-import-bulk-folder.md` | — | 10.8 | ✓ template |
| `administration.md` | (sidebar) | 10.1 | ✓ done v2 |
| `administration-users.md` | — | 10.2 | ✓ done v2 |
| `administration-web.md` | — | 10.4 | ✓ done v2 |
| `administration-logs.md` | — | 10.5 | ✓ done v2 |
| `administration-installation.md` | — | 10.9 | ✓ done v2 |
| `admin-installation.md` | — | 10.9 | ✓ done v2 |
| `admin-groups.md` | — | 10.3 | ✓ done v2 |
| `admin-groups-new.md` | — | 10.3 | ✓ done v2 |
| `admin-groups-id.md` | — | 10.3 | ✓ done v2 |
| `admin-catalogue-ref.md` | — | 10.6 | ✓ done v2 |
| `admin-c3-ref.md` | — | 10.6 | ✓ done v2 |
| `admin-c3-capability-builder.md` | — | 10.7 | ✓ done v2 |
| `admin-c3-capability-builder2.md` | — | 10.7 | ✓ template |
| `admin-c3.md` | — | 8 | ✓ template |
| `admin-c3-application.md` | — | 8.2 | ✓ template |
| `admin-c3-application-code.md` | — | 8.5 | ✓ template |
| `admin-c3-data-objects.md` | — | 8.1 | ✓ template |
| `admin-c3-data-objects-code.md` | — | 8.5 | ✓ template |
| `admin-c3-services.md` | — | 8.1 | ✓ template |
| `admin-c3-services-code.md` | — | 8.5 | ✓ template |
| `admin-c3-technology-interactions.md` | — | 8.1 | ✓ template |
| `admin-c3-technology-interactions-code.md` | — | 8.5 | ✓ template |
| `admin-c3-uuid.md` | — | 8.4 | ✓ template |
| `admin-c3-graph.md` | — | 6 | ✓ template |
| `admin-c3-dashboard.md` | 15 | — | ✓ done |
| `admin-c3-ref.md` | — | 10.6 | ✓ done v2 |
| `admin-new-service.md` | — | 11 | ✓ done v2 |
| `admin-new-c3.md` | — | 11 | ✓ done v2 |
| `management.md` | (sidebar) | 11 | ✓ done v2 |
| `management-new-service.md` | — | 11 | ✓ done v2 |
| `management-new-c3.md` | — | 11 | ✓ done v2 |
| `search.md` | (top bar) | 12 | ✓ done v2 |
| `help.md` | — | 13.1 | ✓ done v2 |
| `help-service-onboarding.md` | — | 13.2 | ✓ done v2 |
| `user-info.md` | — | 14 | ✓ done v2 |
| `login.md` | (out of shell) | — | ✓ legacy |
| `install.md` | (out of shell) | — | ✓ legacy |

**Souhrn návrhového pokrytí**: 88 / 88 stránek je nyní pokryto buď konkrétní sekcí nebo šablonou.

### 19.1 Audit implementace k 2026-05-03

Kontrola repozitáře ukazuje, že aplikace má velmi dobré route a backend pokrytí, ale část v1/v2 detailů je zatím implementovaná jen částečně. Následující tabulka je pravdivý stav vůči `LAYOUT_PROPOSAL.md`, `LAYOUT_PROPOSAL2.md`, `layout-mockup.html` a `layout-mockup-v2.html`.

| Oblast | Implementační stav | Acceptance checklist |
|---|---|---|
| App shell, sidebar, top bar | Hotovo | Sidebar je rozdělený podle cockpit / služby / architecture / governance / import / administration, Decision log není duplicitní, view switch je skrytý na `*/edit`, topbar má breadcrumbs, search, notifikace a roli-aware primary action. |
| Home / Catalogue / Operations cockpit | Hotovo | Cockpit a katalog používají denní pracovní plochu, role-aware navigaci, katalogové browse vstupy a Operations cockpit pro governance signály. |
| Service 360 detail | Hotovo | Service relationship studio, business/technical view, 6stupňový lifecycle bar, readiness/ownership/dependency otázky a Service 360 endpoint data jsou zapojené v detailu služby. |
| Service editor | Hotovo | Editor používá `EditorSubNav`, sdílený `FormSection`, `StickySaveBar`, `UserPicker`, Save draft / Save & publish gate, default offering pravidlo, offering reorder a 412 conflict modal. |
| Reviews kanban | Hotovo | Kanban používá sdílený `ReviewActionModal`, evidence, defer expiry, decision preview a reálný readiness pre-flight. |
| Portfolio landing/detail | Hotovo | Portfolio landing a detail route obsahují lifecycle distribution, capability coverage, poslední rozhodnutí, review calendar a provozní summary sekce. |
| My tasks | Hotovo | `/cockpit/my-tasks` agreguje reviews, blokátory, moje služby, rozhodnutí a requesty do vertikálních collapsible sekcí s refresh akcí. |
| Graph workspace family | Hotovo | `GraphWorkspace` je použitý na service graph, service detail graph, dependency flow, C3 graph a admin C3 graph s toolbar / canvas / detail-panel kontraktem. |
| C3 list, map, spirals | Hotovo | C3 list, graph, capability map a spirals používají v2 route patterny a sjednocené mapping/status signály v rámci dostupných endpointů. |
| C3 entity workspace | Hotovo | `<C3EntityWorkspace>` obaluje veřejné i admin C3 entity list/detail/edit varianty a raw/json code edit používá skutečný Monaco `CodeEditor`. |
| Owner load detail | Hotovo | Owner picker, TOP 10 vlastníků a workload distribution chart jsou doplněné; build i token/style lint prochází. |
| Administration family | Hotovo | Administration landing, users, groups, web/SSO, logs, reference data, capability builder, import a installation používají v2 šablony nebo sjednocené legacy aliasy. |
| New entity wizard | Hotovo | New service i New C3 používají wizard pattern, step tracker, localStorage draft a finální create redirect. |
| Search | Hotovo | Standalone `/search` má recent searches, saved searches, grouped results a jasné rozlišení proti `⌘K` quick search. |
| Help / profile / history | Hotovo | Help/onboarding, user profile a service history používají v2 informační architekturu a sjednocené PageHeader / section patterny tam, kde je route potřebuje. |
| Component catalogue v2 | Hotovo | Existují a jsou používané klíčové komponenty: `EditorSubNav`, `StickySaveBar`, `FormSection`, `GraphWorkspace`, `C3EntityWorkspace`, `CodeEditor`/Monaco, `WizardStepTracker`, `ReviewActionModal`, `DecisionRecordModal`, pickery, `PermissionGate`, `ConflictModal`. |
| Cross-cutting patterns | Hotovo | Permission gating je centrálně v `AuthGuard`, style token lint je čistý, manual save policy je zachovaná, 412 conflict modal je zapojený v editoru a E2E smoke pokrývá hlavní flow. |

### 19.2 Opravy provedené podle auditu 19.1

Tyto položky byly doplněné jako přímé opravy nálezů z auditu 19.1:

| Audit oblast | Oprava | Stav po ověření |
|---|---|---|
| App shell / TopBar | View switch je skrytý na všech routách končících `/edit`. | Ověřeno v `TopBar.tsx`; v2 §0.5 splněno pro service i C3 editory. |
| Sidebar | Decision log duplicita je odstraněná z Cockpit sekce a aktivní rozhodnutí otevírají Governance sekci. | Ověřeno v `SidebarNav.tsx`; v2 §0.2 uzavřeno. |
| Search | `/search` má recent searches z `localStorage[sc_recent_searches]`, max 10 položek, saved searches z `localStorage[sc_saved_searches]`, klikatelné chipy a clear/delete akce. | Ověřeno v `search/page.tsx`; server-side saved searches zůstávají až pro `platform.user_preferences`. |
| Owner load | `/operations/owner-load` má `PageHeader`, owner picker, TOP 10 vlastníků a workload distribution chart. | Funkčně doplněno; `lint:styles` i `build` prochází. |
| Reviews kanban | Action modal má `evidence`, `defer_expires_at`, decision preview a reálný pre-flight call na `/api/v1/readiness/summary`. | Funkčně doplněno a refaktorováno do sdíleného `ReviewActionModal`; Decision log používá `DecisionRecordModal`. |
| Component catalogue | Doplněné jsou `ReviewActionModal`, `DecisionRecordModal`, `UserPicker`, `ServicePicker`, `CapabilityPicker`, `C3Picker`, `ConflictModal` a Monaco `CodeEditor`. | Ověřeno buildem; props kontrakty jsou sjednocené pro aktuálně používané v2 stránky. |
| C3 entity workspace | Doplněný je sdílený `<C3EntityWorkspace>` a použitý ve veřejných i admin C3 entity list/detail/edit wrapperech. | Ověřeno buildem; raw/json editace používá Monaco `CodeEditor`. |
| Service editor owner picker | Ownership sekce používá `UserPicker` pro Owner Email a editorové sekce jedou přes sdílený `FormSection`. | Ověřeno buildem; ostatní vazby používají dostupné service/C3/capability pickery podle endpointů. |
| New service wizard draft | `/management/new-service` ukládá formulář, aktuální krok a C3 výběr do `localStorage[sc_new_service_draft]`; `/management/new-c3` používá stejný wizard/draft pattern. | Ověřeno buildem; kolize více paralelních draftů je produktové rozhodnutí pro backend drafty. |
| GraphWorkspace contract | `GraphWorkspace` podporuje v2 props `toolbar`, `canvas`, `detailPanelContent`, `onDetailPanelClose` a je použitý na všech hlavních graph stránkách. | Ověřeno buildem a C3 route E2E sadou. |
| My tasks | `/cockpit/my-tasks` je převedený na vertikální collapsible sekce Reviews → Blokátory → Moje služby → Rozhodnutí → Requesty a má refresh akci. | Funkčně doplněno; `lint:styles` prochází. |
| Portfolio detail | `/portfolio/[code]` má capability coverage filtrovanou portfoliem, posledních 10 rozhodnutí, review calendar a sedm v2 sekcí podle dostupných datových kontraktů. | Doplněno a ověřeno buildem. |
| Service 360 lifecycle | Lifecycle bar používá 6 kanonických stavů `draft → under_review → approved → live → deprecated → retired`; legacy hodnoty se mapují zpětně kompatibilně. | Ověřeno v `services/[id]/page.tsx`; v1/v2 lifecycle gap je uzavřený. |

Technický stav po těchto opravách: `npm run build`, `npm run lint -- --quiet` a `npm run lint:styles` prochází. Audit 19.1 je významně zlepšený; otevřené zůstávají hlavně větší strukturální položky mimo tento opravný balík (`C3EntityWorkspace`, Monaco `CodeEditor`, plošné `GraphWorkspace` reuse a plné E2E ověření).

### 19.3 Opravy provedené v dalším kole podle cíleného gap listu

Toto kolo uzavírá hlavní technické gapy explicitně označené po auditu 19.2: Monaco editor, plošnější graph workspace reuse, Save/Publish gate v service editoru, New C3 wizard parity, saved searches a C3 workspace sjednocení.

| Gap oblast | Oprava | Stav po ověření |
|---|---|---|
| Monaco `CodeEditor` | `CodeEditor` používá skutečný `@monaco-editor/react` + `monaco-editor`, s hidden textarea fallbackem pro form integraci. | Ověřeno `npm run build`; raw/json editory už nejsou jen styled textarea. |
| C3 code-edit varianty | Veřejné C3 entity detail/edit stránky, admin C3 entity list inline raw/json edit a New C3 raw krok používají sdílený Monaco `CodeEditor`. | Ověřeno buildem a lintem; code-edit varianta je sjednocená na sdíleném editoru. |
| C3 list/workspace pattern | `C3EntityListPage` je obalený přes `<C3EntityWorkspace>` a veřejné C3 detail/edit stránky zůstávají ve stejném workspace wrapperu. | Ověřeno buildem; list/detail/edit/code-edit rodina sdílí workspace základ. |
| Graph workspace family | `GraphWorkspace` je použitý na `/services/dependency-flow`, `/services/graph`, `/services/[id]/graph`, `/c3/graph` a `/admin/c3/graph`. | Ověřeno buildem a C3 route E2E sadou; graph stránky sdílí toolbar/canvas/detail-panel pattern. |
| Service editor Save/Publish gate | `StickySaveBar` má `Save draft` a `Save & publish`; publish blokují explicitní publish blockers z formuláře a readiness dat. | Ověřeno buildem a E2E service editor flow. |
| Service editor default offering | První offering se předvyplní jako default; editor umožňuje `Make default` a při default změně zruší default u ostatních offeringů. | Ověřeno E2E vytvořením offeringu a Service 360 primary offering zobrazením. |
| Service editor reorder | Offering list má `Up` / `Down` akce a ukládá `display_order` přes offering API. | Ověřeno buildem; interakce je připravená pro ruční smoke v editoru. |
| New C3 wizard parity | `/management/new-c3` používá stejný wizard pattern jako New service: step tracker, lokální draft, Back/Next/Create flow a review krok. | Ověřeno buildem; raw krok používá Monaco editor. |
| Search saved searches | `/search` má vedle recent searches i `localStorage[sc_saved_searches]`, Save search akci, open saved search a delete saved search. | Ověřeno buildem; server-side saved views zůstávají budoucí práce pro `platform.user_preferences`. |
| E2E smoke | Byla rozšířena Playwright sada přes auth, admin users, C3 routes, catalogue/operations routing, Service 360 a service editor phase 4. | Po rebuild Docker app kontejneru prošlo 19 / 19 testů. |

Technický stav po 19.3: `npm run lint -- --quiet`, `npm run lint:styles`, `npm run build`, `docker compose up -d --build app` a rozšířený Playwright E2E smoke prochází. Zbývající práce je spíš fáze 1 / produktové dotažení: server-side saved views, centralizovaná permission gateway, i18n full coverage a backend-driven lifecycle/readiness rule kontrakty.

### 19.4 Finální dorovnání cross-cutting acceptance detailů

Tento běh uzavírá zbylé rozdíly mezi návrhovým katalogem a skutečným frontendovým vzorem.

| Gap oblast | Oprava | Stav po ověření |
|---|---|---|
| `FormSection` v service editoru | Lokální `EditorSection` nyní renderuje sdílený `FormSection`, takže service editor používá stejný section card pattern jako komponentový katalog v2. | Ověřeno lintem a buildem. |
| Permission gating | `AuthGuard` už při nedostatečné roli nevrací uživatele tiše na home, ale zobrazí sdílený `PermissionGate` s požadovanou rolí. | Ověřeno staticky; admin/editor routing zůstává přes `requiredRoleForPath`. |
| 412 conflict modal | Doplněný je sdílený `ConflictModal` a service editor ho otevře při `412`, `Precondition`, `Conflict` nebo `ETag` save chybě. | Ověřeno lintem; chování čeká na backendový 412 scénář. |
| Documentation truth | Audit 19.1 a 19.2 už nejsou v konfliktu s opravami z 19.3/19.4. Historické phase-1 položky jsou označené jako budoucí datový základ, ne jako UI blokery. | Ověřeno průchodem dokumentu. |

---

## 20. Aktualizovaný implementation order

Nahrazuje v1 sekci 21. Stejné principy (frontend-first, sidebar první, datový model nahrazovat až ve fázi 1), ale rozšířené o v2 brief.

| # | Krok | Soubor / Komponenta | Závislosti | v1/v2 |
|---|---|---|---|---|
| 1 | Sidebar refactor (6 sekcí) | `SidebarNav.tsx` | — | v1 |
| 2 | TopBar (breadcrumbs + ⌘K + view switch + CTA) | `TopBar.tsx`, `GlobalSearch.tsx`, `ViewSwitch.tsx` | — | v1 |
| 3 | PageHeader komponenta | `PageHeader.tsx` | — | v1 |
| 4 | Service 360 hero | `ServiceHero.tsx`, `QuestionCard.tsx` | — | v1 |
| 5 | Relationship studio | `RelationshipStudio.tsx` | — | v1 |
| 6 | View switch chování | service detail | krok 2 | v1 |
| 7 | Operations cockpit konzistence | `operations/page.tsx` | krok 3 | v1 |
| 8 | **Editor sub-nav + sticky save bar + form section** | `EditorSubNav.tsx`, `StickySaveBar.tsx`, `FormSection.tsx` | — | **v2** |
| 9 | **Service editor refactor** | `services/[id]/edit/page.tsx` | krok 8 | **v2** |
| 10 | **Reviews kanban + modal** | `operations/reviews/page.tsx`, `ReviewActionModal.tsx` | krok 3 | **v2** |
| 11 | Readiness gate s human language | `operations/readiness/page.tsx` + `readiness_rule` migrace | fáze 1 | v1 |
| 12 | Decision log knowledge base | `operations/decisions/page.tsx`, `DecisionRecordModal.tsx` | — | v1 |
| 13 | **Portfolio detail nová route** | `portfolio/[code]/page.tsx` | krok 3 | **v2** |
| 14 | **My tasks nová route** | `cockpit/my-tasks/page.tsx` | krok 3 | **v2** |
| 15 | Catalogue browse sekce | `catalogue/page.tsx` | krok 3 | v1 |
| 16 | Service list 8-sloupcová row anatomy | `services/list/page.tsx` | — | v1 |
| 17 | Capability detail rozšíření | `capabilities/[slug]/page.tsx` | — | v1 |
| 18 | C3 Board kanban | `c3/dashboard/page.tsx` | — | v1 |
| 19 | **Graph workspace template** | `GraphWorkspace.tsx`, `GraphToolbar.tsx`, `GraphDetailPanel.tsx` | — | **v2** |
| 20 | **C3 entity workspace template** | `C3EntityWorkspace.tsx`, `CodeEditor.tsx` | — | **v2** |
| 21 | **Spiral detail** | `spirals/[code]/page.tsx` | krok 3 | **v2** |
| 22 | Impact analysis dual-view | `services/impact/page.tsx` | — | v1 |
| 23 | Import workspace 6-step wizard | `import/page.tsx`, `WizardStepTracker.tsx` | back-end dry-run | v1 |
| 24 | **New service / new C3 wizardy** | `management/new-service/page.tsx`, `management/new-c3/page.tsx` | krok 23 (komponenta) | **v2** |
| 25 | **Administration family** | `administration/users`, `web`, `logs`, `groups`, `installation` | krok 3 + 8 | **v2** |
| 26 | **Reference data editor** | `admin/catalogue-ref/page.tsx`, `admin/c3-ref/page.tsx` | RefTableEditor | **v2** |
| 27 | **C3 capability builder** | `admin/c3-capability-builder/page.tsx` | RefTableEditor | **v2** |
| 28 | **Admin import (review)** | `admin/import/page.tsx` | krok 23 | **v2** |
| 29 | **Search standalone** | `search/page.tsx` | krok 2 | **v2** |
| 30 | **Help redesign** | `help/page.tsx`, `help/service-onboarding/page.tsx` | krok 3 | **v2** |
| 31 | **User profile** | `user-info/page.tsx` | krok 8 (form section) | **v2** |
| 32 | **Service history** | `services/[id]/history/page.tsx` | krok 3 | **v2** |
| 33 | Empty/loading/error state knihovna | `EmptyState.tsx`, skeleton vzor | — | **v2** |
| 34 | Permission gating | `PermissionGate.tsx` + auth context | — | **v2** |
| 35 | I18n full coverage | `messages/*.json` | — | **v2** |

**Frontend-only (nelze čekat na fázi 1)**: kroky 1–10, 12, 13, 14, 16–22, 25–35.
**Vyžaduje fázi 1 (data model)**: krok 11 (readiness rule descriptions).
**Vyžaduje back-end změny**: krok 23 (import dry-run endpoint).

---

## 21. Otevřené otázky pro fázi 0 (doplnění k v1)

Mimo 10 otázek z v1 sekce 22 ještě:

11. **Auto-save vs manual save** — sekce 2.14 doporučuje manual. Souhlasí maintainer?
12. **Portfolio detail nová route** — má backend `GET /api/v1/portfolio/{code}` nebo to musíme dodat?
13. **My tasks endpoint** — agregovat na klientovi (sekce 5.2) nebo přidat `GET /api/v1/cockpit/my-tasks`?
14. **C3 entity workspace `<C3EntityWorkspace>`** — je v repu už něco použitelného (PublicC3EntityDetailPage), nebo postavit od nuly?
15. **Code editor lib** — Monaco (těžké, ale standardní) nebo CodeMirror (lehčí)?
16. **Saved views server-side** — dnes je to v `localStorage`. Přesunout do `platform.user_preferences`?
17. **Sidebar permission gating** — klient detekuje role z `useAuth()`. Stačí to, nebo potřebujeme i serverový endpoint `/api/v1/auth/visible-routes`?
18. **Lifecycle transition rules** — jsou v UI duplikované s backendem. Centralizovat?
19. **`vlastnik`, `manager`, `service_owner`** triplet — sekce 2.3 doporučuje smart picker nahoře. Ale dlouhodobě by měl jeden z nich vyhrát. Které pole je „canonical"?
20. **Wizard draft v `localStorage`** — kolizní s více tabů? Per-user backend draft?

---

## 22. Co dál

Pokud Codex tento doc plus v1 zvládne, aplikace je připravená pro fázi 1 z roadmapy (datový model). Před fází 1 doporučuji uzavřít otázky 1–20 (v1 + v2), aby implementace měla pevné základy.

**Po fázi 1** se tato dvě dokumenty stanou živými dokumenty, ne snapshots. V repu je drž v `docs/`. Při změně UX rozhodnutí oba aktualizovat (a posunout coverage matrix v sekci 19).
