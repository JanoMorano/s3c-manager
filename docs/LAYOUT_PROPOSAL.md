# S3C Manager — Layout Proposal (merged)

> **Účel dokumentu**
> Sjednocený návrh layoutu pro **Service Governance Workspace**. Tento dokument kombinuje koncepční rámec (Signal → Explanation → Action → Detail → Audit) s detailní UI specifikací, kterou může Codex implementovat bez nutnosti vymýšlet vizuální rozhodnutí.
>
> **Pro koho**
> Codex (implementace) a maintainer (review). UI sekce jsou popsány do úrovně gridu, tokenů, microcopy a stavů, protože UI design Codex obecně neřeší přesně.
>
> **Jak číst**
> Sekce 1–3 jsou koncept. Sekce 4–7 jsou globální UI vrstvy. Sekce 8–18 jsou stránkové brief. Sekce 19–21 jsou principy, komponenty a pořadí implementace.
>
> **Co tento dokument nemění**
> Datový model. To je úkol fáze 1 z roadmapy. Tento dokument popisuje, co a jak má UI ukazovat z dat, která už dnes existují nebo budou existovat po fázi 1.

---

## 1. Princip — co aplikace dělá

S3C Manager je **mezivrstva** mezi manažerským řízením služby, architekturou, ITSM a projektovým řízením. Není to ticketovací systém, monitoring, plná CMDB ani EA modeler.

Uživatel přichází s otázkou, ne s tabulkou. Aplikace musí postupně odpovědět:

```
Signal → Explanation → Action → Detail → Audit
```

1. **Signal** — co je nového, kritického, blokujícího (KPI, banner, badge).
2. **Explanation** — co to znamená v lidském jazyce (microcopy, popis pravidla).
3. **Action** — co můžu udělat (primární akce, link, formulář).
4. **Detail** — surová data, raw fields, audit trail (až tady).
5. **Audit** — kdo, kdy, proč (decision log, history).

Každá důležitá stránka má držet tento sled shora dolů.

---

## 2. Tři mentální vrstvy

Layout neorganizuje obrazovky podle role, ale podle **mentální vrstvy**, ve které uživatel právě je. Jedna stránka může obsluhovat manažera i admina, ale priorita obsahu se mění:

| Vrstva | Manažer | Architekt | Administrátor |
|---|---|---|---|
| **Co tam vidí první** | stav, riziko, dopad, rozhodnutí | capability, C3, dependencies | missing fields, validation, import |
| **Jak k tomu jde** | shora — KPI, signály, decision log | středem — coverage, mapování, vztahy | zdola — raw data, edit, exception |
| **Co je primary action** | „Otevřít Operations" / „Schválit review" | „Otevřít capability map" / „Spustit impact" | „Doplnit pole" / „Spustit import" |

Tyto vrstvy se promítají do uspořádání každé stránky: shora *manažerský pohled*, dole *administrativní oprava*.

---

## 3. Persony pro permission gating

Vrstvy říkají, **co** uživatel uvidí. Persony říkají, **co může**:

| Persona | Smí | Default landing | Default view |
|---|---|---|---|
| **Konzument** | browse, request | `/` Home (Discover) | Business |
| **Service owner / editor** | edit own services, request review | `/services/list` (jeho služby) | Business |
| **Architekt** | edit C3/capability mapping | `/c3/capability-map` | Technical |
| **Governance / reviewer** | approve, reject, defer, exception | `/operations` | Technical |
| **Administrátor** | vše + users/groups/import/install | `/administration` | Technical |

Položky v sidebaru, na které persona nemá oprávnění, se **skrývají, ne disable-ují**.

---

## 4. Globální shell — UI spec

```
┌────────────────────────────────────────────────────────────────────────┐
│ TOP BAR (44 px)                                                         │
├──────────────┬─────────────────────────────────────────────────────────┤
│ SIDEBAR      │ PAGE                                                    │
│ (220 px)     │  ┌─ page header ────────────────────────────────────┐   │
│              │  │ Title                                            │   │
│              │  │ Jednověté vysvětlení                             │   │
│              │  │ status chips                          primary CTA│   │
│              │  ├──────────────────────────────────────────────────┤   │
│              │  │ DECISION STRIP / KPI / BLOCKERS                  │   │
│              │  ├──────────────────────────────────────────────────┤   │
│              │  │ MAIN WORKSPACE                                   │   │
│              │  ├──────────────────────────────────────────────────┤   │
│              │  │ SUPPORTING DETAIL / RAW / AUDIT                  │   │
│              │  └──────────────────────────────────────────────────┘   │
└──────────────┴─────────────────────────────────────────────────────────┘
```

### 4.1 Top bar (`44 px` výška, `var(--panel)` pozadí, `1px` spodní border `var(--border)`)

Zleva doprava:

| Pozice | Komponenta | Detail |
|---|---|---|
| Left | **Breadcrumbs** | Cesta v IA (max 3 úrovně). Klikatelné. Font 12.5/16, `var(--muted)` až poslední úroveň `var(--ink)` 600. Separator `›` opacity 0.5. Pokud uživatel je ztracen, breadcrumb je první orientační bod. |
| Center | (spacer) | flex: 1 |
| Right 1 | **Global search** `⌘K` | Šířka 280 px, výška 30 px, border-radius 8 px, pozadí `#f1f5f9`, padding 6×10. Levá ikona 🔍, vpravo `kbd` chip `⌘K`. Click otevře překryvný panel s instant výsledky (services, capabilities, C3, decisions). Klávesa `⌘K` / `Ctrl+K` ho otevírá z libovolné stránky. |
| Right 2 | **View switch** | Segmentovaný toggle „Business / Technical". Default per persona. Per-uživatel se ukládá do `localStorage[sc_view_mode]`. Skrytý pro stránky, kde nemá smysl (admin, login). |
| Right 3 | **Primary action** | Kontextová: pro konzumenta `⊕ Request a service`, pro ownera `⊕ New service`, pro governance `⊕ Record decision`. Tato akce je „nejlogičtější další krok" pro danou personu. |
| Right 4 | **Notifications** 🔔 | Dropdown s readiness alerts, review assignments, expiring exceptions. Badge s počtem přečtených/nepřečtených. |
| Right 5 | **User chip** | 28 px kruh s iniciálami nebo avatarem. Dropdown: profil, jazyk, role, settings, logout. |

### 4.2 Sidebar (`220 px` šířka, `var(--sidebar) #0f172a` pozadí, full height)

**Šest sekcí v tomto pořadí**:

```
─ S3C Manager (brand 56 px)
─ COCKPIT
   • Přehled řízení            (= Home, persona-aware)
   • Moje úkoly                (review assignments + readiness exceptions)
   • Decision log              (read filter; rychlý vstup do auditu)
─ SLUŽBY
   • Katalog služeb            (=catalogue dashboard)
   • Portfolio
   • Service list
   • Service graph
   • Dependency flow
   • Impact analysis
   • Konsolidace
   • Nová služba               (jen pro ownera/admina)
─ SCHOPNOSTI a C3
   • Capability map
   • Coverage
   • Gaps
   • Overlaps
   • C3 Board                  (=kanban místo dashboardu)
   • C3 Graph
   • C3 List
   • Spirals
─ GOVERNANCE
   • Operations cockpit
   • Readiness gate
   • Reviews
   • Decisions
   • Owner load
   • Risk radar
─ IMPORT a INTEGRACE
   • Import workspace          (=6-step data quality)
   • Exporty
   • Profily (CSV/JSON/Backstage)
─ ADMINISTRACE
   • Uživatelé a skupiny
   • Nastavení webu / SSO
   • Reference data
   • Logy
   • Instalace
─ User chip + Help (sticky bottom)
```

