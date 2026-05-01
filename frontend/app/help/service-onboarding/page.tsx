import Image from 'next/image';

import Link from '@/app/components/AppLink';
import styles from '../help.module.css';

const screenshots = {
  wizard: '/help/service-onboarding/01-new-service-wizard.png',
  catalogue: '/help/service-onboarding/02-service-catalogue.png',
  detail: '/help/service-onboarding/03-service-detail.png',
  editor: '/help/service-onboarding/04-service-editor.png',
  c3: '/help/service-onboarding/05-c3-capability-map.png',
  readiness: '/help/service-onboarding/06-readiness.png',
  decisions: '/help/service-onboarding/07-decision-log.png',
} as const;

const scenarioSteps = [
  {
    id: 'prepare',
    image: screenshots.catalogue,
    title: '0) Nejdřív si ujasněte, proč službu zavádíte',
    route: '/services/list',
    purpose: 'Cílem není založit další řádek v katalogu. Cílem je vytvořit auditovatelný záznam, podle kterého uživatel pozná hodnotu služby, vlastník pozná odpovědnost a governance tým vidí readiness, coverage a riziko.',
    actions: [
      'Ověřte, zda už podobná služba v katalogu existuje. Použijte fulltext, lifecycle, requestable filtr, domain filtry a portfolio.',
      'Pokud existuje překryv, otevřete detail a rozhodněte, zda jde o novou službu, variantu/flavour, dependency relation, nebo kandidáta na konsolidaci.',
      'Připravte si business popis, vlastníky, request kanál, SLA, portfolio zařazení a předběžné C3/FMΝ capability, aby wizard nebyl jen technický zápis.',
    ],
    impact: 'Tento krok chrání portfolio před duplicitami. Špatně založená služba zvyšuje overlap, zhoršuje vyhledávání a v readiness cockpitu později vypadá jako governance dluh.',
  },
  {
    id: 'wizard',
    image: screenshots.wizard,
    title: '1) Založte službu přes průvodce',
    route: '/management/new-service',
    purpose: 'Wizard založí minimální ITIL service record. Každý krok má krátkou inline nápovědu a tlačítko s delším vysvětlením pole.',
    actions: [
      'Vyplňte Service ID stabilní konvencí, například SVC-DOM-001. ID se používá v URL, importech, vazbách, reportech a auditu.',
      'Název pište pro konzumenta, ne pro technický tým. Dobře: "Bezpečný vzdálený přístup"; špatně: "VPN GW profile push".',
      'Vyberte Service Type a Lifecycle. Draft je bezpečný pracovní stav; Live používejte až po kontrole readiness.',
      'V dalších krocích doplňte popis, hodnotu, objednatelnost, klasifikaci, vlastníky, SLA, domény a C3 mapování.',
    ],
    impact: 'Kvalita polí ve wizardu přímo ovlivňuje, zda bude služba nalezitelná, requestable, reportovatelná a později schválitelná.',
  },
  {
    id: 'enrich',
    image: screenshots.editor,
    title: '2) Po vytvoření doplňte službu v editoru',
    route: '/services/{service_id}/edit',
    purpose: 'Editor je místo, kde z minimálního záznamu vznikne provozně použitelná služba: doplňují se detaily, varianty, support model, audience policy, operační odkazy a vztahy.',
    actions: [
      'V Basic Identity a Description doplňte title, status, summary, detailed description, value proposition, business purpose, service features a scope.',
      'V Request & Eligibility nastavte requestable, request channel type, request channel URL, approval required, target audience a fulfillment lead time.',
      'V Classification doplňte portfolio group, global service group, service line, organizational element, service area a security classification.',
      'V Ownership udržujte Service Ownera, Area Ownera a Delivery Managera včetně organizace. Změny rolí vytvářejí historické záznamy.',
      'V Availability & Domains doplňte SLA availability, restoration, delivery, domény a případné flavour-specific SLA overrides.',
      'V Pricing Variants přidejte flavours: title, unit, price, currency, billing period, initiation/lifecycle cost, lifetime, status, orderable a poznámky.',
      'Doplňte Support Model, Audience Policies, Operational Links, Relations a C3 Mappings. Právě tyto sekce často rozhodují, zda služba projde readiness.',
    ],
    impact: 'Editor odstraňuje mezery, které wizard záměrně nechává na později. Bez support modelu, ceny, vazeb a C3 mappingu uživatel službu uvidí, ale governance cockpit ji bude stále chápat jako nedokončenou.',
  },
  {
    id: 'detail',
    image: screenshots.detail,
    title: '3) Zkontrolujte detail služby očima konzumenta i vlastníka',
    route: '/services/{service_id}',
    purpose: 'Detail služby je pravda, kterou uvidí uživatelé, vlastníci a review board. Zde se ukáže, zda zadaná data dávají smysl mimo formulář.',
    actions: [
      'V Overview zkontrolujte business view, value proposition, availability, owner, support, review date a readiness signály.',
      'V Offerings ověřte varianty služby, cenu, jednotku, orderable stav, billing period a poznámky k dodání nebo technice.',
      'V Request & Support ověřte, zda requestable služba opravdu ukazuje kanál, URL, lead time, support model, kontakty a eskalaci.',
      'V Coverage ověřte C3 mapping, capability kontext, flavours a případné gap/overlap signály.',
      'V Governance ověřte readiness, audit, otevřené review kroky a rozhodnutí.',
    ],
    impact: 'Jestli detail nedokáže vysvětlit hodnotu, cestu k objednání a odpovědnost, uživatelé budou službu obcházet a provoz bude řešit dotazy mimo řízený proces.',
  },
  {
    id: 'c3',
    image: screenshots.c3,
    title: '4) Navažte službu na C3/FMΝ capability, TINy, aplikace a data',
    route: '/c3/capability-map-spiral8',
    purpose: 'C3 a FMΝ vrstva ukazuje, co služba pokrývá, kde je mezera, kde se služby překrývají a jaké technické nebo datové prvky dokládají schopnost.',
    actions: [
      'U služby nastavte jedno primární C3 mapování a případná podpůrná mapování. Primární mapping je důležitý pro readiness a coverage reporting.',
      'V C3 taxonomy ověřte, že capability má správný typ, úroveň, domain, parent vazbu a je zařazená do správné spirály.',
      'TIN použijte pro integrační nebo provozní interakci: co s čím komunikuje, jaký tok podporuje a proč je relevantní pro readiness nebo impact.',
      'Aplikace a data objekty používejte jako evidenci, která vysvětluje, čím je capability skutečně realizovaná.',
      'U FMΝ spirál kontrolujte L2/L3/L4 hierarchii. Rootless položky patří na level 1; podřízené položky musí mít konzistentní parent.',
    ],
    impact: 'Bez C3 vazeb je služba jen katalogový text. S C3, TINy, aplikacemi a daty se z ní stává prvek capability governance, který lze měřit, porovnávat a obhájit.',
  },
  {
    id: 'readiness',
    image: screenshots.readiness,
    title: '5) Řiďte chyby, blokery a výjimky přes readiness',
    route: '/operations/readiness',
    purpose: 'Readiness ukazuje, co brání publikaci nebo důvěryhodnému provoznímu řízení služby. Není to jen kontrolka, ale pracovní seznam pro vlastníky.',
    actions: [
      'Blocker řešte jako věc, která brání publikaci nebo schválení. Typicky chybí offering, owner, support, request channel, pricing nebo primární C3 mapping.',
      'Warning řešte jako riziko kvality dat: neúplný review date, slabý popis, chybějící relation, nejasná klasifikace nebo nedoložená capability.',
      'Exception používejte jen s důvodem a expirací. Výjimka má vysvětlit, proč je riziko dočasně přijatelné, ne ho schovat.',
      'Po opravě se vraťte na detail služby a ověřte, že readiness panel ukazuje menší počet problémů.',
    ],
    impact: 'Readiness mění subjektivní dojem na konkrétní seznam chyb. Díky tomu je jasné, kdo má co doplnit a jaký dopad má neúplná evidence.',
  },
  {
    id: 'decision',
    image: screenshots.decisions,
    title: '6) Uzavřete governance rozhodnutí a auditní stopu',
    route: '/operations/decisions',
    purpose: 'Decision Log zachycuje, proč byla služba schválena, odložena, odmítnuta, vyřazena nebo přijata s rizikem. Je to kontext pro budoucí audit.',
    actions: [
      'Zapište rozhodnutí až ve chvíli, kdy máte k dispozici detail služby, readiness stav, C3 coverage a případné review poznámky.',
      'U deferred nebo rejected rozhodnutí vždy doplňte rationale. Bez důvodu není jasné, co má vlastník opravit.',
      'U risk acceptance uveďte, jaký blocker nebo warning zůstává, kdo ho vlastní a do kdy má být odstraněn.',
      'Po rozhodnutí ověřte audit/history sekce a případně založte follow-up review.',
    ],
    impact: 'Rozhodnutí bez auditního kontextu se po měsíci nedá obhájit. Decision Log chrání tým před opakovaným řešením stejných otázek.',
  },
] as const;

