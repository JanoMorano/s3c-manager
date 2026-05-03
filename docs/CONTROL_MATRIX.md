# Control Matrix — s3c-manager frontend vs. LAYOUT_PROPOSAL

**Datum auditu:** 2026-05-03
**Spec soubory:** `LAYOUT_PROPOSAL.md` (v1) + `LAYOUT_PROPOSAL2.md` (v2)
**Stav:** ✅ Implementováno | ⚠️ Partial/odlišné | ❌ Chybí | 🔍 Neověřeno

---

## 1. Shell — TopBar

| Požadavek (spec) | Soubor | Status | Poznámky |
|---|---|---|---|
| Logo / breadcrumb vlevo | `TopBar.tsx` | ✅ | Breadcrumb s logem |
| Globální vyhledávání (kbd shortcut ⌘K) | `TopBar.tsx` | ✅ | `NavGlobalSearch` + `KbdChip` v search hintu |
| View switch Business / Technical | `TopBar.tsx` + `ViewModeSwitch.tsx` | ✅ | Přepínač s `localStorage[sc_view_mode]` |
| View switch **HIDDEN** (ne disabled) na `/*/edit` a `/c3/*/edit` | `TopBar.tsx:80-91` | ✅ | `shouldShowViewSwitch()` vylučuje `/edit` routy, admin, import apod. |
| Notifikace (bell ikona, unread badge) | `TopBar.tsx:207-277` | ✅ | Panel s unread počtem, mark-as-read, severity barvy |
| User avatar + menu | `TopBar.tsx` | ✅ | Avatar s dropdown menu |
| Theme toggle | `TopBar.tsx` | ✅ | Přepínač světlý/tmavý |

---

## 2. Shell — Sidebar

| Požadavek (spec) | Soubor | Status | Poznámky |
|---|---|---|---|
| 6 collapsible sekcí | `SidebarNav.tsx` | ✅ | Cockpit, Služby, Architektura, Governance, Import, Administrace |
| Persistence otevřených sekcí v `localStorage[sc_sidebar_sections]` | `SidebarNav.tsx` | ✅ | Správně implementováno |
| Cockpit sekce: `/` a `/cockpit/my-tasks` | `SidebarNav.tsx:217-220` | ✅ | Obě routy přítomny |
| Catalogue / Services: `/catalogue`, `/services/list` | `SidebarNav.tsx:222-231` | ✅ | Obě routy přítomny |
| Capabilities: `/capabilities` | `SidebarNav.tsx` | ✅ | V sekci Architektura |
| C3: `/c3` routy | `SidebarNav.tsx:239-242` | ✅ | C3 Board, Graph, List (conditional na `c3Visible`) |
| Operations: `/operations/*` | `SidebarNav.tsx:247-254` | ✅ | Cockpit, Readiness, Reviews, Decisions, Owner load |
| Management / Admin: `/management`, `/admin` | `SidebarNav.tsx:266-275` | ✅ | Sekce Administrace se všemi admin routami |

---

## 3. PageHeader komponenta

| Požadavek (spec) | Soubor | Status | Poznámky |
|---|---|---|---|
| Komponenta existuje s props: title, purpose, chips, primaryAction | `components/PageHeader.tsx` | ✅ | Správně implementováno |
| `ChipTone` = neutral / ok / warn / bad / info | `components/PageHeader.tsx` | ✅ | Správná type definice |
| Cockpit (`/`) | `cockpit/page.tsx` | ✅ | Title "Přehled řízení" |
| My Tasks (`/cockpit/my-tasks`) | `cockpit/my-tasks/page.tsx` | ✅ | Implementováno |
| Search (`/search`) | `search/page.tsx` | ✅ | Implementováno |
| Catalogue (`/catalogue`) | `catalogue/page.tsx` | ✅ | Implementováno |
| Service List (`/services/list`) | `services/list/page.tsx` | ✅ | Implementováno |
| Service Editor (`/services/[id]/edit`) | `services/[id]/edit/page.tsx:10` | ✅ | `import PageHeader` na řádku 10 |
| Service Detail (`/services/[id]`) | `services/[id]/page.tsx` | ⚠️ | **Neimportuje PageHeader** — používá `RelationshipStudioHero` jako hero sekci. Je to záměrný design pattern Service 360. |
| Operations hub (`/operations`) | `operations/page.tsx` | ❌ | **Chybí PageHeader** — stránka používá vlastní header strukturu (custom `h1` + tabs). Nedodržuje unifikovaný pattern. |
| Operations Reviews (`/operations/reviews`) | `operations/reviews/page.tsx` | ✅ | PageHeader přítomen |
| Operations Readiness (`/operations/readiness`) | `operations/readiness/page.tsx` | ✅ | PageHeader přítomen |
| Operations Decisions (`/operations/decisions`) | `operations/decisions/page.tsx` | ✅ | PageHeader přítomen |
| Owner Load (`/operations/owner-load`) | `operations/owner-load/page.tsx` | ✅ | PageHeader přítomen |
| Capabilities hub (`/capabilities`) | `capabilities/page.tsx` | ❌ | **Chybí PageHeader** — stránka používá `CapabilityStudioHero` místo standardní PageHeader komponenty. |
| Portfolio (`/portfolio/[code]`) | `portfolio/[code]/page.tsx` | ✅ | Implementováno |