**Sekce jsou collapsible**. Stav otevření per uživatel v `localStorage[sc_sidebar_sections]`. Aktivní sekce se otevírá automaticky při navigaci.

**Položka aktivní stránky**:
- pozadí `var(--sidebar-active) #1e293b`
- levý border `3 px solid var(--accent)`
- text `white`
- ikonka ve `var(--accent)`

**Položka, na kterou persona nemá oprávnění**: nezobrazuje se vůbec. Žádné disabled stavy.

**C3 sekce**: pokud `useInstallStatus().c3Visible === false`, schová se i celá sekce „Schopnosti a C3".

### 4.3 Page column

`flex: 1`, vertikální layout, `var(--bg) #f4f6f9`. Obsahuje:

- top bar (jako globální komponenta)
- main scroll container (padding 22 px 24 px, max-width 1280 px centered)

---

## 5. Univerzální stránková šablona

Každá důležitá stránka drží tuto kostru shora dolů:

### 5.1 Page header

```
Title (H1, 22/28, weight 700, letter-spacing -0.01em)
Jednovětý účel stránky. (13.5/20, var(--muted))
─────────────────────────────────────────
[status chip] [status chip] [data freshness]    [✎ Primary action]
```

**Pravidla**:
- Title ≤ 4 slova.
- Jednovětý účel je povinný. Smyslem je, aby nový uživatel po prvním přečtení věděl, k čemu stránka slouží.
- Status chips ukazují metadata stránky (read-only, requires admin) NEBO klíčová KPI (12 blockers, 3 reviews).
- Primary action je vpravo, vždy `var(--accent)` background, jediná barva tlačítek.

**Příklady jednovětého účelu**:

| Stránka | Účel |
|---|---|
| `/operations/readiness` | „Které služby jsou připravené k publikaci, změně nebo review." |
| `/capabilities/coverage` | „Kde máme dobré pokrytí schopnostmi a kde chybí odpovědnost." |
| `/services/impact` | „Co se rozbije, když změním tuto službu, capability nebo C3 prvek." |
| `/operations/decisions` | „Auditovatelný záznam toho, co a proč jsme rozhodli." |
| `/import` | „Co přibyde, změní se nebo selže, když nahraju tento import." |
| `/services/consolidation-matrix` | „Kandidáti na konsolidaci podle sdílených capabilities a vztahů." |

### 5.2 Decision strip / KPI / blockers

Pás KPI nebo bannerů těsně pod headerem. **Ne tabulka**.

**KPI ribbon** — 4 karty v gridu `repeat(4, 1fr) gap 12 px`:

```
┌─────────────────┐
│ Open reviews    │  ← label 11.5 px uppercase var(--muted)
│ 14              │  ← value 22/28 weight 700
│ 3 due dnes      │  ← delta 11.5 px var(--ok) nebo var(--bad)
└─────────────────┘
```

Variant: `kpi.warn` (jemný oranžový gradient `#fff8eb → panel`), `kpi.bad` (jemný červený gradient `#fff1f2 → panel`).

**Blocker banner** — když je co řešit:

```
🔴 Readiness: 1 warning — chybí audience policy pro offering "Partner SSO".         Otevřít v Operations →
```

Padding 10×14, border-radius 8, barvy podle severity (warn / bad). Vždy končí pravým „call-to-resolve" linkem.

### 5.3 Main workspace

Tady je vlastní obsah stránky. **Ne raw data**. Pokud je obsah graf, **vždy vedle něj textový závěr**.

> Špatně: jen graf coverage.
> Dobře: graf coverage + text „3 služby blokují capability X. 1 capability nemá ownera."

### 5.4 Supporting detail / raw / audit

Spodní třetina stránky. Obsahuje:
- raw data (collapsible, default zavřené)
- audit trail
- linky na zdrojové entity / external systémy

---

## 6. Page header pattern — UI spec

Každá stránka používá `<PageHeader>` komponentu:

```tsx
<PageHeader
  title="Readiness"
  purpose="Které služby jsou připravené k publikaci, změně nebo review."
  chips={[
    { label: "Blocked: 12", tone: "bad" },
    { label: "Warnings: 7", tone: "warn" },
    { label: "Ready: 33", tone: "ok" },
    { label: "Exceptions expiring: 2", tone: "warn" },
  ]}
  primaryAction={{ label: "Review blockers", href: "?filter=blocked" }}
  meta={{ lastSync: "před 4 minutami", readOnly: false }}
/>
```

**Layout (CSS grid)**:

```
.page-header {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  padding: 20px 24px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.page-header .title-block { grid-column: 1; }
.page-header .actions     { grid-column: 2; align-self: end; }
.page-header .chips       { grid-column: 1 / -1; margin-top: 10px; }
```

**Microcopy pravidla**:
- Title `Readiness` — ne `Service Readiness Dashboard`.
- Purpose vždy jednou větou v ≤ 14 slovech, dospělý jazyk, žádný marketingový tón.
- Chips jsou `[label]: [count]` formát.
- Primary action sloveso v rozkazovacím způsobu („Review blockers", ne „Click to review blockers").

---

## 7. Tokens, typography, density

### 7.1 Color tokens

```css
:root {
  /* Surface */
  --bg:        #f4f6f9;   /* page background */
  --panel:    #ffffff;    /* card/header background */
  --border:   #e2e8f0;    /* hairline */
  --ink:      #0f172a;    /* primary text */
  --muted:    #64748b;    /* secondary text */
  --neutral:  #475569;    /* tertiary text */

  /* Accent */
  --accent:      #2563eb; /* primary action, links, active nav */
  --accent-soft: #dbeafe; /* selected backgrounds */

  /* Semantic */
  --ok:         #15803d;  /* live, ready, pass */
  --ok-soft:    #dcfce7;
  --warn:       #b45309;  /* warning, deprecated */
  --warn-soft:  #fef3c7;
  --bad:        #b91c1c;  /* blocked, overdue, high risk */
  --bad-soft:   #fee2e2;

  /* Sidebar */
  --sidebar:        #0f172a;
  --sidebar-active: #1e293b;
  --sidebar-ink:    #e2e8f0;
  --sidebar-muted:  #94a3b8;
}
```

### 7.2 Typography

| Použití | Velikost / line | Weight | Notes |
|---|---|---|---|
| Page title (H1) | 22/28 | 700 | letter-spacing -0.01em |
| Section title (H3) | 14/20 | 700 | uppercase 11.5/16 pro mini sekce |
| Body | 14/20 | 400/500 | |
| Microcopy / meta | 12.5/18 | 400 | `var(--muted)` |
| KPI value | 22/26 | 700 | letter-spacing -0.01em |
| KPI label | 11.5/14 | 600 | uppercase, letter-spacing 0.04em |
| Pill / chip | 11/14 | 600 | uppercase volitelně |