const fieldGroups = [
  {
    title: 'Identita',
    why: 'Určuje stabilní business klíč a srozumitelnost služby.',
    fields: ['Service ID', 'Název služby', 'Service Type', 'Status', 'Lifecycle State'],
    risk: 'Duplicitní nebo technický název zhorší vyhledávání, importy i reporting.',
  },
  {
    title: 'Popis a hodnota',
    why: 'Vysvětluje, co služba dělá, proč existuje a komu pomáhá.',
    fields: ['Summary', 'Detailed Description', 'Business Summary', 'Consumer Value', 'Value Proposition', 'Business Purpose', 'Service Features', 'Scope'],
    risk: 'Slabý popis vede k nízké adopci a k dotazům mimo katalog.',
  },
  {
    title: 'Objednání a audience',
    why: 'Říká, zda a jak může uživatel službu získat.',
    fields: ['Requestable', 'Request Channel Type', 'Request Channel URL', 'Approval Required', 'Fulfillment Lead Time', 'Target Audience', 'Prerequisites'],
    risk: 'Requestable služba bez kanálu nebo supportu vypadá dostupně, ale uživatel ji reálně neumí objednat.',
  },
  {
    title: 'Klasifikace',
    why: 'Zařazuje službu do portfolia, domén a governance reportingu.',
    fields: ['Portfolio Group', 'Global Service Group', 'Service Line', 'Organizational Element', 'Service Area', 'Security Classification'],
    risk: 'Bez klasifikace se služba ztrácí v reportech a nelze ji spolehlivě porovnávat.',
  },
  {
    title: 'Vlastnictví',
    why: 'Určuje odpovědnost za strategii, oblast a každodenní dodávku.',
    fields: ['Service Owner', 'Owner Email', 'Owner Organization', 'Area Owner', 'Area Owner Organization', 'Delivery Manager', 'Delivery Manager Organization'],
    risk: 'Chybějící vlastník je jeden z největších governance blockerů.',
  },
  {
    title: 'SLA, dostupnost a domény',
    why: 'Překládá slib služby do měřitelných závazků.',
    fields: ['SLA Availability', 'SLA Restoration', 'SLA Delivery', 'Support Window', 'Domains', 'Flavour SLA Overrides'],
    risk: 'Nerealistické SLA vytváří falešný závazek; chybějící domény zhoršují plánování dostupnosti.',
  },
  {
    title: 'Pricing a flavours',
    why: 'Popisuje varianty služby a jejich ekonomický dopad.',
    fields: ['Variant Title', 'Service Unit', 'Price', 'Currency', 'Billing Period', 'Initiation Cost', 'Lifecycle Cost', 'Lifetime Years', 'Orderable', 'Status', 'Pricing/Delivery/Technical Notes'],
    risk: 'Bez ceny a variant nelze posoudit total cost, showback ani konsolidaci.',
  },
  {
    title: 'Support, vazby a C3',
    why: 'Doplňuje provozní důkaz, dependency kontext a capability coverage.',
    fields: ['Support Model', 'Audience Policies', 'Operational Links', 'Relations', 'Primary C3 Mapping', 'TINs', 'Applications', 'Data Objects', 'Audit History'],
    risk: 'Bez těchto vazeb služba vypadá hotově, ale readiness a impact analýza zůstanou slepé.',
  },
] as const;