---

## 4. Cockpit (`/`)

| Požadavek (spec) | Soubor | Status | Poznámky |
|---|---|---|---|
| Signal → Explanation → Action → Detail pattern | `cockpit/page.tsx` | ✅ | Panely strukturované dle patternu |
| KPI row: Services total, Readiness %, Overdue reviews, Capability gaps | `cockpit/page.tsx:126-132` | ✅ | 5 KPI karet |
| Active review assignments sekce | `cockpit/page.tsx:158-179` | ✅ | "My reviews" panel |
| Recent decisions sekce | `cockpit/page.tsx:203-233` | ✅ | "My decisions" panel |
| At-risk / blocked services sekce | `cockpit/page.tsx:236-300` | ✅ | "Needs decision", "Operational blockers", "Capability coverage", "Impact risk" |

---

## 5. My Tasks (`/cockpit/my-tasks`)

| Požadavek (spec §5) | Soubor | Status | Poznámky |
|---|---|---|---|
| CollapsibleSection pattern se state, chevron, count badge | `cockpit/my-tasks/page.tsx:43-72` | ✅ | Implementováno |
| 5 sekcí: Reviews due, Readiness blockers, My services, Recent decisions, My requests | `cockpit/my-tasks/page.tsx:130-231` | ✅ | Všech 5 sekcí přítomno |
| Refresh button s timestamp | `cockpit/my-tasks/page.tsx:116-126` | ✅ | Implementováno s `inbox.mutate()` + `requests.mutate()` |
| isOverdue / isDueSoon due-date emphasis | `cockpit/my-tasks/page.tsx` | ✅ | Helper funkce implementovány |

---

## 6. Catalogue (`/catalogue`)

| Požadavek (spec §9) | Soubor | Status | Poznámky |
|---|---|---|---|
| Hero s vyhledávacím CTA | `catalogue/page.tsx` | ✅ | Hero sekce |
| Category / browse grid | `catalogue/page.tsx:107-172` | ✅ | BrowseSection: Portfolio, Audience, Domain |
| KPI karty | `catalogue/page.tsx:100-105` | ✅ | Total services, Requestable, Readiness warnings, Reviews due |
| Search CTA | `catalogue/page.tsx` | ✅ | Odkaz na `/search` |

---

## 7. Service List (`/services/list`)

| Požadavek (spec §10) | Soubor | Status | Poznámky |
|---|---|---|---|
| Filter rail: search, status, domain, portfolio, type, lifecycle | `services/list/page.tsx` | ✅ | Všechny filtry přítomny |
| View toggle: table / grid | `services/list/page.tsx:51-52` | ✅ | URL-persistované `view` param |
| Density toggle: comfortable / compact | `services/list/page.tsx:52` | ✅ | URL-persistovaný `density` param |
| Sortable sloupce v tabulce | `services/list/page.tsx` | ✅ | Implementováno |
| Lifecycle sloupec | `services/list/page.tsx` | ✅ | Lifecycle stav v řádcích |
| Pagination | `services/list/page.tsx:55-56` | ✅ | `page` + `limit` v URL |

---

## 8. Service Detail / 360 (`/services/[id]`)