Žádné více než 3 hierarchické úrovně na stránce.

### 7.3 Density

Tabulky a list pohledy mají toggle `[Comfortable] [Compact]`:

| Mód | Row height | Cell padding | Font |
|---|---|---|---|
| Comfortable | 44 px | 10×12 | 14/20 |
| Compact | 32 px | 6×10 | 13/16 |

Default = Comfortable.

### 7.4 Lifecycle stavy — barevný kód

Tento kód platí všude (badges, lifecycle bar, list rows, graf nodes):

| Stav | Background | Text | Symbol |
|---|---|---|---|
| `draft` | #e2e8f0 | #475569 | — |
| `under_review` | #dbeafe | #2563eb | ◷ |
| `approved` | #dcfce7 | #15803d | ✓ |
| `live` | #dcfce7 | #15803d | ● |
| `deprecated` | #fef3c7 | #b45309 | ◐ |
| `retired` | #f1f5f9 | #64748b | strikethrough |

---

## 8. Home / Cockpit po přihlášení

**Účel:** odpovědět personě na otázku „Je všechno pod kontrolou?" / „Co mám dnes udělat?".

**Layout (persona-aware)**:

### 8.1 Manažer / governance / owner

```
PAGE HEADER
  Title: Přehled řízení
  Purpose: Stav portfolia, rizik a rozhodnutí v jednom pohledu.
  Chips: žádné (KPI ribbon je hned dole)
  Primary action: žádná (cockpit nemá primary akci)

KPI RIBBON (5 karet)
  [Services total] [Ready] [Blocked] [Reviews overdue] [Capability gaps]

DECISION STRIP (2× 2 grid)
  ┌─ Needs decision ──────────┬─ Operational blockers ─┐
  │ • 3 reviews waiting        │ • 4 services bez owner  │
  │ • 2 deferred decisions     │ • 7 missing SLA         │
  │ • 2 exceptions expiring    │ • 5 missing capability  │
  └─ open queue →             └─ otevřít readiness →    ─┘
  ┌─ Capability coverage ─────┬─ Impact / dependency ──┐
  │ 6 gaps · 4 overlaps        │ 12 critical chains     │
  │ • Identity (gap)            │ • Network → Identity   │
  │ • Print queue (overlap)     │ • DNS → 23 services    │
  └─ otevřít coverage →        └─ otevřít impact →     ─┘

RECENT DECISIONS / AUDIT TRAIL (timeline)
  2026-05-01 14:32 · approved · Identity Federation publish
  2026-04-30 09:15 · exception accepted · Legacy DNS (expires 2026-08-15)
  …

NAPOSLEDY NAVŠTÍVENÉ
  [Service · Identity Federation] [Capability · Secure Workforce Identity] …
```

### 8.2 Konzument

```
PAGE HEADER
  Title: Vítejte zpět, {first_name}
  Purpose: Najděte službu, kterou potřebujete, nebo pokračujte v rozdělané práci.
  Primary action: ⊕ Request a service

KPI RIBBON
  [Mé requesty: 3] [Aktivní u mě: 2] [Doporučené: 5]

DECISION STRIP
  ┌─ Pokračujte ─────────────┬─ Doporučujeme ─────────┐
  │ Request „Backup access"  │ Identity Federation     │
  │ — čeká na schválení      │ — pokud chystáte novou  │
  │ Request „VPN profile"    │ aplikaci                │
  │ — pripraveno k odběru    │ Endpoint protection     │
  └──────────────────────────┴─────────────────────────┘

BROWSE
  [Procházet katalog] [Mé služby] [Search]

NAPOSLEDY NAVŠTÍVENÉ
  …
```

**Pravidla**:
- Persona se detekuje z `user.roles` při prvním načtení.
- Pokud má uživatel více rolí, default je **nejmenší privilegovaná**, ale view switch v top baru může přepnout.
- Decision strip karty mají vždy „resolve link" vpravo dole karty (`otevřít … →`).

---

## 9. Service catalogue dashboard (`/catalogue`)

**Účel:** rozcestník katalogu pro konzumenta i ownera. KPI + browse + attention list.

```
PAGE HEADER
  Title: Service catalogue
  Purpose: 132 služeb, 87 requestable, 11 čeká na review.
  Chips: žádné
  Primary action: ⊕ Request a service

KPI RIBBON (4)
  [Total: 132] [Requestable: 87] [Readiness warnings: 23] [Reviews due: 11]

BROWSE BY (3 řady karet)
  Section title: Procházet podle portfolia
    [Platform · 28 / 4 attention] [Workplace · 19 / 1] [Networks · 22 / 7] [Security · 14 / 2]
  Section title: Podle audience
    [Aplikační týmy · 42] [Koncoví uživatelé · 37] [Partneři · 9] [Provozní týmy · 26]
  Section title: Podle domény
    [Identity] [Compute] [Data] [Networking] [Workplace] [Security]

ATTENTION LIST (vyžaduje pozornost)
  Card s 5–10 řádky, každý:
    [Název služby] · [portfolio] · [readiness %]                [pill: blockers/warning/review]
```

**Browse karta** — komponenta `<BrowseCard>`:

```
┌──────────────────┐
│ Platform          │  ← title 13/18 weight 600
│ 28 services       │  ← count 11.5/16 var(--muted)
│ 4 attention       │  ← attention 11.5/16 var(--warn)
└──────────────────┘
```

Min height 70 px, hover `transform: translateY(-1px); box-shadow: 0 2px 6px rgba(0,0,0,0.06)`. Click vede na `/services/list?portfolio={code}`.

---

## 10. Service list (`/services/list`)

**Účel:** pracovní katalog. Filtruje, řadí, ukládá pohledy. Jeden řádek = jedna služba s jejími klíčovými signály.

### 10.1 Layout

```
PAGE HEADER
  Title: Services
  Purpose: Pracovní katalog služeb pro správu, review a export.
  Chips: [Saved view: My services]    Primary action: ⊕ New service

TOOLBAR (sticky pod headerem)
  Search input — fulltext nad ID, name, owner, capability, C3
  Saved views chips: [⭐ All] [Blocked] [Missing owner] [Ready for review] [Deprecated] [Critical]
  Filter row: [Status ▾] [Lifecycle ▾] [Portfolio ▾] [Owner ▾] [Domain ▾] [Requestable ▾] [Capability mapped ▾]
  Right: [List] [Cards] [Dependency]   [Density: ⊟ Comfortable] [Export CSV]

MAIN
  podle View switch:
    LIST  → table s row anatomy (10.2)
    CARDS → grid 3×N karet
    DEPENDENCY → vlevo list, vpravo dep-graf vybrané služby

RIGHT PANEL (volitelný, otevírá se kliknutím na řádek)
  Quick preview:
    Title + lifecycle + readiness summary
    Missing fields list (z readiness)
    Top 3 dependencies
    [Open detail →] [Edit →]
```

### 10.2 Row anatomy (List view)

Každý řádek má **8 sloupců** v tomto pořadí:

