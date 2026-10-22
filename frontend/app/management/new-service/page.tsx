'use client';
/**
 * Service Onboarding Wizard — /management/new-service/page.tsx
 *
 * Multi-step průvodce založením služby do katalogu.
 *
 * Kroky:
 *   1  Identita           — Service ID, Title, Type, Lifecycle
 *   2  Popis a hodnota    — summary, consumer_value
 *   3  Přístup & Audience — requestable, request model, target audience
 *   4  Klasifikace        — portfolio, service_line, org_element, security
 *   5  Vlastnictví        — service_owner, vlastnik, manager
 *   6  SLA & Domény       — availability, SLA, domains
 *   7  C3 mapování        — (podmíněno instalací modulu C3_TAXONOMY)
 *   8  Přehled & Vytvoření
 *
 * Každé pole má:
 *   - krátkou produktovou nápovědu inline (italic, muted)
 *   - ? tlačítko s delším vysvětlením (Radix Tooltip)
 *   - placeholder v modré kurzívě (ukázkové hodnoty)
 */

import { cloneElement, isValidElement, useState, useCallback, useEffect, useId, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { optionalNumber } from '@/shared/utils/zodFields';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';

import Link from '@/app/components/AppLink';
import { WizardStepTracker } from '@/app/components/layout-v2';
import {
  usePortfolioGroups, useServiceTypes, useNetworkDomains,
  useServiceLines, useOrganizationalElements, useGlobalServiceGroups,
  useSecurityClassifications, useC3Taxonomy,
} from '@/features/services/hooks/useServices';
import { authHeaders } from '@/features/services/api/services.api';
import { updateDomains, updateRole } from '@/features/services/api/editor.api';
import { useInstallStatus } from '@/features/install/installStatus';
import { Button } from '@/design-system/controls/Button';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';

import styles from './wizard.module.css';

// ── Product help text per field ──────────────────────────────────────────────

const HELP_FIELDS = new Set([
  'service_id',
  'title',
  'service_type',
  'lifecycle_state',
  'summary',
  'consumer_value',
  'requestable',
  'request_channel_type',
  'request_channel_url',
  'approval_required',
  'fulfillment_lead_time_text',
  'target_audience_summary',
  'portfolio_group_code',
  'service_line_code',
  'organizational_element_code',
  'global_service_group_code',
  'security_classification',
  'service_owner',
  'service_owner_email',
  'vlastnik',
  'manager',
  'sla_availability',
  'domains',
  'c3_mapping',
]);

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  service_id:                   z.string().min(1, 'new_service_wizard.validation.service_id_required').max(20, 'new_service_wizard.validation.service_id_max'),
  title:                        z.string().min(1, 'new_service_wizard.validation.title_required'),
  service_type:                 z.string().min(1, 'new_service_wizard.validation.service_type_required'),
  service_status:               z.string().optional(),
  lifecycle_state:              z.string().optional(),
  summary:                      z.string().optional(),
  consumer_value:               z.string().optional(),
  requestable:                  z.boolean().optional(),
  request_channel_type:         z.string().optional(),
  request_channel_url:          z.string().url('new_service_wizard.validation.url_invalid').optional().or(z.literal('')),
  approval_required:            z.boolean().optional(),
  fulfillment_lead_time_text:   z.string().optional(),
  target_audience_summary:      z.string().optional(),
  portfolio_group_code:         z.string().optional(),
  service_line_code:            z.string().optional(),
  organizational_element_code:  z.string().optional(),
  global_service_group_code:    z.string().optional(),
  security_classification:      z.string().optional(),
  service_owner:                z.string().optional(),
  service_owner_email:          z.string().email('new_service_wizard.validation.email_invalid').optional().or(z.literal('')),
  service_owner_org:            z.string().optional(),
  vlastnik:                     z.string().optional(),
  manager:                      z.string().optional(),
  sla_availability:             optionalNumber(0, 100),
  sla_restoration:              optionalNumber(0),
  sla_delivery:                 optionalNumber(0),
  domains:                      z.array(z.string()).optional(),
  notes_json:                   z.string().optional(),
});

