/**
 * §9.3 Service Editor — v2 editor form with left sub-navigation + sticky save bar.
 * Manual save, react-hook-form + zod, PUT /services/:id + /domains + /roles
 */
'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import PageHeader from '@/app/components/PageHeader';
import { CodeEditor, ConflictModal, EditorSubNav, StickySaveBar, UserPicker, type EditorSubNavSection, type SaveState } from '@/app/components/layout-v2';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useService, useServices, usePortfolioGroups, useServiceTypes, useServiceLines, useNetworkDomains, useC3Taxonomy, useServiceRoles, useSecurityClassifications, useServiceReadiness } from '@/features/services/hooks/useServices';
import { updateService, updateDomains, updateRole, type ServiceUpdateBody } from '@/features/services/api/editor.api';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { useServiceSla } from '@/features/services/hooks/useServices';
import type { SlaRecord } from '@/features/services/model/service.types';
import { useT } from '@/app/i18n/useI18n';
import styles from './editor.module.css';
import { LIFECYCLE_TRANSITIONS, lifecycleStageLabelKey, selectableLifecycleStages, toLifecycleStage } from '@/features/services/lifecycle';

import { schema, type FormData } from './_editor/schema';
import { ActiveEditorTabContext, EDITOR_TABS, SECTION_FIELD_MAP, editorTabOfSection } from './_editor/editorTabs';
import { EditorSection, Field, OperationalReadinessPanel, fieldClass, isConflictMessage, type OfferingInheritedValues } from './_editor/EditorFields';
import { useFlavourEvidence } from './_editor/useFlavourEvidence';
import { useServiceModelEditor } from './_editor/useServiceModelEditor';
import { useRelationEditor } from './_editor/useRelationEditor';
import { useC3MappingEditor } from './_editor/useC3MappingEditor';
import { OfferingsPanel } from './_editor/OfferingsPanel';
import { RelationsPanel } from './_editor/RelationsPanel';
import { C3MappingPanel } from './_editor/C3MappingPanel';
import { SupportModelPanel } from './_editor/SupportModelPanel';
import { AudiencePanel } from './_editor/AudiencePanel';
import { OperationalLinksPanel } from './_editor/OperationalLinksPanel';

interface Props { params: Promise<{ id: string }> }

