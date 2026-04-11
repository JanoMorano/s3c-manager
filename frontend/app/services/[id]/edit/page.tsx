/**
 * §9.3 Service Editor — Pattern C: editor form + sticky summary rail
 * 9 sections, react-hook-form + zod, PUT /services/:id + /domains + /roles
 */
'use client';

import { use, useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useService, useServices, usePortfolioGroups, useServiceTypes, useServiceLines, useOrganizationalElements, useNetworkDomains, useGlobalServiceGroups, useC3Taxonomy, useServiceRoles, useSecurityClassifications, useServiceReadiness } from '@/features/services/hooks/useServices';
import {
  updateService, updateDomains, updateRole,
  fetchServiceFlavours, createFlavour, updateFlavour, deleteFlavour,
  createRelation, deleteRelation, updateRelation,
  type FlavourRecord, type FlavourBody, type RelationPatch,
} from '@/features/services/api/editor.api';
import { authHeaders } from '@/features/services/api/services.api';
import { useServiceSla } from '@/features/services/hooks/useServices';
import type { SlaRecord, ServiceC3Mapping } from '@/features/services/model/service.types';
import { StatusPill } from '@/features/services/components/StatusPill';
import { Button }     from '@/design-system/controls/Button';
import { TextInput }  from '@/design-system/controls/TextInput';
import { Select }     from '@/design-system/controls/Select';
import { Checkbox }   from '@/design-system/controls/Checkbox';
import styles from './editor.module.css';

// ── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  title:                  z.string().min(1, 'Title is required'),
  service_type:           z.string().min(1, 'Service type is required'),
  service_status:         z.string().optional(),
  portfolio_group_code:           z.string().optional(),
  global_service_group_code:      z.string().optional(),
  service_line_code:              z.string().optional(),
  organizational_element_code:    z.string().optional(),
  summary:                z.string().optional(),
  detailed_description:   z.string().optional(),
  value_proposition:      z.string().optional(),
  business_purpose:       z.string().optional(),
  service_features:       z.string().optional(),
  // Item 7: narrative text fields
  scope_text:             z.string().optional(),
  operational_notes_raw:  z.string().optional(),
  sla_restoration_text:   z.string().optional(),
  sla_delivery_text:      z.string().optional(),
  exclusions:             z.string().optional(),
  service_area:           z.string().optional(),
  security_classification:z.string().optional(),
  source_url:             z.string().url('Must be a valid URL').optional().or(z.literal('')),
  unit_of_measure:        z.string().optional(),
  charging_basis:         z.string().optional(),
  rate_note:              z.string().optional(),
  ordering_note:          z.string().optional(),
  retired_note:           z.string().optional(),
  customer_type:          z.string().optional(),
  // Item 13: notes_json
  notes_json:             z.string().optional(),
  sla_availability:       z.coerce.number().min(0).max(100).optional().nullable(),
  sla_restoration:        z.coerce.number().min(0).optional().nullable(),
  sla_delivery:           z.coerce.number().min(0).optional().nullable(),
  // Ownership (separate API calls)
  service_owner:          z.string().optional(),
  service_owner_email:    z.string().email().optional().or(z.literal('')),
  vlastnik:               z.string().optional(),
  manager:                z.string().optional(),
  service_owner_org:      z.string().optional(),
  vlastnik_org:           z.string().optional(),
  manager_org:            z.string().optional(),
  // Domains (separate API call)
  domains:                z.array(z.string()).optional(),
});

type FormData = z.infer<typeof schema>;

const STATUS_OPTIONS    = ['active','retired','deprecated','draft'];
const RELATION_TYPES    = ['prerequisite','underlying','replaces','depends_on','related_to'];
const FLAVOUR_STATUSES  = ['available','active','retired'];

interface Props { params: Promise<{ id: string }> }