| # | Sloupec | Šířka | Obsah | Detail |
|---|---|---|---|---|
| 1 | Service | 28 % | název + service_id (12 px muted pod ním) | Click → detail |
| 2 | Lifecycle | 10 % | pill | barva podle 7.4 |
| 3 | Owner | 14 % | jméno + org | empty state „— bez ownera" červeně |
| 4 | Readiness | 12 % | mini progress bar 0–100 % + počet blockerů/warnings | hover ukáže rule list |
| 5 | Capability | 12 % | primary capability name | empty state „— nemapováno" warn |
| 6 | C3 | 8 % | counter `3` (počet C3 mappings) nebo `—` | |
| 7 | Deps | 8 % | counter `12 ↓ / 3 ↑` (downstream / upstream) | hover ukáže top 5 |
| 8 | Next action | 8 % | inline action button | „Doplnit", „Spustit review", „Otevřít" |

**Pravidlo**: nikdy jen `[Detail] [Edit]`. Sloupec „Next action" musí ukázat, **proč má uživatel řádek otevřít**.

### 10.3 Card view

3 sloupce, každá karta 280×180:

```
┌────────────────────────────┐
│ Identity Federation  ● Live │
│ id-fed-001 · Platform       │
│                              │
│ "SSO a federovaná identita." │
│                              │
│ Owner: Alice Veselá          │
│ Readiness: ████████░░ 80 %  │
│ Capability: Workforce Ident. │
│ ↓ 12 deps · ↑ 3              │
│                              │
│ [Otevřít →]                  │
└────────────────────────────┘
```

### 10.4 Saved views

`localStorage[sc_saved_views]` (už existuje). UI:

- Default views (vestavěné, needitovatelné): All, Blocked, Missing owner, Ready for review, Deprecated, Critical.
- User views: pojmenovaný kombinovaný stav filtrů + sortu + density.
- View se ukládá tlačítkem `⊕ Save view as…`.
- Sdílení: button `🔗 Copy link` zkopíruje URL s vyřešenými query params.

---

## 11. Service detail = Service 360 (`/services/{id}`)

> **Toto je nejdůležitější stránka aplikace.** Od ní se odráží UX celé aplikace.

### 11.1 Layout shora dolů

```
1. SERVICE 360 HEADER          ← business meaning + 4 question cards
2. RELATIONSHIP STUDIO          ← jediný diagram vazeb mezi entitami
3. TABS (Business view default)  ← Overview / Offerings / Request / Support / Dependencies
4. TABS (Technical view, expand) ← Coverage / Governance / Lifecycle / Audit
```

### 11.2 Service 360 header — UI spec

**Toto je hlavní inovace oproti dnešku.** Místo titulku + meta řádku ukážeme čtyři otázky v lidském jazyce.

```
┌──────────────────────────────────────────────────────────────────────┐
│ Identity Federation                                          ● Live  │  ← title row
│ id-fed-001 · Platform · Owner: Alice Veselá · Last reviewed 12.4.2026│  ← meta row
│                                                                       │
│  Lifecycle bar:                                                       │
│   [Draft] [Under review] [Approved] [● LIVE] [Deprecated] [Retired]  │
│                                                                       │
│  "SSO a federovaná identita pro interní i partnerské aplikace."      │  ← business summary
│                                                                       │
│  ┌── What is this? ──┬── Who owns it? ──┬── Is it ready? ──┬── What depends on it? ─┐
│  │ Purpose           │ Service owner    │ Readiness         │ Dependencies            │
│  │ Portfolio         │ Resolver group   │ Blockers          │ Downstream count        │
│  │ Audience          │ Steward          │ Warnings          │ Critical chains          │
│  │                   │ Review cadence   │ Exceptions        │ Top 3 list              │
│  └───────────────────┴──────────────────┴───────────────────┴────────────────────────┘
│                                                                       │
│  Primary actions:                                                     │
│  [⊕ Request access] [📈 Service graph] [🔗 Knowledge]   View: ◉ Business ○ Technical
│                                                                       │
│  Secondary (technical view): [✎ Edit] [Run impact analysis] [Add exception] [History]
└──────────────────────────────────────────────────────────────────────┘
```

#### 4 question cards — detailní spec

Každá karta je `<QuestionCard>`:

```
.question-card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 130px;
}
.question-card .q {
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--muted);
  font-weight: 700;
}
.question-card .a-row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  padding: 4px 0;
  border-top: 1px dashed var(--border);
}
.question-card .a-row:first-of-type { border-top: 0; }
.question-card .k { color: var(--muted); }
.question-card .v { font-weight: 500; text-align: right; }
.question-card .footer-link {
  margin-top: auto;
  font-size: 12px;
  color: var(--accent);
  font-weight: 600;
}
```

**Card 1 — What is this?**
```
WHAT IS THIS?
Purpose      SSO a federace identity
Portfolio    Platform
Audience     Aplikační týmy + partneři
                                  Read full →
```

**Card 2 — Who owns it?**
```
WHO OWNS IT?
Owner            Alice Veselá
Resolver group   IDP-OPS
Steward          Petr Novák
Review cadence   6 měsíců
                                  Owner load →
```

**Card 3 — Is it ready?**
```
IS IT READY?
Readiness        ████████░ 92 %
Blockers         0
Warnings         1 (audience policy)
Exceptions       1 active
                              Otevřít readiness →
```

**Card 4 — What depends on it?**
```
WHAT DEPENDS ON IT?
Downstream       12 services
Upstream         3 services
Critical chains  2
Top: Backup Vault, Email Relay, …
                                  Run impact →
```

**Grid**: `grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 14px 0`.

#### Lifecycle bar

```
.lifecycle {
  display: flex; gap: 4px; margin: 8px 0 14px;
}
.lc-step {
  flex: 1; padding: 6px 10px;
  font-size: 11.5px; font-weight: 600;
  text-align: center;
  border-radius: 4px;
  background: #f1f5f9; color: var(--muted);
}
.lc-step.done { background: var(--ok-soft); color: var(--ok); }
.lc-step.now {
  background: var(--accent); color: white;
  position: relative;
}
.lc-step.now::after {
  content: ""; position: absolute; bottom: -7px; left: 50%;
  transform: translateX(-50%);
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid var(--accent);
}
.lc-step.deprecated { background: var(--warn-soft); color: var(--warn); }
.lc-step.retired    { background: #f1f5f9; color: var(--muted); text-decoration: line-through; }
```

Šest kroků: `Draft · Under review · Approved · Live · Deprecated · Retired`.

Skutečné lifecycle stavy už jsou definované v project_instructions a fáze 7. Bar vychází z `service.service_lifecycle` a barvy podle 7.4.

### 11.3 Relationship studio — UI spec

Jediný diagram, který ukazuje datový model služby v jednom pohledu. **Pod headerem, nad taby**.

**Layout** (`SVG` nebo CSS grid; 100 % šířky, výška 220 px):