type FormData = z.output<typeof schema>;

const DRAFT_KEY = 'sc_new_service_draft';

const DEFAULT_FORM_VALUES: Partial<FormData> = {
  service_id: '',
  title: '',
  service_type: '',
  service_status: 'draft',
  lifecycle_state: 'draft',
  requestable: false,
  approval_required: false,
  domains: [],
  sla_availability: null,
  sla_restoration: null,
  sla_delivery: null,
};

interface WizardDraft {
  data?: Partial<FormData>;
  c3Selected?: string[];
  step?: number;
  savedAt?: string;
}

function compactPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  ) as Partial<T>;
}

// ── WizardTooltip ─────────────────────────────────────────────────────────────

function WizardTooltip({ content }: { content: string }) {
  const t = useT();
  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <button type="button" className={styles.tooltipTrigger} aria-label={t('new_service_wizard.more_info')}>
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
  const t = useT();
  const generatedId = useId();
  // Tie the visible label to the control so clicking it focuses the field and
  // screen readers announce it.
  const childId = isValidElement<{ id?: string }>(children) ? children.props.id ?? generatedId : undefined;
  const control = childId && isValidElement<{ id?: string }>(children) ? cloneElement(children, { id: childId }) : children;
  const help = fieldKey && HELP_FIELDS.has(fieldKey)
    ? {
        short: t(`new_service_wizard.help.${fieldKey}.short`),
        long: t(`new_service_wizard.help.${fieldKey}.long`),
      }
    : undefined;
  return (
    <div className={styles.fieldWrapper}>
      <div className={styles.fieldLabelRow}>
        <label className={styles.fieldLabel} htmlFor={childId}>
          {label}
          {required && <span className={styles.fieldRequired}> *</span>}
        </label>
        {help?.long && <WizardTooltip content={help.long} />}
      </div>
      {help?.short && <div className={styles.fieldHint}>{help.short}</div>}
      {control}
      {error && <div className={styles.fieldError}>{t(error)}</div>}
    </div>
  );
}

// ── StepProgress ──────────────────────────────────────────────────────────────

interface StepDef { id: number; label: string }

