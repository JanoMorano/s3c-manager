import type { Locale } from '@/app/i18n/messages';

export type HelpTopic = {
  slug: string;
  title: string;
  persona: string;
  outcome: string;
  body: string;
  next: string;
  href: string;
  tags: string[];
};

export type HelpSection = {
  id: string;
  title: string;
  topics: HelpTopic[];
};

export type HelpContent = {
  hero: {
    eyebrow: string;
    title: string;
    lead: string;
  };
  quickLinks: Array<[string, string]>;
  roleSection: {
    eyebrow: string;
    title: string;
    lead: string;
    cards: Array<{
      title: string;
      role: string;
      purpose: string;
      can: string[];
      start: string;
      action: string;
    }>;
  };
  outputsSection: {
    eyebrow: string;
    title: string;
    lead: string;
    items: Array<[string, string]>;
  };
  chapterEyebrow: string;
  metaLabels: {
    role: string;
    outcome: string;
    next: string;
  };
  sections: HelpSection[];
  tutorials: {
    eyebrow: string;
    title: string;
    lead: string;
    newServiceTitle: string;
    commonMistakesTitle: string;
    relationRulesTitle: string;
    adminTitle: string;
    newServiceSteps: Array<[string, string]>;
    commonMistakes: string[];
    relationRules: string[];
    adminChecks: string[];
  };
  audit: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
  };
  overlap: {
    eyebrow: string;
    title: string;
    paragraphs: string[];
    action: string;
  };
};

const topicDefinitions = [
  ['getting-started', 'help.getting-started.overview-roles', '/help#help.getting-started.overview-roles', ['start', 'roles', 'navigation']],
  ['getting-started', 'help.getting-started.first-login', '/help#help.getting-started.first-login', ['login', 'profile', 'locale']],
  ['getting-started', 'help.getting-started.basic-workflow', '/help#help.getting-started.basic-workflow', ['workflow', 'catalogue', 'detail']],
  ['services', 'help.services.search-filter', '/help#help.services.search-filter', ['services', 'filter', 'export']],
  ['services', 'help.services.service-detail', '/help#help.services.service-detail', ['service', 'detail', 'governance']],
  ['services', 'help.services.create-update', '/help#help.services.create-update', ['wizard', 'new service', 'editor']],
  ['services', 'help.services.lifecycle-history', '/help#help.services.lifecycle-history', ['lifecycle', 'history', 'audit']],
  ['linking', 'help.linking.relationship-basics', '/help#help.linking.relationship-basics', ['relations', 'dependency', 'workflow']],
  ['linking', 'help.linking.graph-navigation', '/help#help.linking.graph-navigation', ['graph', 'dependencies', 'impact']],
  ['linking', 'help.linking.c3-mapping', '/help#help.linking.c3-mapping', ['c3', 'fmn', 'capability']],
  ['evaluation', 'help.evaluation.operations-cockpit', '/help#help.evaluation.operations-cockpit', ['operations', 'kpi', 'risk']],
  ['evaluation', 'help.evaluation.governance-cockpit', '/help#help.evaluation.governance-cockpit', ['operations', 'governance', 'risk', 'owner', 'contract']],
  ['evaluation', 'help.evaluation.readiness', '/help#help.evaluation.readiness', ['readiness', 'publishable', 'compliance']],
  ['evaluation', 'help.evaluation.coverage-gaps', '/help#help.evaluation.coverage-gaps', ['coverage', 'overlap', 'gap']],
  ['data', 'help.data.imports', '/help#help.data.imports', ['import', 'csv', 'json', 'xlsx']],
  ['data', 'help.data.audit-trail', '/help#help.data.audit-trail', ['audit', 'traceability', 'decision']],
  ['data', 'help.data.exports', '/help#help.data.exports', ['export', 'reporting', 'stakeholders']],
  ['installation', 'help.installation.first-run', '/help#help.installation.first-run', ['install', 'admin', 'setup']],
  ['installation', 'help.installation.runtime-overview', '/help#help.installation.runtime-overview', ['runtime', 'environment', 'security']],
  ['installation', 'help.installation.backup-restore', '/help#help.installation.backup-restore', ['backup', 'restore', 'upgrade']],
  ['faq', 'help.faq.access-roles', '/help#help.faq.access-roles', ['access', 'roles', 'sso']],
  ['faq', 'help.faq.troubleshooting', '/help#help.faq.troubleshooting', ['troubleshooting', 'validation', 'import']],
  ['faq', 'help.faq.performance', '/help#help.faq.performance', ['performance', 'limits', 'health']],
] as const;

function withTopicMeta(
  sectionId: string,
  index: number,
  title: string,
  persona: string,
  outcome: string,
  body: string,
  next: string,
): HelpTopic {
  const definition = topicDefinitions.filter(([id]) => id === sectionId)[index];
  return {
    slug: definition[1],
    href: definition[2],
    tags: [...definition[3]],
    title,
    persona,
    outcome,
    body,
    next,
  };
}

function buildSections(sectionTitles: Record<string, string>, topics: Record<string, Array<Omit<HelpTopic, 'slug' | 'href' | 'tags'>>>): HelpSection[] {
  return Object.entries(sectionTitles).map(([id, title]) => ({
    id,
    title,
    topics: topics[id].map((topic, index) => withTopicMeta(id, index, topic.title, topic.persona, topic.outcome, topic.body, topic.next)),
  }));
}