const errorPatterns = [
  ['Duplicate Service ID', 'Zvolte jiný stabilní kód. ID je business klíč pro URL, importy a vazby. Neměňte ho podle technologie.'],
  ['Invalid URL', 'Použijte úplnou adresu včetně protokolu, typicky https://. Pokud kanál není URL, napište ho do typu kanálu a URL nechte prázdnou.'],
  ['Requestable without channel', 'Doplňte request channel type a/nebo request channel URL. Jinak uživatel neví, kde službu objednat.'],
  ['Requestable without support model', 'Doplňte resolver group, kontakt, support hours a eskalační cestu. Jinak se incidenty a dotazy rozpadnou mimo katalog.'],
  ['Missing owner', 'Přiřaďte Service Ownera a případně Area Ownera/Delivery Managera. Bez vlastníka nelze schvalovat ani eskalovat.'],
  ['Missing C3 primary mapping', 'Vyberte primární capability. Bez ní nebude služba správně počítaná v coverage, gap a readiness pohledech.'],
  ['Capability hierarchy error', 'Root bez parenta musí být level 1. L2/L3/L4 položky musí mít validní parent a konzistentní doménu.'],
  ['Import taxonomy unresolved', 'Zkontrolujte zdrojový kód, external_id, uuid a referenční tabulky. Nejprve opravte dry-run chyby, až potom commitujte import.'],
] as const;