```
            ┌──────────────────┐
            │  REQUESTER /     │
            │  USER             │
            │  • Audience       │
            │  • Eligibility    │
            └────────┬─────────┘
                     │ requests
                     ▼
            ┌──────────────────┐
            │  SERVICE OFFERING│   3 offerings: Standard SSO, Partner SSO, Embedded
            │  (selected: Std) │
            └────────┬─────────┘
                     │ exposes
                     ▼
   ┌─────────────────────────────────────────┐
   │            SERVICE                       │
   │            Identity Federation           │
   └──┬──────────┬──────────┬──────────┬─────┘
      │          │          │          │
   supports    maps to    uses      depends on
      │          │          │          │
      ▼          ▼          ▼          ▼
  ┌──────┐  ┌──────┐  ┌──────┐  ┌─────────┐
  │ CAPA-│  │ C3 / │  │ APPLI│  │ SERVICES│
  │BILITY│  │ FMN  │  │CATION│  │ (12)    │
  │ Wfrc │  │ S7   │  │ Okta │  │ Backup, │
  │ Idn. │  │ map  │  │ Entra│  │ Email,  │
  │      │  │      │  │      │  │ …        │
  └──────┘  └──────┘  └──────┘  └─────────┘
                          │
                          ▼ exposes
                      ┌──────┐
                      │ DATA │
                      │ Idn, │
                      │ Sess │
                      └──────┘
```

**Pravidla**:
- Centrální box je vždy aktuální služba.
- Chybějící uzel se ukáže jako šedý dashed obrys s textem „— nemapováno" a inline akcí „Doplnit".
- Click na uzel otevře daný detail (capability slug, c3 uuid, application code, service id).
- Edge typy mají barvy: `requests` (modrá), `exposes` (modrá), `supports` (zelená), `maps to` (fialová), `uses` (oranžová), `depends on` (šedá).
- V Business view: zjednodušená verze (jen Requester → Offering → Service → Capability → Deps).
- V Technical view: plná verze + edge labels + click → graph.

### 11.4 Taby

```
.tab-row {
  display: flex;
  border-bottom: 1px solid var(--border);
  margin-top: 18px;
  padding: 0 8px;
}
.tab {
  padding: 10px 14px;
  font-size: 13px;
  color: var(--muted);
  border-bottom: 2px solid transparent;
}
.tab.on {
  color: var(--ink);
  border-bottom-color: var(--accent);
  font-weight: 600;
}
.tab.tech {
  color: var(--muted);
}
.tab.tech::before {
  content: "🔒"; font-size: 9px; margin-right: 4px; opacity: 0.5;
}
```

#### Business view (default)

| Tab | Obsah |
|---|---|
| **Overview** | value proposition, scope, primary offering summary, SLA summary, support summary |
| **Offerings** | seznam offerings (tabulka s default/requestable/approval/lead time), kliknutí otevře detail |
| **Request & Eligibility** | request channel, lead time, audience policy, eligibility rules |
| **Support** | support owner, hours, channel, escalation, maintenance window, knowledge links |
| **Dependencies** | „Co tato služba potřebuje" + „Co je na ní závislé" v lidsky čitelné podobě |

#### Technical view (additional, příznak `🔒` pokud persona nesmí)

| Tab | Obsah |
|---|---|
| **Coverage** | C3 mapping, framework coverage, evidence |
| **Governance** | readiness blockers/warnings, recent reviews, decisions, exceptions, retirement note |
| **Lifecycle** | timeline draft → live → retired, transition rules, gate kontrola |
| **Audit** | parser raw fields, source URL, change history, import batch link |

#### Per-tab šablona

Každý tab dodržuje stejnou kostru:

```
H3 Section title
microcopy (jedna věta)

[Klíčový blok obsahu]

H3 Doplňkový blok
[Doplňkový obsah]
```

### 11.5 View switch chování

- Switch v top baru přepíná `[Business] [Technical]`.
- V Business view: technical taby jsou skryté (ne disabled).
- V Technical view: ukážou se všechny taby + sekce 11.3 dostane edge labels.
- Stav per uživatel v `localStorage[sc_view_mode]`.
- Default per persona (sekce 3).

---

## 12. Operations cockpit (`/operations`)

**Účel:** „Co hoří teď." Pět tabů, ale **stejná kostra v každém tabu**:

```
KPI ribbon (4)
─ panely (2× 2 grid) ─
[Top 5 list]   [Top 5 list]
[Top 5 list]   [Top 5 list]
─ needs action table ─
```

### 12.1 Taby

| Tab | KPI ribbon | Top panely | Needs action |
|---|---|---|---|
| **Governance** | Open reviews / Overdue / Decisions logged / Active exceptions | Risk radar / Owner load / Renewal calendar / Advisor findings | reviews waiting today |
| **Health** | Total / Ready / Warning / Blocked | Missing owner / Missing SLA / Missing capability / Stale records | services missing mandatory fields |
| **Pricing** | Priced / Free / Variable / Untracked | Above benchmark / Below benchmark / Renewal due / Contract overlap | pricing rows missing currency |
| **Owners** | Owners total / Overloaded / Without owner / Reviewer bottleneck | Top 5 overloaded / Without owner / Reviewer queue / Recent attestations | owner attestations overdue |
| **C3** | Mapped / Unmapped / Validation failures / Drift | Capability gaps / Overlaps / Sync drift / Validation errors | C3 items needing mapping |

### 12.2 Pravidla pro grafy

Codex pozn: graf má odpovědět na otázku, ne dekorovat. Vedle grafu **vždy textový závěr** ve formátu:

> „3 služby blokují capability *Workforce Identity*. Owner: Alice Veselá."

Doporučené grafy:
- **Readiness funnel** (Health tab): horizontální stepped bar `Total → Ready → Warning → Blocked`.
- **Owner load bar** (Owners tab): horizontal bar chart, max 10 vlastníků, jasně zvýrazněný overload threshold.
- **Stale services scatter** (Health tab): X = days since update, Y = readiness %, bublina = počet blockerů.
- **Gap/overlap matrix** (C3 tab): heatmap capability × portfolio.

---

## 13. Readiness gate (`/operations/readiness`)

**Účel:** phase gate před publikací nebo změnou. Lidský jazyk u každého pravidla. Akce ke každému řádku.

### 13.1 Layout

```
PAGE HEADER
  Title: Readiness gate
  Purpose: Které služby jsou připravené k publikaci, změně nebo review.
  Chips: [Blocked: 12] [Warnings: 7] [Ready: 33] [Exceptions expiring: 2]
  Primary action: Review blockers

SUB-TABS
  [Ready] [Warnings] [Blocked] [Exceptions]

MAIN
  Tabulka Blocked services:
    Service | Blocking rule (1 sentence) | Owner | Due | [Action]

RIGHT PANEL — RULE DETAIL (otevírá se po kliknutí na pravidlo)
  Title: Capability mapping is missing
  What is missing: Služba není namapovaná na žádnou L3 capability.
  Why it matters: Manažer nepozná, jakou organizační schopnost služba podporuje, a aplikace nedokáže spočítat coverage.
  Related ITIL/TOGAF process: Service Design / Architecture Vision
  How to fix: Otevřete editor služby a vyplňte sekci „C3 mapping".
  Allow exception? [Add exception]
```

### 13.2 Pravidla microcopy

Každé readiness rule **MUSÍ** mít:

| Pole | Příklad |
|---|---|
| `code` (interní) | `RULE_CAPABILITY_MAPPING_MISSING` |
| `title` (UI) | „Capability mapping je prázdné" |
| `what_is_missing` | „Služba není namapovaná na žádnou L3 capability." |
| `why_it_matters` | „Manažer nepozná, jakou organizační schopnost služba podporuje." |
| `how_to_fix` | „Otevřete editor služby a vyplňte sekci „C3 mapping"." |
| `severity` | `blocker` / `warning` |
| `allow_exception` | bool |