const cs: HelpContent = {
  hero: {
    eyebrow: 'Nápověda aplikace',
    title: 'Help',
    lead: 'Český help pro S3C Manager podle informační architektury: role, katalog služeb, provazování, C3/FMN vyhodnocení, správa dat, instalace, provoz a FAQ.',
  },
  quickLinks: [['Začínáme', '#getting-started'], ['Služby', '#services'], ['Provazování', '#linking'], ['Výsledky', '#evaluation'], ['Data', '#data'], ['Instalace', '#installation'], ['FAQ', '#faq'], ['Tutoriály', '#tutorials']],
  roleSection: {
    eyebrow: 'Role a práva',
    title: 'Jak Help používat podle role',
    lead: 'Role určují oprávnění, persona určuje pracovní pohled. Všechny kapitoly níže mají stabilní slug, cílové role, očekávaný výstup a doporučený další krok.',
    cards: [
      { title: 'Pro uživatele', role: 'viewer / Consumer', purpose: 'Najít vhodnou službu, pochopit její hodnotu, SLA, podporu a cestu k vyžádání.', can: ['číst katalog, detail služby, dashboardy a grafy', 'používat request path a support kontakty', 'sledovat lifecycle a varování u deprecated/retired služeb'], start: '/catalogue', action: 'Otevřít výchozí oblast' },
      { title: 'Pro správce obsahu', role: 'editor / Service Owner', purpose: 'Zakládat a udržovat služby tak, aby byly publishable, requestable a správně navázané na C3.', can: ['zakládat služby přes wizard', 'editovat popis, vlastníky, SLA, offerings, support model a vazby', 'řešit importní chyby, readiness a auditované změny'], start: '/management', action: 'Otevřít výchozí oblast' },
      { title: 'Pro administrátora', role: 'admin / Administrator', purpose: 'Provozovat platformu, řídit účty, skupiny, SSO, moduly, instalaci, reference, importy a audit.', can: ['spravovat uživatele, skupiny a role', 'kontrolovat instalaci, seed data, upgrade a zálohy', 'publikovat a verzovat Help obsah podle release procesu'], start: '/administration', action: 'Otevřít výchozí oblast' },
    ],
  },
  outputsSection: {
    eyebrow: 'Výstupy pro firmu',
    title: 'Co z aplikace používat pro řízení',
    lead: 'Tyto výstupy jsou vhodné pro governance, portfolio management, audit, provozní plánování a rozhodování o konsolidaci.',
    items: [['Evidence služeb', 'Jeden zdroj pravdy pro službu, vlastníka, lifecycle, request channel, SLA, support a vazby.'], ['Readiness a publishability', 'Signály, zda je služba datově připravená k publikaci a kde má blokery.'], ['Coverage / gap / overlap', 'Podklady pro capability management: co je pokryté, co chybí a kde vznikají duplicity.'], ['Graf závislostí', 'Dopadová analýza mezi službami před změnou, migrací nebo vyřazením.'], ['Importní audit', 'Dohledatelnost: odkud data přišla, co se změnilo a které řádky vyžadují opravu.'], ['Konsolidační kandidáti', 'Výstup pro portfolio: kde lze sloučit, nahradit nebo omezit překrývající se řešení.']],
  },
  chapterEyebrow: 'Kapitola',
  metaLabels: { role: 'Role', outcome: 'Výstup', next: 'Další krok' },
  sections: buildSections(
    { 'getting-started': '1) Začínáme', services: '2) Práce se službami', linking: '3) Provazování', evaluation: '4) Vyhodnocení výsledků', data: '5) Správa dat', installation: '6) Instalace a provoz', faq: '7) FAQ' },
    {
      'getting-started': [
        { title: 'Přehled aplikace a role', persona: 'admin, operátor, analytik', outcome: 'Uživatel rozumí rozdílům rolí a orientuje se v hlavní navigaci.', body: 'Aplikace spojuje Service Catalogue, C3 taxonomy, capability mapy, importy a audit do jednoho pracovního místa. Role určují oprávnění; persona určuje pracovní perspektivu.', next: 'help.getting-started.first-login' },
        { title: 'První přihlášení a nastavení profilu', persona: 'admin, operátor, analytik', outcome: 'Umí se přihlásit, změnit jazyk, nastavit profil a ověřit oprávnění.', body: 'Jazyk a persona se spravují na /user-info. Aplikace používá uživatelskou preferenci, cookie sc_locale, Accept-Language a fallback cs; URL nemají jazykové prefixy.', next: 'help.services.catalog-basics' },
        { title: 'Základní workflow práce v katalogu', persona: 'operátor, analytik', outcome: 'Umí vyhledat službu, otevřít detail a zkontrolovat vazby.', body: 'Začněte v /services/list, filtrujte podle názvu, domény, lifecycle nebo requestable, otevřete detail a ověřte Overview, Request & Eligibility, Support, Dependencies, Governance a Audit.', next: 'help.services.search-filter' },
      ],
      services: [
        { title: 'Vyhledávání a filtrování služeb', persona: 'operátor, analytik', outcome: 'Umí rychle najít službu podle názvu, domény, stavu nebo vlastníka.', body: 'Seznam služeb podporuje fulltext, filtry status, portfolio, type, lifecycle, requestable a domain, URL-persisted filtry, sorting, density toggle, CSV export a uložené pohledy.', next: 'help.services.service-detail' },
        { title: 'Detail služby a governance pole', persona: 'operátor, analytik', outcome: 'Umí interpretovat stav služby, SLA, vlastníky a auditní kontext.', body: 'Detail ukazuje header summary, consumer value, offerings, request path, support model, dependency graph, C3 mappings, completeness score, readiness checks a audit log.', next: 'help.services.create-update' },
        { title: 'Založení a editace služby', persona: 'editor, admin', outcome: 'Umí vytvořit nebo aktualizovat službu včetně povinných polí a validace.', body: 'Wizard vede přes Identity, Description, Access, Classification, Ownership, SLA, C3 Mapping a Review. Po uložení editor doplní offerings, support model a operational links.', next: 'help.linking.relationship-basics' },
        { title: 'Životní cyklus a změnová historie', persona: 'admin, operátor', outcome: 'Umí sledovat historické změny a rozhodnout o dalším governance kroku.', body: 'Lifecycle stavy jsou draft, under_review, approved, live, deprecated a retired. Přechod do live blokují minimální completeness požadavky; deprecated/retired se zobrazují s varováním.', next: 'help.evaluation.readiness' },
      ],
      linking: [
        { title: 'Typy vazeb mezi službami', persona: 'editor, analytik', outcome: 'Umí založit správný typ relace a chápe dopad na graf závislostí.', body: 'Nejprve nastavte klienta a eligibility, potom workflow a provozní odkazy, nakonec závislosti. Relace zahrnují depends_on, prerequisite, underlying, uses, provides, replaces, integrates_with a related_to.', next: 'help.linking.graph-navigation' },
        { title: 'Navigace v grafu závislostí', persona: 'analytik, editor', outcome: 'Umí číst graf, filtrovat uzly a sledovat upstream/downstream dopady.', body: 'Globální graf má connector type, line style, C3 Taxonomy overlay, Flavours overlay a PDF export. Detailní graf služby používá hloubku 1-3 podle šíře dopadové analýzy.', next: 'help.linking.c3-mapping' },
        { title: 'Mapování na C3/FMN capability', persona: 'analytik, admin', outcome: 'Umí propojit službu na capability a ověřit konzistenci mapování.', body: 'Služba má mít jednoznačné primární C3 mapování. C3 detail ukazuje hierarchy, classification, data quality, source a linked services; capability mapy Spiral 6/7 ukazují kontext pokrytí.', next: 'help.evaluation.coverage-gaps' },
      ],
      evaluation: [
        { title: 'Provozní cockpit a KPI', persona: 'analytik, admin', outcome: 'Umí číst KPI, prioritizovat rizika a připravit akční seznam.', body: 'Operations sleduje neúplná metadata, chybějící vlastníky, pricing coverage, deprecated/retired služby a C3 mapping gaps. Dashboardy nejsou jen počítadla; vedou na problematické položky.', next: 'help.evaluation.readiness' },
        { title: 'Service governance cockpit', persona: 'analytik, admin, service owner', outcome: 'Umí použít Risk Radar, Owner Load Monitor, Contract Overlap a Advisor pro řízení služeb.', body: 'Governance Cockpit v /operations ukazuje rizika služeb, přetížené vlastníky, překryvy smluv a doporučené akce. P0 řešte hned, P1 plánujte do nejbližší governance revize a P2 používejte pro konsolidaci a doplňování evidence.', next: 'help.evaluation.readiness' },
        { title: 'Readiness, rizika a compliance signály', persona: 'analytik, admin', outcome: 'Umí vyhodnotit připravenost služby a identifikovat kritické nedostatky.', body: 'Publish readiness vychází ze služby, C3 mapování, flavours a relations. is_publishable = TRUE pouze pokud platí současně: jedno primární mapování, complete primární capability a aktivní flavour.', next: 'help.evaluation.coverage-gaps' },
        { title: 'Coverage / overlap / gap analýza', persona: 'analytik', outcome: 'Umí interpretovat mezery, duplicity a návrhy konsolidace.', body: 'C3 dashboard počítá mapped_items / total_items a coverage řádku jako mapped / value. Overlap znamená, že více služeb nebo aplikací podporuje stejnou capability; je to signál ke kontrole, ne automaticky chyba.', next: 'help.data.exports' },
      ],
      data: [
        { title: 'Import dat (CSV/JSON/XLSX) - dry-run a commit', persona: 'admin, editor', outcome: 'Umí připravit import, vyhodnotit chyby z dry-runu a provést commit.', body: 'Import pipeline je parse -> normalize -> taxonomy resolve -> upsert -> audit log -> batch summary. Podporuje Service Catalogue CSV/JSON, C3 CSV/JSON/XLSX, FMN Spirals a ArchiMate XML pro C3 cíle.', next: 'help.data.audit-trail' },
        { title: 'Auditní stopa a dohledatelnost změn', persona: 'admin, analytik', outcome: 'Umí dohledat kdo, kdy a co změnil a podložit rozhodnutí evidencí.', body: 'Auditní vysvětlení má popsat načtení entity, primární mapování, completeness capability, aktivní flavours, složení rozhodnutí a persistovanou stopu v audit logu.', next: 'help.data.exports' },
        { title: 'Exporty a sdílení výsledků', persona: 'analytik, admin', outcome: 'Umí exportovat relevantní data pro reporting a stakeholdery.', body: 'Pro reporting používejte filtrovaný export ze seznamu služeb, graf závislostí, coverage/gap výstupy, import audit a měsíční KPI report z pilotního nebo provozního režimu.', next: 'help.installation.runtime-overview' },
      ],
      installation: [
        { title: 'Instalační průvodce a první admin účet', persona: 'admin', outcome: 'Umí bezpečně dokončit první spuštění a inicializaci systému.', body: 'Připravte .env, spusťte docker compose up -d, otevřete /install, vytvořte první admin účet, vyberte moduly, případně nahrajte seed/import data a ověřte stav READY.', next: 'help.installation.runtime-overview' },
        { title: 'Provozní režimy a konfigurace prostředí', persona: 'admin', outcome: 'Umí nastavit runtime proměnné, moduly a základní bezpečnostní parametry.', body: 'Minimálně nastavte JWT_SECRET, DB_PASSWORD a POSTGRES_PASSWORD. Pro sdílené prostředí zapněte INSTALL_SETUP_TOKEN, používejte HTTPS a ověřte DB konektivitu, porty a health endpointy.', next: 'help.installation.backup-restore' },
        { title: 'Záloha, obnova a upgrade', persona: 'admin', outcome: 'Umí naplánovat zálohování, obnovu a bezpečný upgrade.', body: 'Před releasem a větším importem spusťte ./scripts/backup-postgres.sh. Obnova používá ./scripts/restore-postgres.sh --file <dump>. deploy.sh rebuild-db není náhrada backup/restore procesu.', next: 'help.faq.troubleshooting' },
      ],
      faq: [
        { title: 'Nejčastější dotazy k přístupům a rolím', persona: 'admin, editor', outcome: 'Umí rychle vyřešit běžné problémy s přihlášením a oprávněními.', body: 'Když se nezobrazí Administration, ověřte roli uživatele a obnovte stránku. U SSO zkontrolujte trusted proxy hlavičky, sdílené tajemství a mapování principal/display/email headerů.', next: 'help.faq.troubleshooting' },
        { title: 'Troubleshooting importů a validací', persona: 'admin, editor', outcome: 'Umí diagnostikovat běžné chyby importu a zvolit správnou nápravu.', body: 'taxonomy_unresolved řešte kontrolou referenčních kódů. Před importem udělejte dry-run a zálohu, po importu zkontrolujte import_batch, rows_failed, import_issue a vzorek dat v UI.', next: 'help.faq.performance' },
        { title: 'Výkon, limity a doporučené postupy', persona: 'admin, analytik', outcome: 'Umí rozpoznat výkonové limity a aplikovat provozní doporučení.', body: 'Pro produkci počítejte alespoň 2 vCPU / 4 GB RAM, doporučeně 4 vCPU / 8 GB RAM a 10 GB místa. Sledujte /api/health/live, /api/health/ready a /api/health/import.', next: 'help.getting-started.overview-roles' },
      ],
    },
  ),
  tutorials: {
    eyebrow: 'Praktické postupy',
    title: 'Tutoriály',
    lead: 'Postupy vycházejí z detailních dokumentů v /docs a doplňují IA kapitoly o konkrétní kontrolní body.',
    newServiceTitle: 'Jak vytvořit záznam v katalogu služeb',
    commonMistakesTitle: 'Nejčastější chyby při zadání služby',
    relationRulesTitle: 'Jak správně tvořit vazby',
    adminTitle: 'Jak se o Help a aplikaci stará admin',
    newServiceSteps: [['Identity', 'Service ID: SVC-NET-001; Title: Bezpečný vzdálený přístup VPN; Type: business_service; Status: active; Lifecycle: under_review. Kontrola: bez validačních chyb a aktivní Next.'], ['Description', 'Short description, Business summary a Consumer value musí vysvětlit účel i hodnotu pro uživatele, ne jen technický název.'], ['Access', 'Requestable, Request channel, Approval required, Lead time a Audience / Eligibility určují, jestli lze službu opravdu objednat.'], ['Classification', 'Portfolio, Domains a Service lines dávají službě reportingový a odpovědnostní kontext.'], ['Ownership', 'Service owner, Review owner a Next review date určují odpovědnost a pravidelnou kontrolu kvality.'], ['SLA', 'Availability, RTO, RPO, Support hours, Support tier a Support channel musí odpovídat reálnému provoznímu modelu.'], ['C3 Mapping', 'Pokud je C3 aktivní, vyberte capability/entity a ověřte, že mapování dává věcný smysl.'], ['Review', 'Před uložením zkontrolujte ID, ownera, request channel, SLA a lifecycle; po uložení službu najdete v /services/list.']],
    commonMistakes: ['Neunikátní nebo nečitelné Service ID; používejte stabilní konvenci typu SVC-<DOMENA>-<CISLO>.', 'Příliš obecný název a popis; doplňte Business summary a Consumer value konkrétním jazykem.', 'Requestable = Yes, ale chybí Request channel; vložte validní URL do portálu nebo ITSM.', 'Nevyplněné vlastnictví služby; bez ownera nelze řešit eskalace ani revize.', 'Nekonzistentní SLA parametry; slaďte dostupnost, RTO/RPO a support model.', 'Špatný lifecycle stav při publikaci; live nastavujte až po kontrole readiness.', 'Chybějící klasifikace portfolio/doména; služba se pak špatně filtruje a reportuje.'],
    relationRules: ['Objekt ukládejte jako operational link na úrovni služby nebo offeringu stejné služby.', 'Klientský kontext a eligibility patří do audience policy; service-level i offering-level pravidla lze kombinovat.', 'Workflow držte primárně v request channelu a doplňte runbooky, BPMN nebo approval flow jako operational links.', 'Dependency relace nesmí být self-loop a aktivní kombinace from + to + relation type + pace je unikátní.', 'Odpojení dependency relace je soft delete; auditní stopa zůstává zachovaná.'],
    adminChecks: ['Content owner, Reviewer, Approver: vlastník potvrzuje správnost, reviewer věcně kontroluje a approver publikuje.', 'Help obsah revidujte měsíčně a povinně po každém patch/minor/major releasu.', 'Každá publikovaná verze má uvést Documentation version a Compatible with application.', 'Uživatelé se spravují v /administration/users; skupiny v /admin/groups; web/SSO v /administration/web.', 'Reference katalogu jsou v /admin/catalogue-ref, C3 reference v /admin/c3-ref.'],
  },
  audit: {
    eyebrow: 'Auditní vysvětlení výsledku',
    title: 'Proč vyšel tento výsledek',
    paragraphs: ['U publishability vysvětlete, zda služba má právě jedno primární C3 mapování, zda je primární capability complete a zda existuje active/available flavour. Pokud některá odpověď chybí, služba není publishable.', 'V auditní stopě uveďte načtenou službu, primary_mapping_count, primary_c3_uuid, completeness_status, active_flavour_count a odkazy na platform.audit_log, taxonomy_mapping_audit nebo graph_layout_audit.'],
  },
  overlap: {
    eyebrow: 'Překryv aplikací',
    title: 'Co znamená překryv',
    paragraphs: ['Překryv vzniká, když více služeb nebo aplikací podporuje stejnou schopnost, podobný proces, stejná data nebo podobnou technologickou interakci. Může jít o záměrnou redundanci, ale bez věcného důvodu je to kandidát na racionalizaci.'],
    action: 'Otevřít consolidation matrix',
  },
};

