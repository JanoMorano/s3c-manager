# s3c-manager — Uživatelské scénáře

Tento dokument popisuje, k čemu slouží s3c-manager, a uvádí deset konkrétních scénářů použití z pohledu různých uživatelů.

---

## Co je s3c-manager?

s3c-manager je **ITIL-ready service catalogue** — centrální místo, kde organizace eviduje, řídí a zveřejňuje své IT služby. Aplikace propojuje pohled **byznys konzumenta** (co mohu objednat, od koho a za jak dlouho?) s pohledem **governance a techniky** (kdo za službu odpovídá, je připravená k provozu, prošla review?).

Aplikace je určena pro tři skupiny uživatelů:

- **Konzumenti služeb** — zaměstnanci, kteří hledají, co IT nabízí a jak to objednat.
- **Vlastníci a správci služeb** — lidé, kteří services udržují, dokumentují a atestují.
- **Governance, operace a management** — týmy, které řídí kvalitu katalogu, rozhodují o životním cyklu a sledují celkové zdraví IT portfolia.

---

## Scénář 1 — Zaměstnanec hledá, jak získat přístup k nástroji

**Persona:** Jana, nová analytička, první týden v práci.
**Cíl:** Zjistit, jak si zřídit přístup k analytickému nástroji, který kolega zmínil na stand-upu.

Jana otevře Service Catalogue (`/catalogue`) a zadá název nástroje do vyhledávání. Katalog jí zobrazí kartu služby s přehledným **Business View**: stručný popis, pro koho je služba určena, zda je requestable a jaký je očekávaný lead time. V sekci **Request & Eligibility** vidí, že přístup se žádá přes ServiceDesk ticketing systém, přičemž schválení trvá dva pracovní dny. Jana klikne na tlačítko „Objednat" a je přesměrována rovnou na request formulář.

**Co aplikace poskytla:** Jednu pravdivou odpověď místo prohledávání tří různých intranet stránek.

---

## Scénář 2 — Vlastník služby provádí pravidelnou atestaci

**Persona:** Martin, Service Owner skupiny HR aplikací.
**Cíl:** Jednou za kvartál potvrdit, že jeho služby jsou stále aktuální a připravené k provozu.

Martin otevře **My Tasks** (`/cockpit/my-tasks`). V sekci „Moje služby" vidí seznam služeb, které vlastní, seřazených podle termínu příštího review. U dvou služeb svítí oranžový indikátor — review je splatné tento týden. Martin klikne na první službu, zkontroluje vyplněné informace a v sekci Governance potvrdí atestaci s poznámkou. Druhá služba má zastaralý support model — Martin přejde do editoru, upraví resolver group a uloží změny přes `StickySaveBar`. Status readiness se ihned překlopí na zelený.

**Co aplikace poskytla:** Přehled povinností na jednom místě, přímý přístup k editaci bez zbytečných kliků.

---

## Scénář 3 — Governance manažer schvaluje přechod služby do stavu Live

**Persona:** Petra, ITSM Governance Lead.
**Cíl:** Rozhodnout, zda nová platební brána splňuje podmínky pro přechod z `approved` do `live`.

Petra otevře **Operations → Reviews** (`/operations/reviews`). Ve sloupci „Decision needed" leží review karta platební brány. Před otevřením action modalu systém automaticky spustí **pre-flight readiness check** — vidí, že ze 12 readiness pravidel jsou splněna pouze 10 a dvě kritická pole (SLA restoration time, support owner) jsou prázdná. Petra rozhodnutí neudělí hned — vybere status `deferred`, vyplní rationale, přiloží evidenci z Jiry a nastaví `defer_expires_at` na konec příštího sprintu. Vlastník služby uvidí konkrétní požadavky v review/governance frontě a v kontextu služby.

**Co aplikace poskytla:** Governance rozhodnutí s plnou auditní stopou — co chybělo, kdo rozhodl, do kdy musí být napraveno.

---

## Scénář 4 — Portfolio manažer hodnotí zdraví portfolia

**Persona:** Tomáš, Architecture Portfolio Manager.
**Cíl:** Připravit kvartální přehled zdraví portfolia „Zákaznické operace" pro CIO.

Tomáš otevře detail portfolia (`/portfolio/ZAK-OPS`). Stránka mu okamžitě ukáže: počet služeb, průměrnou readiness, počet nevyřešených governance rozhodnutí a přehled capability coverage — které schopnosti portfolia jsou pokryté, které chybí. V sekci „Nadcházející review" vidí tři služby, jejichž owner review vyprší do 14 dní. Tomáš exportuje data a přiloží screenshot do prezentace.

**Co aplikace poskytla:** Jednomístný přehled celého portfolia bez nutnosti sbírat data z více systémů.

---

## Scénář 5 — Architekt mapuje schopnosti na novou službu

**Persona:** Lucie, Enterprise Architect.
**Cíl:** Zajistit, že nová datová platforma pokrývá capability „Data Integration" a není zdvojením stávající služby.

Lucie otevře **Capabilities** (`/capabilities`), vybere capability „Data Integration" a zobrazí si coverage matrix. Vidí, které stávající služby tuto schopnost pokrývají — a s jakou vazbou (primary/secondary). Jedna ze služeb je ve stavu `deprecated`. Lucie přejde do editoru nové datové platformy (`/services/[id]/edit`), v sekci Capabilities přidá vazbu na „Data Integration" a v sekci C3 Mappings propojí service s příslušnou C3 taxonomickou položkou. Coverage matrix se okamžitě aktualizuje.

**Co aplikace poskytla:** Viditelnost překryvů a mezer před tím, než je nová služba nasazena.