Tyto stringy se ukládají v reference data (`readiness_rule.title_text`, `…why_text`, …) a jsou jazykově lokalizovatelné.

### 13.3 Exception dialog

```
Add exception for "Capability mapping is missing"
Service: Identity Federation

Reason (povinné, max 1000 znaků)
[                                                          ]

Expires at (volitelné)
[ 2026-08-15 ▾ ]

Affected scope (read-only): Identity Federation
Created by: Jan Moravec (auto)

[Cancel] [Save exception]
```

Per spec `/operations/readiness` POST `/api/v1/readiness/services/{id}/exceptions`.

---

## 14. Capability Hub (`/capabilities`)

### 14.1 Capability landing

```
PAGE HEADER
  Title: Capability governance
  Purpose: Kde máme dobré pokrytí schopností a kde chybí odpovědnost.
  Chips: [Coverage: 78 %] [Gaps: 6] [Overlaps: 4] [Without primary: 11] [FMN/C3: 95 %]

SUB-TABS
  [Overview] [Coverage] [Gaps] [Overlaps]

MAIN podle taby:
  Overview: matrix (capability × spiral) + KPI explanation
  Coverage: tabulka (capability, spiral, % coverage, services count, readiness)
  Gaps: list capabilities with no primary mapping + recommended action
  Overlaps: list of pairs (capability, services duplicating it) + consolidation candidate
```

### 14.2 Capability detail (`/capabilities/{slug}`)

```
PAGE HEADER
  Title: Workforce Identity Management
  Purpose: Schopnost organizace spravovat životní cyklus identit zaměstnanců a partnerů.
  Chips: [Covered by 4 services] [Spiral 7 ✓] [1 gap] [No overlap]

SECTIONS
  1. What this capability means       (markdown popis z reference dat)
  2. Supporting services               (seznam mapovaných služeb s lifecycle/readiness)
  3. C3 / FMN mapping                  (technical view)
  4. Gaps                              (co schopnosti chybí: data, app, service)
  5. Overlap candidates                (jiné capabilities/služby s podobným pokrytím)
  6. Related decisions                 (decision log filtered by capability)
  7. Impact if capability changes      (link na impact analysis)
```

---

## 15. C3 Board (`/c3/dashboard` redesign)

**Inovace:** kanban místo dashboardu. Admin vidí, kde se C3 entita zasekla.

### 15.1 Layout

```
PAGE HEADER
  Title: C3 Board
  Purpose: Stav importovaných C3 položek od ingestu po review.
  Chips: [Mapped: 412] [Unmapped: 38] [Validation findings: 7] [Sync drift: 2]
  Primary action: ⊕ New C3 capability

KANBAN (5 lanes, equal width, scroll inside lane)
  ┌─ Imported ─┬─ Validated ─┬─ Mapped ─┬─ Used by service ─┬─ Reviewed ─┐
  │ 64         │ 56          │ 38       │ 29                │ 412         │
  │ ──         │ ──          │ ──       │ ──                │ ──          │
  │ [c3 card]  │ [c3 card]   │ [c3 card]│ [c3 card]         │ [c3 card]   │
  │ [c3 card]  │ [c3 card]   │ [c3 card]│ [c3 card]         │ [c3 card]   │
  │ …          │ …           │ …        │ …                 │ …            │
  └────────────┴─────────────┴──────────┴───────────────────┴─────────────┘

BELOW: Sync drift panel + Validation findings panel
```

### 15.2 C3 card

```
┌─────────────────────────────┐
│ Workforce Identity           │
│ Spiral 7 · L3                │
│ ──                            │
│ Source: import-2026-04-12     │
│ Mapped: 4 services           │
│ Last validation: ✓ pass        │
│                              │
│ [Open detail →]               │
└─────────────────────────────┘
```

Drag-and-drop **není potřeba** v MVP. Lane je read-only signál stavu.

---

## 16. Decision log (`/operations/decisions`)

**Inovace:** ne audit tabulka, **knowledge base rozhodnutí**.

```
PAGE HEADER
  Title: Decision log
  Purpose: Auditovatelný záznam toho, co a proč jsme rozhodli.
  Chips: [Decisions: 38] [Approved: 28] [Deferred: 6] [Rejected: 4]
  Primary action: ⊕ Record decision

FILTERS
  [Service ▾] [Capability ▾] [C3 ▾] [Decision type ▾] [Date ▾] [Person ▾]

LIST (timeline, ne tabulka)
  ┌─ 2026-05-01 14:32  approved  Identity Federation publish ─────────┐
  │ Decision: Approve publish of Identity Federation v2.            │
  │ Why:      Bezpečnostní review prošel; partner SSO offering        │
  │           splňuje compliance pro EU partnery.                    │
  │ Affects:  Service · Identity Federation                          │
  │           Capability · Workforce Identity                         │
  │ Expires:  2027-05-01 (annual review)                             │
  │ Evidence: ↗ Security review report SR-2026-12                   │
  │ Recorded by: Eva Černá                                          │
  └────────────────────────────────────────────────────────────────────┘
  ┌─ 2026-04-30 09:15  exception accepted  Legacy DNS ────────────────┐
  …
```

**Pravidlo**: decision row nikdy není jen `[type] [decision] [date]`. Vždy obsahuje **What**, **Why**, **Affects**, **Expires**, **Evidence**, **Recorded by**.

### 16.1 Record decision modal

```
Record decision
─────────────────────────────────────
Service / Capability / C3 (alespoň jedno)  [search ▾]

Decision type:
  ◯ Publish approval
  ◯ Deferral
  ◯ Risk acceptance
  ◯ Exception
  ◯ Retirement

Decision:
  ◯ Approved   ◯ Rejected   ◯ Deferred   ◯ Cancelled

Rationale (povinné pokud Rejected/Deferred, max 1000 znaků)
[                                                          ]

Expiry / next review (volitelné)
[ 2027-05-01 ▾ ]

Evidence (volitelné, link nebo ID)
[ SR-2026-12 ]

[Cancel] [Save decision]
```

---

## 17. Impact analysis (`/services/impact`)

**Inovace:** graf **A** textový seznam dopadů. Graf sám o sobě nestačí.

```
PAGE HEADER
  Title: Impact analysis
  Purpose: Co se rozbije, když změním tuto službu, capability nebo C3 prvek.

SELECT
  Source:    [Service ▾]  Identity Federation
  Direction: [Downstream ▾]
  Depth:     [3 ▾]
  [Run analysis]

RESULT (po Run)

  ┌─ Graph (left) ─┬─ Text impact list (right) ─┐
  │  selected node │ Direct impact (1)           │
  │   ├─ depends   │  • Backup Vault              │
  │   ├─ supports  │ Downstream (depth 2) (3)     │
  │   ├─ consumes  │  • Email Relay               │
  │   └─ impacts   │  • Print Queue                │
  │                │  • CRM Sync                  │
  │                │ Downstream (depth 3) (8)     │
  │                │  …                           │
  │                │ Affected capabilities (2)    │
  │                │  • Workforce Identity        │
  │                │  • Partner Federation        │
  │                │ Affected C3/FMN (4)          │
  │                │  …                           │
  │                │ Services needing review (5)  │
  │                │  …                           │
  │                │ Recommended actions (3)      │
  │                │  • Trigger reviews           │
  │                │  • Notify owners             │
  │                │  • Add change record         │
  └─────────────────┴────────────────────────────┘

EXPORT
  [📄 Export impact report] [📋 Copy summary]
```