function localize(base: HelpContent, overrides: Partial<HelpContent>): HelpContent {
  return { ...base, ...overrides } as HelpContent;
}

const en = localize(cs, {
  hero: { eyebrow: 'Application Help', title: 'Help', lead: 'English help for S3C Manager based on the information architecture: roles, service catalogue, linking, C3/FMN evaluation, data management, installation, operations, and FAQ.' },
  quickLinks: [['Getting Started', '#getting-started'], ['Services', '#services'], ['Linking', '#linking'], ['Results', '#evaluation'], ['Data', '#data'], ['Installation', '#installation'], ['FAQ', '#faq'], ['Tutorials', '#tutorials']],
  roleSection: {
    eyebrow: 'Roles and Permissions',
    title: 'How to use Help by role',
    lead: 'Roles define permissions; personas define the working perspective. Every chapter below has a stable slug, target roles, learning outcome, and next step.',
    cards: [
      { title: 'For Users', role: 'viewer / Consumer', purpose: 'Find the right service and understand its value, SLA, support, and request path.', can: ['read catalogue, service detail, dashboards, and graphs', 'use request paths and support contacts', 'watch lifecycle warnings for deprecated or retired services'], start: '/catalogue', action: 'Open starting area' },
      { title: 'For Content Managers', role: 'editor / Service Owner', purpose: 'Create and maintain services so they are publishable, requestable, and correctly linked to C3.', can: ['create services through the wizard', 'edit description, owners, SLA, offerings, support model, and relations', 'resolve import issues, readiness blockers, and audited changes'], start: '/management', action: 'Open starting area' },
      { title: 'For Administrators', role: 'admin / Administrator', purpose: 'Operate the platform and manage users, groups, SSO, modules, installation, references, imports, and audit.', can: ['manage users, groups, and roles', 'check installation, seed data, upgrades, and backups', 'publish and version Help content through the release process'], start: '/administration', action: 'Open starting area' },
    ],
  },
  outputsSection: { eyebrow: 'Business Outputs', title: 'What to use from the application for management', lead: 'These outputs support governance, portfolio management, audit, operations planning, and consolidation decisions.', items: [['Service evidence', 'Single source of truth for service, owner, lifecycle, request channel, SLA, support, and relations.'], ['Readiness and publishability', 'Signals showing whether a service is data-ready for publication and where blockers remain.'], ['Coverage / gap / overlap', 'Inputs for capability management: what is covered, what is missing, and where duplications appear.'], ['Dependency graph', 'Impact analysis between services before change, migration, or retirement.'], ['Import audit', 'Traceability: where data came from, what changed, and which rows need correction.'], ['Consolidation candidates', 'Portfolio output showing where overlapping solutions can be merged, replaced, or reduced.']] },
  chapterEyebrow: 'Chapter',
  metaLabels: { role: 'Role', outcome: 'Outcome', next: 'Next step' },
  sections: buildSections(
    { 'getting-started': '1) Getting Started', services: '2) Working With Services', linking: '3) Linking', evaluation: '4) Result Evaluation', data: '5) Data Management', installation: '6) Installation and Operations', faq: '7) FAQ' },
    {
      'getting-started': [
        { title: 'Application overview and roles', persona: 'admin, operator, analyst', outcome: 'The user understands role differences and the main navigation.', body: 'The application brings Service Catalogue, C3 taxonomy, capability maps, imports, and audit into one working place. Roles define permissions; personas define the daily perspective.', next: 'help.getting-started.first-login' },
        { title: 'First sign-in and profile setup', persona: 'admin, operator, analyst', outcome: 'Can sign in, change language, set profile, and verify permissions.', body: 'Language and persona are managed on /user-info. The app uses user preference, sc_locale cookie, Accept-Language, and cs fallback; URLs have no locale prefixes.', next: 'help.services.catalog-basics' },
        { title: 'Basic catalogue workflow', persona: 'operator, analyst', outcome: 'Can search for a service, open detail, and check relations.', body: 'Start at /services/list, filter by name, domain, lifecycle, or requestable, then open detail and review Overview, Request & Eligibility, Support, Dependencies, Governance, and Audit.', next: 'help.services.search-filter' },
      ],
      services: [
        { title: 'Searching and filtering services', persona: 'operator, analyst', outcome: 'Can quickly find a service by name, domain, status, or owner.', body: 'The services list supports full text, status, portfolio, type, lifecycle, requestable and domain filters, URL-persisted filters, sorting, density toggle, CSV export, and saved views.', next: 'help.services.service-detail' },
        { title: 'Service detail and governance fields', persona: 'operator, analyst', outcome: 'Can interpret service status, SLA, owners, and audit context.', body: 'Detail shows header summary, consumer value, offerings, request path, support model, dependency graph, C3 mappings, completeness score, readiness checks, and audit log.', next: 'help.services.create-update' },
        { title: 'Creating and updating a service', persona: 'editor, admin', outcome: 'Can create or update a service including mandatory fields and validation.', body: 'The wizard walks through Identity, Description, Access, Classification, Ownership, SLA, C3 Mapping, and Review. After save, the editor enriches offerings, support model, and operational links.', next: 'help.linking.relationship-basics' },
        { title: 'Lifecycle and change history', persona: 'admin, operator', outcome: 'Can track historical changes and decide the next governance step.', body: 'Lifecycle states are draft, under_review, approved, live, deprecated, and retired. Moving to live is blocked by minimum completeness requirements; deprecated/retired services show warnings.', next: 'help.evaluation.readiness' },
      ],
      linking: [
        { title: 'Types of service relations', persona: 'editor, analyst', outcome: 'Can create the correct relation type and understand graph impact.', body: 'Set client and eligibility first, then workflow and operational links, then dependencies. Relations include depends_on, prerequisite, underlying, uses, provides, replaces, integrates_with, and related_to.', next: 'help.linking.graph-navigation' },
        { title: 'Dependency graph navigation', persona: 'analyst, editor', outcome: 'Can read the graph, filter nodes, and follow upstream/downstream impact.', body: 'The global graph has connector type, line style, C3 Taxonomy overlay, Flavours overlay, and PDF export. A service graph uses depth 1-3 depending on analysis breadth.', next: 'help.linking.c3-mapping' },
        { title: 'Mapping to C3/FMN capability', persona: 'analyst, admin', outcome: 'Can link a service to capability and validate mapping consistency.', body: 'A service should have one clear primary C3 mapping. C3 detail shows hierarchy, classification, data quality, source, and linked services; Spiral 6/7 maps show coverage context.', next: 'help.evaluation.coverage-gaps' },
      ],
      evaluation: [
        { title: 'Operations cockpit and KPI', persona: 'analyst, admin', outcome: 'Can read KPIs, prioritize risks, and prepare an action list.', body: 'Operations tracks incomplete metadata, missing owners, pricing coverage, deprecated/retired services, and C3 mapping gaps. Dashboards are navigation into problem items, not only counters.', next: 'help.evaluation.readiness' },
        { title: 'Service governance cockpit', persona: 'analyst, admin, service owner', outcome: 'Can use Risk Radar, Owner Load Monitor, Contract Overlap, and Advisor to govern services.', body: 'The Governance Cockpit in /operations shows service risks, overloaded owners, contract overlaps, and recommended actions. Treat P0 as immediate action, plan P1 for the next governance review, and use P2 for consolidation and evidence completion.', next: 'help.evaluation.readiness' },
        { title: 'Readiness, risks, and compliance signals', persona: 'analyst, admin', outcome: 'Can evaluate service readiness and identify critical gaps.', body: 'Publish readiness is derived from service data, C3 mapping, flavours, and relations. is_publishable = TRUE only when all conditions are met: one primary mapping, complete primary capability, and active flavour.', next: 'help.evaluation.coverage-gaps' },
        { title: 'Coverage / overlap / gap analysis', persona: 'analyst', outcome: 'Can interpret gaps, duplications, and consolidation proposals.', body: 'C3 dashboard calculates mapped_items / total_items and row coverage as mapped / value. Overlap means multiple services or applications support the same capability; it is a review signal, not automatically an error.', next: 'help.data.exports' },
      ],
      data: [
        { title: 'Data import (CSV/JSON/XLSX) - dry-run and commit', persona: 'admin, editor', outcome: 'Can prepare import, review dry-run errors, and commit.', body: 'Import pipeline is parse -> normalize -> taxonomy resolve -> upsert -> audit log -> batch summary. It supports Service Catalogue CSV/JSON, C3 CSV/JSON/XLSX, FMN Spirals, and ArchiMate XML for C3 targets.', next: 'help.data.audit-trail' },
        { title: 'Audit trail and traceability', persona: 'admin, analyst', outcome: 'Can trace who changed what and when, and support decisions with evidence.', body: 'Audit explanation should cover entity loading, primary mapping, capability completeness, active flavours, decision composition, and persisted audit trail.', next: 'help.data.exports' },
        { title: 'Exports and sharing results', persona: 'analyst, admin', outcome: 'Can export relevant data for reporting and stakeholders.', body: 'Use filtered service-list export, dependency graph, coverage/gap outputs, import audit, and monthly KPI report from pilot or operational mode.', next: 'help.installation.runtime-overview' },
      ],
      installation: [
        { title: 'Installation wizard and first admin account', persona: 'admin', outcome: 'Can safely complete first run and system initialization.', body: 'Prepare .env, run docker compose up -d, open /install, create the first admin account, select modules, optionally load seed/import data, and verify READY.', next: 'help.installation.runtime-overview' },
        { title: 'Runtime modes and environment configuration', persona: 'admin', outcome: 'Can configure runtime variables, modules, and base security.', body: 'At minimum set JWT_SECRET, DB_PASSWORD, and POSTGRES_PASSWORD. For shared environments enable INSTALL_SETUP_TOKEN, use HTTPS, and verify DB connectivity, ports, and health endpoints.', next: 'help.installation.backup-restore' },
        { title: 'Backup, restore, and upgrade', persona: 'admin', outcome: 'Can plan backup, restore, and safe upgrade.', body: 'Before a release or large import run ./scripts/backup-postgres.sh. Restore uses ./scripts/restore-postgres.sh --file <dump>. deploy.sh rebuild-db is not a backup/restore replacement.', next: 'help.faq.troubleshooting' },
      ],
      faq: [
        { title: 'Common access and role questions', persona: 'admin, editor', outcome: 'Can quickly solve common sign-in and permission issues.', body: 'If Administration is missing, verify the user role and reload. For SSO, check trusted proxy headers, shared secret, and principal/display/email header mapping.', next: 'help.faq.troubleshooting' },
        { title: 'Troubleshooting imports and validation', persona: 'admin, editor', outcome: 'Can diagnose common import errors and choose the right fix.', body: 'Resolve taxonomy_unresolved by checking reference codes. Before import run dry-run and backup; after import check import_batch, rows_failed, import_issue, and a UI sample.', next: 'help.faq.performance' },
        { title: 'Performance, limits, and recommended practices', persona: 'admin, analyst', outcome: 'Can identify limits and apply operating recommendations.', body: 'For production plan at least 2 vCPU / 4 GB RAM, recommended 4 vCPU / 8 GB RAM and 10 GB storage. Watch /api/health/live, /api/health/ready, and /api/health/import.', next: 'help.getting-started.overview-roles' },
      ],
    },
  ),
  tutorials: {
    ...cs.tutorials,
    eyebrow: 'Practical Guides',
    title: 'Tutorials',
    lead: 'These workflows come from the detailed /docs material and add concrete checkpoints to the IA chapters.',
    newServiceTitle: 'How to create a service catalogue record',
    commonMistakesTitle: 'Common mistakes when entering a service',
    relationRulesTitle: 'How to create relations correctly',
    adminTitle: 'How admin maintains Help and the application',
    newServiceSteps: [['Identity', 'Service ID: SVC-NET-001; Title: Secure Remote VPN Access; Type: business_service; Status: active; Lifecycle: under_review. Check: no validation errors and Next is enabled.'], ['Description', 'Short description, Business summary, and Consumer value must explain purpose and user value, not only the technical name.'], ['Access', 'Requestable, Request channel, Approval required, Lead time, and Audience / Eligibility define whether the service is truly orderable.'], ['Classification', 'Portfolio, Domains, and Service lines provide reporting and accountability context.'], ['Ownership', 'Service owner, Review owner, and Next review date define accountability and regular quality review.'], ['SLA', 'Availability, RTO, RPO, Support hours, Support tier, and Support channel must match the real operating model.'], ['C3 Mapping', 'If C3 is active, select capability/entity and verify that the mapping is semantically correct.'], ['Review', 'Before saving, check ID, owner, request channel, SLA, and lifecycle; after saving the service appears in /services/list.']],
    commonMistakes: ['Non-unique or unreadable Service ID; use a stable convention such as SVC-<DOMAIN>-<NUMBER>.', 'Too generic name and description; add concrete Business summary and Consumer value.', 'Requestable = Yes but Request channel is missing; add a valid portal or ITSM URL.', 'Missing ownership; without owner, escalation and reviews do not work.', 'Inconsistent SLA parameters; align availability, RTO/RPO, and support model.', 'Wrong lifecycle at publication; set live only after readiness review.', 'Missing portfolio/domain classification; the service becomes hard to filter and report.'],
    relationRules: ['Store objects as operational links at service level or offering level of the same service.', 'Client context and eligibility belong to audience policy; service-level and offering-level rules can be combined.', 'Keep workflow primarily in request channel and add runbooks, BPMN, or approval flow as operational links.', 'Dependency relation must not be a self-loop and active from + to + relation type + pace is unique.', 'Disconnecting a dependency relation is soft delete; audit trail remains.'],
    adminChecks: ['Content owner, Reviewer, Approver: owner confirms correctness, reviewer checks content, approver publishes.', 'Review Help monthly and after every patch/minor/major release.', 'Every published version must state Documentation version and Compatible with application.', 'Users are managed in /administration/users; groups in /admin/groups; web/SSO in /administration/web.', 'Catalogue references are in /admin/catalogue-ref, C3 references in /admin/c3-ref.'],
  },
  audit: { eyebrow: 'Audit explanation of a result', title: 'Why this result was produced', paragraphs: ['For publishability, explain whether the service has exactly one primary C3 mapping, whether the primary capability is complete, and whether an active/available flavour exists. If one answer is missing, the service is not publishable.', 'In the audit trail include loaded service, primary_mapping_count, primary_c3_uuid, completeness_status, active_flavour_count, and links to platform.audit_log, taxonomy_mapping_audit, or graph_layout_audit.'] },
  overlap: { eyebrow: 'Application overlap', title: 'What overlap means', paragraphs: ['Overlap appears when several services or applications support the same capability, similar process, same data, or similar technology interaction. It can be intentional redundancy, but without a business reason it is a rationalization candidate.'], action: 'Open consolidation matrix' },
});