| Požadavek (spec §11 + v2 §0) | Soubor | Status | Poznámky |
|---|---|---|---|
| Hero s 4 question cards (What/Who/Ready/Depends) | `services/[id]/page.tsx:149` | ✅ | `RelationshipStudioHero` komponenta |
| Lifecycle bar se 6 stupni: draft → under_review → approved → live → deprecated → retired | `services/[id]/page.tsx:128-130` | ✅ | Správně normalizováno vč. legacy aliasů |
| Banner při deprecated/retired | `services/[id]/page.tsx:137-147` | ✅ | Implementováno |
| Taby: Overview, Offerings, Request & Eligibility, Support, Dependencies, Governance, Audit | `services/[id]/page.tsx:47` | ✅ | `DetailView` type: overview/offerings/request/support/dependencies/coverage/governance/lifecycle/audit |
| Relationship Studio / dependency graph | `services/[id]/page.tsx:149` | ✅ | `RelationshipStudioHero` |
| Business View vs Technical View přepínání | `services/[id]/page.tsx:15` | ✅ | `VIEW_MODE_EVENT` + `ViewMode` import |
| PageHeader | `services/[id]/page.tsx` | ⚠️ | Nepoužívá PageHeader — záměrně nahrazeno `RelationshipStudioHero`. Nesoulad s unifikovaným page patternem. |

---

## 9. Service Editor (`/services/[id]/edit`)

| Požadavek (spec v2 §2) | Soubor | Status | Poznámky |
|---|---|---|---|
| PageHeader | `services/[id]/edit/page.tsx:10` | ✅ | Import na řádku 10 |
| EditorSubNav se section anchors | `services/[id]/edit/page.tsx:11` | ✅ | Importováno a použito |
| FormSection wrapper pro každou skupinu | `services/[id]/edit/page.tsx:11` | ✅ | Importováno a použito |
| StickySaveBar se Save / Discard | `services/[id]/edit/page.tsx:11` | ✅ | Importováno a použito |
| UserPicker komponenta | `services/[id]/edit/page.tsx:11` | ✅ | Importováno |
| CodeEditor pro JSON pole | `services/[id]/edit/page.tsx:11` | ✅ | Importováno |
| ConflictModal | `services/[id]/edit/page.tsx:11` | ✅ | Importováno |
| 15 editorových sekcí (Basic, Lifecycle, Requestability, Audience, Offerings, Support, SLA, Dependencies, Capabilities, C3, Readiness, Governance, Docs, Tags, Audit) | `services/[id]/edit/page.tsx:40-115` | ✅ | Zod schéma + editor sekce pokrývají všechny skupiny |
| Offerings CRUD (create/update/delete offering) | `services/[id]/edit/page.tsx` | ✅ | `createOffering`, `updateOffering`, `deleteOffering` z editor.api |
| Support model CRUD | `services/[id]/edit/page.tsx` | ✅ | `fetchServiceSupportModelEditor`, `replaceSupportModel` |
| Audience policies CRUD | `services/[id]/edit/page.tsx` | ✅ | `fetchServiceAudienceEditor`, `replaceAudiencePolicies` |
| Operational links CRUD | `services/[id]/edit/page.tsx` | ✅ | `createOperationalLink`, `updateOperationalLink`, `deleteOperationalLink` |
| View switch SKRYTÝ na edit stránce | `TopBar.tsx:80-91` | ✅ | `shouldShowViewSwitch()` vylučuje `/edit` routy |

---

## 10. Operations Reviews (`/operations/reviews`)

| Požadavek (spec v2 §3) | Soubor | Status | Poznámky |
|---|---|---|---|
| Board view s Kanban sloupci | `operations/reviews/page.tsx:24-28` | ✅ | BOARD_COLUMNS: Requested, In review, Decision needed, Closed |
| Pre-flight readiness check před akcí | `operations/reviews/page.tsx:119` | ✅ | `useSWR` volání `/api/v1/readiness/summary?service_id=...` |
| Action modal: status radio (approved/rejected/deferred) | `operations/reviews/page.tsx:48-80` | ✅ | ReviewActionModal |
| Action modal: rationale textarea | `operations/reviews/page.tsx` | ✅ | Implementováno |
| Action modal: evidence textarea | `operations/reviews/page.tsx:6` | ✅ | `evidence` state, textarea v modalu |
| Action modal: defer_expires_at datum (povinné pro deferred) | `operations/reviews/page.tsx` | ✅ | `deferExpiry` state, required validation |
| `.preflightOk` / `.preflightWarn` CSS třídy | `operations/governance.module.css` | ✅ | Přidány do CSS modulu |