function StepProgress({ current, steps }: { current: number; steps: StepDef[] }) {
  return (
    <WizardStepTracker
      activeId={String(current)}
      steps={steps.map((item) => ({
        id: String(item.id),
        label: item.label,
        state: current > item.id ? 'done' : current === item.id ? 'active' : 'todo',
      }))}
    />
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LIFECYCLE_OPTIONS = [
  { value: 'draft',        labelKey: 'new_service_wizard.lifecycle.draft' },
  { value: 'live',         labelKey: 'new_service_wizard.lifecycle.live' },
  { value: 'deprecated',   labelKey: 'new_service_wizard.lifecycle.deprecated' },
  { value: 'retired',      labelKey: 'new_service_wizard.lifecycle.retired' },
];

// Values are stored as request_channel_type; only the visible labels are translated.
const CHANNEL_OPTIONS = [
  { value: 'ITSM Portal',        labelKey: 'new_service_wizard.channel.itsm_portal' },
  { value: 'E-mail',             labelKey: 'new_service_wizard.channel.email' },
  { value: 'Teams',              labelKey: 'new_service_wizard.channel.teams' },
  { value: 'Self-service portál', labelKey: 'new_service_wizard.channel.self_service' },
  { value: 'Telefon',            labelKey: 'new_service_wizard.channel.phone' },
  { value: 'API',                labelKey: 'new_service_wizard.channel.api' },
];

// ── Step props type ───────────────────────────────────────────────────────────

interface StepFormProps {
  register: ReturnType<typeof useForm<FormData>>['register'];
  watch:    ReturnType<typeof useForm<FormData>>['watch'];
  setValue: ReturnType<typeof useForm<FormData>>['setValue'];
  errors:   ReturnType<typeof useForm<FormData>>['formState']['errors'];
}

// ═══ STEP 1 — Identita ═══════════════════════════════════════════════════════

function Step1Identity({ register, watch, errors, serviceTypes }: StepFormProps & {
  serviceTypes: Array<{ code: string; name: string }> | undefined;
}) {
  const t = useT();
  const watchedId    = watch('service_id');
  const watchedTitle = watch('title');

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.identity.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.identity.description')}
        </p>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="service_id" label={t('new_service_wizard.field.service_id')} required error={errors.service_id?.message}>
          <input
            {...register('service_id', { setValueAs: (v) => String(v ?? '').toUpperCase() })}
            className={[styles.input, errors.service_id ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder={t('new_service_wizard.placeholder.example', { value: 'WPS001' })}
            maxLength={20}
            style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}
          />
          {watchedId?.trim() && (
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 3, fontFamily: 'var(--font-mono)' }}>
              → {watchedId.trim().toUpperCase()}
            </div>
          )}
        </WizardField>

        <WizardField fieldKey="title" label={t('new_service_wizard.field.title')} required error={errors.title?.message}>
          <input
            {...register('title')}
            className={[styles.input, errors.title ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder={t('new_service_wizard.placeholder.title')}
          />
        </WizardField>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="service_type" label={t('new_service_wizard.field.service_type')} required error={errors.service_type?.message}>
          <select
            {...register('service_type')}
            className={[styles.input, errors.service_type ? styles.inputError : ''].filter(Boolean).join(' ')}
          >
            <option value="">{t('new_service_wizard.identity.select_type')}</option>
            {serviceTypes?.map((type) => (
              <option key={type.code} value={type.code}>{type.code} — {type.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="lifecycle_state" label={t('new_service_wizard.field.lifecycle_state')}>
          <select {...register('lifecycle_state')} className={styles.input}>
            <option value="">{t('new_service_wizard.identity.select_state')}</option>
            {LIFECYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{t(o.labelKey)}</option>
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
          ✓ {t('new_service_wizard.identity.preview')} <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-primary)' }}>
            {watchedId.trim().toUpperCase()}
          </strong> — {watchedTitle}
        </div>
      )}
    </div>
  );
}

// ═══ STEP 2 — Popis a hodnota ═════════════════════════════════════════════════

function Step2Description({ register }: StepFormProps) {
  const t = useT();
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.description.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.description.description')}
        </p>
      </div>

      <WizardField fieldKey="summary" label={t('new_service_wizard.field.summary')}>
        <textarea
          {...register('summary')}
          rows={2}
          className={styles.textarea}
          placeholder={t('new_service_wizard.placeholder.summary')}
        />
      </WizardField>

      <WizardField fieldKey="consumer_value" label={t('new_service_wizard.field.consumer_value')}>
        <textarea
          {...register('consumer_value')}
          rows={2}
          className={styles.textarea}
          placeholder={t('new_service_wizard.placeholder.consumer_value')}
        />
      </WizardField>
    </div>
  );
}

// ═══ STEP 3 — Přístup & audience ══════════════════════════════════════════════

function Step3Access({ register, watch, setValue, errors }: StepFormProps) {
  const t = useT();
  const isRequestable = watch('requestable') === true;
  const channelType   = watch('request_channel_type') ?? '';
  const isApproval    = watch('approval_required') === true;

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.access.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.access.description')}
        </p>
      </div>

      <WizardField fieldKey="requestable" label={t('new_service_wizard.field.requestable')}>
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
              {isRequestable ? t('new_service_wizard.access.requestable_on') : t('new_service_wizard.access.requestable_off')}
            </div>
            <div className={styles.toggleRowSub}>
              {isRequestable
                ? t('new_service_wizard.access.requestable_on_hint')
                : t('new_service_wizard.access.requestable_off_hint')}
            </div>
          </div>
          <div className={[styles.toggleCheckmark, isRequestable ? styles.toggleCheckmarkActive : ''].filter(Boolean).join(' ')}>
            {isRequestable ? '✓' : ''}
          </div>
        </div>
      </WizardField>

      {isRequestable && (
        <div className={styles.conditionalBlock}>
          <div className={styles.conditionalBlockTitle}>{t('new_service_wizard.access.request_model_title')}</div>

          <WizardField fieldKey="request_channel_type" label={t('new_service_wizard.field.request_channel_type')}>
            <div className={styles.channelOptions}>
              {CHANNEL_OPTIONS.map((ch) => (
                <button
                  key={ch.value}
                  type="button"
                  className={[styles.channelChip, channelType === ch.value ? styles.channelChipActive : ''].filter(Boolean).join(' ')}
                  onClick={() => setValue('request_channel_type', channelType === ch.value ? '' : ch.value, { shouldDirty: true })}
                >
                  {t(ch.labelKey)}
                </button>
              ))}
            </div>
          </WizardField>

          <WizardField fieldKey="request_channel_url" label={t('new_service_wizard.field.request_channel_url')} error={errors.request_channel_url?.message}>
            <input
              {...register('request_channel_url')}
              className={[styles.input, errors.request_channel_url ? styles.inputError : ''].filter(Boolean).join(' ')}
              placeholder={t('new_service_wizard.placeholder.example', { value: 'https://itsm.company.com/catalog/email-service' })}
              type="url"
            />
          </WizardField>

          <WizardField fieldKey="fulfillment_lead_time_text" label={t('new_service_wizard.field.fulfillment_lead_time_text')}>
            <input
              {...register('fulfillment_lead_time_text')}
              className={styles.input}
              placeholder={t('new_service_wizard.placeholder.fulfillment_lead_time_text')}
            />
          </WizardField>

          <WizardField fieldKey="approval_required" label={t('new_service_wizard.field.approval_required')}>
            <label className={styles.approvalRow}>
              <input
                type="checkbox"
                checked={isApproval}
                onChange={(e) => setValue('approval_required', e.target.checked, { shouldDirty: true })}
              />
              <span>{t('new_service_wizard.access.approval_checkbox')}</span>
            </label>
          </WizardField>
        </div>
      )}

      <WizardField fieldKey="target_audience_summary" label={t('new_service_wizard.field.target_audience_summary')}>
        <textarea
          {...register('target_audience_summary')}
          rows={2}
          className={styles.textarea}
          placeholder={t('new_service_wizard.placeholder.target_audience_summary')}
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
  const t = useT();
  const SEC_FALLBACK = [
    { code: 'OPEN', name: 'Open' }, { code: 'STANDARD', name: 'Standard' },
    { code: 'ELEVATED', name: 'Elevated' }, { code: 'RESTRICTED', name: 'Restricted' },
    { code: 'PROTECTED', name: 'Protected' }, { code: 'CLASSIFIED', name: 'Classified' },
  ];
  const secOptions = (securityClassifications?.length ? securityClassifications : SEC_FALLBACK);
  const selectPlaceholder = t('new_service_wizard.select_placeholder');

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.classification.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.classification.description')}
        </p>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="portfolio_group_code" label={t('new_service_wizard.field.portfolio_group_code')}>
          <select {...register('portfolio_group_code')} className={styles.input}>
            <option value="">{selectPlaceholder}</option>
            {portfolioGroups?.map((g) => (
              <option key={g.code} value={g.code}>{g.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="global_service_group_code" label={t('new_service_wizard.field.global_service_group_code')}>
          <select {...register('global_service_group_code')} className={styles.input}>
            <option value="">{selectPlaceholder}</option>
            {globalServiceGroups?.map((g) => (
              <option key={g.code} value={g.code}>{g.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="service_line_code" label={t('new_service_wizard.field.service_line_code')}>
          <select {...register('service_line_code')} className={styles.input}>
            <option value="">{selectPlaceholder}</option>
            {serviceLines?.map((l) => (
              <option key={l.code} value={l.code}>{l.name}</option>
            ))}
          </select>
        </WizardField>

        <WizardField fieldKey="organizational_element_code" label={t('new_service_wizard.field.organizational_element_code')}>
          <select {...register('organizational_element_code')} className={styles.input}>
            <option value="">{selectPlaceholder}</option>
            {orgElements?.map((e) => (
              <option key={e.code} value={e.code}>{e.name}</option>
            ))}
          </select>
        </WizardField>
      </div>

      <WizardField fieldKey="security_classification" label={t('new_service_wizard.field.security_classification')}>
        <select {...register('security_classification')} className={styles.input}>
          <option value="">{t('new_service_wizard.classification.select_classification')}</option>
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
  const t = useT();
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.ownership.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.ownership.description')}
        </p>
      </div>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="service_owner" label={t('new_service_wizard.field.service_owner')}>
          <input
            {...register('service_owner')}
            className={styles.input}
            placeholder={t('new_service_wizard.placeholder.service_owner')}
          />
        </WizardField>

        <WizardField fieldKey="service_owner_email" label={t('new_service_wizard.field.service_owner_email')} error={errors.service_owner_email?.message}>
          <input
            {...register('service_owner_email')}
            type="email"
            className={[styles.input, errors.service_owner_email ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder={t('new_service_wizard.placeholder.service_owner_email')}
          />
        </WizardField>
      </div>

      <WizardField label={t('new_service_wizard.field.service_owner_org')}>
        <input
          {...register('service_owner_org')}
          className={styles.input}
          placeholder={t('new_service_wizard.placeholder.service_owner_org')}
        />
      </WizardField>

      <div className={styles.fieldRow2}>
        <WizardField fieldKey="vlastnik" label={t('new_service_wizard.field.vlastnik')}>
          <input
            {...register('vlastnik')}
            className={styles.input}
            placeholder={t('new_service_wizard.placeholder.vlastnik')}
          />
        </WizardField>

        <WizardField fieldKey="manager" label={t('new_service_wizard.field.manager')}>
          <input
            {...register('manager')}
            className={styles.input}
            placeholder={t('new_service_wizard.placeholder.manager')}
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
  const t = useT();
  const watchedDomains = watch('domains');
  const selectedDomains = useMemo(() => watchedDomains ?? [], [watchedDomains]);

  const toggleDomain = useCallback((code: string) => {
    const next = selectedDomains.includes(code)
      ? selectedDomains.filter((d) => d !== code)
      : [...selectedDomains, code];
    setValue('domains', next, { shouldDirty: true });
  }, [selectedDomains, setValue]);

  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.sla.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.sla.description')}
        </p>
      </div>

      <div className={styles.slaGrid}>
        <WizardField fieldKey="sla_availability" label={t('new_service_wizard.field.sla_availability')}>
          <input
            {...register('sla_availability')}
            type="number"
            min={0}
            max={100}
            step={0.01}
            className={styles.input}
            placeholder={t('new_service_wizard.placeholder.example', { value: '99.9' })}
          />
          <div className={styles.slaUnit}>{t('new_service_wizard.sla.availability_unit')}</div>
        </WizardField>

        <WizardField label={t('new_service_wizard.field.sla_restoration')}>
          <input
            {...register('sla_restoration')}
            type="number"
            min={0}
            step={0.5}
            className={styles.input}
            placeholder={t('new_service_wizard.placeholder.example', { value: '4' })}
          />
          <div className={styles.slaUnit}>{t('new_service_wizard.sla.restoration_unit')}</div>
        </WizardField>

        <WizardField label={t('new_service_wizard.field.sla_delivery')}>
          <input
            {...register('sla_delivery')}
            type="number"
            min={0}
            step={0.5}
            className={styles.input}
            placeholder={t('new_service_wizard.placeholder.example', { value: '2' })}
          />
          <div className={styles.slaUnit}>{t('new_service_wizard.sla.delivery_unit')}</div>
        </WizardField>
      </div>

      <WizardField fieldKey="domains" label={t('new_service_wizard.field.domains')}>
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
            {t('new_service_wizard.sla.selected_domains', { items: selectedDomains.join(', ') })}
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
  const t = useT();
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
        <h2 className={styles.stepTitle}>{t('new_service_wizard.c3.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.c3.description')}
        </p>
      </div>

      <WizardField fieldKey="c3_mapping" label={t('new_service_wizard.field.c3_mapping')}>
        <div className={styles.c3InfoBanner}>
          {t('new_service_wizard.c3.info')}
        </div>

        <div className={styles.c3SearchInput}>
          <input
            type="search"
            className={styles.input}
            placeholder={t('new_service_wizard.c3.search_placeholder')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className={styles.c3List}>
          {filtered.length === 0 && (
            <div className={styles.c3EmptyState}>
              {c3Items ? t('new_service_wizard.c3.no_results') : t('new_service_wizard.c3.loading')}
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
            {t(resolveCountForm(selectedUuids.length, {
              one: 'new_service_wizard.c3.selected.one',
              few: 'new_service_wizard.c3.selected.few',
              many: 'new_service_wizard.c3.selected.many',
            }), { count: selectedUuids.length })}
          </div>
        )}

        <div className={styles.c3PostNote}>
          {t('new_service_wizard.c3.post_note_before')}{' '}
          <strong>{t('service_editor.section.c3_governance')}</strong>
          {t('new_service_wizard.c3.post_note_after')}
        </div>
      </WizardField>
    </div>
  );
}

// ═══ STEP REVIEW ══════════════════════════════════════════════════════════════

function RRow({ label, value }: { label: string; value: unknown }) {
  const t = useT();
  const isEmpty = value === '' || value === null || value === undefined ||
    (Array.isArray(value) && (value as unknown[]).length === 0);
  return (
    <div className={styles.reviewRow}>
      <span className={styles.reviewKey}>{label}</span>
      {isEmpty
        ? <span className={styles.reviewValEmpty}>—</span>
        : <span className={styles.reviewVal}>
            {typeof value === 'boolean'
              ? (value ? t('new_service_wizard.review.yes') : t('new_service_wizard.review.no'))
              : Array.isArray(value)
                ? (value as string[]).join(', ')
                : String(value)}
          </span>
      }
    </div>
  );
}

function StepReview({ watch, c3Selected }: { watch: StepFormProps['watch']; c3Selected: string[] }) {
  const t = useT();
  const v = watch();
  return (
    <div className={styles.stepCard}>
      <div className={styles.stepHeader}>
        <h2 className={styles.stepTitle}>{t('new_service_wizard.review.title')}</h2>
        <p className={styles.stepDescription}>
          {t('new_service_wizard.review.description')}
        </p>
      </div>

      <div className={styles.reviewGrid}>
        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>{t('new_service_wizard.review.section.identity')}</div>
          <RRow label={t('new_service_wizard.field.service_id')}   value={v.service_id} />
          <RRow label={t('new_service_wizard.review.title_label')} value={v.title} />
          <RRow label={t('new_service_wizard.field.service_type')} value={v.service_type} />
          <RRow label={t('new_service_wizard.review.lifecycle')}   value={v.lifecycle_state} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>{t('new_service_wizard.review.section.description')}</div>
          <RRow label={t('new_service_wizard.review.summary')}        value={v.summary} />
          <RRow label={t('new_service_wizard.field.consumer_value')} value={v.consumer_value} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>{t('new_service_wizard.review.section.access')}</div>
          <RRow label={t('new_service_wizard.review.requestable')} value={v.requestable} />
          {v.requestable && (
            <>
              <RRow label={t('new_service_wizard.review.channel')}                  value={v.request_channel_type} />
              <RRow label="URL"                                                       value={v.request_channel_url} />
              <RRow label={t('new_service_wizard.review.approval')}                 value={v.approval_required} />
              <RRow label={t('new_service_wizard.field.fulfillment_lead_time_text')} value={v.fulfillment_lead_time_text} />
            </>
          )}
          <RRow label={t('new_service_wizard.field.target_audience_summary')} value={v.target_audience_summary} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>{t('new_service_wizard.review.section.classification_ownership')}</div>
          <RRow label={t('new_service_wizard.review.portfolio')}               value={v.portfolio_group_code} />
          <RRow label={t('new_service_wizard.field.security_classification')} value={v.security_classification} />
          <RRow label={t('new_service_wizard.field.service_owner')}           value={v.service_owner} />
          <RRow label={t('new_service_wizard.field.vlastnik')}                value={v.vlastnik} />
        </div>

        <div className={styles.reviewSection}>
          <div className={styles.reviewSectionHead}>{t('new_service_wizard.review.section.sla')}</div>
          <RRow label={t('new_service_wizard.review.availability')} value={v.sla_availability != null ? `${v.sla_availability} %` : null} />
          <RRow label={t('new_service_wizard.review.domains')}      value={v.domains} />
        </div>

        {c3Selected.length > 0 && (
          <div className={styles.reviewSection}>
            <div className={styles.reviewSectionHead}>{t('new_service_wizard.review.section.c3')}</div>
            <RRow
              label={t('new_service_wizard.review.capabilities')}
              value={t(resolveCountForm(c3Selected.length, {
                one: 'new_service_wizard.review.c3_selected.one',
                few: 'new_service_wizard.review.c3_selected.few',
                many: 'new_service_wizard.review.c3_selected.many',
              }), { count: c3Selected.length })}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ MAIN WIZARD ══════════════════════════════════════════════════════════════

export default function NewServiceWizard() {
  const router = useRouter();
  const t = useT();
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
    { id: 1, label: t('new_service_wizard.steps.identity') },
    { id: 2, label: t('new_service_wizard.steps.description') },
    { id: 3, label: t('new_service_wizard.steps.access') },
    { id: 4, label: t('new_service_wizard.steps.classification') },
    { id: 5, label: t('new_service_wizard.steps.ownership') },
    { id: 6, label: t('new_service_wizard.steps.sla') },
    ...(c3Visible ? [{ id: 7, label: t('new_service_wizard.steps.c3') }] : []),
    { id: reviewStep, label: t('new_service_wizard.steps.review') },
  ], [c3Visible, reviewStep, t]);

  const {
    register, handleSubmit, watch, setValue, trigger, reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: DEFAULT_FORM_VALUES,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as WizardDraft;
      if (draft.data) reset({ ...DEFAULT_FORM_VALUES, ...draft.data });
      if (Array.isArray(draft.c3Selected)) setC3Selected(draft.c3Selected.filter(Boolean));
      if (draft.step && draft.step >= 1 && draft.step <= reviewStep) setStep(draft.step);
    } catch {
      window.localStorage.removeItem(DRAFT_KEY);
    }
  }, [reset, reviewStep]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line react-hooks/incompatible-library -- U5: React Hook Form watch subscription is used only to persist the wizard draft.
    const subscription = watch((value) => {
      const draft: WizardDraft = {
        data: value as Partial<FormData>,
        c3Selected,
        step,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    });
    return () => subscription.unsubscribe();
  }, [c3Selected, step, watch]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const draft: WizardDraft = {
      data: watch(),
      c3Selected,
      step,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [c3Selected, step, watch]);

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
        consumer_value:              data.consumer_value?.trim() || undefined,
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

      if (typeof window !== 'undefined') window.localStorage.removeItem(DRAFT_KEY);
      router.push(`/services/${createdId}/edit`);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : t('new_service_wizard.error.create_failed'));
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
        <Link href="/services/list">{t('new_service_wizard.breadcrumb.services')}</Link>
        <span>›</span>
        <span>{t('new_service_wizard.breadcrumb.current')}</span>
      </div>

      {/* Header */}
      <div className={styles.wizardHeader}>
        <h1 className={styles.wizardTitle}>{t('new_service_wizard.title')}</h1>
        <p className={styles.wizardSubtitle}>
          {t('new_service_wizard.subtitle_before')} <strong>?</strong>
          {t('new_service_wizard.subtitle_after')}
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
              {t('new_service_wizard.nav.back')}
            </Button>
          )}
          <span className={styles.stepCounter}>{t('new_service_wizard.nav.step_counter', { step, total: totalSteps })}</span>
        </div>
        <div className={styles.navRight}>
          {!isReview && (
            <Button variant="secondary" size="sm" onClick={() => { void handleNext(); }} type="button">
              {t('new_service_wizard.nav.next')}
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
              {t('new_service_wizard.nav.create')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