---

## 18. Import workspace (`/import` redesign)

**Inovace:** šestikrokový wizard. Žádný „upload a modli se". Před commit musí uživatel vědět, co se stane.

```
PAGE HEADER
  Title: Import workspace
  Purpose: Co přibyde, změní se nebo selže, když nahraju tento soubor.

STEP TRACKER (sticky pod headerem)
  ┌─1──────┬─2──────┬─3────────┬─4────────┬─5──────┬─6────────┐
  │ Profile│ Upload │ Dry run  │ Validate │ Commit │ Review    │
  │ ✓      │ ✓      │ now      │          │        │           │
  └────────┴────────┴──────────┴──────────┴────────┴───────────┘

STEP CONTENT (mění se podle aktivního stepu)

  Step 3 — Dry run:
    Panels:
      ┌─ New records (12) ──────────┬─ Updated records (8) ───────┐
      │ Service · A new platform svc│ Service · Identity Fed v2    │
      │ Service · Backup tier 2     │ Capability · Workforce Idn.  │
      │ …                            │ …                            │
      └─────────────────────────────┴──────────────────────────────┘
      ┌─ Failed rows (3) ────────────┬─ Mapping suggestions (5) ────┐
      │ row 27: missing service_id   │ row 12: capability slug?     │
      │ row 41: bad format owner     │ row 19: portfolio code?       │
      │ row 53: duplicate id         │ …                             │
      └──────────────────────────────┴───────────────────────────────┘
    Governance impact:
      • 4 capabilities will be added
      • 2 services will move to lifecycle „live"
      • 1 owner will be created (jan@example.com)

NAVIGATION
  [← Back] [Next: Validate →]
```

