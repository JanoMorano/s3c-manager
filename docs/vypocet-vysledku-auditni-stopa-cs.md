# Jak systém počítá/odvozuje výsledek z vyplněných dat a vazeb

Tento dokument popisuje, jak se v Service Catalogue/C3 odvozují výsledky z dat služby, mapování na C3 a vazeb mezi entitami.

## 1) Vstupní proměnné

### 1.1 Katalog služeb (základ služby)
Výpočet vychází primárně z `service_catalog` (aktivní, nestubované služby):

- identita služby (`service_id`, `title`)
- status (`service_status_code`)
- příznaky publikovatelnosti a provozu (např. `requestable`, `lifecycle_state`)

Poznámka: ve view pro publish readiness se explicitně filtruje pouze na `is_deleted = FALSE` a `is_stub = FALSE`.

### 1.2 Vazby služby
Pro rozhodnutí se agregují:

- **C3 mapování** (`service_c3_mapping`), zejména `is_primary = TRUE`
- **flavours** (`service_flavour`) v aktivním stavu (`available`/`active`) a `is_deleted = FALSE`
- **service relations** (`service_relation`) včetně počtu závislostních relací (`depends_on`, `prerequisite`, `underlying`)

### 1.3 C3 capability completeness
Pro C3 položku (capability) se počítají počty navázaných entit:

- aplikace
- data objekty
- TIN
- C3 služby
- mapování služeb

a z nich stav `completeness_status`.

---

## 2) Pravidla výpočtu/rozhodování

## 2.1 Pravidla pro `completeness_status` capability
View `v_c3capabilitycompleteness` odvozuje stav takto:

- **`complete`**: capability má současně alespoň 1 aplikaci + 1 data object + 1 TIN
- **`partial`**: není complete, ale existuje aspoň jedna vazba (aplikace/data object/TIN/C3 service/service mapping)
- **`incomplete`**: capability nemá žádnou uvedenou vazbu

Důležité: pro `complete` se vyžadují konkrétně tři typy vazeb (app + data object + tin).

## 2.2 Pravidla publish readiness služby (`v_servicepublishreadiness`)
Systém odvozuje pomocné indikátory a finální `is_publishable`:

1. **`has_single_primary_mapping`** = právě jedno primární mapování (`primary_mapping_count = 1`) a neprázdné `primary_c3_uuid`.
2. **`has_complete_primary_capability`** = primární capability má `completeness_status = 'complete'`.
3. **`has_active_flavour`** = služba má alespoň jeden aktivní flavour (`available` nebo `active`).
4. **`is_publishable`** = `TRUE` pouze pokud platí současně body 1–3.

Prakticky: pokud chybí kterýkoli z těchto tří předpokladů, služba není publishable.

## 2.3 Pravidla dashboardových procent
V C3 dashboardu (`/c3/dashboard`) frontend počítá:

- **mapování v %** = `round(mapped_items / total_items * 100)`
- **coverage řádku v %** = `round(mapped / value * 100)`

Při nulovém jmenovateli se vrací 0 %.

---

## 3) Význam stavů a indikátorů

## 3.1 Stavy kompletnosti C3 capability
- **complete**: minimální důkazní trojice vazeb (app + data object + TIN) je hotová
- **partial**: capability je rozpracovaná (něco navázáno), ale nesplňuje complete
- **incomplete**: není navázáno nic

## 3.2 Publish-readiness indikátory služby
- **Single primary mapping**: služba má jednoznačný primární C3 anchor
- **Complete primary capability**: tento anchor je datově kompletní
- **Active flavour**: existuje reálně aktivní varianta služby
- **Is publishable**: souhrnné rozhodnutí „může do publikace“

## 3.3 Stavové signály na C3 dashboardu
Dashboard používá barevné mapování stavů (`active`, `draft`, `pending`, `published`, `retired`, …) a ukazuje zejména:

- celkové C3 položky
- mapované vs. nemapované položky
- top rodiče / top mapované entity
- health bloky (link health, review validation, import/sync drift)

Tyto bloky neslouží jen jako „počítadla“, ale jako navigace na seznamy problémových položek.

---

## 4) Jak číst výstupní report/dashboard

## 4.1 Doporučené pořadí čtení (C3 dashboard)
1. **KPI řádek nahoře**: velikost scope (`total_items`), pokrytí (`mapped_items %`), backlog (`unmapped_items`).
2. **Health**: kde je kvalita dat nejhorší (stárnoucí sync, nevalidní vazby, review warningy).
3. **Mappings**: které položky chybí namapovat (`needs_mapping`) a kde je koncentrace mapování (`most_mapped`).
4. **Imports**: jestli drift vzniká importem nebo nesynchronizovanými změnami.
5. **Review**: validační pohled před release/publikací.

## 4.2 Jak číst publishability služby
Pro konkrétní službu čtěte v pořadí:

1. Má **právě jedno** primární C3 mapování?
2. Je primární capability **complete**?
3. Má služba aspoň jeden **active/available flavour**?

Pokud některá odpověď = ne, `is_publishable` je ne.

---

## 5) „Proč vyšel tento výsledek“ — auditní stopa kroků

Následující šablona je doporučený auditní záznam pro vysvětlení výsledku:

## 5.1 Auditní kroky rozhodnutí
1. **Načtení entity**
   - služba nalezena v `service_catalog`
   - filtr: `is_deleted = FALSE`, `is_stub = FALSE`
2. **Vyhodnocení primárního mapování**
   - spočten `primary_mapping_count`
   - určeno `primary_c3_uuid`
3. **Vyhodnocení kompletnosti primární capability**
   - načten `completeness_status` z `v_c3capabilitycompleteness`
   - současně evidovány počty app/data object/TIN/C3 service/service mapping
4. **Vyhodnocení aktivních flavours**
   - spočten `active_flavour_count` podle statusů `available|active`
5. **Složení rozhodnutí**
   - odvozeny booleany `has_single_primary_mapping`, `has_complete_primary_capability`, `has_active_flavour`
   - finální `is_publishable` jako logické AND
6. **Persistovaná auditní stopa změn**
   - změny služeb v `platform.audit_log`
   - změny mapování v `taxonomy_mapping_audit`
   - změny layoutu grafu v `graph_layout_audit`

## 5.2 Vzor vysvětlení pro uživatele

> Výsledek: **Není publishable**.  
> Důvod: služba má primární mapování a aktivní flavour, ale primární capability má `completeness_status = partial` (chybí minimálně jedna z vazeb app/data object/TIN).  
> Auditní podklady: poslední změna mapování v `taxonomy_mapping_audit.changed_at`, poslední změna služby v `platform.audit_log.performed_at`.

Tento formát umožní obhájit výsledek jak vůči editorovi dat, tak vůči governance roli.