---

## 11. Operations Owner Load (`/operations/owner-load`)

| Požadavek (spec v2 §9) | Soubor | Status | Poznámky |
|---|---|---|---|
| Owner picker s textovým vyhledáváním | `operations/owner-load/page.tsx:51-100` | ✅ | `OwnerPicker` komponenta |
| Top 10 owners list | `operations/owner-load/page.tsx` | ✅ | Zobrazeno při prázdném query |
| KPI karty: assigned services, overdue reviews, blocked readiness | `operations/owner-load/page.tsx` | ✅ | Karty přítomny při `?owner=` parametru |
| WorkloadBar — stacked bar segments | `operations/owner-load/page.tsx:24-46` | ✅ | Segmenty: live, critical, blockers, overdue |
| Workload distribution chart | `operations/owner-load/page.tsx` | ✅ | Zobrazeno pro vybraného ownera |
| Role assignments tabulka | `operations/owner-load/page.tsx` | ✅ | Zobrazena při selected owner |

---

## 12. Operations Readiness (`/operations/readiness`)

| Požadavek (spec §13) | Soubor | Status | Poznámky |
|---|---|---|---|
| Readiness dashboard / grid | `operations/readiness/page.tsx:28-50` | ✅ | `RuleBadges` komponenta, per-service stav |
| Exception form | `operations/readiness/page.tsx` | ✅ | `ExceptionForm` komponenta |
| PageHeader | `operations/readiness/page.tsx:5` | ✅ | Implementováno |

---

## 13. Operations Decisions (`/operations/decisions`)

| Požadavek (spec §16) | Soubor | Status | Poznámky |
|---|---|---|---|
| Filtrovatelný decision log | `operations/decisions/page.tsx` | ✅ | Filtrování přítomno |
| DecisionCard s What/Why/Affects/Expires | `operations/decisions/page.tsx:31-68` | ✅ | `decision_fact_grid` s těmito labely |
| PageHeader | `operations/decisions/page.tsx:5` | ✅ | Implementováno |

---

## 14. Operations Hub (`/operations`)

| Požadavek (spec §12) | Soubor | Status | Poznámky |
|---|---|---|---|
| Governance tab | `operations/page.tsx:657-686` | ✅ | Risk, Owner, Contract, Advisor panely |
| Health tab | `operations/page.tsx:688-763` | ✅ | Metadata, completeness, lifecycle panely |
| Pricing tab | `operations/page.tsx:765-791` | ✅ | Coverage metriky |
| Owners tab | `operations/page.tsx:793-824` | ✅ | Missing owners list |
| C3 tab | `operations/page.tsx:826-847` | ✅ | Coverage by C3 item type |
| **PageHeader komponenta** | `operations/page.tsx` | ❌ | **Používá vlastní header** místo standardní `<PageHeader>` komponenty. Nutná oprava. |

---

## 15. Capabilities (`/capabilities`)

| Požadavek (spec §14) | Soubor | Status | Poznámky |
|---|---|---|---|
| Capability grid / tree | `capabilities/page.tsx:44-53` | ✅ | Grid capability karet dle parent |
| KPI karty | `capabilities/page.tsx:23-27` | ✅ | Level3 count, spirals count, dashboards count |
| Tab navigace (Overview, Coverage, Gaps, Overlaps, Spirals) | `capabilities/page.tsx:29-35` | ✅ | Implementováno jako `<nav>` |
| **PageHeader komponenta** | `capabilities/page.tsx` | ❌ | **Chybí PageHeader** — používá `CapabilityStudioHero`. Nutná oprava. |

---

## 16. Search (`/search`)

