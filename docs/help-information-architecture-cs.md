# Strom obsahu nápovědy (IA)

Tento návrh sjednocuje strukturu nápovědy pro UI, interní dokumentaci i deep-linky.

## Pravidla pro slugy

- Formát: `help.<oblast>.<tema>`
- Znaky: malá písmena, čísla, tečka jako oddělovač
- Stabilita: slug je neměnný identifikátor (při změně názvu sekce zůstává stejný)
- Deep-link doporučení: `/help/<slug>` nebo `#help/<slug>`

## Strom sekcí

### 1) Začínáme

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Přehled aplikace a role | `help.getting-started.overview-roles` | admin, operátor, analytik | Uživatel rozumí rozdílům rolí a orientuje se v hlavní navigaci. | `help.getting-started.first-login` |
| První přihlášení a nastavení profilu | `help.getting-started.first-login` | admin, operátor, analytik | Umí se přihlásit, změnit jazyk, nastavit profil a ověřit oprávnění. | `help.services.catalog-basics` |
| Základní workflow práce v katalogu | `help.getting-started.basic-workflow` | operátor, analytik | Umí projít základní scénář: vyhledat službu, otevřít detail, zkontrolovat vazby. | `help.services.search-filter` |

### 2) Práce se službami

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Vyhledávání a filtrování služeb | `help.services.search-filter` | operátor, analytik | Umí rychle najít službu podle názvu, domény, stavu nebo vlastníka. | `help.services.service-detail` |
| Detail služby a governance pole | `help.services.service-detail` | operátor, analytik | Umí interpretovat stav služby, SLA, vlastníky a auditní kontext. | `help.services.create-update` |
| Založení a editace služby | `help.services.create-update` | operátor, admin | Umí vytvořit/aktualizovat službu včetně povinných polí a validace. | `help.linking.relationship-basics` |
| Životní cyklus a změnová historie | `help.services.lifecycle-history` | admin, operátor | Umí sledovat historické změny a rozhodnout o dalším governance kroku. | `help.evaluation.readiness` |

### 3) Provazování

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Typy vazeb mezi službami | `help.linking.relationship-basics` | operátor, analytik | Umí založit správný typ relace a chápe dopad na graf závislostí. | `help.linking.graph-navigation` |
| Navigace v grafu závislostí | `help.linking.graph-navigation` | analytik, operátor | Umí číst graf, filtrovat uzly a sledovat upstream/downstream dopady. | `help.linking.c3-mapping` |
| Mapování na C3/FMN capability (je-li modul aktivní) | `help.linking.c3-mapping` | analytik, admin | Umí propojit službu na capability a ověřit konzistenci mapování. | `help.evaluation.coverage-gaps` |

### 4) Vyhodnocení výsledků

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Provozní cockpit a KPI | `help.evaluation.operations-cockpit` | analytik, admin | Umí číst KPI, prioritizovat rizika a připravit akční seznam. | `help.evaluation.readiness` |
| Readiness, rizika a compliance signály | `help.evaluation.readiness` | analytik, admin | Umí vyhodnotit připravenost služby a identifikovat kritické nedostatky. | `help.evaluation.coverage-gaps` |
| Coverage / overlap / gap analýza | `help.evaluation.coverage-gaps` | analytik | Umí interpretovat mezery, duplicity a návrhy konsolidace. | `help.data.exports` |

### 5) Správa dat

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Import dat (CSV/JSON) – dry-run a commit | `help.data.imports` | admin, operátor | Umí připravit import, vyhodnotit chyby z dry-runu a provést commit. | `help.data.audit-trail` |
| Auditní stopa a dohledatelnost změn | `help.data.audit-trail` | admin, analytik | Umí dohledat kdo/kdy/co změnil a podložit rozhodnutí evidencí. | `help.data.exports` |
| Exporty a sdílení výsledků | `help.data.exports` | analytik, admin | Umí exportovat relevantní data pro reporting a stakeholdery. | `help.installation.runtime-overview` |

### 6) Instalace a provoz

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Instalační průvodce a první admin účet | `help.installation.first-run` | admin | Umí bezpečně dokončit první spuštění a inicializaci systému. | `help.installation.runtime-overview` |
| Provozní režimy a konfigurace prostředí | `help.installation.runtime-overview` | admin | Umí nastavit runtime proměnné, moduly a základní bezpečnostní parametry. | `help.installation.backup-restore` |
| Záloha, obnova a upgrade | `help.installation.backup-restore` | admin | Umí naplánovat zálohování, obnovu a bezpečný upgrade. | `help.faq.troubleshooting` |

### 7) FAQ

| Název tématu | Slug | Cílový uživatel | Očekávaný výstup | Další krok |
|---|---|---|---|---|
| Nejčastější dotazy k přístupům a rolím | `help.faq.access-roles` | admin, operátor | Umí rychle vyřešit běžné problémy s přihlášením a oprávněními. | `help.faq.troubleshooting` |
| Troubleshooting importů a validací | `help.faq.troubleshooting` | admin, operátor | Umí diagnostikovat nejběžnější chyby importu a zvolit správnou nápravu. | `help.faq.performance` |
| Výkon, limity a doporučené postupy | `help.faq.performance` | admin, analytik | Umí rozpoznat výkonové limity a aplikovat provozní doporučení. | `help.getting-started.overview-roles` |

## Poznámky pro implementaci v UI

- Navigační strom v UI ukládat přes `slug` + lokalizovaný `title`.
- Každá stránka nápovědy by měla mít metadata:
  - `slug`
  - `persona[]`
  - `learning_outcome`
  - `next_slug[]`
- Doporučené minimální API schéma:

```json
{
  "slug": "help.services.service-detail",
  "title": "Detail služby a governance pole",
  "persona": ["operator", "analyst"],
  "learning_outcome": "Uživatel umí interpretovat stav služby, SLA a ownership.",
  "next_slug": ["help.services.create-update", "help.linking.relationship-basics"]
}
```