---

## Scénář 6 — Operační inženýr řeší readiness blokery před release

**Persona:** Pavel, Release Manager.
**Cíl:** Zjistit, co brání dvěma plánovaným službám vstoupit do stavu `live` příští týden.

Pavel otevře **Operations → Readiness** (`/operations/readiness`). Dashboard mu zobrazí readiness grid — řádky jsou pravidla (SLA definováno, support owner přiřazen, C3 mapping existuje…), sloupce jsou služby. Červené buňky okamžitě ukazují, kde je blokér. Pavel rozklikne konkrétní pravidlo, vidí popis požadavku a tlačítko pro přidání výjimky (pokud je blokér dočasně akceptovatelný s odůvodněním). Oba blokéry odstraní ve spolupráci s vlastníky služeb ještě před release window.

**Co aplikace poskytla:** Přesný přehled co chybí, ne obecné „service není připravená".

---

## Scénář 7 — Vedoucí týmu kontroluje zatížení svých service ownerů

**Persona:** Radek, Head of Platform Engineering.
**Cíl:** Zjistit, zda je rozložení ownership spravedlivé a zda někdo není přetížen.

Radek otevře **Operations → Owner Load** (`/operations/owner-load`). Do vyhledávacího pole zadá jméno člena svého týmu. Stránka zobrazí KPI karty: počet přiřazených služeb, počet prosincových overdue reviews a počet readiness blokerů. Stacked workload bar ukazuje poměr „live, kritické, blokované, overdue" na první pohled. Radek vidí, že jeden kolega má 14 přiřazených služeb zatímco ostatní průměrně 4 — zahájí redistribuci ownership přes editor příslušných služeb.

**Co aplikace poskytla:** Datové podložení organizačního rozhodnutí, ne jen pocit.

---

## Scénář 8 — Správce C3 taxonomie aktualizuje entitu

**Persona:** Alena, C3 Taxonomy Administrator.
**Cíl:** Opravit popis a source status C3 aplikace „SAP FI" po auditu.

Alena otevře C3 entitu přes `/c3/applications/SAP-FI`. Stránka zobrazí standardní **Business View** s `PageHeader` a strukturovanými sekcemi (Klasifikace, Popis, Zdroj & stav, Vazby, Raw data) — přehledně uspořádanými díky `EditorSubNav` vlevo. Alena přejde do edit mode, upraví pole `ss_overall_status` a doplní `description_raw`. **StickySaveBar** jí na spodu obrazovky průběžně ukazuje stav „Neuložené změny". Po uložení se stav překlopí na „Uloženo" a readiness score nadřazených služeb se přepočítá.

**Co aplikace poskytla:** Bezpečnou editaci taxonomie se stavovým přehledem a auditní stopou.

---

## Scénář 9 — Analytik prohledává celý katalog pro interní audit

**Persona:** Michaela, Internal Auditor.
**Cíl:** Najít všechny služby ve stavu `deprecated` napříč celým katalogem a ověřit, zda mají definovaný termín vyřazení.

Michaela použije globální hledání v horní liště a filtry v `/services/list`, aby našla služby ve stavu `deprecated`. Výsledky ji vedou na konkrétní služby a související C3/capability evidence. Klikne na každou nalezenou službu a v Service 360 ověří, zda je vyplněno pole `next_review_due_at`. Tři služby pole nemají — Michaela zapíše findings do svého audit reportu.

**Co aplikace poskytla:** Rychlé průřezové hledání bez přístupu do databáze nebo exportu CSV.

---

## Scénář 10 — Service Designer navrhuje novou Service Offering variantu

**Persona:** Ondřej, IT Service Designer.
**Cíl:** Přidat k existující cloudové storage službě novou offering variantu pro enterprise zákazníky s vyšším SLA.

Ondřej otevře editor cloudové storage služby (`/services/[id]/edit`). V sekci **Offerings** klikne na „Přidat offering". Vyplní: název „Enterprise Tier", popis, příznak `requestable = true`, `approval_required = true`, lead time „3 pracovní dny", target audience „Enterprise segment", support tier „P1". V sekci **Support Model** propojí offering s resolver group „Cloud Ops Premium" a nastaví support hours „24/7". `StickySaveBar` průběžně drží stav „Neuložené změny" — Ondřej uloží jedním kliknutím. Nová offering se okamžitě zobrazí na detailu služby v záložce Offerings pro konzumenty.

**Co aplikace poskytla:** Strukturovaný způsob, jak rozšiřovat catalogue o nové varianty bez narušení stávající service definice.

---

## Co tedy s3c-manager nabízí?

| Potřeba | Řešení v aplikaci |
|---|---|
| Najít a objednat IT službu | Catalogue + Service Detail (Business View) |
| Spravovat a dokumentovat vlastní služby | Service Editor s EditorSubNav + StickySaveBar |
| Řídit lifecycle a governance | Operations Reviews + Decision Log |
| Sledovat readiness před release | Operations Readiness dashboard |
| Mapovat capabilities na služby | Capabilities hub + Coverage matrix |
| Hlídat ownership a zátěž | Owner Load detail |
| Přehled portfolia pro management | Portfolio stránka s KPI a coverage |
| Správa C3 taxonomie | C3 entity workspace (Applications, Data Objects, Services, TINs) |
| Rychlé průřezové vyhledávání | Globální hledání v horní liště + filtry v seznamech |
| Osobní přehled povinností | My Tasks s collapsible sekcemi |

---

*Dokument je součástí projektu s3c-manager. Poslední aktualizace: 2026-05-07.*
