# Návod: od otevření formuláře po uložení služby

Tento postup je určen pro roli **editor** nebo **admin** a popisuje lineární průchod formulářem **New Service Wizard** (`/management/new-service`).

## 1) Otevření formuláře „Nová služba“

- **Konkrétní akce v UI:** V levém menu otevři **Administration** (nebo **Management**) a klikni na **New Service**.
- **Která pole vyplnit a proč:** V tomto kroku se ještě nic nevyplňuje; cílem je otevřít správný formulář, aby se data zakládala přes validovaný wizard.
- **Validní příklad hodnot:** N/A (jen navigace).
- **Kontrolní bod – jak poznám, že je krok správně:** Vidíš stránku se záhlavím „New Service Wizard“ a první krok **Identity**.

## 2) Krok Identity

- **Konkrétní akce v UI:** Ve kroku **Identity** vyplň základní identitu služby.
- **Která pole vyplnit a proč:**
  - `Service ID` – unikátní identifikátor pro vyhledávání a integrace.
  - `Title` – uživatelsky srozumitelný název služby.
  - `Type` – určuje kategorii služby v katalogu.
  - `Status` – určuje provozní stav z pohledu katalogu.
  - `Lifecycle` – řídí životní cyklus služby (draft/live/deprecated…).
- **Validní příklad hodnot:**
  - `Service ID`: `SVC-NET-001`
  - `Title`: `Bezpečný vzdálený přístup VPN`
  - `Type`: `business_service`
  - `Status`: `active`
  - `Lifecycle`: `under_review`
- **Kontrolní bod – jak poznám, že je krok správně:** Formulář neukazuje validační chyby a tlačítko **Next** je aktivní.

## 3) Krok Description

- **Konkrétní akce v UI:** Klikni na **Next** a vyplň krok **Description**.
- **Která pole vyplnit a proč:**
  - `Short description` – stručné vysvětlení služby pro seznamy a vyhledávání.
  - `Business summary` – proč služba existuje z pohledu businessu.
  - `Consumer value` – jakou konkrétní hodnotu dostává koncový uživatel.
- **Validní příklad hodnot:**
  - `Short description`: `Centrálně spravovaný VPN přístup do interních systémů.`
  - `Business summary`: `Služba zajišťuje bezpečný vzdálený přístup zaměstnanců a dodavatelů.`
  - `Consumer value`: `Uživatel se bezpečně připojí odkudkoli bez složitých manuálních nastavení.`
- **Kontrolní bod – jak poznám, že je krok správně:** Textová pole jsou vyplněná smysluplně (ne jen jedním slovem) a lze pokračovat dál.

## 4) Krok Access

- **Konkrétní akce v UI:** Přepni se na krok **Access**.
- **Která pole vyplnit a proč:**
  - `Requestable` – určuje, zda si službu lze objednat.
  - `Request channel` – kde uživatel službu žádá (portál/formulář).
  - `Approval required` – jestli je nutné schválení.
  - `Lead time` – očekávaná doba zřízení.
  - `Audience / Eligibility` – kdo má nárok službu využívat.
- **Validní příklad hodnot:**
  - `Requestable`: `Yes`
  - `Request channel`: `https://serviceportal.example.org/catalog/vpn`
  - `Approval required`: `Yes`
  - `Lead time`: `2 business days`
  - `Audience / Eligibility`: `Interní zaměstnanci a smluvní partneři s MFA.`
- **Kontrolní bod – jak poznám, že je krok správně:** Pokud je `Requestable = Yes`, pole `Request channel` není prázdné a URL je ve validním formátu.

## 5) Krok Classification

- **Konkrétní akce v UI:** Pokračuj na **Classification**.
- **Která pole vyplnit a proč:**
  - `Portfolio` – zařazení do portfolia pro reporting.
  - `Domains` – doménové tagy pro filtrování a odpovědnost.
  - `Service lines` – věcné členění katalogu.
- **Validní příklad hodnot:**
  - `Portfolio`: `Workplace Services`
  - `Domains`: `Network`, `Security`
  - `Service lines`: `Remote Access`
- **Kontrolní bod – jak poznám, že je krok správně:** Služba je viditelně zařazená minimálně do jednoho portfolia/domény a nebude „bez kontextu“ v dashboardech.

## 6) Krok Ownership

- **Konkrétní akce v UI:** Otevři krok **Ownership**.
- **Která pole vyplnit a proč:**
  - `Service owner (email)` – jednoznačný vlastník služby.
  - `Review owner` – odpovědnost za periodickou revizi obsahu.
  - `Next review date` – datum další kontroly kvality dat.