const capabilityCards = [
  ['Katalog služeb', 'Evidence služeb, vlastníků, lifecycle, request kanálů, supportu, SLA a variant.'],
  ['Governance cockpit', 'Rizika, owner load, contract overlap, readiness, reviews, exceptions a decision log.'],
  ['Capability coverage', 'C3/FMΝ mapy, gap/overlap analýza a vazby na služby, aplikace, data a TINy.'],
  ['Impact analýza', 'Grafy závislostí a vztahů mezi službami před změnou, migrací nebo vyřazením.'],
  ['Audit a importy', 'Dohledatelnost změn, importních dávek, chyb a rozhodnutí pro revizi a compliance.'],
  ['Self-hosted provoz', 'Lehká platforma bez těžké enterprise suite, vhodná pro organizace, které chtějí rychlejší governance cyklus.'],
] as const;

function ScreenshotFigure({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <figure className={styles.guideFigure}>
      <Image
        src={src}
        alt={alt}
        width={1680}
        height={900}
        className={styles.guideImage}
        sizes="(max-width: 900px) 100vw, 1180px"
        priority={priority}
        loading={priority ? undefined : 'lazy'}
      />
    </figure>
  );
}

export default function ServiceOnboardingGuidePage() {
  return (
    <main className={styles.shell}>
      <header className={styles.guideHero}>
        <div className={styles.guideHeroText}>
          <Link href="/help" className={styles.backLink}>← Zpět na Help</Link>
          <span className={styles.eyebrow}>Scénář zavedení služby</span>
          <h1>Kompletní průchod: od nové služby po readiness a rozhodnutí</h1>
          <p>
            Tento návod vede uživatele celou aplikací jako praktický pracovní scénář. Ukazuje, co vyplnit,
            proč na tom záleží, jak poznat chyby a jaký dopad má neúplná evidence na katalog, C3 coverage,
            ownership, readiness a audit.
          </p>
        </div>
        <div className={styles.guideHeroStats} aria-label="Obsah průvodce">
          <div><strong>7</strong><span>pracovních kroků</span></div>
          <div><strong>8</strong><span>oblastí polí</span></div>
          <div><strong>8</strong><span>typických chyb</span></div>
        </div>
      </header>

      <nav className={styles.guideQuickNav} aria-label="Rychlá navigace průvodcem">
        {scenarioSteps.map((step) => <a key={step.id} href={`#${step.id}`}>{step.title.split(') ')[0]}) {step.id}</a>)}
        <a href="#fields">Pole</a>
        <a href="#errors">Chyby</a>
        <a href="#capabilities">Co aplikace umí</a>
      </nav>

      <section className={styles.guideSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Jak návod používat</span>
          <h2>Jeden průchod, dva pohledy</h2>
          <p>
            První pohled je konzumentský: bude služba srozumitelná, objednatelná a podporovaná?
            Druhý pohled je governance: má vlastníka, SLA, C3/FMΝ mapování, readiness bez blockerů
            a rozhodnutí s auditní stopou?
          </p>
        </div>
        <div className={styles.guidePrinciples}>
          <article>
            <h3>Vyplňujte od business smyslu k technickému důkazu</h3>
            <p>Nejdřív definujte hodnotu a audience, potom SLA, support, varianty, C3 mapping a operační vazby.</p>
          </article>
          <article>
            <h3>Každé pole má dopad</h3>
            <p>Pole nejsou jen formulář. Ovlivňují vyhledávání, request path, readiness, coverage, audit i rozhodnutí.</p>
          </article>
          <article>
            <h3>Chybu řešte tam, kde vzniká</h3>
            <p>Readiness ukáže symptom; opravujte zdrojové pole v editoru, C3 taxonomii, support modelu nebo vazbě.</p>
          </article>
        </div>
      </section>

      <section className={styles.guideTimeline} aria-label="Kroky zavedení služby">
        {scenarioSteps.map((step, index) => (
          <article key={step.id} id={step.id} className={styles.guideStep}>
            <div className={styles.guideStepHeader}>
              <span className={styles.guideStepNumber}>{index + 1}</span>
              <div>
                <span className={styles.guideRoute}>{step.route}</span>
                <h2>{step.title}</h2>
                <p>{step.purpose}</p>
              </div>
            </div>
            <ScreenshotFigure src={step.image} alt={step.title} priority={index === 0} />
            <div className={styles.guideStepBody}>
              <div>
                <h3>Co udělat</h3>
                <ol className={styles.guideChecklist}>
                  {step.actions.map((action) => <li key={action}>{action}</li>)}
                </ol>
              </div>
              <aside className={styles.guideImpact}>
                <h3>Dopad</h3>
                <p>{step.impact}</p>
              </aside>
            </div>
          </article>
        ))}
      </section>

      <section id="fields" className={styles.guideSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Pole a jejich význam</span>
          <h2>Co vyplnit a proč</h2>
          <p>
            Pokud uživatel neví, proč pole existuje, vyplní ho formálně nebo ho přeskočí.
            Tato matice vysvětluje účel polí a typický dopad chyby.
          </p>
        </div>
        <div className={styles.fieldMatrix}>
          {fieldGroups.map((group) => (
            <article key={group.title} className={styles.fieldGroup}>
              <h3>{group.title}</h3>
              <p>{group.why}</p>
              <ul>
                {group.fields.map((field) => <li key={field}>{field}</li>)}
              </ul>
              <strong>{group.risk}</strong>
            </article>
          ))}
        </div>
      </section>

      <section id="errors" className={styles.guideSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Správa chyb</span>
          <h2>Jak číst validace, blockery a warnings</h2>
          <p>
            Aplikace se snaží chyby ukazovat co nejblíže místu opravy. Formulář hlídá syntaxi,
            readiness hlídá governance kvalitu a Operations Cockpit pomáhá rozhodnout, co má prioritu.
          </p>
        </div>
        <div className={styles.errorGrid}>
          {errorPatterns.map(([title, remedy]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{remedy}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="capabilities" className={styles.guideSection}>
        <div className={styles.sectionIntro}>
          <span className={styles.eyebrow}>Co aplikace umí</span>
          <h2>Výsledek dobrého zavedení služby</h2>
          <p>
            Správně zavedená služba není jen publikovaný katalogový záznam. Je to řízený objekt,
            který se dá najít, objednat, provozovat, mapovat na capability, auditovat a použít
            pro rozhodnutí o portfoliu.
          </p>
        </div>
        <div className={styles.capabilityGrid}>
          {capabilityCards.map(([title, body]) => (
            <article key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <div className={styles.finalChecklist}>
          <h3>Smoke checklist před publikací</h3>
          <ul>
            <li>Detail služby vysvětluje business hodnotu a konzument ví, co získá.</li>
            <li>Služba má ownera, delivery managera, request kanál, support model a SLA.</li>
            <li>Requestable služba má variantu/flavour, cenu nebo jasnou poznámku k ceně.</li>
            <li>Primární C3 mapping je vybraný a dává smysl vůči FMΝ spirále.</li>
            <li>TINy, aplikace a data objekty dokládají technickou nebo datovou realizaci.</li>
            <li>Readiness nemá neřešené blockery, nebo má časově omezenou a zdůvodněnou výjimku.</li>
            <li>Decision Log obsahuje schválení, odklad nebo risk acceptance s racionálem.</li>
          </ul>
        </div>
      </section>
    </main>
  );
}