const sk = localize(en, {
  hero: { eyebrow: 'Pomoc aplikácie', title: 'Help', lead: 'Slovenská pomoc pre S3C Manager podľa informačnej architektúry: roly, katalóg služieb, prepájanie, C3/FMN vyhodnotenie, správa dát, inštalácia, prevádzka a FAQ.' },
  quickLinks: [['Začíname', '#getting-started'], ['Služby', '#services'], ['Prepájanie', '#linking'], ['Výsledky', '#evaluation'], ['Dáta', '#data'], ['Inštalácia', '#installation'], ['FAQ', '#faq'], ['Tutoriály', '#tutorials']],
  roleSection: { ...en.roleSection, eyebrow: 'Roly a oprávnenia', title: 'Ako používať Help podľa role', lead: 'Roly určujú oprávnenia, persona určuje pracovný pohľad. Každá kapitola má stabilný slug, cieľové roly, očakávaný výstup a ďalší krok.' },
  chapterEyebrow: 'Kapitola',
  metaLabels: { role: 'Rola', outcome: 'Výstup', next: 'Ďalší krok' },
  sections: buildSections(
    { 'getting-started': '1) Začíname', services: '2) Práca so službami', linking: '3) Prepájanie', evaluation: '4) Vyhodnotenie výsledkov', data: '5) Správa dát', installation: '6) Inštalácia a prevádzka', faq: '7) FAQ' },
    {
      'getting-started': en.sections[0].topics.map((t) => ({ ...t, persona: t.persona.replace('operator', 'operátor').replace('analyst', 'analytik'), title: t.title.replace('Application overview and roles', 'Prehľad aplikácie a roly').replace('First sign-in and profile setup', 'Prvé prihlásenie a nastavenie profilu').replace('Basic catalogue workflow', 'Základný workflow práce v katalógu') })),
      services: en.sections[1].topics.map((t) => ({ ...t, title: t.title.replace('Searching and filtering services', 'Vyhľadávanie a filtrovanie služieb').replace('Service detail and governance fields', 'Detail služby a governance polia').replace('Creating and updating a service', 'Založenie a úprava služby').replace('Lifecycle and change history', 'Životný cyklus a história zmien') })),
      linking: en.sections[2].topics.map((t) => ({ ...t, title: t.title.replace('Types of service relations', 'Typy väzieb medzi službami').replace('Dependency graph navigation', 'Navigácia v grafe závislostí').replace('Mapping to C3/FMN capability', 'Mapovanie na C3/FMN capability') })),
      evaluation: en.sections[3].topics.map((t) => ({ ...t, title: t.title.replace('Operations cockpit and KPI', 'Prevádzkový cockpit a KPI').replace('Service governance cockpit', 'Governance cockpit služieb').replace('Readiness, risks, and compliance signals', 'Readiness, riziká a compliance signály').replace('Coverage / overlap / gap analysis', 'Coverage / overlap / gap analýza') })),
      data: en.sections[4].topics.map((t) => ({ ...t, title: t.title.replace('Data import (CSV/JSON/XLSX) - dry-run and commit', 'Import dát (CSV/JSON/XLSX) - dry-run a commit').replace('Audit trail and traceability', 'Auditná stopa a dohľadateľnosť zmien').replace('Exports and sharing results', 'Exporty a zdieľanie výsledkov') })),
      installation: en.sections[5].topics.map((t) => ({ ...t, title: t.title.replace('Installation wizard and first admin account', 'Inštalačný sprievodca a prvý admin účet').replace('Runtime modes and environment configuration', 'Prevádzkové režimy a konfigurácia prostredia').replace('Backup, restore, and upgrade', 'Záloha, obnova a upgrade') })),
      faq: en.sections[6].topics.map((t) => ({ ...t, title: t.title.replace('Common access and role questions', 'Najčastejšie otázky k prístupom a rolám').replace('Troubleshooting imports and validation', 'Troubleshooting importov a validácií').replace('Performance, limits, and recommended practices', 'Výkon, limity a odporúčané postupy') })),
    },
  ),
});

