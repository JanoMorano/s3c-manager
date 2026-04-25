'use client';
/**
 * Service Onboarding Wizard — /management/new-service/page.tsx
 *
 * Multi-step průvodce zavedením služby do ITIL katalogu.
 *
 * Kroky:
 *   1  Identita           — Service ID, Title, Type, Lifecycle
 *   2  Popis a hodnota    — summary, business_summary, consumer_value, value_proposition
 *   3  Přístup & Audience — requestable, request model, target audience
 *   4  Klasifikace        — portfolio, service_line, org_element, security
 *   5  Vlastnictví        — service_owner, vlastnik, manager
 *   6  SLA & Domény       — availability, SLA, domains
 *   7  C3 mapování        — (podmíněno instalací modulu C3_TAXONOMY)
 *   8  Přehled & Vytvoření
 *
 * Každé pole má:
 *   - krátkou ITIL nápovědu inline (italic, muted)
 *   - ? tlačítko s delším vysvětlením (Radix Tooltip)
 *   - placeholder v modré kurzívě (ukázkové hodnoty)
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import Link from '@/app/components/AppLink';
import {
  usePortfolioGroups, useServiceTypes, useNetworkDomains,
  useServiceLines, useOrganizationalElements, useGlobalServiceGroups,
  useSecurityClassifications, useC3Taxonomy,
} from '@/features/services/hooks/useServices';
import { authHeaders } from '@/features/services/api/services.api';
import { updateDomains, updateRole } from '@/features/services/api/editor.api';
import { useInstallStatus } from '@/features/install/installStatus';
import { Button } from '@/design-system/controls/Button';

import styles from './wizard.module.css';

// ── ITIL help text per field ─────────────────────────────────────────────────

const HELP: Record<string, { short: string; long: string }> = {
  service_id: {
    short: 'Unikátní kód, max 20 znaků (doporučení: PREFIX + číslice)',
    long: 'V ITIL Service Catalogue má každá služba unikátní identifikátor. Doporučená konvence: 3-4 písmena prefixu + číselný kód, např. WPS001 = Workplace Services #001. Kód se nezmění a používá se v reportech, importech a URL.',
  },
  title: {
    short: 'Celý název srozumitelný pro uživatele — bez zkratek',
    long: 'Název by měl být jasný a srozumitelný pro konzumenta, nikoliv technický. Dle ITIL 4 by název reflektoval hodnotu, kterou služba přináší, ne způsob implementace. Příklad: "Firemní mobilní zařízení" místo "MDM Provisioning".',
  },
  service_type: {
    short: 'Kategorie dle interní taxonomie typů služeb',
    long: 'Typ služby definuje charakter dodávky. CF = Core Function (primární IT služby), EF = Enabling Function (podpůrné služby), EP = External Provider (3. strana). Správné zařazení je klíčové pro portfolio management a reporting.',
  },
  lifecycle_state: {
    short: 'Aktuální stav v životním cyklu — určuje viditelnost v katalogu',
    long: 'ITIL Service Lifecycle: Draft (návrh, neviditelný), Under Review (čeká na schválení), Approved (schváleno), Live (aktivní, viditelný), Deprecated (zastaralá, plánované stažení), Retired (stažena). Stav řídí přístup a provozní procesy.',
  },
  summary: {
    short: 'Krátký popis pro zobrazení v katalogu — 1–2 věty',
    long: 'Service Summary je první věc, kterou konzument v katalogu vidí. Piš z pohledu uživatele: co dostane a proč mu to pomůže. Doporučená délka: 1–2 věty, max 200 znaků. Vyhni se technickému žargonu.',
  },
  business_summary: {
    short: 'Popis přínosu pro business stakeholdery (Business View)',
    long: 'Business Summary je určen pro Business View v katalogu. Vysvětluje službu v kontextu obchodních výstupů, nikoliv technických možností. Piš jako product manager pro business stakeholdera — co obchodně získají.',
  },
  consumer_value: {
    short: 'Konkrétní hodnota nebo přínos, který konzument získá',
    long: 'ITIL 4 klade důraz na value co-creation. Consumer Value popisuje konkrétní outcome nebo přínos konzumenta. Příklad: "Přístup k emailu a kalendáři z jakéhokoli zařízení, spolehlivý provoz s 99,9 % SLA a bezpečným šifrováním."',
  },
  value_proposition: {
    short: 'Proč tuto službu místo alternativ — klíčové diferenciátory',
    long: 'Value Proposition vysvětluje proč konzumenti mají zvolit právě tuto službu. Zahrň klíčové diferenciátory, úspory nebo schopnosti. Příklad: "Plně spravované řešení — žádná vlastní infrastruktura, garantované SLA, integrace s AD."',
  },
  requestable: {
    short: 'Může konzument tuto službu objednat z katalogu?',
    long: 'ITIL definuje "requestable services" jako služby, které si konzumenti mohou formálně objednat přes Request Model. Pokud je zapnuto, mohou podat Service Request. Pokud ne, služba je pouze informativní (konzumována automaticky nebo přidělením).',
  },
  request_channel_type: {
    short: 'Jak konzumenti podávají žádost o tuto službu',
    long: 'Definuje vstupní bod Request Modelu. Jasný request channel je nezbytný pro ITIL-compliant Service Fulfilment. Příklady kanálů: ITSM Portal (ServiceNow, Jira SM), Email, Self-service portál, Teams, Telefon.',
  },
  request_channel_url: {
    short: 'Přímý odkaz na portál nebo formulář pro objednávky',
    long: 'Přímý URL odkaz na portál nebo formulář, přes který konzumenti podávají žádosti. Zjednodušuje cestu konzumenta — z detailu služby může rovnou přejít k objednávce bez hledání správného místa.',
  },
  approval_required: {
    short: 'Vyžaduje žádost schválení před zahájením fulfillmentu?',
    long: 'Některé služby vyžadují formální schválení před fulfillmentem — rozpočtová autorizace, bezpečnostní posouzení nebo souhlas nadřízeného. Pokud zapnuto, žádost vstupuje do approval workflow před spuštěním dodávky.',
  },
  fulfillment_lead_time_text: {
    short: 'Očekávaná doba od podání žádosti do dodání služby',
    long: 'ITIL označuje tuto veličinu jako "service lead time". Buď realistický a zahrň čas schvalování. Příklady: "Tentýž pracovní den", "1–2 pracovní dny", "2–4 týdny (včetně schválení)". Konzumenti tuto dobu vidí v katalogu.',
  },
  target_audience_summary: {
    short: 'Komu je tato služba určena — oprávněná skupina uživatelů',
    long: 'Popisuje oprávněnou skupinu konzumentů. ITIL Audience/Eligibility pomáhá konzumentům ověřit, zda mají na službu nárok. Příklady: "Všichni zaměstnanci", "Pouze IT personál", "Projektoví manažeři ve schválených cost centrech".',
  },
  portfolio_group_code: {
    short: 'Portfolio, do kterého tato služba patří — governance a reporting',
    long: 'Služby jsou seskupeny do portfolií pro governance, rozpočtování a reporting. Portfolio group určuje vlastnický řetězec, alokaci rozpočtu a který portfolio review board službu spravuje.',
  },
  service_line_code: {
    short: 'Service line pro sdružení příbuzných služeb',
    long: 'Service Line je logické seskupení příbuzných služeb pod společné provozní a finanční řízení. Pomáhá při horizontálním srovnávání nákladů a kapacity mezi službami stejného charakteru.',
  },
  organizational_element_code: {
    short: 'Útvar nebo tým zodpovědný za provoz a financování',
    long: 'Organizační element identifikuje útvar (oddělení, tým, business unit), který je zodpovědný za financování a provoz služby. Používá se pro charge-back/show-back reporting a governance.',
  },
  global_service_group_code: {
    short: 'Globální seskupení pro cross-portfolio reporting',
    long: 'Global Service Group umožňuje seskupit služby napříč portfolii pro globální reporting, benchmarking nebo strategické hodnocení. Typicky odpovídá vrstvám ITIL Service Portfolio.',
  },
  security_classification: {
    short: 'Nejvyšší úroveň citlivosti dat zpracovávaných touto službou',
    long: 'Indikuje nejvyšší úroveň citlivosti dat, která tato služba zpracovává. Používá se pro řízení přístupu, compliance reporting a eligibility konzumentů. Navazuje na interní klasifikační schéma (ISO 27001 nebo NIST).',
  },
  service_owner: {
    short: 'Jméno primárně zodpovědné osoby za tuto službu end-to-end',
    long: 'Service Owner je dle ITIL zodpovědný za službu end-to-end — od návrhu po retirement. Zajišťuje plnění závazků, zastupuje službu v governance fórech a schvaluje významné změny. Toto pole zobrazuje detail služby.',
  },
  service_owner_email: {
    short: 'Email Service Ownera — konzumenti jej mohou kontaktovat',
    long: 'Email Service Ownera se zobrazuje na detailu služby jako kontakt pro eskalace nebo otázky k definici služby. Liší se od support kontaktu — Service Owner odpovídá za strategii, ne provoz.',
  },
  vlastnik: {
    short: 'Vlastník oblasti — odpovědný za portfolio nebo doménu',
    long: 'Service Area Owner (Vlastník oblasti) odpovídá za skupinu příbuzných služeb nebo celou oblast (doménu). Spravuje portfolio alignment a je kontaktem pro business stakeholdery na vyšší úrovni.',
  },
  manager: {
    short: 'Delivery Manager — zodpovídá za provozní dodávku',
    long: 'Service Delivery Manager koordinuje každodenní provoz, SLA plnění a eskalace. Liší se od Service Ownera (strategie) — Delivery Manager řeší operativní problémy a komunikaci s resolver groups.',
  },
  sla_availability: {
    short: 'Cílový uptime v % (např. 99,9 = max 8,7 h výpadku ročně)',
    long: 'SLA Availability definuje % času, po které má být služba funkční. 99,9 % = max 8,7 h/rok. 99,5 % = max 43,8 h/rok. Zvolte realistický cíl odpovídající skutečné infrastrukturní kapacitě, ne aspiraci.',
  },
  domains: {
    short: 'Síťové domény / zóny dostupnosti pro tuto službu',
    long: 'Network Domains reprezentují fyzické nebo logické zóny dostupnosti. Mapování říká konzumentům, odkud mohou službu čerpat. Služby na více doménách mohou mít různé endpointy nebo support kontakty per doména.',
  },
  c3_mapping: {
    short: 'Volitelné — namapujte službu na C3 capability taxonomii',
    long: 'C3 (Capability, Capacity, Coverage) taxonomie mapuje IT služby na business capabilities. Mapování umožňuje reporting pokrytí capabilities, analýzu mezer a racionalizaci portfolia. Plné mapování dostupné v editoru po vytvoření.',
  },
};

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  service_id:                   z.string().min(1, 'Service ID je povinné').max(20, 'Max 20 znaků'),
  title:                        z.string().min(1, 'Název je povinný'),
  service_type:                 z.string().min(1, 'Typ služby je povinný'),
  service_status:               z.string().optional(),
  lifecycle_state:              z.string().optional(),
  summary:                      z.string().optional(),
  business_summary:             z.string().optional(),
  consumer_value:               z.string().optional(),
  value_proposition:            z.string().optional(),
  business_purpose:             z.string().optional(),
  requestable:                  z.boolean().optional(),
  request_channel_type:         z.string().optional(),
  request_channel_url:          z.string().url('Musí být platná URL').optional().or(z.literal('')),
  approval_required:            z.boolean().optional(),
  fulfillment_lead_time_text:   z.string().optional(),
  target_audience_summary:      z.string().optional(),
  portfolio_group_code:         z.string().optional(),
  service_line_code:            z.string().optional(),
  organizational_element_code:  z.string().optional(),
  global_service_group_code:    z.string().optional(),
  security_classification:      z.string().optional(),
  service_owner:                z.string().optional(),
  service_owner_email:          z.string().email('Neplatný email').optional().or(z.literal('')),
  service_owner_org:            z.string().optional(),
  vlastnik:                     z.string().optional(),
  manager:                      z.string().optional(),
  sla_availability:             z.coerce.number().min(0).max(100).optional().nullable(),
  sla_restoration:              z.coerce.number().min(0).optional().nullable(),
  sla_delivery:                 z.coerce.number().min(0).optional().nullable(),
  domains:                      z.array(z.string()).optional(),
  notes_json:                   z.string().optional(),
});

type FormData = z.infer<typeof schema>;

function compactPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ) as Partial<T>;
}

// ── WizardTooltip ─────────────────────────────────────────────────────────────

function WizardTooltip({ content }: { content: string }) {
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button type="button" className={styles.tooltipTrigger} aria-label="Více informací">
            ?
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={styles.tooltipContent}
            side="top"
            align="start"
            sideOffset={6}
          >
            {content}
            <TooltipPrimitive.Arrow className={styles.tooltipArrow} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}

// ── WizardField ───────────────────────────────────────────────────────────────

interface WizardFieldProps {
  fieldKey?: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}

function WizardField({ fieldKey, label, required, error, children }: WizardFieldProps) {
  const help = fieldKey ? HELP[fieldKey] : undefined;
  return (
    <div className={styles.fieldWrapper}>
      <div className={styles.fieldLabelRow}>
        <span className={styles.fieldLabel}>
          {label}
          {required && <span className={styles.fieldRequired}> *</span>}
        </span>
        {help?.long && <WizardTooltip content={help.long} />}
      </div>
      {help?.short && <div className={styles.fieldHint}>{help.short}</div>}
      {children}
      {error && <div className={styles.fieldError}>{error}</div>}
    </div>
  );
}

// ── StepProgress ──────────────────────────────────────────────────────────────

interface StepDef { id: number; label: string }

function StepProgress({ current, steps }: { current: number; steps: StepDef[] }) {
  return (
    <div className={styles.stepProgress} role="list" aria-label="Postup průvodce">
      {steps.map((s) => {
        const done   = current > s.id;
        const active = current === s.id;
        return (
          <div
            key={s.id}
            role="listitem"
            className={[
              styles.stepItem,
              done   ? styles.stepItemDone   : '',
              active ? styles.stepItemActive : '',
            ].filter(Boolean).join(' ')}
          >
            <div className={[
              styles.stepDot,
              done   ? styles.stepDotDone   : '',
              active ? styles.stepDotActive : '',
            ].filter(Boolean).join(' ')}>
              {done ? '✓' : s.id}
            </div>
            <span className={[
              styles.stepLabel,
              done   ? styles.stepLabelDone   : '',
              active ? styles.stepLabelActive : '',
            ].filter(Boolean).join(' ')}>
              {s.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS = [
  { value: 'draft',        label: 'Draft — návrh, neviditelný v katalogu' },
  { value: 'under_review', label: 'Under Review — čeká na schválení' },
  { value: 'approved',     label: 'Approved — schváleno, nezveřejněno' },
  { value: 'live',         label: 'Live — aktivní, viditelný v katalogu' },
  { value: 'deprecated',   label: 'Deprecated — zastaralá, plánované stažení' },
  { value: 'retired',      label: 'Retired — stažena z provozu' },
];

const CHANNEL_OPTIONS = ['ITSM Portal', 'E-mail', 'Teams', 'Self-service portál', 'Telefon', 'API'];

// ── Step props type ───────────────────────────────────────────────────────────

interface StepFormProps {
  register: ReturnType<typeof useForm<FormData>>['register'];
  watch:    ReturnType<typeof useForm<FormData>>['watch'];
  setValue: ReturnType<typeof useForm<FormData>>['setValue'];
  errors:   ReturnType<typeof useForm<FormData>>['formState']['errors'];
}

// ═══ STEP 1 — Identita ═══════════════════════════════════════════════════════

function Step1Identity({ register, watch, setValue, errors, serviceTypes }: StepFormProps & {
  serviceTypes: Array<{ code: string; name: string }> | undefined;
}) {
  const watchedId    = watch('service_id');
  const watchedTitle = watch('title');

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Identita služby</h2>
        <p className={styles.stepDescription}>
          Základní identifikace — tyto údaje jsou klíčové a nelze je snadno změnit po vytvoření.
        </p>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="service_id" label="Service ID" required error={errors.service_id?.message}>
          <input
            {...register('service_id', { setValueAs: (v) => String(v ?? '').toUpperCase() })}
            className={[styles.input, errors.service_id ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder="např. WPS001"
            maxLength={20}
            style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
          />
          {watchedId?.trim() && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
              → {watchedId.trim().toUpperCase()}
            </div>
          )}
        </WizardField>

        <WizardField fieldKey="title" label="Název služby" required error={errors.title?.message}>
          <input
            {...register('title')}
            className={[styles.input, errors.title ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder="např. Firemní mobilní zařízení"
          />
        </WizardField>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="service_type" label="Typ služby" required error={errors.service_type?.message}>
          <select
            {...register('service_type')}
            className={[styles.input, errors.service_type ? styles.inputError : ''].filter(Boolean).join(' ')}
          >
            <option value="">— vyberte typ —</option>
            {serviceTypes?.map((t) => (
              <option key={t.code} value={t.code}>{t.code} — {t.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="lifecycle_state" label="Lifecycle stav">
          <select {...register('lifecycle_state')} className={styles.input}>
            <option value="">— vyberte stav —</option>
            {LIFECYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </WizardField>
      </div>

      {watchedTitle?.trim() && watchedId?.trim() && (
        <div style={{
          marginTop: 'var(--space-4)', padding: '10px 14px',
          background: 'rgba(22,163,74,0.05)',
          border: '1px solid rgba(22,163,74,0.2)',
          borderRadius: 'var(--radius-md)',
          font: 'var(--text-body-sm)', color: 'var(--color-text-secondary)',
        }}>
          ✓ Identita: <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
            {watchedId.trim().toUpperCase()}
          </strong> — {watchedTitle}
        </div>
      )}
    </div>
  );
}

// ═══ STEP 2 — Popis a hodnota ═════════════════════════════════════════════════

function Step2Description({ register }: StepFormProps) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Popis a hodnota</h2>
        <p className={styles.stepDescription}>
          Vysvětlete co služba dělá a jakou hodnotu přináší — pro katalog a pro konzumenty.
        </p>
      </div>

      <WizardField fieldKey="summary" label="Stručný popis (pro katalogový seznam)">
        <textarea
          {...register('summary')}
          rows={2}
          className={styles.textarea}
          placeholder="např. Plně spravovaná emailová služba pro všechny zaměstnance s dostupností 24/7."
        />
      </WizardField>

      <WizardField fieldKey="consumer_value" label="Hodnota pro konzumenta">
        <textarea
          {...register('consumer_value')}
          rows={2}
          className={styles.textarea}
          placeholder="např. Přístup k emailu a kalendáři z jakéhokoli zařízení, spolehlivý provoz s 99,9 % SLA."
        />
      </WizardField>

      <WizardField fieldKey="business_summary" label="Business summary (pro Business View)">
        <textarea
          {...register('business_summary')}
          rows={2}
          className={styles.textarea}
          placeholder="např. Zajišťuje komunikaci zaměstnanců napříč organizací, kritický enabler produktivity."
        />
      </WizardField>

      <WizardField fieldKey="value_proposition" label="Value proposition">
        <textarea
          {...register('value_proposition')}
          rows={2}
          className={styles.textarea}
          placeholder="např. Plně spravované řešení bez vlastní infrastruktury, garantované SLA, integrace s AD."
        />
      </WizardField>
    </div>
  );
}

// ═══ STEP 3 — Přístup & audience ══════════════════════════════════════════════

function Step3Access({ register, watch, setValue, errors }: StepFormProps) {
  const isRequestable = watch('requestable') === true;
  const channelType   = watch('request_channel_type') ?? '';
  const isApproval    = watch('approval_required') === true;

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Přístup & objednávání</h2>
        <p className={styles.stepDescription}>
          Definujte kdo může službu využívat a jak ji může objednat.
        </p>
      </div>

      <WizardField fieldKey="requestable" label="Objednatelnost">
        <div
          className={[styles.toggleRow, isRequestable ? styles.toggleRowActive : ''].filter(Boolean).join(' ')}
          onClick={() => setValue('requestable', !isRequestable, { shouldDirty: true })}
          role="checkbox"
          aria-checked={isRequestable}
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === ' ') setValue('requestable', !isRequestable, { shouldDirty: true }); }}
        >
          <div className={styles.toggleRowText}>
            <div className={styles.toggleRowLabel}>
              {isRequestable ? 'Služba je objednatelná z katalogu' : 'Služba není objednatelná (jen informativní)'}
            </div>
            <div className={styles.toggleRowSub}>
              {isRequestable
                ? 'Konzumenti mohou podat Service Request přes definovaný kanál'
                : 'Služba je konzumována automaticky nebo přidělením — bez žádosti'}
            </div>
          </div>
          <div className={[styles.toggleCheckmark, isRequestable ? styles.toggleCheckmarkActive : ''].filter(Boolean).join(' ')}>
            {isRequestable ? '✓' : ''}
          </div>
        </div>
      </WizardField>

      {isRequestable && (
        <div className={styles.conditionalBlock}>
          <div className={styles.conditionalBlockTitle}>Request Model — vyplňte jak lze tuto službu objednat</div>

          <WizardField fieldKey="request_channel_type" label="Kanál pro objednávky">
            <div className={styles.channelOptions}>
              {CHANNEL_OPTIONS.map((ch) => (
                <button
                  key={ch}
                  type="button"
                  className={[styles.channelChip, channelType === ch ? styles.channelChipActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setValue('request_channel_type', channelType === ch ? '' : ch, { shouldDirty: true })}
                >
                  {ch}
                </button>
              ))}
            </div>
          </WizardField>

          <WizardField fieldKey="request_channel_url" label="URL odkaz na objednávkový portál" error={errors.request_channel_url?.message}>
            <input
              {...register('request_channel_url')}
              className={[styles.input, errors.request_channel_url ? styles.inputError : ''].filter(Boolean).join(' ')}
              placeholder="např. https://itsm.company.com/catalog/email-service"
              type="url"
            />
          </WizardField>

          <WizardField fieldKey="fulfillment_lead_time_text" label="Dodací lhůta">
            <input
              {...register('fulfillment_lead_time_text')}
              className={styles.input}
              placeholder="např. 1–2 pracovní dny (po schválení)"
            />
          </WizardField>

          <WizardField fieldKey="approval_required" label="Schválení žádosti">
            <label className={styles.approvalRow}>
              <input
                type="checkbox"
                checked={isApproval}
                onChange={(e) => setValue('approval_required', e.target.checked, { shouldDirty: true })}
              />
              <span>Žádost vyžaduje schválení před zahájením fulfillmentu</span>
            </label>
          </WizardField>
        </div>
      )}

      <WizardField fieldKey="target_audience_summary" label="Cílová skupina">
        <textarea
          {...register('target_audience_summary')}
          rows={2}
          className={styles.textarea}
          placeholder="např. Všichni zaměstnanci s platnou pracovní smlouvou a aktivním AD účtem."
        />
      </WizardField>
    </div>
  );
}

// ═══ STEP 4 — Klasifikace ══════════════════════════════════════════════════════

function Step4Classification({ register, portfolioGroups, serviceLines, orgElements, globalServiceGroups, securityClassifications }: StepFormProps & {
  portfolioGroups?:       Array<{ code: string; name: string }>;
  serviceLines?:          Array<{ code: string; name: string }>;
  orgElements?:           Array<{ code: string; name: string }>;
  globalServiceGroups?:   Array<{ code: string; name: string }>;
  securityClassifications?: Array<{ code: string; name: string }>;
}) {
  const SEC_FALLBACK = [
    { code: 'OPEN', name: 'Open' }, { code: 'STANDARD', name: 'Standard' },
    { code: 'ELEVATED', name: 'Elevated' }, { code: 'RESTRICTED', name: 'Restricted' },
    { code: 'PROTECTED', name: 'Protected' }, { code: 'CLASSIFIED', name: 'Classified' },
  ];
  const secOptions = (securityClassifications?.length ? securityClassifications : SEC_FALLBACK);

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Klasifikace</h2>
        <p className={styles.stepDescription}>
          Zařaďte službu do organizační struktury — pro governance, reporting a portfolio management.
        </p>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="portfolio_group_code" label="Portfolio skupina">
          <select {...register('portfolio_group_code')} className={styles.input}>
            <option value="">— vyberte —</option>
            {portfolioGroups?.map((g) => (
              <option key={g.code} value={g.code}>{g.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="global_service_group_code" label="Global Service Group">
          <select {...register('global_service_group_code')} className={styles.input}>
            <option value="">— vyberte —</option>
            {globalServiceGroups?.map((g) => (
              <option key={g.code} value={g.code}>{g.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="service_line_code" label="Service Line">
          <select {...register('service_line_code')} className={styles.input}>
            <option value="">— vyberte —</option>
            {serviceLines?.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="organizational_element_code" label="Organizační element">
          <select {...register('organizational_element_code')} className={styles.input}>
            <option value="">— vyberte —</option>
            {orgElements?.map((e) => (
              <option key={e.code} value={e.code}>{e.name}</option>
            ))}
          </select>
        </WizardField>
      </div>

      <WizardField fieldKey="security_classification" label="Bezpečnostní klasifikace">
        <select {...register('security_classification')} className={styles.input}>
          <option value="">— vyberte klasifikaci —</option>
          {secOptions.map((c) => (
            <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
          ))}
        </select>
      </WizardField>
    </div>
  );
}

// ═══ STEP 5 — Vlastnictví ══════════════════════════════════════════════════════

function Step5Ownership({ register, errors }: StepFormProps) {
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Vlastnictví</h2>
        <p className={styles.stepDescription}>
          Určete odpovědné osoby — konzumenti i provoz potřebují vědět, kdo je za službu zodpovědný.
        </p>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="service_owner" label="Service Owner">
          <input
            {...register('service_owner')}
            className={styles.input}
            placeholder="např. Jana Nováková"
          />
        </WizardField>

        <WizardField fieldKey="service_owner_email" label="Email Service Ownera" error={errors.service_owner_email?.message}>
          <input
            {...register('service_owner_email')}
            type="email"
            className={[styles.input, errors.service_owner_email ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder="např. j.novakova@company.com"
          />
        </WizardField>
      </div>

      <WizardField label="Organizace / útvar Service Ownera">
        <input
          {...register('service_owner_org')}
          className={styles.input}
          placeholder="např. IT Infrastructure & Operations"
        />
      </WizardField>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="vlastnik" label="Vlastník oblasti (Area Owner)">
          <input
            {...register('vlastnik')}
            className={styles.input}
            placeholder="např. Petr Svoboda"
          />
        </WizardField>

        <WizardField fieldKey="manager" label="Delivery Manager">
          <input
            {...register('manager')}
            className={styles.input}
            placeholder="např. Martin Krejčí"
          />
        </WizardField>
      </div>
    </div>
  );
}

// ═══ STEP 6 — SLA & Domény ════════════════════════════════════════════════════

function Step6Sla({ register, watch, setValue, domainOptions, domainColorMap }: StepFormProps & {
  domainOptions: string[];
  domainColorMap: Map<string, string | undefined>;
}) {
  const selectedDomains = watch('domains') ?? [];

  const toggleDomain = useCallback((code: string) => {
    const next = selectedDomains.includes(code)
      ? selectedDomains.filter((d) => d !== code)
      : [...selectedDomains, code];
    setValue('domains', next, { shouldDirty: true });
  }, [selectedDomains, setValue]);

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>SLA & Dostupnost</h2>
        <p className={styles.stepDescription}>
          Definujte závazky dostupnosti a síťové domény — konzumenti je vidí na detailu služby.
        </p>
      </div>

      <div className={styles.slaGrid}>
        <WizardField fieldKey="sla_availability" label="Dostupnost (%)">
          <input
            {...register('sla_availability')}
            type="number"
            min={0}
            max={100}
            step={0.01}
            className={styles.input}
            placeholder="např. 99.9"
          />
          <div className={styles.slaUnit}>% uptime ročně</div>
        </WizardField>

        <WizardField label="Obnova (h)">
          <input
            {...register('sla_restoration')}
            type="number"
            min={0}
            step={0.5}
            className={styles.input}
            placeholder="např. 4"
          />
          <div className={styles.slaUnit}>hodin do obnovy</div>
        </WizardField>

        <WizardField label="Dodávka (dny)">
          <input
            {...register('sla_delivery')}
            type="number"
            min={0}
            step={0.5}
            className={styles.input}
            placeholder="např. 2"
          />
          <div className={styles.slaUnit}>pracovní dny</div>
        </WizardField>
      </div>

      <WizardField fieldKey="domains" label="Dostupné domény">
        <div className={styles.domainGrid}>
          {domainOptions.map((code) => {
            const active = selectedDomains.includes(code);
            const color  = domainColorMap.get(code);
            return (
              <button
                key={code}
                type="button"
                className={[styles.domainChip, active ? styles.domainChipActive : ''].filter(Boolean).join(' ')}
                style={
                  active && color
                    ? { background: color, borderColor: color }
                    : color ? { borderColor: color } : undefined
                }
                onClick={() => toggleDomain(code)}
                title={code}
              >
                {code}
              </button>
            );
          })}
        </div>
        {selectedDomains.length > 0 && (
          <div style={{ marginTop: 6, font: 'var(--text-label-sm)', color: 'var(--color-text-muted)' }}>
            Vybráno: {selectedDomains.join(', ')}
          </div>
        )}
      </WizardField>
    </div>
  );
}

// ═══ STEP 7 — C3 Mapování ═════════════════════════════════════════════════════

function Step7C3({
  selectedUuids,
  onToggle,
}: {
  selectedUuids: string[];
  onToggle: (uuid: string) => void;
}) {
  const { data: c3Items } = useC3Taxonomy();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!c3Items) return [];
    const q = query.toLowerCase();
    if (!q) return c3Items.slice(0, 80);
    return c3Items
      .filter((i) => i.title?.toLowerCase().includes(q) || i.application?.toLowerCase().includes(q))
      .slice(0, 80);
  }, [c3Items, query]);

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>C3 Mapování</h2>
        <p className={styles.stepDescription}>
          Propojte službu s C3 capability taxonomií. Volitelné — plné mapování dostupné v editoru.
        </p>
      </div>

      <WizardField fieldKey="c3_mapping" label="Vyberte relevantní C3 capabilities">
        <div className={styles.c3InfoBanner}>
          Mapování na C3 taxonomii umožňuje coverage reporting a gap analýzu portfolia.
          Vyberte capabilities, se kterými tato služba přímo souvisí.
          Plné technické mapování dokončíte v editoru po vytvoření služby.
        </div>

        <div className={styles.c3SearchInput}>
          <input
            type="search"
            className={styles.input}
            placeholder="Hledat v C3 capabilities…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.c3List}>
          {filtered.length === 0 && (
            <div className={styles.c3EmptyState}>
              {c3Items ? 'Žádné výsledky pro daný výraz' : 'Načítám C3 taxonomii…'}
            </div>
          )}
          {filtered.map((item) => {
            const selected = selectedUuids.includes(item.uuid);
            return (
              <div
                key={item.uuid}
                className={[styles.c3Item, selected ? styles.c3ItemSelected : ''].filter(Boolean).join(' ')}
                onClick={() => onToggle(item.uuid)}
                role="checkbox"
                aria-checked={selected}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ') onToggle(item.uuid); }}
              >
                <div className={[styles.c3Tick, selected ? styles.c3TickSelected : ''].filter(Boolean).join(' ')}>
                  {selected ? '✓' : ''}
                </div>
                {item.application && (
                  <span className={styles.c3ItemApp}>{item.application}</span>
                )}
                <span className={styles.c3ItemTitle}>{item.title ?? item.uuid}</span>
              </div>
            );
          })}
        </div>

        {selectedUuids.length > 0 && (
          <div className={styles.c3SelectedSummary}>
            ✓ Vybráno {selectedUuids.length}{' '}
            {selectedUuids.length === 1 ? 'capability' : 'capabilities'} — budou zaznamenány k zavedení
          </div>
        )}

        <div className={styles.c3PostNote}>
          Po vytvoření přejdete do editoru, kde lze plné technické C3 mapování dokončit
          v sekci <strong>C3 Mappings</strong>.
        </div>
      </WizardField>
    </div>
  );
}

// ═══ STEP REVIEW ══════════════════════════════════════════════════════════════

function RRow({ label, value }: { label: string; value: unknown }) {
  const isEmpty = value === '' || value === null || value === undefined ||
    (Array.isArray(value) && (value as unknown[]).length === 0);
  return (
    <div className={styles.reviewRow}>
      <span className={styles.reviewKey}>{label}</span>
      {isEmpty
        ? <span className={styles.reviewValEmpty}>—</span>
        : <span className={styles.reviewVal}>
            {typeof value === 'boolean'
              ? (value ? '✓ Ano' : '✗ Ne')
              : Array.isArray(value)
                ? (value as string[]).join(', ')
                : String(value)}
          </span>
      }
    </div>
  );
}

function StepReview({ watch, c3Selected }: { watch: StepFormProps['watch']; c3Selected: string[] }) {
  const v = watch();
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>Přehled a vytvoření</h2>
        <p className={styles.stepDescription}>
          Zkontrolujte zadané údaje. Vše ostatní lze doplnit v editoru po vytvoření.
        </p>
      </div>

      <div className={styles.reviewGrid}>
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>Identita</div>
          <RRow label="Service ID"  value={v.service_id} />
          <RRow label="Název"       value={v.title} />
          <RRow label="Typ služby"  value={v.service_type} />
          <RRow label="Lifecycle"   value={v.lifecycle_state} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>Popis</div>
          <RRow label="Stručný popis"        value={v.summary} />
          <RRow label="Hodnota konzumenta"   value={v.consumer_value} />
          <RRow label="Business summary"     value={v.business_summary} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>Přístup & objednávání</div>
          <RRow label="Objednatelná"   value={v.requestable} />
          {v.requestable && (
            <>
              <RRow label="Kanál"          value={v.request_channel_type} />
              <RRow label="URL"            value={v.request_channel_url} />
              <RRow label="Schválení"      value={v.approval_required} />
              <RRow label="Dodací lhůta"   value={v.fulfillment_lead_time_text} />
            </>
          )}
          <RRow label="Cílová skupina" value={v.target_audience_summary} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>Klasifikace & Vlastnictví</div>
          <RRow label="Portfolio"        value={v.portfolio_group_code} />
          <RRow label="Bezp. klasifikace" value={v.security_classification} />
          <RRow label="Service Owner"    value={v.service_owner} />
          <RRow label="Vlastník oblasti" value={v.vlastnik} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>SLA & Dostupnost</div>
          <RRow label="Dostupnost" value={v.sla_availability != null ? `${v.sla_availability} %` : null} />
          <RRow label="Domény"     value={v.domains} />
        </div>

        {c3Selected.length > 0 && (
          <div className={styles.reviewSection}>
            <div className={styles.reviewSectionHead}>C3 Mapování</div>
            <RRow label="Capabilities" value={`${c3Selected.length} vybrány (dokončit v editoru)`} />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ MAIN WIZARD ══════════════════════════════════════════════════════════════

export default function NewServiceWizard() {
  const router = useRouter();
  const { c3Visible } = useInstallStatus();

  const { data: serviceTypes }          = useServiceTypes();
  const { data: portfolioGroups }       = usePortfolioGroups();
  const { data: serviceLines }          = useServiceLines();
  const { data: orgElements }           = useOrganizationalElements();
  const { data: globalServiceGroups }   = useGlobalServiceGroups();
  const { data: securityClassifications } = useSecurityClassifications();
  const { data: networkDomains }        = useNetworkDomains();

  const domainOptions = useMemo(
    () => networkDomains?.map((d) => d.code) ??
      ['NEXUS','VERTEX','ORBIT','PULSE','RELAY','CLOUD','GRID','PRISM','HELIX','ZENITH','APEX','VORTEX'],
    [networkDomains],
  );
  const domainColorMap = useMemo(
    () => new Map((networkDomains ?? []).map((d) => [d.code, d.color_hex ?? undefined])),
    [networkDomains],
  );

  const [step, setStep]             = useState(1);
  const [c3Selected, setC3Selected] = useState<string[]>([]);
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);

  const reviewStep = c3Visible ? 8 : 7;
  const totalSteps = reviewStep;

  const stepDefs: StepDef[] = useMemo(() => [
    { id: 1, label: 'Identita' },
    { id: 2, label: 'Popis' },
    { id: 3, label: 'Přístup' },
    { id: 4, label: 'Klasifikace' },
    { id: 5, label: 'Vlastnictví' },
    { id: 6, label: 'SLA' },
    ...(c3Visible ? [{ id: 7, label: 'C3' }] : []),
    { id: reviewStep, label: 'Přehled' },
  ], [c3Visible, reviewStep]);

  const {
    register, handleSubmit, watch, setValue, trigger,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      service_id: '', title: '', service_type: '',
      service_status: 'draft', lifecycle_state: 'draft',
      requestable: false, approval_required: false,
      domains: [],
      sla_availability: null, sla_restoration: null, sla_delivery: null,
    },
  });

  const toggleC3 = useCallback((uuid: string) => {
    setC3Selected((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid],
    );
  }, []);

  const handleNext = useCallback(async () => {
    if (step === 1) {
      const ok = await trigger(['service_id', 'title', 'service_type']);
      if (!ok) return;
    }
    if (step === 3) {
      const ok = await trigger(['request_channel_url']);
      if (!ok) return;
    }
    if (step === 5) {
      const ok = await trigger(['service_owner_email']);
      if (!ok) return;
    }
    setStep((s) => s + 1);
  }, [step, trigger]);

  const handleBack = useCallback(() => setStep((s) => s - 1), []);

  const onSubmit = async (data: FormData) => {
    const serviceId = data.service_id.trim().toUpperCase();
    setSaving(true);
    setSaveError(null);

    try {
      const body = compactPayload({
        service_id:                  serviceId,
        title:                       data.title.trim(),
        service_type:                data.service_type,
        service_status:              data.service_status || 'draft',
        lifecycle_state:             data.lifecycle_state || 'draft',
        summary:                     data.summary?.trim() || undefined,
        business_summary:            data.business_summary?.trim() || undefined,
        consumer_value:              data.consumer_value?.trim() || undefined,
        value_proposition:           data.value_proposition?.trim() || undefined,
        requestable:                 data.requestable ?? false,
        request_channel_type:        data.request_channel_type?.trim() || undefined,
        request_channel_url:         data.request_channel_url?.trim() || undefined,
        approval_required:           data.approval_required ?? false,
        fulfillment_lead_time_text:  data.fulfillment_lead_time_text?.trim() || undefined,
        target_audience_summary:     data.target_audience_summary?.trim() || undefined,
        portfolio_group_code:        data.portfolio_group_code || undefined,
        service_line_code:           data.service_line_code || undefined,
        organizational_element_code: data.organizational_element_code || undefined,
        global_service_group_code:   data.global_service_group_code || undefined,
        security_classification:     data.security_classification || undefined,
        sla_availability:            data.sla_availability ?? null,
        sla_restoration:             data.sla_restoration ?? null,
        sla_delivery:                data.sla_delivery ?? null,
        notes_json:                  c3Selected.length > 0
          ? JSON.stringify({ c3_pending: c3Selected, source: 'wizard' })
          : undefined,
      });

      const res = await fetch('/api/v1/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        let parsed: { error?: string } | null = null;
        try { parsed = JSON.parse(text) as { error?: string }; } catch { /* ignore */ }
        throw new Error(parsed?.error ?? (text || `POST /services ${res.status}`));
      }

      const created = (await res.json()) as { service_id?: string };
      const createdId = created.service_id ?? serviceId;

      if ((data.domains ?? []).length > 0) {
        await updateDomains(createdId, data.domains ?? []);
      }

      if (data.service_owner?.trim()) {
        await updateRole(createdId, {
          roleCode: 'service_owner',
          displayName: data.service_owner.trim(),
          email: data.service_owner_email?.trim() ?? '',
          orgName: data.service_owner_org?.trim() || undefined,
        });
      }
      if (data.vlastnik?.trim()) {
        await updateRole(createdId, { roleCode: 'service_area_owner', displayName: data.vlastnik.trim() });
      }
      if (data.manager?.trim()) {
        await updateRole(createdId, { roleCode: 'service_delivery_manager', displayName: data.manager.trim() });
      }

      router.push(`/services/${createdId}/edit`);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Vytvoření selhalo — zkuste znovu');
    } finally {
      setSaving(false);
    }
  };

  const formProps: StepFormProps = { register, watch, setValue, errors };
  const isReview = step === reviewStep;

  return (
    <div className={styles.wizardShell}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/management">Content Admin</Link>
        <span>›</span>
        <span>Nová služba</span>
      </div>

      {/* Header */}
      <div className={styles.wizardHeader}>
        <h1 className={styles.wizardTitle}>Průvodce zavedením služby</h1>
        <p className={styles.wizardSubtitle}>
          Projděte kroky pro ITIL-compliant záznam v katalogu. Každé pole má krátkou nápovědu
          — detailní vysvětlení otevřete tlačítkem <strong>?</strong>.
          Placeholdery (modrá kurzíva) ukazují příklady hodnot.
        </p>
      </div>

      {/* Progress */}
      <StepProgress current={step} steps={stepDefs} />

      {/* Steps */}
      {step === 1 && <Step1Identity {...formProps} serviceTypes={serviceTypes} />}
      {step === 2 && <Step2Description {...formProps} />}
      {step === 3 && <Step3Access {...formProps} />}
      {step === 4 && (
        <Step4Classification
          {...formProps}
          portfolioGroups={portfolioGroups}
          serviceLines={serviceLines}
          orgElements={orgElements}
          globalServiceGroups={globalServiceGroups}
          securityClassifications={securityClassifications}
        />
      )}
      {step === 5 && <Step5Ownership {...formProps} />}
      {step === 6 && (
        <Step6Sla {...formProps} domainOptions={domainOptions} domainColorMap={domainColorMap} />
      )}
      {c3Visible && step === 7 && (
        <Step7C3 selectedUuids={c3Selected} onToggle={toggleC3} />
      )}
      {isReview && <StepReview watch={watch} c3Selected={c3Selected} />}

      {/* Error */}
      {saveError && (
        <div className={styles.errorBanner}>⚠ {saveError}</div>
      )}

      {/* Nav */}
      <div className={styles.navBar}>
        <div className={styles.navLeft}>
          {step > 1 && (
            <Button variant="ghost" size="sm" onClick={handleBack} type="button">
              ← Zpět
            </Button>
          )}
          <span className={styles.stepCounter}>Krok {step} z {totalSteps}</span>
        </div>
        <div className={styles.navRight}>
          {!isReview && (
            <Button variant="secondary" size="sm" onClick={() => { void handleNext(); }} type="button">
              Další →
            </Button>
          )}
          {isReview && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => { void handleSubmit(onSubmit)(); }}
              disabled={saving}
              loading={saving}
              type="button"
            >
              ✓ Vytvořit službu
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