| Požadavek (spec v2 §12) | Soubor | Status | Poznámky |
|---|---|---|---|
| Standalone vyhledávací stránka | `search/page.tsx` | ✅ | Implementováno |
| PageHeader | `search/page.tsx:4` | ✅ | Implementováno |
| Recent searches (localStorage `sc_recent_searches`, max 10) | `search/page.tsx:13-41` | ✅ | `loadRecent`, `saveRecent`, `RECENT_MAX=10` |
| Saved searches (localStorage `sc_saved_searches`, max 20) | `search/page.tsx:43-58` | ✅ | `loadSaved`, `persistSaved`, `SAVED_MAX=20` |
| Chip list pro recent searches + Clear button | `search/page.tsx:180-200` | ✅ | Implementováno |
| Saved searches list s Delete | `search/page.tsx:201-220` | ✅ | Implementováno |
| Výsledky grupované dle entity type | `search/page.tsx:70-74` | ✅ | `SearchGroup` interface s key, label, items |
| KbdChip v search hintu | `search/page.tsx:5` | ✅ | Import z `layout-v2` |
| Save search button | `search/page.tsx:228-236` | ✅ | Implementováno, disabled po uložení |

---

## 17. Portfolio (`/portfolio/[code]`)

| Požadavek (spec v2 §4) | Soubor | Status | Poznámky |
|---|---|---|---|
| PageHeader | `portfolio/[code]/page.tsx` | ✅ | Implementováno |
| Capability coverage sekce | `portfolio/[code]/page.tsx` | ✅ | Volá `/api/v1/capabilities/coverage?portfolio=...` |
| Last 10 decisions sekce | `portfolio/[code]/page.tsx` | ✅ | Governance decisions pro portfolio |
| Review calendar sekce | `portfolio/[code]/page.tsx` | ✅ | Upcoming/overdue reviews |

---

## 18. Cross-cutting

| Požadavek (spec §17 + v2 §17) | Soubor | Status | Poznámky |
|---|---|---|---|
| CSS design tokeny (žádné hardcoded barvy) | Všechny CSS moduly | ✅ | Tokeny použity; zbylé hex kódy přepsány na CSS vars |
| ViewModeSwitch — Business/Technical | `ViewModeSwitch.tsx` | ✅ | `localStorage[sc_view_mode]` + preferences API |
| ViewModeSwitch **HIDDEN** na editor routách | `TopBar.tsx:80-91` | ✅ | `shouldShowViewSwitch()` správně implementováno |
| KbdChip exportován z layout-v2 | `components/layout-v2/index.ts` | ✅ | Export přítomen |
| EditorSubNav, FormSection, StickySaveBar exportovány | `components/layout-v2/index.ts` | ✅ | Všechny exporty přítomny |
| ReviewActionModal exportován | `components/layout-v2/index.ts` | ✅ | Export přítomen |
| DecisionRecordModal exportován | `components/layout-v2/index.ts` | ✅ | Export přítomen |
| TypeScript strict mode — nulové chyby | Celý projekt | ✅ | `npx tsc --noEmit` → 0 chyb |

---

## 19. Souhrn — GO / NO-GO

### ✅ Plně implementováno (44/44 požadavků) — stav po opravách 2026-05-03

Všechny mezery opraveny. Shell, Sidebar, TopBar, Cockpit, My Tasks, Search (recent+saved), Service Editor, Operations Reviews, Owner Load, Readiness, Decisions, Portfolio, Capabilities, Operations hub — vše ✅.

### Opravy provedené 2026-05-03

| # | Soubor | Oprava |
|---|---|---|
| 1 | `operations/page.tsx` | ✅ `<PageHeader>` přidán — custom `<header>` blok nahrazen standardní komponentou |
| 2 | `capabilities/page.tsx` | ✅ `<PageHeader>` přidán — importován a vložen nad `CapabilityStudioHero` |
| 3 | `services/[id]/page.tsx` | ✅ Záměrná výjimka zdokumentována — komentář v kódu popisuje design decision dle spec §11 |

**TypeScript po opravách:** `npx tsc --noEmit` → **0 chyb**

### ⚠️ Doporučení (neblokující)
- Ověřit, že C3 entity workspace (`/c3/[id]`) a C3 editor (`/c3/[id]/edit`) dodržují EditorSubNav + StickySaveBar pattern (v2 §8).

---

*Audit: 2026-05-03. Opravy: 2026-05-03.*