export default function ServiceEditorPage({ params }: Props) {
  const { id } = use(params);
  const router  = useRouter();
  const { data: svc, mutate } = useService(id);
  const { data: portfolioGroups } = usePortfolioGroups();
  const { data: serviceTypes }    = useServiceTypes();
  const { data: networkDomains }  = useNetworkDomains();
  const domainOptions = networkDomains?.map(d => d.code) ?? ['NEXUS','VERTEX','ORBIT','PULSE','RELAY','CLOUD','GRID','PRISM','HELIX','ZENITH','APEX','VORTEX','MATRIX'];
  const { data: serviceLines }           = useServiceLines();
  const { data: orgElements }            = useOrganizationalElements();
  const { data: globalServiceGroups }    = useGlobalServiceGroups();
  const { data: securityClassifications } = useSecurityClassifications();
  const { data: serviceRoles } = useServiceRoles(id);
  const { data: readiness, mutate: mutateReadiness } = useServiceReadiness(id);
  const securityClassificationOptions = securityClassifications?.length
    ? securityClassifications
    : [
        { code: 'OPEN',       name: 'Open',        sort_order: 0 },
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
  const [saved,     setSaved]     = useState(false);

  // ── SLA records (Item 17) ─────────────────────────────────────────────────
  const { data: slaData, mutate: mutateSla } = useServiceSla(id);
  const [slaForm, setSlaForm] = useState<{ flavour_id?: number|null; availability_pct?: string; restoration_hours?: string; delivery_days?: string; support_window_code?: string; sla_note_raw?: string; priority_model_raw?: string }>({});

  // Flavours from all services for the SLA select.
  const [dash6Flavours, setDash6Flavours] = useState<Array<{ id: number; flavour_code: string; title: string | null; service_id: string; service_title: string }>>([]);
  useEffect(() => {
    fetch('/api/v1/flavours?all=1', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setDash6Flavours)
      .catch(() => {});
  }, []);

  // ── Raw fields — audit trail (ServiceRawField) ────────────────────────────
  const [rawFields, setRawFields] = useState<Array<{ id: number; field_name: string; raw_value: string; parser_version: string | null; created_at: string }>>([]);
  const [rawFieldsOpen, setRawFieldsOpen] = useState(false);
  useEffect(() => {
    if (!rawFieldsOpen) return;
    fetch(`/api/v1/services/${id}/raw-fields`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setRawFields)
      .catch(() => {});
  }, [id, rawFieldsOpen]);
  const [showSlaAdd,  setShowSlaAdd]  = useState(false);
  const [slaBusy,     setSlaBusy]     = useState(false);
  const [slaError,    setSlaError]    = useState<string | null>(null);

  const handleSlaAdd = async () => {
    setSlaBusy(true); setSlaError(null);
    try {
      const body: Record<string, unknown> = {};
      if (slaForm.flavour_id != null) body.flavour_id = slaForm.flavour_id;
      if (slaForm.availability_pct)  body.availability_pct  = parseFloat(slaForm.availability_pct);
      if (slaForm.restoration_hours) body.restoration_hours = parseFloat(slaForm.restoration_hours);
      if (slaForm.delivery_days)     body.delivery_days     = parseFloat(slaForm.delivery_days);
      if (slaForm.support_window_code) body.support_window_code = slaForm.support_window_code;
      if (slaForm.sla_note_raw)      body.sla_note_raw      = slaForm.sla_note_raw;
      await fetch(`/api/v1/services/${id}/sla`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      setSlaForm({}); setShowSlaAdd(false);
      await mutateSla();
    } catch (e: unknown) { setSlaError(e instanceof Error ? e.message : 'Failed'); }
    finally { setSlaBusy(false); }
  };

  const handleSlaDelete = async (slaId: number) => {
    if (!confirm('Delete this SLA record?')) return;
    setSlaBusy(true); setSlaError(null);
    try {
      await fetch(`/api/v1/services/${id}/sla/${slaId}`, { method: 'DELETE', headers: authHeaders() });
      await mutateSla();
    } catch (e: unknown) { setSlaError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setSlaBusy(false); }
  };

  // ── Flavours state ───────────────────────────────────────────────────────
  const [flavours,      setFlavours]      = useState<FlavourRecord[]>([]);
  const [flavourBusy,   setFlavourBusy]   = useState(false);
  const [flavourError,  setFlavourError]  = useState<string | null>(null);
  const [editFlavourId, setEditFlavourId] = useState<number | null>(null);
  const [flavourForm,   setFlavourForm]   = useState<FlavourBody>({});
  const [showFlavourAdd, setShowFlavourAdd] = useState(false);

  const loadFlavours = useCallback(async () => {
    try {
      setFlavours(await fetchServiceFlavours(id));
      await mutateReadiness();
    } catch { /* ignore */ }
  }, [id, mutateReadiness]);

  useEffect(() => { loadFlavours(); }, [loadFlavours]);

  const handleFlavourSave = async () => {
    setFlavourBusy(true); setFlavourError(null);
    try {
      if (editFlavourId != null) {
        await updateFlavour(editFlavourId, flavourForm);
      } else {
        await createFlavour(id, flavourForm);
      }
      setEditFlavourId(null); setFlavourForm({}); setShowFlavourAdd(false);
      await loadFlavours();
    } catch (e: unknown) {
      setFlavourError(e instanceof Error ? e.message : 'Save failed');
    } finally { setFlavourBusy(false); }
  };

  const handleFlavourDelete = async (fid: number) => {
    if (!confirm('Delete this pricing variant?')) return;
    setFlavourBusy(true); setFlavourError(null);
    try { await deleteFlavour(fid); await loadFlavours(); }
    catch (e: unknown) { setFlavourError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setFlavourBusy(false); }
  };

  // ── Relations state ──────────────────────────────────────────────────────
  const [relBusy,       setRelBusy]       = useState(false);
  const [relError,      setRelError]      = useState<string | null>(null);
  const [showRelAdd,    setShowRelAdd]    = useState(false);
  const [relForm,       setRelForm]       = useState({ to_service_id: '', relation_type: 'depends_on', relation_label: '' });
  // Inline edit existing relation
  const [editRelId,     setEditRelId]     = useState<number | null>(null);
  const [editRelForm,   setEditRelForm]   = useState<RelationPatch>({});

  const handleRelAdd = async () => {
    if (!relForm.to_service_id.trim()) { setRelError('Target service ID is required'); return; }
    setRelBusy(true); setRelError(null);
    try {
      await createRelation({ from_service_id: id, to_service_id: relForm.to_service_id.trim(), relation_type: relForm.relation_type, relation_label: relForm.relation_label || undefined });
      setRelForm({ to_service_id: '', relation_type: 'depends_on', relation_label: '' });
      setShowRelAdd(false);
      await mutate();
      await mutateReadiness();
    } catch (e: unknown) { setRelError(e instanceof Error ? e.message : 'Failed to add'); }
    finally { setRelBusy(false); }
  };

  const handleRelEditOpen = (r: { id: number; relation_type: string; relation_label?: string | null; impact_mode?: string | null; impact_level?: string | null; is_verified?: boolean | null; pace_code?: string | null }) => {
    setEditRelId(r.id);
    setEditRelForm({
      relation_type:  r.relation_type,
      relation_label: r.relation_label ?? undefined,
      impact_mode:    r.impact_mode    ?? undefined,
      impact_level:   r.impact_level   ?? undefined,
      is_verified:    r.is_verified    ?? undefined,
      pace_code:      r.pace_code      ?? undefined,
    });
  };

  const handleRelEditSave = async () => {
    if (editRelId == null) return;
    setRelBusy(true); setRelError(null);
    try {
      await updateRelation(editRelId, editRelForm);
      setEditRelId(null); setEditRelForm({});
      await mutate();
      await mutateReadiness();
    } catch (e: unknown) { setRelError(e instanceof Error ? e.message : 'Save failed'); }
    finally { setRelBusy(false); }
  };

  const handleRelDelete = async (relId: number) => {
    if (!confirm('Delete this relationship?')) return;
    setRelBusy(true); setRelError(null);
    try { await deleteRelation(relId); await mutate(); await mutateReadiness(); }
    catch (e: unknown) { setRelError(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setRelBusy(false); }
  };

  // ── C3 Taxonomy mappings ──────────────────────────────────────────────────
  const [c3Mappings,   setC3Mappings]   = useState<ServiceC3Mapping[]>([]);
  const [c3Busy,       setC3Busy]       = useState(false);
  const [c3Error,      setC3Error]      = useState<string | null>(null);
  const [showC3Add,    setShowC3Add]    = useState(false);
  const [c3Form,       setC3Form]       = useState({ c3_uuid: '', mapping_type_code: 'supports', is_primary: false, mapping_note: '' });

  const loadC3Mappings = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}`, { headers: authHeaders() });
      if (r.ok) setC3Mappings(await r.json());
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadC3Mappings(); }, [loadC3Mappings]);

  const handleC3Add = async () => {
    if (!c3Form.c3_uuid.trim()) { setC3Error('C3 UUID is required'); return; }
    setC3Busy(true); setC3Error(null);
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(c3Form),
      });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${r.status}`); }
      setC3Form({ c3_uuid: '', mapping_type_code: 'supports', is_primary: false, mapping_note: '' });
      setShowC3Add(false);
      await loadC3Mappings();
      await mutateReadiness();
    } catch (e: unknown) { setC3Error(e instanceof Error ? e.message : 'Failed'); }
    finally { setC3Busy(false); }
  };

  const handleC3Delete = async (mappingId: number) => {
    if (!confirm('Remove this C3 taxonomy mapping?')) return;
    setC3Busy(true); setC3Error(null);
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}/${mappingId}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      await loadC3Mappings();
      await mutateReadiness();
    } catch (e: unknown) { setC3Error(e instanceof Error ? e.message : 'Delete failed'); }
    finally { setC3Busy(false); }
  };

  const { register, handleSubmit, reset, watch, setValue,
          formState: { errors, isDirty, dirtyFields } } = useForm<FormData>({
    resolver: zodResolver(schema),
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
      service_status:          svc.service_status  ?? '',
      portfolio_group_code:           svc.portfolio_group             ?? '',
      global_service_group_code:      svc.global_service_group_code   ?? '',
      service_line_code:              svc.service_line_code           ?? '',
      organizational_element_code:    svc.organizational_element_code ?? '',
      summary:                 svc.summary         ?? '',
      detailed_description:    svc.detailed_description ?? '',
      value_proposition:       svc.value_proposition   ?? '',
      business_purpose:        svc.business_purpose    ?? '',
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

  const watchedDomains = watch('domains') ?? [];
  const dirtyCount     = Object.keys(dirtyFields).length;

  const onSubmit = async (data: FormData) => {
    setSaving(true); setSaveError(null); setSaved(false);
    try {
      // 1. Update main service fields
      await updateService(id, {
        title:                   data.title,
        service_type:            data.service_type,
        service_status:          data.service_status,
        portfolio_group_code:        data.portfolio_group_code,
        global_service_group_code:   data.global_service_group_code,
        service_line_code:           data.service_line_code,
        organizational_element_code: data.organizational_element_code,
        summary:                 data.summary,
        detailed_description:    data.detailed_description,
        value_proposition:       data.value_proposition,
        business_purpose:        data.business_purpose,
        service_features:        data.service_features,
        security_classification: data.security_classification,
        source_url:              data.source_url,
        unit_of_measure:         data.unit_of_measure,
        charging_basis:          data.charging_basis,
        rate_note:               data.rate_note,
        ordering_note:           data.ordering_note,
        retired_note:            data.retired_note,
        scope_text:              data.scope_text,
        operational_notes_raw:   data.operational_notes_raw,
        sla_restoration_text:    data.sla_restoration_text,
        sla_delivery_text:       data.sla_delivery_text,
        exclusions:              data.exclusions,
        service_area:            data.service_area,
        customer_type:           data.customer_type
          ? JSON.stringify(data.customer_type.split(',').map((s: string) => s.trim()).filter(Boolean))
          : null,
        notes_json:              data.notes_json,
        sla_availability:        data.sla_availability,
        sla_restoration:         data.sla_restoration,
        sla_delivery:            data.sla_delivery,
      });

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
      setSaveError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!svc) return <div className={styles.state}>Loading…</div>;

  return (
    <form className={styles.shell} onSubmit={handleSubmit(onSubmit)}>
      {/* ── Editor header ────────────────────────────────────────────── */}
      <div className={styles.editorHeader}>
        <div>
          <span className={styles.serviceId}>{id}</span>
          <h1 className={styles.editorTitle}>{svc.title}</h1>
        </div>
        <StatusPill status={svc.service_status ?? 'draft'} />
      </div>

      <div className={styles.editorBody}>
        {/* ── Form sections ─────────────────────────────────────────── */}
        <div className={styles.formArea}>

          {/* §1 Basic identity */}
          <EditorSection id="identity" title="1. Basic Identity">
            <div className={styles.fieldRow}>
              <Field label="Title *" error={errors.title?.message}>
                <input {...register('title')} className={fieldClass(errors.title)} />
              </Field>
              <Field label="Service Type *" error={errors.service_type?.message}>
                <select {...register('service_type')} className={fieldClass(errors.service_type)}>
                  <option value="">— select —</option>
                  {serviceTypes?.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
                </select>
              </Field>
              <Field label="Status">
                <select {...register('service_status')} className={styles.input}>
                  <option value="">— select —</option>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
          </EditorSection>

          {/* §2 Description */}
          <EditorSection id="description" title="2. Description">
            <Field label="Short Description (summary)">
              <textarea {...register('summary')} rows={2} className={styles.textarea} />
            </Field>
            <Field label="Detailed Description">
              <textarea {...register('detailed_description')} rows={4} className={styles.textarea} />
            </Field>
            <Field label="Value Proposition">
              <textarea {...register('value_proposition')} rows={3} className={styles.textarea} />
            </Field>
            <Field label="Business Purpose">
              <textarea {...register('business_purpose')} rows={3} className={styles.textarea} placeholder="Describe the business purpose and customer value…" />
            </Field>
            <Field label="Service Features">
              <textarea {...register('service_features')} rows={3} className={styles.textarea} />
            </Field>
            {/* Item 7 */}
            <Field label="Scope">
              <textarea {...register('scope_text')} rows={3} className={styles.textarea} placeholder="Describe the scope of this service…" />
            </Field>
          </EditorSection>

          {/* §3 Classification */}
          <EditorSection id="classification" title="3. Classification">
            <div className={styles.fieldRow}>
              <Field label="Portfolio Group">
                <select {...register('portfolio_group_code')} className={styles.input} aria-label="Portfolio Group">
                  <option value="">— select —</option>
                  {portfolioGroups?.map(pg => <option key={pg.code} value={pg.code}>{pg.name}</option>)}
                </select>
              </Field>
              <Field label="Security Classification">
                <select {...register('security_classification')} className={styles.input} aria-label="Security Classification">
                  <option value="">— select —</option>
                  {securityClassificationOptions.map((classification) => (
                    <option key={classification.code} value={classification.code}>
                      {classification.code} — {classification.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Service Area">
                <input {...register('service_area')} className={styles.input} placeholder="e.g. IT, Finance, HR…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Global Service Group">
                <select {...register('global_service_group_code')} className={styles.input} aria-label="Global Service Group">
                  <option value="">— select —</option>
                  {globalServiceGroups?.map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
                </select>
              </Field>
              <Field label="Service Line">
                <select {...register('service_line_code')} className={styles.input} aria-label="Service Line">
                  <option value="">— select —</option>
                  {serviceLines?.map(sl => <option key={sl.code} value={sl.code}>{sl.name}</option>)}
                </select>
              </Field>
              <Field label="Organizational Element">
                <select {...register('organizational_element_code')} className={styles.input} aria-label="Organizational Element">
                  <option value="">— select —</option>
                  {orgElements?.map(oe => <option key={oe.code} value={oe.code}>{oe.name}</option>)}
                </select>
              </Field>
            </div>
          </EditorSection>

          {/* §4 Ownership */}
          <EditorSection id="ownership" title="4. Ownership">
            <div className={styles.fieldRow}>
              <Field label="Service Owner">
                <input {...register('service_owner')} className={styles.input} placeholder="Display name" />
              </Field>
              <Field label="Owner Email" error={errors.service_owner_email?.message}>
                <input {...register('service_owner_email')} className={fieldClass(errors.service_owner_email)} placeholder="email@example.com" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Service Area Owner (vlastnik)">
                <input {...register('vlastnik')} className={styles.input} />
              </Field>
              <Field label="Area Owner Organization">
                <input {...register('vlastnik_org')} className={styles.input} placeholder="Organizace podpory" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Service Delivery Manager">
                <input {...register('manager')} className={styles.input} />
              </Field>
              <Field label="Delivery Manager Organization">
                <input {...register('manager_org')} className={styles.input} placeholder="Organizace delivery managera" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Owner Organization">
                <input {...register('service_owner_org')} className={styles.input} placeholder="Organizace vlastníka" />
              </Field>
            </div>
            <p className={styles.hint}>Each role update creates a new dated record — the previous record is closed automatically.</p>
          </EditorSection>

          {/* §5 Availability / Domains */}
          <EditorSection id="availability" title="5. Availability & Domains">
            <div className={styles.hint}>
              Export SLA bundle: <a href="/api/v1/export/sla">SLA export</a> · <a href="/api/v1/export/bundle">Full bundle</a>
            </div>
            <div className={styles.fieldRow}>
              <Field label="SLA Availability (%)" error={errors.sla_availability?.message}>
                <input type="number" min={0} max={100} step={0.01} {...register('sla_availability')} className={fieldClass(errors.sla_availability)} />
              </Field>
              <Field label="SLA Restoration (hours)" error={errors.sla_restoration?.message}>
                <input type="number" min={0} {...register('sla_restoration')} className={fieldClass(errors.sla_restoration)} />
              </Field>
              <Field label="SLA Delivery (days)" error={errors.sla_delivery?.message}>
                <input type="number" min={0} {...register('sla_delivery')} className={fieldClass(errors.sla_delivery)} />
              </Field>
            </div>
            <Field label="Available On (domains)">
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

            {/* ── Item 17: Flavour-specific SLA overrides ─────────────────── */}
            <div className={styles.slaSubsection}>
              <div className={styles.slaSubtitle}>Flavour-specific SLA overrides</div>
              {slaError && <div className={styles.errorBanner}>{slaError}</div>}

              {/* Existing SLA records per flavour */}
              {slaData && slaData.sla_records.filter(r => r.flavour_code != null).length > 0 && (
                <div className={styles.slaRecordList}>
                  {(slaData.sla_records.filter(r => r.flavour_code != null) as SlaRecord[]).map(r => (
                    <div key={r.id} className={styles.slaRecordRow}>
                      <span className={styles.slaRecordFlavour}>{r.flavour_title ?? r.flavour_code}</span>
                      <span>{r.availability_pct != null ? `${r.availability_pct}%` : '—'}</span>
                      <span>{r.restoration_hours != null ? `${r.restoration_hours}h` : '—'}</span>
                      <span>{r.delivery_days != null ? `${r.delivery_days}d` : '—'}</span>
                      <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleSlaDelete(r.id)} disabled={slaBusy}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {showSlaAdd ? (
                <div className={styles.slaAddForm}>
                  <div className={styles.fieldRow}>
                    <Field label="Flavour">
                      <select className={styles.input} value={slaForm.flavour_id ?? ''} onChange={e => setSlaForm(p => ({ ...p, flavour_id: e.target.value ? Number(e.target.value) : null }))}>
                        <option value="">— none (base service) —</option>
                        {dash6Flavours.map(f => (
                          <option key={f.id} value={f.id}>
                            {f.service_id}{f.flavour_code ? ` · ${f.flavour_code}` : ''}{f.title ? ` — ${f.title}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Support Window">
                      <input className={styles.input} placeholder="e.g. 24x7" value={slaForm.support_window_code ?? ''} onChange={e => setSlaForm(p => ({ ...p, support_window_code: e.target.value }))} />
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label="Availability (%)">
                      <input type="number" min={0} max={100} step={0.001} className={styles.input} value={slaForm.availability_pct ?? ''} onChange={e => setSlaForm(p => ({ ...p, availability_pct: e.target.value }))} />
                    </Field>
                    <Field label="Restoration (h)">
                      <input type="number" min={0} className={styles.input} value={slaForm.restoration_hours ?? ''} onChange={e => setSlaForm(p => ({ ...p, restoration_hours: e.target.value }))} />
                    </Field>
                    <Field label="Delivery (d)">
                      <input type="number" min={0} className={styles.input} value={slaForm.delivery_days ?? ''} onChange={e => setSlaForm(p => ({ ...p, delivery_days: e.target.value }))} />
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label="SLA Note">
                      <textarea rows={2} className={styles.textarea} value={slaForm.sla_note_raw ?? ''} onChange={e => setSlaForm(p => ({ ...p, sla_note_raw: e.target.value }))} />
                    </Field>
                    <Field label="Priority Model">
                      <input className={styles.input} placeholder="e.g. P1/P2/P3" value={slaForm.priority_model_raw ?? ''} onChange={e => setSlaForm(p => ({ ...p, priority_model_raw: e.target.value }))} />
                    </Field>
                  </div>
                  <div className={styles.flavourEditActions}>
                    <button type="button" className={styles.btnPrimary} onClick={handleSlaAdd} disabled={slaBusy}>Add SLA</button>
                    <button type="button" className={styles.btnGhost} onClick={() => { setShowSlaAdd(false); setSlaForm({}); }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button type="button" className={styles.btnSecondary} onClick={() => setShowSlaAdd(true)} style={{ marginTop: 'var(--space-2)' }}>
                  + Add flavour SLA override
                </button>
              )}
            </div>
          </EditorSection>

          {/* §6 Pricing Variants — Flavours CRUD */}
          <EditorSection id="flavours" title="6. Pricing Variants">
            <div className={styles.hint}>
              Export pricing bundle: <a href="/api/v1/export/pricing">Pricing export</a> · <a href="/api/v1/export/bundle">Full bundle</a>
            </div>
            {flavourError && <div className={styles.errorBanner}>{flavourError}</div>}

            {/* Existing flavours list */}
            {flavours.length > 0 && (
              <div className={styles.flavourList}>
                {flavours.map(f => (
                  editFlavourId === f.id ? (
                    /* Inline edit form — Item 11: extended fields */
                    <div key={f.id} className={styles.flavourEditBlock}>
                      <div className={styles.flavourEditRow}>
                        <input className={styles.input} placeholder="Title" value={flavourForm.title ?? ''} onChange={e => setFlavourForm(p => ({ ...p, title: e.target.value }))} />
                        <input className={styles.input} placeholder="Unit" value={flavourForm.service_unit ?? ''} onChange={e => setFlavourForm(p => ({ ...p, service_unit: e.target.value }))} />
                        <input className={styles.input} type="number" placeholder="Price EUR" value={flavourForm.price_value ?? ''} onChange={e => setFlavourForm(p => ({ ...p, price_value: e.target.value ? Number(e.target.value) : null }))} />
                        <input className={styles.input} type="number" placeholder="Initiation €" value={flavourForm.initiation_cost ?? ''} onChange={e => setFlavourForm(p => ({ ...p, initiation_cost: e.target.value ? Number(e.target.value) : null }))} />
                        <input className={styles.input} type="number" placeholder="Lifecycle €" value={flavourForm.lifecycle_cost ?? ''} onChange={e => setFlavourForm(p => ({ ...p, lifecycle_cost: e.target.value ? Number(e.target.value) : null }))} />
                        <input className={styles.input} type="number" placeholder="Lifetime yrs" value={flavourForm.lifetime_years ?? ''} onChange={e => setFlavourForm(p => ({ ...p, lifetime_years: e.target.value ? Number(e.target.value) : null }))} />
                        <select className={styles.input} value={flavourForm.flavour_status_code ?? ''} onChange={e => setFlavourForm(p => ({ ...p, flavour_status_code: e.target.value }))}>
                          <option value="">— status —</option>
                          {FLAVOUR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className={styles.flavourEditRow}>
                        <textarea className={styles.textarea} rows={2} placeholder="Dependency text" value={flavourForm.dependency_text ?? ''} onChange={e => setFlavourForm(p => ({ ...p, dependency_text: e.target.value }))} style={{ gridColumn: '1 / 4' }} />
                        <textarea className={styles.textarea} rows={2} placeholder="Nations rate (JSON or number)" value={flavourForm.nations_rate ?? ''} onChange={e => setFlavourForm(p => ({ ...p, nations_rate: e.target.value }))} style={{ gridColumn: '4 / 7', fontFamily: 'monospace', fontSize: '12px' }} />
                      </div>
                      {/* Table B gaps: currency, billing period, notes, ordering */}
                      <div className={styles.flavourEditRow}>
                        <input className={styles.input} placeholder="Currency (e.g. EUR)" value={flavourForm.currency_code ?? ''} onChange={e => setFlavourForm(p => ({ ...p, currency_code: e.target.value || null }))} />
                        <input className={styles.input} placeholder="Billing period (e.g. MONTHLY)" value={flavourForm.billing_period_code ?? ''} onChange={e => setFlavourForm(p => ({ ...p, billing_period_code: e.target.value || null }))} />
                        <input className={styles.input} type="number" placeholder="Display order" value={flavourForm.display_order ?? ''} onChange={e => setFlavourForm(p => ({ ...p, display_order: e.target.value ? Number(e.target.value) : null }))} />
                        <label className={styles.domainCheck} style={{ alignSelf: 'center' }}>
                          <input type="checkbox" checked={flavourForm.is_orderable ?? false} onChange={e => setFlavourForm(p => ({ ...p, is_orderable: e.target.checked }))} />
                          <span>Orderable</span>
                        </label>
                      </div>
                      <div className={styles.flavourEditRow}>
                        <textarea className={styles.textarea} rows={2} placeholder="Short note" value={flavourForm.short_note ?? ''} onChange={e => setFlavourForm(p => ({ ...p, short_note: e.target.value || null }))} style={{ gridColumn: '1 / 4' }} />
                        <textarea className={styles.textarea} rows={2} placeholder="Pricing note (raw)" value={flavourForm.pricing_note_raw ?? ''} onChange={e => setFlavourForm(p => ({ ...p, pricing_note_raw: e.target.value || null }))} style={{ gridColumn: '4 / 7' }} />
                      </div>

                      <div className={styles.flavourEditRow}>
                        <textarea className={styles.textarea} rows={2} placeholder="Delivery note" value={flavourForm.delivery_note ?? ''} onChange={e => setFlavourForm(p => ({ ...p, delivery_note: e.target.value || null }))} style={{ gridColumn: '1 / 4' }} />
                        <textarea className={styles.textarea} rows={2} placeholder="Technical note" value={flavourForm.technical_note ?? ''} onChange={e => setFlavourForm(p => ({ ...p, technical_note: e.target.value || null }))} style={{ gridColumn: '4 / 7' }} />
                      </div>
                      <div className={styles.flavourEditActions}>
                        <button type="button" className={styles.btnPrimary} onClick={handleFlavourSave} disabled={flavourBusy}>Save</button>
                        <button type="button" className={styles.btnGhost} onClick={() => { setEditFlavourId(null); setFlavourForm({}); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={f.id} className={styles.flavourRow}>
                      <span className={styles.flavourName}>{f.title || f.flavour_code}</span>
                      <span className={styles.flavourMeta}>{f.service_unit ?? '—'}</span>
                      <span className={styles.flavourMeta}>
                        {f.price_value != null ? `${f.price_value.toLocaleString()} ${f.currency_code ?? '€'}` : '—'}
                      </span>
                      <span className={styles.flavourMeta}>{f.billing_period_code ?? '—'}</span>
                      <span className={styles.flavourMeta}>{f.lifecycle_cost != null ? `€${f.lifecycle_cost.toLocaleString()}` : '—'}</span>
                      <span className={styles.flavourMeta}>{f.display_order != null ? `#${f.display_order}` : ''}</span>
                      {f.is_orderable && <span className={styles.relBadgeGreen}>orderable</span>}
                      <span className={styles.flavourMeta}>{f.flavour_status_code ?? '—'}</span>
                      <div className={styles.flavourActions}>
                        <button type="button" className={styles.btnSmall} onClick={() => {
                          setEditFlavourId(f.id);
                          setFlavourForm({
                            title: f.title,
                            service_unit: f.service_unit ?? '',
                            price_value: f.price_value,
                            initiation_cost: f.initiation_cost,
                            lifecycle_cost: f.lifecycle_cost,
                            lifetime_years: f.lifetime_years,
                            flavour_status_code: f.flavour_status_code ?? '',
                            dependency_text: f.dependency_text ?? '',
                            nations_rate: f.nations_rate ?? '',
                            // Table B newly-added fields
                            currency_code: f.currency_code ?? '',
                            billing_period_code: f.billing_period_code ?? '',
                            display_order: f.display_order,
                            is_orderable: f.is_orderable,
                            short_note: f.short_note ?? '',
                            pricing_note_raw: f.pricing_note_raw ?? '',
                            delivery_note: f.delivery_note ?? '',
                            technical_note: f.technical_note ?? '',
                          });
                        }}>Edit</button>
                        <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleFlavourDelete(f.id)} disabled={flavourBusy}>Del</button>
                      </div>
                    </div>
                  )
                ))}
              </div>
            )}
            {flavours.length === 0 && <p className={styles.hint}>No pricing variants defined.</p>}

            {/* Add new flavour */}
            {showFlavourAdd && editFlavourId == null ? (
              <div className={styles.flavourEditBlock}>
                <div className={styles.flavourEditRow}>
                  <input className={styles.input} placeholder="Title *" value={flavourForm.title ?? ''} onChange={e => setFlavourForm(p => ({ ...p, title: e.target.value }))} />
                  <input className={styles.input} placeholder="Unit" value={flavourForm.service_unit ?? ''} onChange={e => setFlavourForm(p => ({ ...p, service_unit: e.target.value }))} />
                  <input className={styles.input} type="number" placeholder="Price" value={flavourForm.price_value ?? ''} onChange={e => setFlavourForm(p => ({ ...p, price_value: e.target.value ? Number(e.target.value) : null }))} />
                  <input className={styles.input} placeholder="Currency (e.g. EUR)" value={flavourForm.currency_code ?? ''} onChange={e => setFlavourForm(p => ({ ...p, currency_code: e.target.value || null }))} />
                  <input className={styles.input} placeholder="Billing period" value={flavourForm.billing_period_code ?? ''} onChange={e => setFlavourForm(p => ({ ...p, billing_period_code: e.target.value || null }))} />
                  <input className={styles.input} type="number" placeholder="Initiation €" value={flavourForm.initiation_cost ?? ''} onChange={e => setFlavourForm(p => ({ ...p, initiation_cost: e.target.value ? Number(e.target.value) : null }))} />
                  <input className={styles.input} type="number" placeholder="Lifecycle €" value={flavourForm.lifecycle_cost ?? ''} onChange={e => setFlavourForm(p => ({ ...p, lifecycle_cost: e.target.value ? Number(e.target.value) : null }))} />
                  <input className={styles.input} type="number" placeholder="Lifetime yrs" value={flavourForm.lifetime_years ?? ''} onChange={e => setFlavourForm(p => ({ ...p, lifetime_years: e.target.value ? Number(e.target.value) : null }))} />
                  <input className={styles.input} type="number" placeholder="Display order" value={flavourForm.display_order ?? ''} onChange={e => setFlavourForm(p => ({ ...p, display_order: e.target.value ? Number(e.target.value) : null }))} />
                  <select className={styles.input} value={flavourForm.flavour_status_code ?? ''} onChange={e => setFlavourForm(p => ({ ...p, flavour_status_code: e.target.value }))}>
                    <option value="">— status —</option>
                    {FLAVOUR_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className={styles.flavourEditRow}>
                  <textarea className={styles.textarea} rows={2} placeholder="Short note" value={flavourForm.short_note ?? ''} onChange={e => setFlavourForm(p => ({ ...p, short_note: e.target.value || null }))} style={{ gridColumn: '1 / 4' }} />
                  <textarea className={styles.textarea} rows={2} placeholder="Pricing note (raw)" value={flavourForm.pricing_note_raw ?? ''} onChange={e => setFlavourForm(p => ({ ...p, pricing_note_raw: e.target.value || null }))} style={{ gridColumn: '4 / 7' }} />
                </div>
                <div className={styles.flavourEditRow}>
                  <textarea className={styles.textarea} rows={2} placeholder="Dependency text" value={flavourForm.dependency_text ?? ''} onChange={e => setFlavourForm(p => ({ ...p, dependency_text: e.target.value }))} style={{ gridColumn: '1 / 4' }} />
                  <label className={styles.domainCheck} style={{ alignSelf: 'center' }}>
                    <input type="checkbox" checked={flavourForm.is_orderable ?? false} onChange={e => setFlavourForm(p => ({ ...p, is_orderable: e.target.checked }))} />
                    <span>Orderable</span>
                  </label>
                </div>

                <div className={styles.flavourEditRow}>
                  <textarea className={styles.textarea} rows={2} placeholder="Delivery note" value={flavourForm.delivery_note ?? ''} onChange={e => setFlavourForm(p => ({ ...p, delivery_note: e.target.value || null }))} style={{ gridColumn: '1 / 4' }} />
                  <textarea className={styles.textarea} rows={2} placeholder="Technical note" value={flavourForm.technical_note ?? ''} onChange={e => setFlavourForm(p => ({ ...p, technical_note: e.target.value || null }))} style={{ gridColumn: '4 / 7' }} />
                </div>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleFlavourSave} disabled={flavourBusy}>Add</button>
                  <button type="button" className={styles.btnGhost} onClick={() => { setShowFlavourAdd(false); setFlavourForm({}); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => { setShowFlavourAdd(true); setEditFlavourId(null); setFlavourForm({}); }} style={{ marginTop: 'var(--space-3)' }}>
                + Add pricing variant
              </button>
            )}
          </EditorSection>

          {/* §7 Relationships — managed add/delete */}
          <EditorSection id="relationships" title="7. Relationships">
            {relError && <div className={styles.errorBanner}>{relError}</div>}

            {svc.relations && svc.relations.length > 0 ? (
              <div className={styles.relMgmtList}>
                {svc.relations.map(r => (
                  <div key={r.id}>
                    {editRelId === r.id ? (
                      /* ── Inline edit form ─────────────────────────────── */
                      <div className={styles.relAddForm}>
                        <div className={styles.fieldRow}>
                          <Field label="Relation Type">
                            <select className={styles.input} value={editRelForm.relation_type ?? r.relation_type}
                              onChange={e => setEditRelForm(p => ({ ...p, relation_type: e.target.value }))}>
                              {RELATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                          </Field>
                          <Field label="Impact Mode">
                            <select className={styles.input} value={editRelForm.impact_mode ?? r.impact_mode ?? ''}
                              onChange={e => setEditRelForm(p => ({ ...p, impact_mode: e.target.value || null }))}>
                              <option value="">— none —</option>
                              <option value="hard_stop">hard_stop</option>
                              <option value="degraded">degraded</option>
                              <option value="informational">informational</option>
                            </select>
                          </Field>
                          <Field label="Impact Level">
                            <select className={styles.input} value={editRelForm.impact_level ?? r.impact_level ?? ''}
                              onChange={e => setEditRelForm(p => ({ ...p, impact_level: e.target.value || null }))}>
                              <option value="">— none —</option>
                              <option value="high">high</option>
                              <option value="medium">medium</option>
                              <option value="low">low</option>
                            </select>
                          </Field>
                        </div>
                        <div className={styles.fieldRow}>
                          <Field label="Label (optional)">
                            <input className={styles.input} value={editRelForm.relation_label ?? r.relation_label ?? ''}
                              onChange={e => setEditRelForm(p => ({ ...p, relation_label: e.target.value || undefined }))} />
                          </Field>
                          <Field label="PACE Code">
                            <select className={styles.input} value={editRelForm.pace_code ?? r.pace_code ?? ''}
                              onChange={e => setEditRelForm(p => ({ ...p, pace_code: e.target.value || null }))}>
                              <option value="">—</option>
                              <option value="P">P – Primary</option>
                              <option value="A">A – Alternate</option>
                              <option value="C">C – Contingency</option>
                              <option value="E">E – Emergency</option>
                            </select>
                          </Field>
                          <Field label="Verified">
                            <select className={styles.input}
                              value={editRelForm.is_verified != null ? String(editRelForm.is_verified) : (r.is_verified != null ? String(r.is_verified) : '')}
                              onChange={e => setEditRelForm(p => ({ ...p, is_verified: e.target.value === '' ? null : e.target.value === 'true' }))}>
                              <option value="">— unset —</option>
                              <option value="true">Verified</option>
                              <option value="false">Not verified</option>
                            </select>
                          </Field>
                        </div>
                        <div className={styles.flavourEditActions}>
                          <button type="button" className={styles.btnPrimary} onClick={handleRelEditSave} disabled={relBusy}>Save</button>
                          <button type="button" className={styles.btnGhost} onClick={() => { setEditRelId(null); setEditRelForm({}); }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      /* ── Read row ─────────────────────────────────────── */
                      <div className={styles.relMgmtRow}>
                        <span className={styles.relTypeChip}>{r.relation_type}</span>
                        <a href={`/services/${r.to_service_id}`} className={styles.link}>
                          {r.to_title ? `${r.to_title} (${r.to_service_id})` : r.to_service_id}
                        </a>
                        {r.relation_label && <span className={styles.relBadge}>{r.relation_label}</span>}
                        {r.impact_mode && r.impact_mode !== 'none' && <span className={styles.relBadge}>{r.impact_mode}</span>}
                        {r.pace_code && <span className={styles.relBadge}>pace:{r.pace_code}</span>}
                        {r.is_inferred && <span className={styles.relBadge}>inferred</span>}
                        {r.is_verified && <span className={styles.relBadgeGreen}>verified</span>}
                        <button type="button" className={styles.btnSmall} onClick={() => handleRelEditOpen(r)} disabled={relBusy} style={{ marginLeft: 'auto' }}>Edit</button>
                        <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleRelDelete(r.id)} disabled={relBusy}>Remove</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>No relationships defined.</p>
            )}

            {showRelAdd ? (
              <div className={styles.relAddForm}>
                <Field label="Target Service ID">
                  <select className={styles.input} value={relForm.to_service_id ?? ''}
                    onChange={e => setRelForm(p => ({ ...p, to_service_id: e.target.value }))}>
                    <option value="">— select service —</option>
                    {servicePickerOptions.map(s => (
                      <option key={s.service_id} value={s.service_id}>
                        {s.service_id} — {s.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Relation Type">
                  <select className={styles.input} value={relForm.relation_type} onChange={e => setRelForm(p => ({ ...p, relation_type: e.target.value }))}>
                    {RELATION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Label (optional)">
                  <input className={styles.input} placeholder="e.g. billing dependency" value={relForm.relation_label} onChange={e => setRelForm(p => ({ ...p, relation_label: e.target.value }))} />
                </Field>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleRelAdd} disabled={relBusy}>Add relation</button>
                  <button type="button" className={styles.btnGhost} onClick={() => setShowRelAdd(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => setShowRelAdd(true)} style={{ marginTop: 'var(--space-3)' }}>
                + Add relationship
              </button>
            )}
            <p className={styles.hint} style={{ marginTop: 'var(--space-3)' }}>
              <a href={`/services/${id}/graph`} className={styles.link}>View full dependency graph →</a>
            </p>
          </EditorSection>

          {/* §7b C3 Taxonomy Mappings */}
          <EditorSection id="c3mapping" title="7b. C3 Taxonomy Mappings">
            {c3Error && <div className={styles.errorBanner}>{c3Error}</div>}
            {readiness && (
              <div className={styles.readinessCard}>
                <div className={styles.readinessHeader}>
                  <span className={styles.readinessTitle}>Publish Readiness</span>
                  <span className={readiness.is_publishable ? styles.readinessOk : styles.readinessBlocked}>
                    {readiness.is_publishable ? 'Ready' : 'Blocked'}
                  </span>
                </div>
                <div className={styles.readinessMeta}>
                  <span>Primary mapping: {readiness.primary_mapping_count}</span>
                  <span>Capability status: {readiness.primary_c3_completeness_status}</span>
                  <span>Active flavours: {readiness.active_flavour_count}</span>
                </div>
                {readiness.blockers.length > 0 && (
                  <div className={styles.readinessBlock}>
                    <strong>Blokery</strong>
                    <ul className={styles.readinessList}>
                      {readiness.blockers.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {readiness.warnings.length > 0 && (
                  <div className={styles.readinessWarn}>
                    <strong>Upozornění</strong>
                    <ul className={styles.readinessList}>
                      {readiness.warnings.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {c3Mappings.length > 0 ? (
              <div className={styles.relMgmtList}>
                {c3Mappings.map(m => (
                  <div key={m.id} className={styles.relMgmtRow}>
                    <span className={styles.relTypeChip}>{m.mapping_type_code}</span>
                    {(() => {
                      const cap = c3ItemMap.get(m.c3_uuid);
                      const label = cap
                        ? (cap.application ? `${cap.application} — ${cap.title ?? m.c3_uuid}` : (cap.title ?? m.c3_uuid))
                        : m.c3_uuid;
                      return (
                        <a href={`/c3/${m.c3_uuid}`} title={m.c3_uuid}
                          className={styles.link} style={{ fontSize: '0.85em' }}>
                          {label}
                        </a>
                      );
                    })()}
                    {m.is_primary && <span className={styles.relBadgeGreen}>primary</span>}
                    {m.mapping_note && <span className={styles.hint}>{m.mapping_note}</span>}
                    <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`}
                      onClick={() => handleC3Delete(m.id)} disabled={c3Busy} style={{ marginLeft: 'auto' }}>Remove</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>No C3 taxonomy mappings assigned.</p>
            )}

            {showC3Add ? (
              <div className={styles.relAddForm}>
                <Field label="C3 UUID">
                  <select className={styles.input} value={c3Form.c3_uuid ?? ''}
                    onChange={e => setC3Form(p => ({ ...p, c3_uuid: e.target.value }))}>
                    <option value="">— select C3 capability —</option>
                    {(c3Items ?? []).map(c => (
                      <option key={c.uuid} value={c.uuid}>
                        {c.application ? `${c.application} — ${c.title ?? c.uuid}` : (c.title ?? c.uuid)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Mapping Type">
                  <select className={styles.input} value={c3Form.mapping_type_code}
                    onChange={e => setC3Form(p => ({ ...p, mapping_type_code: e.target.value }))}>
                    {['supports','enables','fully_fulfills','partially_fulfills'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Primary mapping">
                  <input type="checkbox" checked={c3Form.is_primary}
                    onChange={e => setC3Form(p => ({ ...p, is_primary: e.target.checked }))} />
                </Field>
                <Field label="Mapping Note">
                  <textarea className={styles.textarea} rows={2} placeholder="Optional note about this mapping"
                    value={c3Form.mapping_note}
                    onChange={e => setC3Form(p => ({ ...p, mapping_note: e.target.value }))} />
                </Field>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleC3Add} disabled={c3Busy}>Add mapping</button>
                  <button type="button" className={styles.btnGhost} onClick={() => setShowC3Add(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => setShowC3Add(true)}
                style={{ marginTop: 'var(--space-3)' }}>
                + Assign C3 taxonomy
              </button>
            )}
            <p className={styles.hint} style={{ marginTop: 'var(--space-3)' }}>
              Browse available C3 entries at <a href="/c3/list" className={styles.link}>Taxonomy Catalogue →</a>
            </p>
          </EditorSection>

          {/* §8 Governance */}
          <EditorSection id="governance" title="8. Governance">
            <Field label="Retired / End-of-life Note">
              <textarea {...register('retired_note')} rows={3} className={styles.textarea} />
            </Field>
          </EditorSection>

          {/* §9 Technical / Review */}
          <EditorSection id="technical" title="9. Technical">
            <div className={styles.fieldRow}>
              <Field label="Service URL" error={errors.source_url?.message}>
                <input {...register('source_url')} className={fieldClass(errors.source_url)} placeholder="https://…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Unit of Measure">
                <input {...register('unit_of_measure')} className={styles.input} />
              </Field>
              <Field label="Charging Basis">
                <input {...register('charging_basis')} className={styles.input} />
              </Field>
              <Field label="Rate Note">
                <input {...register('rate_note')} className={styles.input} />
              </Field>
            </div>
            <Field label="Ordering Note">
              <textarea {...register('ordering_note')} rows={2} className={styles.textarea} />
            </Field>
            {/* Item 7: Operational Notes */}
            <Field label="Operational Notes">
              <textarea {...register('operational_notes_raw')} rows={3} className={styles.textarea} placeholder="Internal operational notes, escalation paths, etc." />
            </Field>
            {/* Table A gaps: exclusions, SLA text fields */}
            <Field label="Exclusions">
              <textarea {...register('exclusions')} rows={3} className={styles.textarea} placeholder="What is explicitly not covered by this service…" />
            </Field>
            <div className={styles.fieldRow}>
              <Field label="SLA Restoration Text">
                <textarea {...register('sla_restoration_text')} rows={2} className={styles.textarea} placeholder="Free-text restoration SLA description" />
              </Field>
              <Field label="SLA Delivery Text">
                <textarea {...register('sla_delivery_text')} rows={2} className={styles.textarea} placeholder="Free-text delivery SLA description" />
              </Field>
            </div>
            <Field label="Customer Type">
              <input
                {...register('customer_type')}
                className={styles.input}
                placeholder="e.g. Internal, External, Partner (comma-separated)"
              />
              <span className={styles.hint}>Customer segments this service targets. Comma-separated values, e.g. "Internal, External".</span>
            </Field>
            {/* Item 13: notes_json editable */}
            <Field label="Notes (JSON)">
              <textarea
                {...register('notes_json')}
                rows={4}
                className={styles.textarea}
                placeholder={'{\n  "key": "value"\n}'}
                style={{ fontFamily: 'monospace', fontSize: '12px' }}
              />
              <span className={styles.hint}>Free-form JSON notes (read from import).</span>
            </Field>
          </EditorSection>

          {/* §10 Raw fields — audit trail */}
          <EditorSection id="raw-fields" title="10. Raw Fields (audit trail)">
            <p className={styles.hint}>
              Zdrojové texty z importu uložené v <code>ServiceRawField</code> pro audit a re-parse pipeline.
              Tato data jsou read-only — upravují se přes import.
            </p>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setRawFieldsOpen(o => !o)}
              style={{ marginBottom: 12 }}
            >
              {rawFieldsOpen ? '▲ Skrýt raw fields' : '▼ Zobrazit raw fields'}
            </button>
            {rawFieldsOpen && (
              rawFields.length === 0
                ? <p className={styles.hint}>Žádné raw fields — služba nebyla importována se zdrojovými texty.</p>
                : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {rawFields.map(rf => (
                      <div key={rf.id} style={{
                        background: 'var(--color-bg-canvas)',
                        border: '1px solid var(--color-border-subtle, #ebecf0)',
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

        {/* ── Sticky rail ───────────────────────────────────────────── */}
        <aside className={styles.rail}>
          <div className={styles.railCard}>
            <div className={styles.railTitle}>Save Status</div>
            {saving   && <div className={styles.saving}>Saving…</div>}
            {saved    && !saving && <div className={styles.savedOk}>✓ Saved</div>}
            {saveError && <div className={styles.railError}>{saveError}</div>}
            {isDirty && <div className={styles.dirtyNote}>{dirtyCount} field(s) changed</div>}

            <Button type="submit" loading={saving} style={{ width: '100%', marginBottom: 'var(--space-2)' }}>
              Save changes
            </Button>
            <Button type="button" variant="ghost" size="sm" style={{ width: '100%' }}
              onClick={() => {
                if (isDirty && !confirm('You have unsaved changes. Leave anyway?')) return;
                router.push(`/services/${id}`);
              }}>
              Cancel
            </Button>
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Sections</div>
            <nav className={styles.sectionNav}>
              {['identity','description','classification','ownership','availability','flavours','relationships','c3mapping','governance','technical']
                .map((s, i) => (
                  <a key={s} href={`#${s}`} className={styles.sectionNavItem}>
                    {i + 1}. {s === 'c3mapping' ? 'C3 Taxonomy' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </a>
                ))}
            </nav>
          </div>

          <div className={styles.railCard}>
            <div className={styles.railTitle}>Validation</div>
            <div className={styles.validOk}>Completeness score: {svc.completeness_score ?? '—'}%</div>
            {Object.entries(errors).length > 0
              ? Object.entries(errors).map(([f, e]) => (
                  <div key={f} className={styles.validationError}>
                    {f}: {(e as { message?: string }).message}
                  </div>
                ))
              : <div className={styles.validOk}>No errors</div>
            }
          </div>
        </aside>
      </div>
    </form>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────
function EditorSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

function fieldClass(error?: { message?: string }) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}