- **Validní příklad hodnot:**
  - `Service owner`: `jana.novakova@example.org`
  - `Review owner`: `it-governance@example.org`
  - `Next review date`: `2026-09-30`
- **Kontrolní bod – jak poznám, že je krok správně:** E-maily mají správný formát a datum revize je v budoucnosti.

## 7) Krok SLA

- **Konkrétní akce v UI:** Přesuň se na krok **SLA**.
- **Která pole vyplnit a proč:**
  - `Availability` – očekávaná dostupnost.
  - `RTO` – čas obnovy po výpadku.
  - `RPO` – přípustná ztráta dat.
  - `Support hours` – kdy je dostupná podpora.
  - `Support tier` – úroveň podpory.
  - `Support channel` – jak kontaktovat podporu.
- **Validní příklad hodnot:**
  - `Availability`: `99.9%`
  - `RTO`: `4h`
  - `RPO`: `15m`
  - `Support hours`: `Mon–Fri 08:00–18:00 CET`
  - `Support tier`: `Tier 2`
  - `Support channel`: `servicedesk@example.org`
- **Kontrolní bod – jak poznám, že je krok správně:** SLA metriky dávají smysl společně (např. RPO není delší než očekávaná provozní tolerance).

## 8) Krok C3 Mapping (pokud je aktivní modul C3)

- **Konkrétní akce v UI:** Pokud se krok zobrazuje, vyplň **C3 Mapping**.
- **Která pole vyplnit a proč:**
  - Vazba na C3 capability/entity – propojení služby s taxonomií pro governance a analytiku.
- **Validní příklad hodnot:**
  - `Capability`: `Access Management`
  - `C3 Entity`: `Identity & Access Platform`
- **Kontrolní bod – jak poznám, že je krok správně:** Vybrané C3 položky jsou uložené v přehledu a nejsou prázdné, pokud jsou pro službu povinné.

## 9) Review + uložení služby

- **Konkrétní akce v UI:** Na obrazovce **Review** zkontroluj souhrn a klikni na **Submit** / **Save**.
- **Která pole vyplnit a proč:** Už nic nového; jde o finální kontrolu konzistence (ID, vlastník, request channel, SLA, lifecycle).
- **Validní příklad hodnot:** Souhrn odpovídá dříve zadaným datům, např. `SVC-NET-001`, `under_review`, `requestable = Yes`.
- **Kontrolní bod – jak poznám, že je krok správně:** Po uložení dojde k přesměrování do detailu/editoru služby bez validačních chyb a služba je dohledatelná v seznamu `/services/list`.

---

## Nejčastější chyby při zadání služby

1. **Neunikátní nebo nečitelné `Service ID`**  
   - Problém: duplicitní ID nebo ad-hoc názvy typu `test1`.  
   - Jak předejít: používej stabilní konvenci (např. `SVC-<DOMENA>-<ČÍSLO>`).

2. **Příliš obecný název a popis**  
   - Problém: název „VPN“ bez kontextu, popis jednou větou bez hodnoty pro uživatele.  
   - Jak předejít: vždy doplň `Business summary` i `Consumer value` konkrétním jazykem.

3. **`Requestable = Yes`, ale chybí `Request channel`**  
   - Problém: služba je objednatelná jen formálně, uživatel neví kde požádat.  
   - Jak předejít: vlož validní URL do interního portálu/ITSM.

4. **Nevyplněné vlastnictví služby**  
   - Problém: bez ownera nelze řešit eskalace ani revize obsahu.  
   - Jak předejít: vyplň `Service owner` i `Review owner` pracovním e-mailem.

5. **Nekonzistentní SLA parametry**  
   - Problém: nereálné nebo rozporné hodnoty (`Availability 99.99%` a současně velmi dlouhé RTO).  
   - Jak předejít: slaď cílovou dostupnost, RTO/RPO a provozní model podpory.

6. **Špatný lifecycle stav při publikaci**  
   - Problém: služba je omylem označena jako `live` dříve, než je datově kompletní.  
   - Jak předejít: před publikací drž stav `under_review` a proveď kontrolu v kroku Review.

7. **Chybějící klasifikace (portfolio/doména)**  
   - Problém: služba se špatně filtruje a nepropíše se správně do reportingu.  
   - Jak předejít: vždy vyber minimálně jedno portfolio a relevantní domény.