**Pravidla**:
- Each step má vlastní URL: `/import?step=upload`, `/import?step=dry-run`.
- Před commit (step 5) je červený potvrzovací dialog se shrnutím dopadů.
- Po commit (step 6) jde do auditního decision logu („Import committed by Jan Moravec, 12 new records, 8 updated").

---

## 19. Microcopy katalog

Tabulka frází, které se v UI opakují. Codex je má převzít beze změny.

| Kontext | Špatně | Správně |
|---|---|---|
| Empty state — services list | „No services found" | „Žádná služba neodpovídá filtru. Zkuste upravit filtry nebo vytvořit novou službu." |
| Empty state — readiness | „No items" | „Žádné readiness blockery. Můžete publikovat." |
| Empty state — owner missing | „Owner: —" | „— bez ownera. [Přiřadit →]" |
| Capability without primary | „Overlap" | „Více služeb podporuje stejnou schopnost podobným způsobem." |
| Capability section header | „Capability coverage" | „Capability coverage: které schopnosti jsou pokryté službami a kde chybí odpovědnost." |
| Readiness rule (capability) | `RULE_CAPABILITY_MAPPING_MISSING` | „Capability mapping je prázdné." |
| Readiness rule (owner) | `RULE_OWNER_MISSING` | „Služba nemá přiřazeného ownera." |
| Readiness rule (sla) | `RULE_SLA_MISSING` | „Služba nemá vyplněné SLA hodnoty." |
| Readiness rule (audience) | `RULE_AUDIENCE_POLICY_MISSING` | „Offering nemá vyplněnou audience policy." |
| Decision logged toast | „Decision saved" | „Rozhodnutí zaznamenáno do decision logu." |
| Lifecycle transition denied | „Invalid transition" | „Z tohoto stavu nelze přejít přímo na „Live". Nejdřív projděte review." |

**Pravidla**:
- Vykání default; v konzumentském Discover lze tykat (přátelštější tón).
- Žádný „Click here". Tlačítko popisuje, co udělá: „Otevřít readiness", „Doplnit capability".
- Microcopy NIKDY nepoužívá interní zkratky (C3, FMN, S7) bez vysvětlení v tooltipu.
- Date format: `12. 4. 2026` (cs locale). Čas: `14:32`. Relativní čas: „před 4 minutami", „před 3 hodinami".

---

## 20. Design principy (8)

1. **Nejdřív rozhodnutí, potom data.** KPI a blockers nahoře, tabulky níž.
2. **Každý objekt má ownera, stav a další akci.** Služba bez next action je jen evidence.
3. **Každý graf má textový závěr.** „3 služby blokují capability X" je lepší než barevný graf bez popisu.
4. **Manažer vidí dopad, admin vidí opravu.** Jedna stránka, dvě vrstvy.
5. **Vazby jsou důležitější než jednotlivé záznamy.** Služba bez kontextu (capability, C3, owner, dependencies) nemá hodnotu.
6. **Readiness je gate, ne dekorace.** Ready / Warning / Blocked / Exception. Bez kompromisů.
7. **Audit a decision log jsou důkazní stopa.** Každé schválení má důvod a kontext.
8. **Technické stránky schovat za kontext.** Admin detail tabulky nesmí být primární navigace pro manažera.

---

## 21. Implementační pořadí (priorita podle UX přínosu)

| # | Krok | Soubor / Komponenta | Závislosti |
|---|---|---|---|
| 1 | **Sidebar refactor** na 6 sekcí + role-based visibility | `frontend/app/components/SidebarNav.tsx` | žádné |
| 2 | **Top bar** s breadcrumbs + ⌘K + view switch + Request CTA | `frontend/app/components/AppShell.tsx`, nový `TopBar.tsx`, `GlobalSearch.tsx`, `ViewSwitch.tsx` | žádné |
| 3 | **PageHeader komponenta** (title, purpose, chips, primary action) | nový `frontend/app/components/PageHeader.tsx` | žádné |
| 4 | **Service 360 header** (4 question cards + lifecycle bar) | `frontend/app/services/[id]/page.tsx`, nový `ServiceHero.tsx` | žádné — data jsou v `/api/v1/services/{id}/overview` |
| 5 | **Relationship studio** (SVG diagram pod headerem) | nový `RelationshipStudio.tsx` | data z `/api/v1/services/{id}` + `/c3-mappings` + `/relations` |
| 6 | **View switch chování** v service detail | `frontend/app/services/[id]/page.tsx` | krok 2 |
| 7 | **Operations cockpit konzistence** layoutu mezi taby | `frontend/app/operations/page.tsx` | krok 3 |
| 8 | **Readiness gate** s human-readable rule descriptions | `frontend/app/operations/readiness/page.tsx`, `readiness_rule` migrace pro `title_text/why_text/howto_text` | fáze 1 |
| 9 | **Decision log** jako knowledge base | `frontend/app/operations/decisions/page.tsx` | žádné |
| 10 | **Catalogue browse sekce** | `frontend/app/catalogue/page.tsx` | krok 3 |
| 11 | **Service list row anatomy** (8 sloupců + saved views chips) | `frontend/app/services/list/page.tsx` | žádné |
| 12 | **Capability detail** rozšíření o sections 1–7 | `frontend/app/capabilities/[slug]/page.tsx` | žádné |
| 13 | **C3 Board** (kanban) | `frontend/app/c3/dashboard/page.tsx` (redesign) | žádné |
| 14 | **Impact analysis** dual-view (graph + text list) | `frontend/app/services/impact/page.tsx` | žádné |
| 15 | **Import workspace** (6-step wizard) | `frontend/app/import/page.tsx` (redesign), `import/upload` | back-end dry-run endpoint |

**Body 1–7 jsou frontend-only** a dají se realizovat ještě před fází 1 z roadmapy. Body 8 a 15 vyžadují back-end úpravy a navazují na fáze 1–6.

---

## 22. Otevřené otázky pro fázi 0 auditu

1. **Notifikace** — máme back-end pro per-user notifikace, nebo to stavíme od nuly?
2. **Personalizace home** — odkud bereme „pro mě" data (role assignments + governance reviews)?
3. **My requests / My services** — existuje request log pro konzumenty, nebo se reálně objednává mimo S3C Manager?
4. **View switch persistence** — per uživatel v DB (`platform.user_preferences`) nebo jen `localStorage`?
5. **Quick action „Request a service"** — kam vede pro konzumenta? (catalogue search? formulář? externí ticketing?)
6. **Readiness rule descriptions** — kde uložíme `title_text/why_text/howto_text`? Migrace na `readiness_rule`?
7. **Relationship studio** — máme jeden agregovaný endpoint, nebo to skládáme z 5 calls (services/c3-mappings/relations/applications/data-objects)?
8. **C3 Board lanes** — jak detekujeme stav „Validated" vs „Mapped" vs „Used"? Je to v `c3_taxonomy.status` + počet mappings, nebo nový stav?
9. **Import dry-run** — existuje endpoint, nebo je to jen kalkulace na klientovi z parsed file?
10. **Lifecycle bar v Service detail** — využíváme `service.service_lifecycle` nebo `service_status`? Jak transition rules pasují na dnešní stavy `active/retired/deprecated/draft`?

Tyto body je vhodné rozhodnout dřív, než se začne stavět top bar a Service 360 header.

### 22.1 Rozhodnutí zapracovaná do verze 1.1.2

| Otázka | Rozhodnutí | Implementace |
|---|---|---|
| Notifikace | Přidat `platform.notification` + `platform.user_notification` | Migrace `28_enterprise_governance_contracts.sql`, endpoint `/api/v1/notifications`, reálný bell panel v topbaru |
| Personalizace Home | Nyní `service_role_assignment` + `governance_review.assigned_to`, work queues později | `/api/v1/dashboard/inbox` vrací `my_owned_services`, `my_reviews`, `my_blockers`, `my_decisions`; Home ukazuje denní cockpit |
| My Requests | Lehký `data.service_request` log | `/api/v1/service-requests/mine`, `POST /api/v1/service-requests`, nový `/services/{id}/request` wrapper |
| View switch persistence | `platform.user_preferences` key-value/json | `ViewModeSwitch` ukládá `view_mode` do DB a drží `localStorage` fallback |
| Request a service | Globální CTA na requestable katalog, service detail na request wrapper | Topbar a Service 360 vedou na `/services/list?requestable=true` nebo `/services/{id}/request` |
| Readiness popisy | Rozšířit `readiness_rule` o `title_text`, `why_text`, `howto_text`, `evidence_hint` | Migrace `28`, readiness API vrací texty, Service 360 ukazuje vysvětlení pravidel |
| Relationship Studio | Agregovaný `/services/:id/360` nyní, read model později | Nový endpoint `/api/v1/services/:id/360`, frontend ho používá jako preferovaný overview zdroj |
| C3 Board lanes | Samostatný `data.c3_board_state` | Migrace `28`, view `v_c3_board_lane`, C3 dashboard používá backend lanes místo čisté UI heuristiky |
| Import dry-run | Nyní existující server-side dry-run endpointy | UI rozhodnutí beze změny, konvergence na obecný validation service zůstává roadmap |
| Lifecycle bar | `lifecycle_stage_code` jako stage, `lifecycle_state` jako workflow, `service_status` legacy/public | Service detail preferuje stage, zobrazuje workflow zvlášť a mapuje bar na Draft → Under review → Approved → Live → Deprecated → Retired |

---

## 23. Co se mění oproti dnešku — sumář

| Oblast | Dnes | Návrh |
|---|---|---|
| Sidebar | 4 sekce: Command Centre / Service Catalogue / C3 Reference / Administration | 6 sekcí: Cockpit · Služby · Schopnosti a C3 · Governance · Import a Integrace · Administrace |
| Top bar | prázdný kromě actions | breadcrumbs + ⌘K search + view switch + Request CTA + notifications |
| Page header | nejednotný | povinný `<PageHeader>` s title + jednovětým účelem + status chips + primary action |
| Home | rozcestník s 1–3 kartami | persona-aware cockpit (manager-cockpit / consumer-discover) s decision strip |
| Service detail | 5 tabů, mix business + tech | Service 360 header (4 question cards + lifecycle bar) + Relationship studio + Business view (5 tabů) + Technical view (4 další taby) |
| Service list | tabulka s edit/detail action | 8-sloupcová row anatomy s „next action" + saved views + 3 view modes (List / Cards / Dependency) |
| Operations | 5 tabů s nestejnou kostrou | 5 tabů se **stejnou** kostrou: KPI ribbon → 2×2 panely → needs action |
| Readiness | seznam pravidel s kódy | gate s human-readable popisem každého pravidla + rule detail panel |
| Capability detail | overview | 7 sekcí: Means / Services / Mapping / Gaps / Overlaps / Decisions / Impact |
| C3 dashboard | KPI + grafy | C3 Board (kanban: Imported → Validated → Mapped → Used → Reviewed) |
| Decision log | tabulka rozhodnutí | timeline-knowledge-base s What / Why / Affects / Expires / Evidence |
| Impact analysis | graf | graf **+** text impact list **+** export report |
| Import | upload form | 6-step workspace s dry-run a governance impact |
| Microcopy | technický jazyk, kódy pravidel | lidské stringy v reference datech, lokalizovatelné |

### 23.1 Stav implementace po finálním UI běhu

V1 návrh je v aplikaci zapracovaný společně s v2 supplementem:

- Shell: sidebar, topbar, breadcrumbs, globální search, view switch, notifications a primary action jsou zapojené.
- Service 360: detail služby používá relationship studio, question cards, lifecycle bar, business/technical pohled a agregovaný `/services/:id/360` zdroj, pokud je k dispozici.
- Operations: readiness, reviews, decisions, owner load a cockpit mají governance-first strukturu.
- Service editor: editor má levý sub-nav, sdílené form sekce, sticky save bar, publish gate, default offering pravidlo, reorder a 412 conflict modal.
- C3/graph: graph stránky používají `GraphWorkspace`; C3 list/detail/edit/code-edit rodina používá `C3EntityWorkspace` a Monaco `CodeEditor`.
- Cross-cutting: role gating jde přes `AuthGuard` + `PermissionGate`, style token lint prochází a širší Playwright smoke pokrývá hlavní uživatelské flow.