export default function ServiceEditorPage({ params }: Props) {
  const { id } = use(params);
  const t = useT();
  const router  = useRouter();
  const { data: svc, mutate } = useService(id);
  const { data: portfolioGroups } = usePortfolioGroups();
  const { data: serviceTypes }    = useServiceTypes();
  const { data: networkDomains }  = useNetworkDomains();
  const domainOptions = networkDomains?.map(d => d.code) ?? ['NEXUS','VERTEX','ORBIT','PULSE','RELAY','CLOUD','GRID','PRISM','HELIX','ZENITH','APEX','VORTEX','MATRIX'];
  const { data: serviceLines }           = useServiceLines();
  const { data: securityClassifications } = useSecurityClassifications();
  const { data: serviceRoles } = useServiceRoles(id);
  const { data: readiness, mutate: mutateReadiness } = useServiceReadiness(id);
  const securityClassificationOptions = securityClassifications?.length
    ? securityClassifications
    : [
        { code: 'OPEN',       name: t('service_editor.text.open'),        sort_order: 0 },
        { code: 'STANDARD',   name: 'Standard',    sort_order: 0 },
        { code: 'ELEVATED',   name: 'Elevated',    sort_order: 0 },
        { code: 'RESTRICTED', name: 'Restricted',  sort_order: 0 },
        { code: 'PROTECTED',  name: 'Protected',   sort_order: 0 },
        { code: 'CLASSIFIED', name: 'Classified',  sort_order: 0 },
        { code: 'SENSITIVE',  name: 'Sensitive',   sort_order: 0 },
        { code: 'CONTROLLED', name: 'Controlled',  sort_order: 0 },
      ];
  // 1F — all services for Target Service ID dropdown (exclude self)
  const { data: allServicesResp } = useServices({ limit: 500 });
  const servicePickerOptions = (allServicesResp?.items ?? []).filter(s => s.service_id !== id);
  // 2F — C3 taxonomy for C3 UUID dropdown + 4F mapping label lookup
  const { data: c3Items } = useC3Taxonomy();
  const c3ItemMap = useMemo(
    () => new Map((c3Items ?? []).map(c => [c.uuid, c])),
    [c3Items],
  );
  const activeRoleMap = useMemo(
    () => new Map((serviceRoles ?? []).filter((role) => !role.valid_to).map((role) => [role.role_code, role])),
    [serviceRoles],
  );
  const [saving,    setSaving]    = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveConflict, setSaveConflict] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);
  const [phase4Saved, setPhase4Saved] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(EDITOR_TABS[0].id);
  const [currentRole, setCurrentRole] = useState(() => getAuthSnapshot()?.role ?? null);
  const canViewAdvancedEvidence = currentRole === 'admin';
  const visibleEditorTabs = useMemo(
    () => EDITOR_TABS.filter((tab) => !tab.adminOnly || canViewAdvancedEvidence),
    [canViewAdvancedEvidence],
  );

  useEffect(() => {
    const syncRole = () => setCurrentRole(getAuthSnapshot()?.role ?? null);
    syncRole();
    window.addEventListener(AUTH_STATE_EVENT, syncRole);
    return () => window.removeEventListener(AUTH_STATE_EVENT, syncRole);
  }, []);

  // ── SLA records (Item 17) ─────────────────────────────────────────────────
  const { data: slaData } = useServiceSla(id);

  const {
    rawFields,
    rawFieldsOpen,
    setRawFieldsOpen,
    flavours,
    flavourError,
  } = useFlavourEvidence({ id });

  const serviceModel = useServiceModelEditor({ id, mutate, setPhase4Saved });
  const {
    offerings,
    supportModels,
    defaultOffering,
  } = serviceModel;

  const relationEditor = useRelationEditor({ id, mutate, mutateReadiness });

  const c3Editor = useC3MappingEditor({ id, mutateReadiness, t });
  const {
    c3Mappings,
  } = c3Editor;


  const { register, handleSubmit, reset, watch, setValue,
          formState: { errors, isDirty, dirtyFields } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: {},
  });

  // ── Unsaved changes protection ────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Populate form when service data loads
  useEffect(() => {
    if (!svc || isDirty) return;
    // available_on is a string[] hydrated by _hydrateService, not a CSV string.
    const currentDomains = Array.isArray(svc.available_on)
      ? svc.available_on
      : svc.available_on
        ? String(svc.available_on).split(',').map((d: string) => d.trim()).filter(Boolean)
        : [];
    const serviceOwnerRole = activeRoleMap.get('service_owner');
    const areaOwnerRole = activeRoleMap.get('service_area_owner');
    const deliveryManagerRole = activeRoleMap.get('service_delivery_manager');
    reset({
      title:                   svc.title,
      service_type:            svc.service_type    ?? '',
      portfolio_group_code:           svc.portfolio_group             ?? '',
      global_service_group_code:      svc.global_service_group_code   ?? '',
      service_line_code:              svc.service_line_code           ?? '',
      organizational_element_code:    svc.organizational_element_code ?? '',
      summary:                 svc.summary         ?? '',
      detailed_description:    svc.detailed_description ?? '',
      service_features:        svc.service_features    ?? '',
      scope_text:              svc.scope_text          ?? '',
      operational_notes_raw:   svc.operational_notes_raw ?? '',
      sla_restoration_text:    svc.sla_restoration_text ?? '',
      sla_delivery_text:       svc.sla_delivery_text   ?? '',
      exclusions:              svc.exclusions          ?? '',
      service_area:            svc.service_area        ?? '',
      security_classification: svc.security_classification ?? '',
      source_url:              svc.source_url      ?? '',
      unit_of_measure:         svc.unit_of_measure ?? '',
      charging_basis:          svc.charging_basis  ?? '',
      consumer_value:          svc.consumer_value ?? '',
      requestable:             svc.requestable ?? false,
      lifecycle_stage_code:    toLifecycleStage(svc.lifecycle_stage_code ?? svc.lifecycle_state ?? svc.service_status) ?? '',
      target_audience_summary: svc.target_audience_summary ?? '',
      request_channel_type:    svc.request_channel_type ?? '',
      request_channel_url:     svc.request_channel_url ?? '',
      approval_required:       svc.approval_required ?? false,
      fulfillment_lead_time_text: svc.fulfillment_lead_time_text ?? '',
      customer_type:           Array.isArray(svc.customer_type) ? (svc.customer_type as string[]).join(', ') : '',
      notes_json:              svc.notes != null ? JSON.stringify(svc.notes, null, 2) : '',
      sla_availability:        svc.sla_availability,
      sla_restoration:         svc.sla_restoration,
      sla_delivery:            svc.sla_delivery,
      service_owner:           svc.service_owner   ?? '',
      service_owner_email:     serviceOwnerRole?.email ?? '',
      vlastnik:                svc.vlastnik        ?? '',
      manager:                 svc.manager         ?? '',
      service_owner_org:       serviceOwnerRole?.organization_name ?? '',
      vlastnik_org:            areaOwnerRole?.organization_name ?? '',
      manager_org:             deliveryManagerRole?.organization_name ?? '',
      domains:                 currentDomains,
    });
  }, [svc, activeRoleMap, isDirty, reset]);

  /* eslint-disable react-hooks/incompatible-library -- U5: React Hook Form watch values drive unsaved-state UX and existing editor conditionals. */
  const watchedDomains      = watch('domains') ?? [];
  const watchedTitle        = watch('title');
  const watchedServiceType  = watch('service_type');
  const watchedRequestable  = watch('requestable');
  const watchedChannelType  = watch('request_channel_type');
  const watchedChannelUrl   = watch('request_channel_url');
  const watchedApproval     = watch('approval_required');
  const watchedLeadTime     = watch('fulfillment_lead_time_text');
  // The service channel is the default; an offering may define its own (inheritance model).
  const hasRequestChannel = !!(watchedChannelType?.trim() || watchedChannelUrl?.trim())
    || offerings.some((offering) => offering.status !== 'deleted' && !!(offering.request_channel_type?.trim() || offering.request_channel_url?.trim()));
  const offeringInherited: OfferingInheritedValues = {
    requestable: watchedRequestable ?? false,
    approval_required: watchedApproval ?? null,
    request_channel_type: watchedChannelType || null,
    request_channel_url: watchedChannelUrl || null,
    lead_time_text: watchedLeadTime || null,
  };
  /* eslint-enable react-hooks/incompatible-library */
  const dirtyCount          = Object.keys(dirtyFields).length;
  const currentLifecycle    = svc ? toLifecycleStage(svc.lifecycle_stage_code ?? svc.lifecycle_state ?? svc.service_status) : null;
  const allowedLifecycleOptions = selectableLifecycleStages(currentLifecycle);

  const publishBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!watchedTitle?.trim()) blockers.push(t('service_editor.text.title_is_required_before_publish'));
    if (!watchedServiceType?.trim()) blockers.push(t('service_editor.text.service_type_is_required_before_publish'));
    if (offerings.length === 0) blockers.push(t('service_editor.text.at_least_one_service_offering_is_required'));
    if (offerings.length > 0 && !defaultOffering) blockers.push(t('service_editor.text.exactly_one_default_offering_must_be_selected'));
    if (watchedRequestable && !hasRequestChannel) {
      blockers.push(t('service_editor.text.requestable_service_needs_a_request_channel_type'));
    }
    if (watchedRequestable && supportModels.length === 0) {
      blockers.push(t('service_editor.text.requestable_service_needs_a_support_model'));
    }
    if (readiness && !readiness.is_publishable) {
      blockers.push(...readiness.blockers.map((blocker) => `Readiness: ${blocker}`));
    }
    return Array.from(new Set(blockers));
  }, [
    defaultOffering,
    hasRequestChannel,
    offerings.length,
    readiness,
    supportModels.length,
    watchedRequestable,
    watchedServiceType,
    watchedTitle,
  ]);

  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTab(tabId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // On submit with field errors, open the first tab that contains one.
  const handleInvalidSubmit = useCallback((fieldErrors: Record<string, unknown>) => {
    const errorKeys = Object.keys(fieldErrors);
    const sectionId = Object.keys(SECTION_FIELD_MAP).find((section) => SECTION_FIELD_MAP[section].some((field) => errorKeys.includes(field)));
    if (sectionId) setActiveTab(editorTabOfSection(sectionId));
  }, []);

  const editorSections: EditorSubNavSection[] = useMemo(() => {
    const errorKeys = new Set(Object.keys(errors));
    const requestWarning = !!watchedRequestable && !hasRequestChannel;
    const sectionBadge = (sectionId: string): Pick<EditorSubNavSection, 'badge' | 'tone'> | null => {
      const sectionErrors = (SECTION_FIELD_MAP[sectionId] ?? []).filter((field) => errorKeys.has(field)).length;
      if (sectionErrors > 0) return { badge: sectionErrors, tone: 'bad' };
      if (sectionId === 'request-access' && requestWarning) return { badge: 'Fix', tone: 'warn' };
      if (sectionId === 'request-access' && offerings.length === 0) return { badge: 'Add', tone: 'orange' };
      if (sectionId === 'request-access' && offerings.length > 0 && !defaultOffering) return { badge: t('service_editor.text.default'), tone: 'warn' };
      if (sectionId === 'ownership-support' && supportModels.length === 0) return { badge: 'Add', tone: 'orange' };
      if (sectionId === 'readiness-governance' && readiness && !readiness.is_publishable) {
        return { badge: readiness.blockers.length || t('service_editor.text.gate'), tone: 'warn' };
      }
      if (sectionId === 'readiness-governance' && c3Mappings.length > 0) return { badge: c3Mappings.length, tone: 'purple' };
      return null;
    };
    return visibleEditorTabs.map((tab, index) => {
      const badges = tab.sections.map(sectionBadge).filter((badge): badge is NonNullable<typeof badge> => badge !== null);
      const errorCount = badges.filter((badge) => badge.tone === 'bad').reduce((sum, badge) => sum + Number(badge.badge), 0);
      const label = `${index + 1}. ${t(`service_editor.tab.${tab.id}`)}`;
      if (errorCount > 0) return { id: tab.id, label, badge: errorCount, tone: 'bad' };
      return { id: tab.id, label, ...(badges[0] ?? {}) };
    });
  }, [c3Mappings.length, defaultOffering, errors, hasRequestChannel, offerings.length, readiness, supportModels.length, t, visibleEditorTabs, watchedRequestable]);

  const saveState: SaveState = saving
    ? 'saving'
    : saveError
      ? 'error'
      : saved || phase4Saved
        ? 'saved'
        : isDirty
          ? 'dirty'
          : 'clean';

  const saveMessage = saveError
    ?? (phase4Saved && !saving ? phase4Saved : null)
    ?? (!saving && publishBlockers.length > 0 ? `${publishBlockers.length} publish blockers` : null)
    ?? (isDirty ? `${dirtyCount} změněných polí` : t('service_editor.text.manual_saving_according_to_v2_design'));

  const onSubmit = async (data: FormData) => {
    setSaving(true); setSaveError(null); setSaveConflict(null); setSaved(false);
    try {
      // 1. Update main service fields
      const serviceUpdate: ServiceUpdateBody = {
        title:                   data.title,
        service_type:            data.service_type,
        portfolio_group_code:        data.portfolio_group_code,
        service_line_code:           data.service_line_code,
        summary:                 data.summary,
        security_classification: data.security_classification,
        retired_note:            data.retired_note,
        scope_text:              data.scope_text,
        exclusions:              data.exclusions,
        consumer_value:          data.consumer_value || null,
        requestable:             data.requestable ?? false,
        lifecycle_stage_code:    data.lifecycle_stage_code || null,
        target_audience_summary: data.target_audience_summary || null,
        request_channel_type:    data.request_channel_type || null,
        request_channel_url:     data.request_channel_url || null,
        approval_required:       data.approval_required ?? false,
        fulfillment_lead_time_text: data.fulfillment_lead_time_text || null,
        sla_availability:        data.sla_availability,
        sla_restoration:         data.sla_restoration,
        sla_delivery:            data.sla_delivery,
      };

      if (canViewAdvancedEvidence) {
        Object.assign(serviceUpdate, {
          source_url:              data.source_url,
          unit_of_measure:         data.unit_of_measure,
          charging_basis:          data.charging_basis,
          rate_note:               data.rate_note,
          ordering_note:           data.ordering_note,
          operational_notes_raw:   data.operational_notes_raw,
          sla_restoration_text:    data.sla_restoration_text,
          sla_delivery_text:       data.sla_delivery_text,
          customer_type:           data.customer_type
            ? JSON.stringify(data.customer_type.split(',').map((s: string) => s.trim()).filter(Boolean))
            : null,
          notes_json:              data.notes_json,
        });
      }

      await updateService(id, serviceUpdate);

      // 2. Update domains (separate PUT)
      if (dirtyFields.domains && data.domains) {
        await updateDomains(id, data.domains);
      }

      // 3. Update roles (separate PUT per role)
      if (dirtyFields.service_owner || dirtyFields.service_owner_email || dirtyFields.service_owner_org) {
        await updateRole(id, { roleCode: 'service_owner', displayName: data.service_owner || null, email: data.service_owner_email, orgName: data.service_owner_org || undefined });
      }
      if (dirtyFields.vlastnik || dirtyFields.vlastnik_org) {
        await updateRole(id, { roleCode: 'service_area_owner', displayName: data.vlastnik || null, orgName: data.vlastnik_org || undefined });
      }
      if (dirtyFields.manager || dirtyFields.manager_org) {
        await updateRole(id, { roleCode: 'service_delivery_manager', displayName: data.manager || null, orgName: data.manager_org || undefined });
      }

      await mutate();
      await mutateReadiness();
      setSaved(true);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : t('service_editor.text.save_failed');
      if (isConflictMessage(message)) {
        setSaveConflict(message);
      }
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = () => {
    if (publishBlockers.length > 0) {
      setSaveError(publishBlockers[0]);
      const targetSection = publishBlockers[0].startsWith('Readiness')
        ? 'readiness-governance'
        : publishBlockers[0].includes('offering')
          ? 'request-access'
          : publishBlockers[0].includes('support')
            ? 'ownership-support'
            : publishBlockers[0].includes('request')
              ? 'request-access'
              : 'identity';
      handleTabSelect(editorTabOfSection(targetSection));
      return;
    }
    setValue('lifecycle_stage_code', 'active', { shouldDirty: true, shouldValidate: true });
    void handleSubmit((data) => onSubmit({ ...data, lifecycle_stage_code: 'active' }))();
  };

  if (!svc) return <div className={styles.state}>{t('common.loading')}</div>;

  return (
    <ActiveEditorTabContext.Provider value={activeTab}>
    <form className={styles.shell} onSubmit={handleSubmit(onSubmit, handleInvalidSubmit)}>
      <div className={styles.stickyHeader}>
        <PageHeader
          title={`Editor služby — ${svc.title}`}
          purpose={t('service_editor.tab.purpose')}
          chips={[
            { label: `ID ${id}`, tone: 'neutral' },
            { label: `Lifecycle: ${currentLifecycle ? t(lifecycleStageLabelKey(currentLifecycle)) : '—'}`, tone: currentLifecycle === 'active' ? 'ok' : 'info' },
            { label: `Completeness ${svc.completeness_score ?? '—'}%`, tone: (svc.completeness_score ?? 0) >= 80 ? 'ok' : 'warn' },
          ]}
          primaryAction={{ label: t('service_editor.text.back_to_detail'), href: `/services/${id}` }}
        />
      </div>

      <div className={styles.editorBody}>
        <EditorSubNav
          title={t('service_editor.text.service_editor')}
          summary={t('service_editor.tab.summary')}
          sections={editorSections}
          activeId={activeTab}
          onSelect={handleTabSelect}
        />

        {/* ── Form sections ─────────────────────────────────────────── */}
        <div className={styles.formArea}>
          <div className={styles.editorSignals}>
            <div className={styles.signalCard}>
              <span className={styles.signalLabel}>{t('service_editor.text.operational_readiness')}</span>
              <OperationalReadinessPanel
                requestable={watchedRequestable}
                channelType={watchedChannelType}
                channelUrl={watchedChannelUrl}
                offeringHasChannel={hasRequestChannel}
                supportModelCount={supportModels.length}
                offeringsCount={offerings.length}
                defaultOfferingTitle={defaultOffering?.title ?? null}
              />
            </div>
            <div className={styles.signalCard}>
              <span className={styles.signalLabel}>{t('service_editor.text.validation')}</span>
              {Object.entries(errors).length > 0
                ? Object.entries(errors).slice(0, 3).map(([field, error]) => (
                    <div key={field} className={styles.validationError}>
                      {field}: {(error as { message?: string }).message}
                    </div>
                  ))
                : <div className={styles.validOk}>{t('service_editor.text.no_field_errors')}</div>
              }
            </div>
          </div>
          <div className={publishBlockers.length > 0 ? styles.publishGateWarn : styles.publishGateOk}>
            <div className={styles.publishGateTitle}>
              <span>{t('service_editor.text.save_publish_gate')}</span>
              <strong>{publishBlockers.length > 0 ? `${publishBlockers.length} blockers` : t('service_editor.text.ready_to_publish')}</strong>
            </div>
            {publishBlockers.length > 0 ? (
              <ul className={styles.publishGateList}>
                {publishBlockers.slice(0, 5).map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            ) : (
              <p>{t('service_editor.text.draft_can_be_saved_or_promoted_to_live_from_the')}</p>
            )}
          </div>

          {/* §1 Identita */}
          <EditorSection id="identity" title={t('service_editor.section.identity')}>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.service_id')}>
                <input className={styles.readOnlyInput} value={id} disabled readOnly aria-label={t('service_editor.text.service_id')} />
              </Field>
              <Field label={t('service_editor.text.title')} error={errors.title?.message}>
                <input {...register('title')} className={fieldClass(errors.title)} />
              </Field>
              <Field label={t('service_editor.text.service_type')} error={errors.service_type?.message}>
                <select {...register('service_type')} className={fieldClass(errors.service_type)}>
                  <option value="">{t('service_editor.text.select')}</option>
                  {serviceTypes?.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
                </select>
              </Field>
              <Field label={t('service_editor.lifecycle.label')}>
                <select {...register('lifecycle_stage_code')} className={styles.input}>
                  <option value="">{t('service_editor.text.select')}</option>
                  {allowedLifecycleOptions.map((stage) => (
                    <option key={stage} value={stage}>
                      {t(lifecycleStageLabelKey(stage))}{stage === currentLifecycle ? ` (${t('service_editor.lifecycle.current')})` : ''}
                    </option>
                  ))}
                </select>
                {currentLifecycle && (
                  <span className={styles.hint}>
                    {t('service_editor.lifecycle.allowed_next', {
                      stages: LIFECYCLE_TRANSITIONS[currentLifecycle].map((stage) => t(lifecycleStageLabelKey(stage))).join(', '),
                    })}
                  </span>
                )}
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.portfolio_group')}>
                <select {...register('portfolio_group_code')} className={styles.input} aria-label={t('service_editor.text.portfolio_group')}>
                  <option value="">{t('service_editor.text.select')}</option>
                  {portfolioGroups?.map(pg => <option key={pg.code} value={pg.code}>{pg.name}</option>)}
                </select>
              </Field>
              <Field label={t('service_editor.text.service_line')}>
                <select {...register('service_line_code')} className={styles.input} aria-label={t('service_editor.text.service_line')}>
                  <option value="">{t('service_editor.text.select')}</option>
                  {serviceLines?.map(sl => <option key={sl.code} value={sl.code}>{sl.name}</option>)}
                </select>
              </Field>
              <Field label={t('service_editor.text.security_classification')}>
                <select {...register('security_classification')} className={styles.input} aria-label={t('service_editor.text.security_classification')}>
                  <option value="">{t('service_editor.text.select')}</option>
                  {securityClassificationOptions.map((classification) => (
                    <option key={classification.code} value={classification.code}>
                      {classification.code} — {classification.name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </EditorSection>

          {/* §2 Hodnota a rozsah */}
          <EditorSection id="value-scope" title={t('service_editor.section.value_scope')}>
            <span id="description" className={styles.anchorAlias} aria-hidden="true" />
            <Field label={t('service_editor.text.short_description_summary')}>
              <textarea {...register('summary')} rows={2} className={styles.textarea} />
            </Field>
            <Field label={t('service_editor.text.consumer_value')} hint={t('service_editor.text.what_value_does_this_service_deliver_to_its_cons')}>
              <textarea
                {...register('consumer_value')}
                rows={2}
                className={styles.textarea}
                placeholder={t('service_editor.text.e_g_enables_teams_to_self_serve_x_without_waitin')}
              />
            </Field>
            <Field label={t('service_editor.text.scope')}>
              <textarea {...register('scope_text')} rows={3} className={styles.textarea} placeholder={t('service_editor.text.describe_the_scope_of_this_service')} />
            </Field>
            <Field label={t('service_editor.text.exclusions')}>
              <textarea {...register('exclusions')} rows={3} className={styles.textarea} placeholder={t('service_editor.text.what_is_explicitly_not_covered_by_this_service')} />
            </Field>
          </EditorSection>

          <EditorSection id="request-access" title={t('service_editor.section.request_access')}>
            <span id="catalogue-access" className={styles.anchorAlias} aria-hidden="true" />
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.request_channel_type')}>
                <input {...register('request_channel_type')} className={styles.input} placeholder={t('service_editor.text.portal_form_email_marketplace')} />
              </Field>
              <Field label={t('service_editor.text.request_channel_url')} error={errors.request_channel_url?.message}>
                <input {...register('request_channel_url')} className={fieldClass(errors.request_channel_url)} placeholder="https://…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.target_audience_summary')}>
                <input {...register('target_audience_summary')} className={styles.input} placeholder={t('service_editor.text.internal_staff_project_teams_suppliers')} />
              </Field>
              <Field label={t('service_editor.text.fulfillment_lead_time')}>
                <input {...register('fulfillment_lead_time_text')} className={styles.input} placeholder={t('service_editor.text.e_g_3_business_days')} />
              </Field>
            </div>
            <div className={styles.toggleRow}>
              <label className={styles.domainCheck}>
                <input type="checkbox" {...register('requestable')} />
                <span>{t('service_editor.text.requestable')}</span>
              </label>
              <label className={styles.domainCheck}>
                <input type="checkbox" {...register('approval_required')} />
                <span>{t('service_editor.text.approval_required')}</span>
              </label>
            </div>
            {watchedRequestable && !hasRequestChannel && (
              <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                <span className={styles.crossFieldAlertIcon}>⚠</span>
                {t('service_editor.text.this_service_is_marked')}{' '}<strong>{t('service_editor.text.requestable')}</strong> {t('service_editor.text.but_has_no_request_channel_type_or_url_consumers')}
              </div>
            )}
            {watchedRequestable && supportModels.length === 0 && (
              <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                <span className={styles.crossFieldAlertIcon}>⚠</span>
                {t('service_editor.text.this_service_is_requestable_but_has_no')}{' '}<strong>{t('service_editor.text.support_model')}</strong>. Consumers won&apos;t know who to contact for help. Add one in the Ownership and support tab.
              </div>
            )}
            <p className={styles.hint}>
              {t('service_editor.text.these_fields_power_the_business_facing_overview')}
            </p>
          </EditorSection>

          {/* §4 Vlastnictví a support */}
          <EditorSection id="ownership-support" title={t('service_editor.section.ownership')}>
            <span id="ownership" className={styles.anchorAlias} aria-hidden="true" />
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.service_owner')}>
                <input {...register('service_owner')} className={styles.input} placeholder={t('service_editor.text.display_name')} />
              </Field>
              <div className={styles.field}>
                <UserPicker
                  label={t('service_editor.text.owner_email')}
                  scope="owners"
                  value={watch('service_owner_email') ?? ''}
                  onChange={(value) => setValue('service_owner_email', value, { shouldDirty: true, shouldValidate: true })}
                  required={false}
                />
                {errors.service_owner_email?.message && <span className={styles.fieldError}>{errors.service_owner_email.message}</span>}
              </div>
              <Field label={t('service_editor.text.service_delivery_manager')} hint={t('service_editor.text.fill_in_only_if_a_delivery_process_exists_for_th')}>
                <input {...register('manager')} className={styles.input} placeholder={t('service_editor.text.display_name')} />
              </Field>
            </div>
            <p className={styles.hint}>{t('service_editor.text.role_history_remains_audited_legacy_owner_organi')}</p>
          </EditorSection>

          {/* §5 Dostupnost a vazby */}
          <EditorSection id="availability-relations" title={t('service_editor.section.sla_availability')}>
            <span id="availability" className={styles.anchorAlias} aria-hidden="true" />
            <div className={styles.hint}>
              {t('service_editor.text.sla_evidence_is_included_in')}{' '}<a href="/api/v1/export/bundle">{t('service_editor.text.full_export_bundle')}</a>.
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.sla_availability')} error={errors.sla_availability?.message}>
                <input type="number" min={0} max={100} step={0.01} {...register('sla_availability')} className={fieldClass(errors.sla_availability)} />
              </Field>
              <Field label={t('service_editor.text.sla_restoration_hours')} error={errors.sla_restoration?.message}>
                <input type="number" min={0} {...register('sla_restoration')} className={fieldClass(errors.sla_restoration)} />
              </Field>
              <Field label={t('service_editor.text.sla_delivery_days')} error={errors.sla_delivery?.message}>
                <input type="number" min={0} {...register('sla_delivery')} className={fieldClass(errors.sla_delivery)} />
              </Field>
            </div>
            <Field label={t('service_editor.text.available_on_domains')}>
              <div className={styles.domainGrid}>
                {domainOptions.map(d => (
                  <label key={d} className={styles.domainCheck}>
                    <input
                      type="checkbox"
                      checked={watchedDomains.includes(d)}
                      onChange={e => {
                        const next = e.target.checked
                          ? [...watchedDomains, d]
                          : watchedDomains.filter(x => x !== d);
                        setValue('domains', next, { shouldDirty: true });
                      }}
                    />
                    <span>{d}</span>
                  </label>
                ))}
              </div>
            </Field>

            {/* ── Legacy variant SLA overrides ─────────────────────────────── */}
            {canViewAdvancedEvidence && (
            <details className={styles.advancedDetails}>
              <summary className={styles.advancedSummary}>{t('service_editor.text.deprecated_legacy_variant_sla_overrides')}</summary>
              <div className={styles.advancedDetailsBody}>
              <div className={styles.slaSubsection}>
              <div className={styles.slaSubtitle}>{t('service_editor.text.legacy_variant_sla_overrides_are_read_only')}</div>
              <p className={styles.hint}>
                {t('service_editor.text.new_sla_evidence_is_maintained_at_service_level')}
              </p>
              {slaData && slaData.sla_records.filter(r => r.flavour_code != null).length > 0 && (
                <div className={styles.slaRecordList}>
                  {(slaData.sla_records.filter(r => r.flavour_code != null) as SlaRecord[]).map(r => (
                    <div key={r.id} className={styles.slaRecordRow}>
                      <span className={styles.slaRecordFlavour}>{r.flavour_title ?? r.flavour_code}</span>
                      <span>{r.availability_pct != null ? `${r.availability_pct}%` : '—'}</span>
                      <span>{r.restoration_hours != null ? `${r.restoration_hours}h` : '—'}</span>
                      <span>{r.delivery_days != null ? `${r.delivery_days}d` : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              {slaData && slaData.sla_records.filter(r => r.flavour_code != null).length === 0 && (
                <p className={styles.hint}>{t('service_editor.text.no_legacy_variant_sla_overrides_exist_for_this_s')}</p>
              )}
              </div>
              </div>
            </details>
            )}
          </EditorSection>

          {/* §6 Legacy variant evidence — read-only */}
          <EditorSection id="flavours" title={t('service_editor.section.legacy_flavours')} hidden={!canViewAdvancedEvidence}>
            <div className={styles.hint}>
              {t('service_editor.text.legacy_variant_data_is_retained_for_history_and')}
            </div>
            {flavourError && <div className={styles.errorBanner}>{flavourError}</div>}
            {flavours.length > 0 ? (
              <div className={styles.flavourList}>
                {flavours.map(f => (
                  <div key={f.id} className={styles.flavourRow}>
                    <span className={styles.flavourName}>{f.title || f.flavour_code}</span>
                    <span className={styles.flavourMeta}>{f.service_unit ?? '—'}</span>
                    <span className={styles.flavourMeta}>
                      {f.price_value != null ? `${f.price_value.toLocaleString()} ${f.currency_code ?? '€'}` : '—'}
                    </span>
                    <span className={styles.flavourMeta}>{f.billing_period_code ?? '—'}</span>
                    <span className={styles.flavourMeta}>{f.lifecycle_cost != null ? `€${f.lifecycle_cost.toLocaleString()}` : '—'}</span>
                    {f.is_orderable && <span className={styles.relBadgeGreen}>{t('service_editor.text.legacy_orderable')}</span>}
                    <span className={styles.flavourMeta}>{f.flavour_status_code ?? '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>{t('service_editor.text.no_legacy_variant_evidence_is_defined_use_servic')}</p>
            )}
          </EditorSection>

          <EditorSection id="offerings" title={t('service_editor.section.offerings')}>
            <OfferingsPanel t={t} model={serviceModel} inherited={offeringInherited} />
          </EditorSection>

          {/* §7 Relationships — managed add/delete */}
          <EditorSection id="relationships" title={t('service_editor.section.relationships')}>
            <RelationsPanel id={id} t={t} relations={relationEditor} svc={svc} servicePickerOptions={servicePickerOptions} />
          </EditorSection>

          {/* §6 Readiness a governance */}
          <EditorSection id="readiness-governance" title={t('service_editor.section.c3_governance')}>
            <C3MappingPanel t={t} c3={c3Editor} c3ItemMap={c3ItemMap} readiness={readiness} />
            <Field label={t('service_editor.text.retired_end_of_life_note')}>
              <textarea {...register('retired_note')} rows={3} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="support-model" title={t('service_editor.section.support_model')}>
            <SupportModelPanel model={serviceModel} watchedRequestable={watchedRequestable} />
          </EditorSection>

          <EditorSection id="audience" title={t('service_editor.section.audience')}>
            <AudiencePanel model={serviceModel} />
          </EditorSection>

          <EditorSection id="operational-links" title={t('service_editor.section.operational_links')}>
            <OperationalLinksPanel model={serviceModel} />
          </EditorSection>

          {/* §7 Advanced evidence */}
          <EditorSection id="advanced-evidence" title={t('service_editor.section.advanced_evidence')} hidden={!canViewAdvancedEvidence}>
            <p className={styles.hint}>
              {t('service_editor.text.admin_import_evidence_only_these_fields_preserve')}
            </p>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.service_url')} error={errors.source_url?.message}>
                <input {...register('source_url')} className={fieldClass(errors.source_url)} placeholder="https://…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.unit_of_measure')}>
                <input {...register('unit_of_measure')} className={styles.input} />
              </Field>
              <Field label={t('service_editor.text.charging_basis')}>
                <input {...register('charging_basis')} className={styles.input} />
              </Field>
              <Field label={t('service_editor.text.rate_note')}>
                <input {...register('rate_note')} className={styles.input} />
              </Field>
            </div>
            <Field label={t('service_editor.text.ordering_note')}>
              <textarea {...register('ordering_note')} rows={2} className={styles.textarea} />
            </Field>
            {/* Item 7: Operational Notes */}
            <Field label={t('service_editor.text.operational_notes')}>
              <textarea {...register('operational_notes_raw')} rows={3} className={styles.textarea} placeholder={t('service_editor.text.internal_operational_notes_escalation_paths_etc')} />
            </Field>
            {/* Legacy SLA text fields kept as import evidence */}
            <div className={styles.fieldRow}>
              <Field label={t('service_editor.text.sla_restoration_text')}>
                <textarea {...register('sla_restoration_text')} rows={2} className={styles.textarea} placeholder={t('service_editor.text.free_text_restoration_sla_description')} />
              </Field>
              <Field label={t('service_editor.text.sla_delivery_text')}>
                <textarea {...register('sla_delivery_text')} rows={2} className={styles.textarea} placeholder={t('service_editor.text.free_text_delivery_sla_description')} />
              </Field>
            </div>
            <Field label={t('service_editor.text.customer_type')}>
              <input
                {...register('customer_type')}
                className={styles.input}
                placeholder={t('service_editor.text.e_g_internal_external_partner_comma_separated')}
              />
              <span className={styles.hint}>{t('service_editor.text.customer_segments_this_service_targets_comma_sep')}</span>
            </Field>
            {/* Item 13: notes_json editable */}
            <Field label={t('service_editor.text.notes_json')}>
              <CodeEditor
                name="notes_json"
                label={t('service_editor.text.notes_json_2')}
                language="json"
                value={watch('notes_json') ?? ''}
                onValueChange={(value) => setValue('notes_json', value, { shouldDirty: true, shouldValidate: true })}
                rows={4}
                placeholder={'{\n  "key": "value"\n}'}
              />
              <span className={styles.hint}>{t('service_editor.text.free_form_json_notes_read_from_import')}</span>
            </Field>
          </EditorSection>

          {/* §10 Raw fields — audit trail */}
          <EditorSection id="raw-fields" title={t('service_editor.section.raw_fields')} hidden={!canViewAdvancedEvidence}>
            <p className={styles.hint}>
              {t('service_editor.text.source_texts_from_import_serve_as_audit_evidence')}
            </p>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setRawFieldsOpen(o => !o)}
              style={{ marginBottom: 12 }}
            >
              {rawFieldsOpen ? t('service_editor.text.hide_source_evidence') : t('service_editor.text.show_source_evidence')}
            </button>
            {rawFieldsOpen && (
              rawFields.length === 0
                ? <p className={styles.hint}>{t('service_editor.text.no_source_evidence_the_service_was_not_imported')}</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {rawFields.map(rf => (
                      <div key={rf.id} style={{
                        background: 'var(--color-bg-canvas)',
                        border: '1px solid var(--color-border-default)',
                        borderRadius: 'var(--radius-sm)',
                        padding: '10px 14px',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <code style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)' }}>
                            {rf.field_name}
                          </code>
                          {rf.parser_version && (
                            <span style={{ fontSize: 10, color: 'var(--color-text-muted)', border: '1px solid var(--color-border-subtle)', borderRadius: 3, padding: '0 4px' }}>
                              v{rf.parser_version}
                            </span>
                          )}
                          <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--color-text-muted)' }}>
                            {new Date(rf.created_at).toLocaleString('cs-CZ', { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                        </div>
                        <pre style={{
                          margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          fontSize: 11, color: 'var(--color-text-primary)',
                          maxHeight: 160, overflow: 'auto',
                        }}>
                          {rf.raw_value}
                        </pre>
                      </div>
                    ))}
                  </div>
            )}
          </EditorSection>

        </div>

      </div>
      <StickySaveBar
        state={saveState}
        message={saveMessage}
        disabled={!isDirty || saving}
        publishDisabled={saving || publishBlockers.length > 0}
        primaryLabel="Save draft"
        publishLabel="Save & publish"
        secondaryLabel="Zahodit a zpět"
        onSave={() => void handleSubmit(onSubmit)()}
        onPublish={handlePublish}
        onDiscard={() => {
          if (isDirty && !confirm(t('service_editor.text.you_have_unsaved_changes_leave_anyway'))) return;
          router.push(`/services/${id}`);
        }}
      />
      {saveConflict && (
        <ConflictModal
          details={saveConflict}
          onClose={() => setSaveConflict(null)}
          onReload={() => {
            setSaveConflict(null);
            window.location.reload();
          }}
        />
      )}
    </form>
    </ActiveEditorTabContext.Provider>
  );
}