const de = localize(en, {
  hero: { eyebrow: 'Anwendungshilfe', title: 'Help', lead: 'Deutsche Hilfe für S3C Manager nach Informationsarchitektur: Rollen, Servicekatalog, Verknüpfung, C3/FMN-Auswertung, Datenverwaltung, Installation, Betrieb und FAQ.' },
  quickLinks: [['Erste Schritte', '#getting-started'], ['Services', '#services'], ['Verknüpfung', '#linking'], ['Ergebnisse', '#evaluation'], ['Daten', '#data'], ['Installation', '#installation'], ['FAQ', '#faq'], ['Tutorials', '#tutorials']],
  roleSection: { ...en.roleSection, eyebrow: 'Rollen und Berechtigungen', title: 'Help nach Rolle verwenden', lead: 'Rollen definieren Berechtigungen, Personas die Arbeitsperspektive. Jedes Kapitel hat stabilen Slug, Zielrollen, Lernziel und nächsten Schritt.' },
  chapterEyebrow: 'Kapitel',
  metaLabels: { role: 'Rolle', outcome: 'Ergebnis', next: 'Nächster Schritt' },
  sections: buildSections(
    { 'getting-started': '1) Erste Schritte', services: '2) Arbeiten mit Services', linking: '3) Verknüpfung', evaluation: '4) Ergebnisauswertung', data: '5) Datenverwaltung', installation: '6) Installation und Betrieb', faq: '7) FAQ' },
    {
      'getting-started': en.sections[0].topics.map((t) => ({ ...t, title: t.title.replace('Application overview and roles', 'Anwendungsüberblick und Rollen').replace('First sign-in and profile setup', 'Erste Anmeldung und Profileinrichtung').replace('Basic catalogue workflow', 'Grundlegender Katalog-Workflow') })),
      services: en.sections[1].topics.map((t) => ({ ...t, title: t.title.replace('Searching and filtering services', 'Services suchen und filtern').replace('Service detail and governance fields', 'Service-Detail und Governance-Felder').replace('Creating and updating a service', 'Service erstellen und aktualisieren').replace('Lifecycle and change history', 'Lifecycle und Änderungshistorie') })),
      linking: en.sections[2].topics.map((t) => ({ ...t, title: t.title.replace('Types of service relations', 'Typen von Service-Beziehungen').replace('Dependency graph navigation', 'Navigation im Abhängigkeitsgraphen').replace('Mapping to C3/FMN capability', 'Mapping auf C3/FMN Capability') })),
      evaluation: en.sections[3].topics.map((t) => ({ ...t, title: t.title.replace('Operations cockpit and KPI', 'Operations-Cockpit und KPI').replace('Service governance cockpit', 'Service-Governance-Cockpit').replace('Readiness, risks, and compliance signals', 'Readiness, Risiken und Compliance-Signale').replace('Coverage / overlap / gap analysis', 'Coverage-/Overlap-/Gap-Analyse') })),
      data: en.sections[4].topics.map((t) => ({ ...t, title: t.title.replace('Data import (CSV/JSON/XLSX) - dry-run and commit', 'Datenimport (CSV/JSON/XLSX) - Dry-run und Commit').replace('Audit trail and traceability', 'Audit-Trail und Nachvollziehbarkeit').replace('Exports and sharing results', 'Exporte und Teilen von Ergebnissen') })),
      installation: en.sections[5].topics.map((t) => ({ ...t, title: t.title.replace('Installation wizard and first admin account', 'Installationsassistent und erstes Admin-Konto').replace('Runtime modes and environment configuration', 'Runtime-Modi und Umgebungskonfiguration').replace('Backup, restore, and upgrade', 'Backup, Wiederherstellung und Upgrade') })),
      faq: en.sections[6].topics.map((t) => ({ ...t, title: t.title.replace('Common access and role questions', 'Häufige Fragen zu Zugriff und Rollen').replace('Troubleshooting imports and validation', 'Troubleshooting für Importe und Validierung').replace('Performance, limits, and recommended practices', 'Performance, Limits und empfohlene Praktiken') })),
    },
  ),
});

export const HELP_CONTENT: Record<Locale, HelpContent> = { cs, en, sk, de };

export function getHelpContent(locale: Locale): HelpContent {
  return HELP_CONTENT[locale] ?? HELP_CONTENT.cs;
}

export function getHelpEntries(locale: Locale): HelpTopic[] {
  return getHelpContent(locale).sections.flatMap((section) => section.topics);
}
