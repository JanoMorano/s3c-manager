/**
 * §9.3 Service Editor — v2 editor form with left sub-navigation + sticky save bar.
 * Manual save, react-hook-form + zod, PUT /services/:id + /domains + /roles
 */
'use client';

import { use, useEffect, useState, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useRouter } from 'next/navigation';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { CodeEditor, ConflictModal, EditorSubNav, FormSection, StickySaveBar, UserPicker, type EditorSubNavSection, type SaveState } from '@/app/components/layout-v2';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useService, useServices, usePortfolioGroups, useServiceTypes, useServiceLines, useNetworkDomains, useC3Taxonomy, useServiceRoles, useSecurityClassifications, useServiceReadiness } from '@/features/services/hooks/useServices';
import {
  updateService, updateDomains, updateRole,
  fetchServiceFlavours,
  fetchServiceOfferingsEditor, createOffering, updateOffering, deleteOffering,
  fetchServiceSupportModelEditor, replaceSupportModel,
  fetchServiceAudienceEditor, replaceAudiencePolicies,
  fetchServiceOperationalLinksEditor, createOperationalLink, updateOperationalLink, deleteOperationalLink,
  createRelation, deleteRelation, updateRelation,
  type FlavourRecord, type RelationPatch,
  type ServiceUpdateBody,
  type ServiceOfferingBody, type ServiceSupportModelBody, type ServiceAudiencePolicyBody, type ServiceOperationalLinkBody,
} from '@/features/services/api/editor.api';
import { authHeaders } from '@/features/services/api/services.api';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { useServiceSla } from '@/features/services/hooks/useServices';
import type {
  SlaRecord,
  ServiceC3Mapping,
  ServiceOffering,
  ServiceOperationalLink,
} from '@/features/services/model/service.types';
import { useT } from '@/app/i18n/useI18n';
import styles from './editor.module.css';
import relationTypes from '../../../../../shared/service-catalogue/relationTypes.json';

// ── Zod schema ───────────────────────────────────────────────────────────────
const schema = z.object({
  title:                  z.string().min(1, 'Title is required'),
  service_type:           z.string().min(1, 'Service type is required'),
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
  business_summary:       z.string().optional(),
  consumer_value:         z.string().optional(),
  requestable:            z.boolean().optional(),
  lifecycle_state:        z.string().optional(),
  target_audience_summary:z.string().optional(),
  request_channel_type:   z.string().optional(),
  request_channel_url:    z.string().url('Must be a valid URL').optional().or(z.literal('')),
  approval_required:      z.boolean().optional(),
  fulfillment_lead_time_text: z.string().optional(),
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

type FormData = z.output<typeof schema>;

const LIFECYCLE_OPTIONS = ['draft', 'live', 'deprecated', 'retired'] as const;
type LifecycleState = typeof LIFECYCLE_OPTIONS[number];

function normalizeLifecycleState(value: string | null | undefined): LifecycleState {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (['live', 'active', 'published', 'production'].includes(normalized)) return 'live';
  if (['deprecated', 'retiring'].includes(normalized)) return 'deprecated';
  if (normalized === 'retired') return 'retired';
  return 'draft';
}

// Canonical lifecycle states mirror backend validation.js
// Standard operational link types
const OPERATIONAL_LINK_TYPES = ['knowledge', 'incidents', 'changes', 'docs', 'review', 'monitoring', 'support', 'other'];

// Canonical lifecycle transitions mirror backend validation.js
const LIFECYCLE_TRANSITION_MAP: Record<string, string[]> = {
  draft:      ['live'],
  live:       ['deprecated', 'retired'],
  deprecated: ['live', 'retired'],
  retired:    ['deprecated'],
};
const RELATION_TYPES    = relationTypes.editable;
const OFFERING_STATUSES = ['draft', 'active', 'retired'];

interface Props { params: Promise<{ id: string }> }

interface PreviewMappingResponse {
  read_only: boolean;
  coverage_delta_per_lvl3: Array<{
    capability_title: string;
    capability_slug: string | null;
    spiral_code: string;
    before_coverage_percent: number;
    after_coverage_percent: number;
    newly_covered_count: number;
  }>;
  newly_covered_requirements: Array<{ code: string; title: string; kind: string }>;
  potential_duplicate_coverage: Array<{ service_id: string; title: string }>;
  affected_spirals: string[];
  classification: string;
}

interface Level3CapabilityOption {
  uuid: string;
  page_id: string | null;
  title: string;
  parent?: { title?: string | null } | null;
}

interface C3TaxonomyCapabilityRow {
  uuid: string;
  external_id?: string | null;
  source_external_id?: string | null;
  title?: string | null;
  item_type?: string | null;
  level_num?: number | string | null;
  parent_title?: string | null;
}

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
  const [saveConflict, setSaveConflict] = useState<string | null>(null);
  const [saved,     setSaved]     = useState(false);
  const [phase4Saved, setPhase4Saved] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState(EDITOR_SECTION_IDS[0]);
  const [currentRole, setCurrentRole] = useState(() => getAuthSnapshot()?.role ?? null);
  const canViewAdvancedEvidence = currentRole === 'admin';
  const visibleEditorSectionIds = useMemo(
    () => canViewAdvancedEvidence
      ? EDITOR_SECTION_IDS
      : EDITOR_SECTION_IDS.filter((sectionId) => sectionId !== 'advanced-evidence'),
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

  // ── Import source evidence — audit trail ─────────────────────────────────
  const [rawFields, setRawFields] = useState<Array<{ id: number; field_name: string; raw_value: string; parser_version: string | null; created_at: string }>>([]);
  const [rawFieldsOpen, setRawFieldsOpen] = useState(false);
  useEffect(() => {
    if (!rawFieldsOpen) return;
    fetch(`/api/v1/services/${id}/raw-fields`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(setRawFields)
      .catch(() => {});
  }, [id, rawFieldsOpen]);
  // ── Flavours state ───────────────────────────────────────────────────────
  const [flavours,      setFlavours]      = useState<FlavourRecord[]>([]);
  const [flavourError,  setFlavourError]  = useState<string | null>(null);

  // ── Offerings state ──────────────────────────────────────────────────────
  const [offerings, setOfferings] = useState<ServiceOffering[]>([]);
  const [offeringBusy, setOfferingBusy] = useState(false);
  const [offeringError, setOfferingError] = useState<string | null>(null);
  const [editOfferingId, setEditOfferingId] = useState<number | null>(null);
  const [showOfferingAdd, setShowOfferingAdd] = useState(false);
  const [offeringForm, setOfferingForm] = useState<ServiceOfferingBody>({});

  // ── Support model state ──────────────────────────────────────────────────
  const [supportModels, setSupportModels] = useState<ServiceSupportModelBody[]>([]);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  // ── Audience state ───────────────────────────────────────────────────────
  const [audiencePolicies, setAudiencePolicies] = useState<ServiceAudiencePolicyBody[]>([]);
  const [audienceBusy, setAudienceBusy] = useState(false);
  const [audienceError, setAudienceError] = useState<string | null>(null);

  // ── Operational links state ──────────────────────────────────────────────
  const [operationalLinks, setOperationalLinks] = useState<ServiceOperationalLink[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [editLinkId, setEditLinkId] = useState<number | null>(null);
  const [showLinkAdd, setShowLinkAdd] = useState(false);
  const [linkForm, setLinkForm] = useState<ServiceOperationalLinkBody>({});

  const loadFlavours = useCallback(async () => {
    try {
      setFlavourError(null);
      setFlavours(await fetchServiceFlavours(id));
      await mutateReadiness();
    } catch (e: unknown) {
      setFlavourError(e instanceof Error ? e.message : 'Legacy variant evidence could not be loaded');
    }
  }, [id, mutateReadiness]);

  useEffect(() => { loadFlavours(); }, [loadFlavours]);

  const loadOfferings = useCallback(async () => {
    try {
      setOfferings(await fetchServiceOfferingsEditor(id));
    } catch { /* ignore */ }
  }, [id]);

  const loadSupportModels = useCallback(async () => {
    try {
      setSupportModels(await fetchServiceSupportModelEditor(id));
    } catch { /* ignore */ }
  }, [id]);

  const loadAudiencePolicies = useCallback(async () => {
    try {
      setAudiencePolicies(await fetchServiceAudienceEditor(id));
    } catch { /* ignore */ }
  }, [id]);

  const loadOperationalLinks = useCallback(async () => {
    try {
      setOperationalLinks(await fetchServiceOperationalLinksEditor(id));
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadOfferings(); }, [loadOfferings]);
  useEffect(() => { loadSupportModels(); }, [loadSupportModels]);
  useEffect(() => { loadAudiencePolicies(); }, [loadAudiencePolicies]);
  useEffect(() => { loadOperationalLinks(); }, [loadOperationalLinks]);

  const sortedOfferings = useMemo(
    () => [...offerings].sort((a, b) => {
      const orderA = a.display_order ?? Number.MAX_SAFE_INTEGER;
      const orderB = b.display_order ?? Number.MAX_SAFE_INTEGER;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    }),
    [offerings],
  );

  const defaultOffering = useMemo(
    () => sortedOfferings.find((offering) => offering.is_default) ?? null,
    [sortedOfferings],
  );

  const handleOfferingSave = async () => {
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      const body = {
        ...offeringForm,
        is_default: offeringForm.is_default ?? offerings.length === 0,
        display_order: offeringForm.display_order ?? sortedOfferings.length + 1,
      };
      let savedOffering: ServiceOffering;
      if (editOfferingId != null) {
        savedOffering = await updateOffering(id, editOfferingId, body);
      } else {
        savedOffering = await createOffering(id, body);
      }
      if (savedOffering.is_default) {
        await Promise.all(
          offerings
            .filter((item) => item.id !== savedOffering.id && item.is_default)
            .map((item) => updateOffering(id, item.id, { is_default: false })),
        );
      }
      setEditOfferingId(null);
      setOfferingForm({});
      setShowOfferingAdd(false);
      await loadOfferings();
      await mutate();
      setPhase4Saved('Offerings saved');
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Offering save failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleOfferingMakeDefault = async (offering: ServiceOffering) => {
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      await Promise.all(
        offerings.map((item) => updateOffering(id, item.id, { is_default: item.id === offering.id })),
      );
      await loadOfferings();
      await mutate();
      setPhase4Saved(`${offering.title} is now the default offering`);
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Default offering update failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleOfferingReorder = async (offeringId: number, direction: -1 | 1) => {
    const currentIndex = sortedOfferings.findIndex((offering) => offering.id === offeringId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sortedOfferings.length) return;
    const reordered = [...sortedOfferings];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(nextIndex, 0, moved);
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      await Promise.all(
        reordered.map((offering, index) => (
          offering.display_order === index + 1
            ? Promise.resolve(offering)
            : updateOffering(id, offering.id, { display_order: index + 1 })
        )),
      );
      await loadOfferings();
      await mutate();
      setPhase4Saved('Offering order saved');
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Offering reorder failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleOfferingDelete = async (offeringId: number) => {
    if (!confirm('Delete this service offering?')) return;
    setOfferingBusy(true); setOfferingError(null); setPhase4Saved(null);
    try {
      await deleteOffering(id, offeringId);
      await loadOfferings();
      await mutate();
      setPhase4Saved('Offering deleted');
    } catch (e: unknown) {
      setOfferingError(e instanceof Error ? e.message : 'Offering delete failed');
    } finally {
      setOfferingBusy(false);
    }
  };

  const handleSupportSave = async () => {
    setSupportBusy(true); setSupportError(null); setPhase4Saved(null);
    try {
      const filtered = supportModels.filter(item =>
        item.offering_id != null ||
        item.support_owner_name ||
        item.resolver_group ||
        item.support_hours_code ||
        item.support_channel ||
        item.escalation_path ||
        item.maintenance_window ||
        item.review_cadence
      );
      setSupportModels(await replaceSupportModel(id, filtered));
      setPhase4Saved('Support model saved');
      await mutate();
    } catch (e: unknown) {
      setSupportError(e instanceof Error ? e.message : 'Support model save failed');
    } finally {
      setSupportBusy(false);
    }
  };

  const handleAudienceSave = async () => {
    setAudienceBusy(true); setAudienceError(null); setPhase4Saved(null);
    try {
      const filtered = audiencePolicies.filter(item =>
        item.offering_id != null ||
        item.audience_type ||
        item.business_unit ||
        item.region_code ||
        item.eligibility_rule ||
        item.notes
      );
      setAudiencePolicies(await replaceAudiencePolicies(id, filtered));
      setPhase4Saved('Audience policies saved');
      await mutate();
    } catch (e: unknown) {
      setAudienceError(e instanceof Error ? e.message : 'Audience save failed');
    } finally {
      setAudienceBusy(false);
    }
  };

  const handleLinkSave = async () => {
    setLinkBusy(true); setLinkError(null); setPhase4Saved(null);
    try {
      if (editLinkId != null) {
        await updateOperationalLink(id, editLinkId, linkForm);
      } else {
        await createOperationalLink(id, linkForm);
      }
      setEditLinkId(null);
      setLinkForm({});
      setShowLinkAdd(false);
      await loadOperationalLinks();
      setPhase4Saved('Operational links saved');
    } catch (e: unknown) {
      setLinkError(e instanceof Error ? e.message : 'Operational link save failed');
    } finally {
      setLinkBusy(false);
    }
  };

  const handleLinkDelete = async (linkId: number) => {
    if (!confirm('Delete this operational link?')) return;
    setLinkBusy(true); setLinkError(null); setPhase4Saved(null);
    try {
      await deleteOperationalLink(id, linkId);
      await loadOperationalLinks();
      setPhase4Saved('Operational link deleted');
    } catch (e: unknown) {
      setLinkError(e instanceof Error ? e.message : 'Operational link delete failed');
    } finally {
      setLinkBusy(false);
    }
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
  const [c3Preview,    setC3Preview]    = useState<PreviewMappingResponse | null>(null);
  const [c3PreviewBusy, setC3PreviewBusy] = useState(false);
  const [c3PreviewError, setC3PreviewError] = useState<string | null>(null);
  const [level3Capabilities, setLevel3Capabilities] = useState<Level3CapabilityOption[]>([]);

  const loadC3Mappings = useCallback(async () => {
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}`, { headers: authHeaders() });
      if (r.ok) setC3Mappings(await r.json());
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { loadC3Mappings(); }, [loadC3Mappings]);

  useEffect(() => {
    if (!showC3Add || level3Capabilities.length > 0) return;
    let cancelled = false;
    fetch('/api/v1/taxonomy/c3?item_type=CP&limit=1000', { credentials: 'include', headers: { ...authHeaders(), 'Cache-Control': 'no-cache' } })
      .then((response) => response.ok ? response.json() : [])
      .then((payload) => {
        if (cancelled) return;
        const capabilities: Level3CapabilityOption[] = (Array.isArray(payload) ? payload : [])
          .filter((item: C3TaxonomyCapabilityRow) => String(item.item_type ?? '').toUpperCase() === 'CP')
          .filter((item: C3TaxonomyCapabilityRow) => Number(item.level_num) === 3)
          .map((item: C3TaxonomyCapabilityRow) => ({
            uuid: item.uuid,
            page_id: item.external_id ?? item.source_external_id ?? null,
            title: item.title ?? item.uuid,
            parent: item.parent_title ? { title: item.parent_title } : null,
          }));
        setLevel3Capabilities(capabilities);
      })
      .catch(() => {
        if (!cancelled) setLevel3Capabilities([]);
      });
    return () => { cancelled = true; };
  }, [level3Capabilities.length, showC3Add]);


  useEffect(() => {
    if (!showC3Add || !c3Form.c3_uuid) {
      setC3Preview(null);
      setC3PreviewError(null);
      setC3PreviewBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setC3PreviewBusy(true);
      setC3PreviewError(null);
      try {
        const response = await fetch(`/api/v1/services/${id}/preview-mapping`, {
          method: 'POST',
          credentials: 'include',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: JSON.stringify({ capability_uuid: c3Form.c3_uuid, mapping_type_code: c3Form.mapping_type_code }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error((payload as { error?: string }).error ?? `HTTP ${response.status}`);
        setC3Preview(payload as PreviewMappingResponse);
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setC3Preview(null);
          setC3PreviewError(error instanceof Error ? error.message : t('service_editor.c3.preview.failed'));
        }
      } finally {
        if (!controller.signal.aborted) setC3PreviewBusy(false);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [c3Form.c3_uuid, c3Form.mapping_type_code, id, showC3Add, t]);

  const handleC3Add = async () => {
    if (!c3Form.c3_uuid.trim()) { setC3Error(t('service_editor.c3.error_required')); return; }
    setC3Busy(true); setC3Error(null);
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(c3Form),
      });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw new Error(b.error ?? `HTTP ${r.status}`); }
      setC3Form({ c3_uuid: '', mapping_type_code: 'supports', is_primary: false, mapping_note: '' });
      setC3Preview(null);
      setC3PreviewError(null);
      setShowC3Add(false);
      await loadC3Mappings();
      await mutateReadiness();
    } catch (e: unknown) { setC3Error(e instanceof Error ? e.message : t('common.failed')); }
    finally { setC3Busy(false); }
  };

  const handleC3Delete = async (mappingId: number) => {
    if (!confirm(t('service_editor.c3.confirm_remove'))) return;
    setC3Busy(true); setC3Error(null);
    try {
      const r = await fetch(`/api/v1/taxonomy/mapping/${id}/${mappingId}`, { method: 'DELETE', headers: authHeaders() });
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        throw new Error((b as { error?: string }).error ?? `HTTP ${r.status}`);
      }
      await loadC3Mappings();
      await mutateReadiness();
    } catch (e: unknown) { setC3Error(e instanceof Error ? e.message : t('service_editor.c3.delete_failed')); }
    finally { setC3Busy(false); }
  };

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
      business_summary:        svc.business_summary ?? '',
      consumer_value:          svc.consumer_value ?? '',
      requestable:             svc.requestable ?? false,
      lifecycle_state:         normalizeLifecycleState(svc.lifecycle_state ?? svc.lifecycle_stage_code ?? svc.service_status),
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
  /* eslint-enable react-hooks/incompatible-library */
  const dirtyCount          = Object.keys(dirtyFields).length;
  const currentLifecycle    = svc ? normalizeLifecycleState(svc.lifecycle_state ?? svc.lifecycle_stage_code ?? svc.service_status) : null;
  const allowedLifecycleOptions = LIFECYCLE_OPTIONS.filter((state) => {
    if (!currentLifecycle) return true;
    return state === currentLifecycle || (LIFECYCLE_TRANSITION_MAP[currentLifecycle] ?? []).includes(state);
  });

  const publishBlockers = useMemo(() => {
    const blockers: string[] = [];
    if (!watchedTitle?.trim()) blockers.push('Title is required before publish.');
    if (!watchedServiceType?.trim()) blockers.push('Service Type is required before publish.');
    if (offerings.length === 0) blockers.push('At least one service offering is required.');
    if (offerings.length > 0 && !defaultOffering) blockers.push('Exactly one default offering must be selected.');
    if (watchedRequestable && !(watchedChannelType?.trim() || watchedChannelUrl?.trim())) {
      blockers.push('Requestable service needs a request channel type or URL.');
    }
    if (watchedRequestable && supportModels.length === 0) {
      blockers.push('Requestable service needs a support model.');
    }
    if (readiness && !readiness.is_publishable) {
      blockers.push(...readiness.blockers.map((blocker) => `Readiness: ${blocker}`));
    }
    return Array.from(new Set(blockers));
  }, [
    defaultOffering,
    offerings.length,
    readiness,
    supportModels.length,
    watchedChannelType,
    watchedChannelUrl,
    watchedRequestable,
    watchedServiceType,
    watchedTitle,
  ]);

  const handleSectionSelect = useCallback((sectionId: string) => {
    setActiveSection(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const editorSections: EditorSubNavSection[] = useMemo(() => {
    const errorKeys = new Set(Object.keys(errors));
    const requestWarning = !!watchedRequestable && !(watchedChannelType?.trim() || watchedChannelUrl?.trim());
    return visibleEditorSectionIds.map((sectionId) => {
      const sectionErrors = (SECTION_FIELD_MAP[sectionId] ?? []).filter((field) => errorKeys.has(field)).length;
      if (sectionErrors > 0) {
        return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId, badge: sectionErrors, tone: 'bad' };
      }
      if (sectionId === 'request-access' && requestWarning) {
        return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId, badge: 'Fix', tone: 'warn' };
      }
      if (sectionId === 'request-access' && offerings.length === 0) {
        return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId, badge: 'Add', tone: 'orange' };
      }
      if (sectionId === 'request-access' && offerings.length > 0 && !defaultOffering) {
        return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId, badge: 'Default', tone: 'warn' };
      }
      if (sectionId === 'ownership-support' && supportModels.length === 0) {
        return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId, badge: 'Add', tone: 'orange' };
      }
      if (sectionId === 'readiness-governance' && readiness && !readiness.is_publishable) {
        return {
          id: sectionId,
          label: SECTION_LABELS[sectionId] ?? sectionId,
          badge: readiness.blockers.length || 'Gate',
          tone: 'warn',
        };
      }
      if (sectionId === 'readiness-governance' && c3Mappings.length > 0) {
        return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId, badge: c3Mappings.length, tone: 'purple' };
      }
      return { id: sectionId, label: SECTION_LABELS[sectionId] ?? sectionId };
    });
  }, [c3Mappings.length, defaultOffering, errors, offerings.length, readiness, supportModels.length, visibleEditorSectionIds, watchedChannelType, watchedChannelUrl, watchedRequestable]);

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
    ?? (isDirty ? `${dirtyCount} změněných polí` : 'Manuální ukládání podle návrhu v2');

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
        lifecycle_state:         data.lifecycle_state || null,
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
      const message = e instanceof Error ? e.message : 'Save failed';
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
      handleSectionSelect(targetSection);
      return;
    }
    setValue('lifecycle_state', 'live', { shouldDirty: true, shouldValidate: true });
    void handleSubmit((data) => onSubmit({ ...data, lifecycle_state: 'live' }))();
  };

  if (!svc) return <div className={styles.state}>{t('common.loading')}</div>;

  return (
    <form className={styles.shell} onSubmit={handleSubmit(onSubmit)}>
      <div className={styles.stickyHeader}>
        <PageHeader
          title={`Editor služby — ${svc.title}`}
          purpose="Udržujte jen sedm pracovních oblastí, které rozhodují o katalogu, žádosti, vlastnictví, supportu, readiness a governance."
          chips={[
            { label: `ID ${id}`, tone: 'neutral' },
            { label: `Lifecycle: ${currentLifecycle ?? '—'}`, tone: currentLifecycle === 'live' ? 'ok' : 'info' },
            { label: `Completeness ${svc.completeness_score ?? '—'}%`, tone: (svc.completeness_score ?? 0) >= 80 ? 'ok' : 'warn' },
          ]}
          primaryAction={{ label: 'Zpět na detail', href: `/services/${id}` }}
        />
      </div>

      <div className={styles.editorBody}>
        <EditorSubNav
          title="Service editor"
          summary="7 pracovních sekcí podle redukční Etapy 4."
          sections={editorSections}
          activeId={activeSection}
          onSelect={handleSectionSelect}
        />

        {/* ── Form sections ─────────────────────────────────────────── */}
        <div className={styles.formArea}>
          <div className={styles.editorSignals}>
            <div className={styles.signalCard}>
              <span className={styles.signalLabel}>Op. readiness</span>
              <OperationalReadinessPanel
                requestable={watchedRequestable}
                channelType={watchedChannelType}
                channelUrl={watchedChannelUrl}
                supportModelCount={supportModels.length}
                offeringsCount={offerings.length}
                defaultOfferingTitle={defaultOffering?.title ?? null}
              />
            </div>
            <div className={styles.signalCard}>
              <span className={styles.signalLabel}>Validation</span>
              {Object.entries(errors).length > 0
                ? Object.entries(errors).slice(0, 3).map(([field, error]) => (
                    <div key={field} className={styles.validationError}>
                      {field}: {(error as { message?: string }).message}
                    </div>
                  ))
                : <div className={styles.validOk}>No field errors</div>
              }
            </div>
          </div>
          <div className={publishBlockers.length > 0 ? styles.publishGateWarn : styles.publishGateOk}>
            <div className={styles.publishGateTitle}>
              <span>Save / Publish gate</span>
              <strong>{publishBlockers.length > 0 ? `${publishBlockers.length} blockers` : 'Ready to publish'}</strong>
            </div>
            {publishBlockers.length > 0 ? (
              <ul className={styles.publishGateList}>
                {publishBlockers.slice(0, 5).map((blocker) => <li key={blocker}>{blocker}</li>)}
              </ul>
            ) : (
              <p>Draft can be saved or promoted to live from the sticky bar.</p>
            )}
          </div>

          {/* §1 Identita */}
          <EditorSection id="identity" title="1. Identita">
            <div className={styles.fieldRow}>
              <Field label="Service ID">
                <input className={styles.readOnlyInput} value={id} disabled readOnly aria-label="Service ID" />
              </Field>
              <Field label="Title *" error={errors.title?.message}>
                <input {...register('title')} className={fieldClass(errors.title)} />
              </Field>
              <Field label="Service Type *" error={errors.service_type?.message}>
                <select {...register('service_type')} className={fieldClass(errors.service_type)}>
                  <option value="">— select —</option>
                  {serviceTypes?.map(t => <option key={t.code} value={t.code}>{t.code} — {t.name}</option>)}
                </select>
              </Field>
              <Field label="Lifecycle State">
                <select {...register('lifecycle_state')} className={styles.input}>
                  <option value="">— select —</option>
                  {allowedLifecycleOptions.map((state) => {
                    const isCurrentState = state === currentLifecycle;
                    return (
                      <option key={state} value={state}>
                        {state}{isCurrentState ? ' (current)' : ''}
                      </option>
                    );
                  })}
                </select>
                {currentLifecycle && (
                  <span className={styles.hint}>
                    Current: <strong>{currentLifecycle}</strong> · Allowed next: {(LIFECYCLE_TRANSITION_MAP[currentLifecycle] ?? []).join(', ') || '—'}
                  </span>
                )}
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Portfolio Group">
                <select {...register('portfolio_group_code')} className={styles.input} aria-label="Portfolio Group">
                  <option value="">— select —</option>
                  {portfolioGroups?.map(pg => <option key={pg.code} value={pg.code}>{pg.name}</option>)}
                </select>
              </Field>
              <Field label="Service Line">
                <select {...register('service_line_code')} className={styles.input} aria-label="Service Line">
                  <option value="">— select —</option>
                  {serviceLines?.map(sl => <option key={sl.code} value={sl.code}>{sl.name}</option>)}
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
            </div>
          </EditorSection>

          {/* §2 Hodnota a rozsah */}
          <EditorSection id="value-scope" title="2. Hodnota a rozsah">
            <span id="description" className={styles.anchorAlias} aria-hidden="true" />
            <Field label="Short Description (summary)">
              <textarea {...register('summary')} rows={2} className={styles.textarea} />
            </Field>
            <Field label="Consumer Value" hint="What value does this service deliver to its consumers?">
              <textarea
                {...register('consumer_value')}
                rows={2}
                className={styles.textarea}
                placeholder="e.g. Enables teams to self-serve X without waiting for Y..."
              />
            </Field>
            <Field label="Scope">
              <textarea {...register('scope_text')} rows={3} className={styles.textarea} placeholder="Describe the scope of this service…" />
            </Field>
            <Field label="Exclusions">
              <textarea {...register('exclusions')} rows={3} className={styles.textarea} placeholder="What is explicitly not covered by this service..." />
            </Field>
          </EditorSection>

          <EditorSection id="request-access" title="3. Request a přístup">
            <span id="catalogue-access" className={styles.anchorAlias} aria-hidden="true" />
            <div className={styles.fieldRow}>
              <Field label="Request Channel Type">
                <input {...register('request_channel_type')} className={styles.input} placeholder="portal, form, email, marketplace…" />
              </Field>
              <Field label="Request Channel URL" error={errors.request_channel_url?.message}>
                <input {...register('request_channel_url')} className={fieldClass(errors.request_channel_url)} placeholder="https://…" />
              </Field>
            </div>
            <div className={styles.fieldRow}>
              <Field label="Target Audience Summary">
                <input {...register('target_audience_summary')} className={styles.input} placeholder="Internal staff, project teams, suppliers…" />
              </Field>
              <Field label="Fulfillment Lead Time">
                <input {...register('fulfillment_lead_time_text')} className={styles.input} placeholder="e.g. 3 business days" />
              </Field>
            </div>
            <div className={styles.toggleRow}>
              <label className={styles.domainCheck}>
                <input type="checkbox" {...register('requestable')} />
                <span>Requestable</span>
              </label>
              <label className={styles.domainCheck}>
                <input type="checkbox" {...register('approval_required')} />
                <span>Approval required</span>
              </label>
            </div>
            {watchedRequestable && !watchedChannelType && !watchedChannelUrl && (
              <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                <span className={styles.crossFieldAlertIcon}>⚠</span>
                This service is marked <strong>Requestable</strong> but has no Request Channel Type or URL. Consumers won&apos;t know how to order it.
              </div>
            )}
            {watchedRequestable && supportModels.length === 0 && (
              <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                <span className={styles.crossFieldAlertIcon}>⚠</span>
                This service is requestable but has no <strong>Support Model</strong>. Consumers won&apos;t know who to contact for help. Add one in section 7c below.
              </div>
            )}
            <p className={styles.hint}>
              These fields power the business-facing Overview and Request &amp; Support views.
            </p>
          </EditorSection>

          {/* §4 Vlastnictví a support */}
          <EditorSection id="ownership-support" title="4. Vlastnictví a support">
            <span id="ownership" className={styles.anchorAlias} aria-hidden="true" />
            <div className={styles.fieldRow}>
              <Field label="Service Owner">
                <input {...register('service_owner')} className={styles.input} placeholder="Display name" />
              </Field>
              <div className={styles.field}>
                <UserPicker
                  label="Owner Email"
                  scope="owners"
                  value={watch('service_owner_email') ?? ''}
                  onChange={(value) => setValue('service_owner_email', value, { shouldDirty: true, shouldValidate: true })}
                  required={false}
                />
                {errors.service_owner_email?.message && <span className={styles.fieldError}>{errors.service_owner_email.message}</span>}
              </div>
              <Field label="Service Delivery Manager" hint="Vyplňte jen tehdy, pokud pro službu existuje delivery proces.">
                <input {...register('manager')} className={styles.input} placeholder="Display name" />
              </Field>
            </div>
            <p className={styles.hint}>Role history remains audited. Legacy owner organization fields stay preserved for import/history but are no longer edited in the core form.</p>
          </EditorSection>

          {/* §5 Dostupnost a vazby */}
          <EditorSection id="availability-relations" title="5. Dostupnost a vazby">
            <span id="availability" className={styles.anchorAlias} aria-hidden="true" />
            <div className={styles.hint}>
              SLA evidence is included in the <a href="/api/v1/export/bundle">full export bundle</a>.
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

            {/* ── Legacy variant SLA overrides ─────────────────────────────── */}
            {canViewAdvancedEvidence && (
            <details className={styles.advancedDetails}>
              <summary className={styles.advancedSummary}>Deprecated legacy variant SLA overrides</summary>
              <div className={styles.advancedDetailsBody}>
              <div className={styles.slaSubsection}>
              <div className={styles.slaSubtitle}>Legacy variant SLA overrides are read-only</div>
              <p className={styles.hint}>
                New SLA evidence is maintained at service level above or through per-offering support model records.
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
                <p className={styles.hint}>No legacy variant SLA overrides exist for this service.</p>
              )}
              </div>
              </div>
            </details>
            )}
          </EditorSection>

          {/* §6 Legacy variant evidence — read-only */}
          <EditorSection id="flavours" title="Legacy variant evidence" hidden={!canViewAdvancedEvidence}>
            <div className={styles.hint}>
              Legacy variant data is retained for history and export evidence. Create and maintain current service variants in Service Offerings below.
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
                    {f.is_orderable && <span className={styles.relBadgeGreen}>legacy orderable</span>}
                    <span className={styles.flavourMeta}>{f.flavour_status_code ?? '—'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>No legacy variant evidence is defined. Use Service Offerings for new variants.</p>
            )}
          </EditorSection>

          <EditorSection id="offerings" title="6b. Service Offerings">
            {offeringError && <div className={styles.errorBanner}>{offeringError}</div>}
            {offerings.length > 0 && !defaultOffering && (
              <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                <span className={styles.crossFieldAlertIcon}>!</span>
                Select one default offering before publish. The default is shown first in catalogue and Service 360.
              </div>
            )}
            {offerings.length > 0 ? (
              <div className={styles.flavourList}>
                {sortedOfferings.map((offering, offeringIndex) => (
                  editOfferingId === offering.id ? (
                    <div key={offering.id} className={styles.phase4Card}>
                      <div className={styles.fieldRow}>
                        <Field label="Offering Code">
                          <input className={styles.input} value={offeringForm.offering_code ?? ''} onChange={e => setOfferingForm(p => ({ ...p, offering_code: e.target.value }))} />
                        </Field>
                        <Field label="Title">
                          <input className={styles.input} value={offeringForm.title ?? ''} onChange={e => setOfferingForm(p => ({ ...p, title: e.target.value }))} />
                        </Field>
                        <Field label="Status">
                          <select className={styles.input} value={offeringForm.status ?? ''} onChange={e => setOfferingForm(p => ({ ...p, status: e.target.value }))}>
                            <option value="">— select —</option>
                            {OFFERING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                          </select>
                        </Field>
                      </div>
                      <Field label="Description">
                        <textarea className={styles.textarea} rows={3} value={offeringForm.description ?? ''} onChange={e => setOfferingForm(p => ({ ...p, description: e.target.value || null }))} />
                      </Field>
                      <div className={styles.fieldRow}>
                        <Field label="Request Channel Type">
                          <input className={styles.input} value={offeringForm.request_channel_type ?? ''} onChange={e => setOfferingForm(p => ({ ...p, request_channel_type: e.target.value || null }))} />
                        </Field>
                        <Field label="Request Channel URL">
                          <input className={styles.input} value={offeringForm.request_channel_url ?? ''} onChange={e => setOfferingForm(p => ({ ...p, request_channel_url: e.target.value || null }))} />
                        </Field>
                        <Field label="Lead Time">
                          <input className={styles.input} value={offeringForm.lead_time_text ?? ''} onChange={e => setOfferingForm(p => ({ ...p, lead_time_text: e.target.value || null }))} />
                        </Field>
                      </div>
                      <div className={styles.fieldRow}>
                        <Field label="Support Tier">
                          <input className={styles.input} value={offeringForm.support_tier_code ?? ''} onChange={e => setOfferingForm(p => ({ ...p, support_tier_code: e.target.value || null }))} />
                        </Field>
                        <Field label="Display Order">
                          <input className={styles.input} type="number" value={offeringForm.display_order ?? ''} onChange={e => setOfferingForm(p => ({ ...p, display_order: e.target.value ? Number(e.target.value) : null }))} />
                        </Field>
                      </div>
                      <div className={styles.toggleRow}>
                        <label className={styles.domainCheck}>
                          <input type="checkbox" checked={offeringForm.is_default ?? false} onChange={e => setOfferingForm(p => ({ ...p, is_default: e.target.checked }))} />
                          <span>Default offering</span>
                        </label>
                        <label className={styles.domainCheck}>
                          <input type="checkbox" checked={offeringForm.requestable ?? false} onChange={e => setOfferingForm(p => ({ ...p, requestable: e.target.checked }))} />
                          <span>Requestable</span>
                        </label>
                        <label className={styles.domainCheck}>
                          <input type="checkbox" checked={offeringForm.approval_required ?? false} onChange={e => setOfferingForm(p => ({ ...p, approval_required: e.target.checked }))} />
                          <span>Approval required</span>
                        </label>
                      </div>
                      {offeringForm.requestable && !offeringForm.request_channel_type && !offeringForm.request_channel_url && (
                        <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                          <span className={styles.crossFieldAlertIcon}>⚠</span>
                          Requestable offerings need a Request Channel Type or URL so consumers know how to order this service.
                        </div>
                      )}
                      <div className={styles.flavourEditActions}>
                        <button type="button" className={styles.btnPrimary} onClick={handleOfferingSave} disabled={offeringBusy}>Save</button>
                        <button type="button" className={styles.btnGhost} onClick={() => { setEditOfferingId(null); setOfferingForm({}); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={offering.id} className={styles.phase4Row}>
                      <div className={styles.phase4Summary}>
                        <strong>{offering.title}</strong>
                        <span className={styles.phase4Meta}>
                          {offering.offering_code} · {offering.status} · {offering.requestable ? 'requestable' : 'not requestable'}
                        </span>
                        {offering.description && <span className={styles.phase4Hint}>{offering.description}</span>}
                      </div>
                      {offering.is_default && <span className={styles.relBadgeGreen}>default</span>}
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => handleOfferingReorder(offering.id, -1)}
                          disabled={offeringBusy || offeringIndex === 0}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className={styles.btnSmall}
                          onClick={() => handleOfferingReorder(offering.id, 1)}
                          disabled={offeringBusy || offeringIndex === sortedOfferings.length - 1}
                        >
                          Down
                        </button>
                        {!offering.is_default && (
                          <button type="button" className={styles.btnSmall} onClick={() => handleOfferingMakeDefault(offering)} disabled={offeringBusy}>
                            Make default
                          </button>
                        )}
                      </div>
                      <button type="button" className={styles.btnSmall} onClick={() => {
                        setEditOfferingId(offering.id);
                        setOfferingForm({
                          offering_code: offering.offering_code,
                          title: offering.title,
                          description: offering.description,
                          is_default: offering.is_default,
                          requestable: offering.requestable,
                          approval_required: offering.approval_required,
                          request_channel_type: offering.request_channel_type,
                          request_channel_url: offering.request_channel_url,
                          lead_time_text: offering.lead_time_text,
                          support_tier_code: offering.support_tier_code,
                          status: offering.status,
                          display_order: offering.display_order,
                        });
                      }}>Edit</button>
                      <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleOfferingDelete(offering.id)} disabled={offeringBusy}>Delete</button>
                    </div>
                  )
                ))}
              </div>
            ) : null}

            {showOfferingAdd && editOfferingId == null ? (
              <div className={styles.phase4Card}>
                <div className={styles.fieldRow}>
                  <Field label="Offering Code">
                    <input className={styles.input} value={offeringForm.offering_code ?? ''} onChange={e => setOfferingForm(p => ({ ...p, offering_code: e.target.value }))} />
                  </Field>
                  <Field label="Title">
                    <input className={styles.input} value={offeringForm.title ?? ''} onChange={e => setOfferingForm(p => ({ ...p, title: e.target.value }))} />
                  </Field>
                  <Field label="Status">
                    <select className={styles.input} value={offeringForm.status ?? 'draft'} onChange={e => setOfferingForm(p => ({ ...p, status: e.target.value }))}>
                      {OFFERING_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="Description">
                  <textarea className={styles.textarea} rows={3} value={offeringForm.description ?? ''} onChange={e => setOfferingForm(p => ({ ...p, description: e.target.value || null }))} />
                </Field>
                <div className={styles.fieldRow}>
                  <Field label="Request Channel Type">
                    <input className={styles.input} value={offeringForm.request_channel_type ?? ''} onChange={e => setOfferingForm(p => ({ ...p, request_channel_type: e.target.value || null }))} />
                  </Field>
                  <Field label="Request Channel URL">
                    <input className={styles.input} value={offeringForm.request_channel_url ?? ''} onChange={e => setOfferingForm(p => ({ ...p, request_channel_url: e.target.value || null }))} />
                  </Field>
                  <Field label="Lead Time">
                    <input className={styles.input} value={offeringForm.lead_time_text ?? ''} onChange={e => setOfferingForm(p => ({ ...p, lead_time_text: e.target.value || null }))} />
                  </Field>
                </div>
                <div className={styles.fieldRow}>
                  <Field label="Support Tier">
                    <input className={styles.input} value={offeringForm.support_tier_code ?? ''} onChange={e => setOfferingForm(p => ({ ...p, support_tier_code: e.target.value || null }))} />
                  </Field>
                  <Field label="Display Order">
                    <input className={styles.input} type="number" value={offeringForm.display_order ?? ''} onChange={e => setOfferingForm(p => ({ ...p, display_order: e.target.value ? Number(e.target.value) : null }))} />
                  </Field>
                </div>
                <div className={styles.toggleRow}>
                  <label className={styles.domainCheck}>
                    <input type="checkbox" checked={offeringForm.is_default ?? false} onChange={e => setOfferingForm(p => ({ ...p, is_default: e.target.checked }))} />
                    <span>Default offering</span>
                  </label>
                  <label className={styles.domainCheck}>
                    <input type="checkbox" checked={offeringForm.requestable ?? false} onChange={e => setOfferingForm(p => ({ ...p, requestable: e.target.checked }))} />
                    <span>Requestable</span>
                  </label>
                  <label className={styles.domainCheck}>
                    <input type="checkbox" checked={offeringForm.approval_required ?? false} onChange={e => setOfferingForm(p => ({ ...p, approval_required: e.target.checked }))} />
                    <span>Approval required</span>
                  </label>
                </div>
                {offeringForm.requestable && !offeringForm.request_channel_type && !offeringForm.request_channel_url && (
                  <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                    <span className={styles.crossFieldAlertIcon}>⚠</span>
                    Requestable offerings need a Request Channel Type or URL so consumers know how to order this service.
                  </div>
                )}
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleOfferingSave} disabled={offeringBusy}>Add offering</button>
                  <button type="button" className={styles.btnGhost} onClick={() => { setShowOfferingAdd(false); setOfferingForm({}); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => { setShowOfferingAdd(true); setEditOfferingId(null); setOfferingForm({ status: 'draft', requestable: false, approval_required: false, is_default: offerings.length === 0, display_order: sortedOfferings.length + 1 }); }} style={{ marginTop: 'var(--space-3)' }}>
                + Add service offering
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
                  <input className={styles.input} placeholder="e.g. approval dependency" value={relForm.relation_label} onChange={e => setRelForm(p => ({ ...p, relation_label: e.target.value }))} />
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

          {/* §6 Readiness a governance */}
          <EditorSection id="readiness-governance" title="6. Readiness a governance">
            <div id="c3mapping" className={styles.inlineEditorBody}>
            {c3Error && <div className={styles.errorBanner}>{c3Error}</div>}
            {readiness && (
              <div className={styles.readinessCard}>
                <div className={styles.readinessHeader}>
                  <span className={styles.readinessTitle}>{t('service_editor.c3.readiness.title')}</span>
                  <span className={readiness.is_publishable ? styles.readinessOk : styles.readinessBlocked}>
                    {readiness.is_publishable ? t('service_editor.c3.readiness.ready') : t('service_editor.c3.readiness.blocked')}
                  </span>
                </div>
                <div className={styles.readinessMeta}>
                  <span>{t('service_editor.c3.readiness.primary_mapping')}: {readiness.primary_mapping_count}</span>
                  <span>{t('service_editor.c3.readiness.capability_status')}: {readiness.primary_c3_completeness_status}</span>
                  <span>{t('service_editor.c3.readiness.active_flavours')}: {readiness.active_flavour_count}</span>
                </div>
                {readiness.blockers.length > 0 && (
                  <div className={styles.readinessBlock}>
                    <strong>{t('service_editor.c3.readiness.blockers')}</strong>
                    <ul className={styles.readinessList}>
                      {readiness.blockers.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {readiness.warnings.length > 0 && (
                  <div className={styles.readinessWarn}>
                    <strong>{t('service_editor.c3.readiness.warnings')}</strong>
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
                    {m.is_primary && <span className={styles.relBadgeGreen}>{t('service_editor.c3.primary_badge')}</span>}
                    {m.mapping_note && <span className={styles.hint}>{m.mapping_note}</span>}
                    <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`}
                      onClick={() => handleC3Delete(m.id)} disabled={c3Busy} style={{ marginLeft: 'auto' }}>{t('common.remove')}</button>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.hint}>{t('service_editor.c3.empty')}</p>
            )}

            {showC3Add ? (
              <div className={styles.relAddForm}>
                <Field label={t('service_editor.c3.capability')}>
                  <select className={styles.input} value={c3Form.c3_uuid ?? ''}
                    onChange={e => setC3Form(p => ({ ...p, c3_uuid: e.target.value }))}>
                    <option value="">{t('service_editor.c3.select_level3')}</option>
                    {level3Capabilities.map(capability => (
                      <option key={capability.uuid} value={capability.uuid}>
                        {capability.page_id ? `${capability.page_id} — ` : ''}{capability.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('service_editor.c3.mapping_type')}>
                  <select className={styles.input} value={c3Form.mapping_type_code}
                    onChange={e => setC3Form(p => ({ ...p, mapping_type_code: e.target.value }))}>
                    {['supports','enables','fully_fulfills','partially_fulfills'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <div className={styles.previewPanel}>
                  <div className={styles.previewHeader}>
                    <span>{t('service_editor.c3.preview.title')}</span>
                    {c3PreviewBusy && <small>{t('service_editor.c3.preview.calculating')}</small>}
                    {c3Preview && <small>{c3Preview.classification.replace(/_/g, ' ')}</small>}
                  </div>
                  {c3PreviewError && <p className={styles.previewError}>{c3PreviewError}</p>}
                  {!c3PreviewError && !c3Preview && !c3PreviewBusy && <p className={styles.hint}>{t('service_editor.c3.preview.empty')}</p>}
                  {c3Preview && (
                    <div className={styles.previewBody}>
                      <div className={styles.previewDeltaGrid}>
                        {c3Preview.coverage_delta_per_lvl3.map((delta) => (
                          <div key={`${delta.spiral_code}-${delta.capability_title}`} className={styles.previewDeltaCard}>
                            <strong>{delta.spiral_code}</strong>
                            <span>{delta.before_coverage_percent}% → {delta.after_coverage_percent}%</span>
                            <em>{t('service_editor.c3.preview.requirement_delta', { count: delta.newly_covered_count })}</em>
                          </div>
                        ))}
                      </div>
                      <div className={styles.previewMeta}>
                        <span>{t('service_editor.c3.preview.affected_spirals')}: {c3Preview.affected_spirals.join(', ') || t('common.none')}</span>
                        <span>{t('service_editor.c3.preview.potential_duplicates')}: {c3Preview.potential_duplicate_coverage.length}</span>
                      </div>
                      {c3Preview.newly_covered_requirements.length > 0 && (
                        <details className={styles.previewDetails}>
                          <summary>{t('service_editor.c3.preview.new_requirements', { count: c3Preview.newly_covered_requirements.length })}</summary>
                          <ul>
                            {c3Preview.newly_covered_requirements.slice(0, 8).map((requirement) => (
                              <li key={`${requirement.kind}-${requirement.code}`}>{requirement.code} — {requirement.title}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
                  )}
                </div>
                <Field label={t('service_editor.c3.primary_mapping')}>
                  <input type="checkbox" checked={c3Form.is_primary}
                    onChange={e => setC3Form(p => ({ ...p, is_primary: e.target.checked }))} />
                </Field>
                <Field label={t('service_editor.c3.mapping_note')}>
                  <textarea className={styles.textarea} rows={2} placeholder={t('service_editor.c3.mapping_note_placeholder')}
                    value={c3Form.mapping_note}
                    onChange={e => setC3Form(p => ({ ...p, mapping_note: e.target.value }))} />
                </Field>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleC3Add} disabled={c3Busy}>{t('service_editor.c3.add_mapping')}</button>
                  <button type="button" className={styles.btnGhost} onClick={() => setShowC3Add(false)}>{t('common.cancel')}</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => setShowC3Add(true)}
                style={{ marginTop: 'var(--space-3)' }}>
                {t('service_editor.c3.assign_taxonomy')}
              </button>
            )}
            <p className={styles.hint} style={{ marginTop: 'var(--space-3)' }}>
              {t('service_editor.c3.catalogue_hint')} <Link href="/c3/list" className={styles.link}>{t('service_editor.c3.catalogue_link')} →</Link>
            </p>
            </div>
            <Field label="Retired / End-of-life Note">
              <textarea {...register('retired_note')} rows={3} className={styles.textarea} />
            </Field>
          </EditorSection>

          <EditorSection id="support-model" title="7c. Support Model">
            {supportError && <div className={styles.errorBanner}>{supportError}</div>}
            <p className={styles.hint}>
              Structured support metadata used by the business-facing service detail.
            </p>
            <div className={styles.phase4Stack}>
              {supportModels.map((item, index) => (
                <div key={`support-${index}`} className={styles.phase4Card}>
                  <div className={styles.fieldRow}>
                    <Field label="Offering">
                      <select className={styles.input} value={item.offering_id ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'offering_id', e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— service level —</option>
                        {offerings.map((offering) => (
                          <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Support Owner">
                      <input className={styles.input} value={item.support_owner_name ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_owner_name', e.target.value || null)} />
                    </Field>
                    <Field label="Resolver Group">
                      <input className={styles.input} value={item.resolver_group ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'resolver_group', e.target.value || null)} />
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label="Support Hours">
                      <input className={styles.input} value={item.support_hours_code ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_hours_code', e.target.value || null)} />
                    </Field>
                    <Field label="Support Channel">
                      <input className={styles.input} value={item.support_channel ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'support_channel', e.target.value || null)} />
                    </Field>
                    <Field label="Review Cadence">
                      <input className={styles.input} value={item.review_cadence ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'review_cadence', e.target.value || null)} />
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label="Escalation Path">
                      <textarea className={styles.textarea} rows={2} value={item.escalation_path ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'escalation_path', e.target.value || null)} />
                    </Field>
                    <Field label="Maintenance Window">
                      <textarea className={styles.textarea} rows={2} value={item.maintenance_window ?? ''} onChange={e => updateSupportDraft(setSupportModels, index, 'maintenance_window', e.target.value || null)} />
                    </Field>
                  </div>
                  <div className={styles.flavourEditActions}>
                    <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setSupportModels((items) => items.filter((_, currentIndex) => currentIndex !== index))}>
                      Remove row
                    </button>
                  </div>
                </div>
              ))}
              {supportModels.length === 0 && watchedRequestable && (
                <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                  <span className={styles.crossFieldAlertIcon}>⚠</span>
                  Service is requestable — a support model is required so consumers know who to contact.
                </div>
              )}
              {supportModels.length > 0 && supportModels.some(m => !m.support_owner_name && !m.resolver_group) && (
                <div className={`${styles.crossFieldAlert} ${styles.crossFieldAlertWarn}`}>
                  <span className={styles.crossFieldAlertIcon}>⚠</span>
                  Some support rows are missing both Support Owner and Resolver Group. At least one identifier is recommended.
                </div>
              )}
            </div>
            <div className={styles.flavourEditActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setSupportModels((items) => [...items, emptySupportModel()])}>
                + Add support row
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleSupportSave} disabled={supportBusy}>
                {supportBusy ? 'Saving…' : 'Save support model'}
              </button>
            </div>
          </EditorSection>

          <EditorSection id="audience" title="7d. Audience Policies">
            {audienceError && <div className={styles.errorBanner}>{audienceError}</div>}
            <p className={styles.hint}>
              Audience segmentation used for requestability and catalogue targeting.
            </p>
            <div className={styles.phase4Stack}>
              {audiencePolicies.map((item, index) => (
                <div key={`audience-${index}`} className={styles.phase4Card}>
                  <div className={styles.fieldRow}>
                    <Field label="Offering">
                      <select className={styles.input} value={item.offering_id ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'offering_id', e.target.value ? Number(e.target.value) : null)}>
                        <option value="">— service level —</option>
                        {offerings.map((offering) => (
                          <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Audience Type">
                      <input className={styles.input} value={item.audience_type ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'audience_type', e.target.value || null)} />
                    </Field>
                    <Field label="Business Unit">
                      <input className={styles.input} value={item.business_unit ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'business_unit', e.target.value || null)} />
                    </Field>
                  </div>
                  <div className={styles.fieldRow}>
                    <Field label="Region">
                      <input className={styles.input} value={item.region_code ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'region_code', e.target.value || null)} />
                    </Field>
                  </div>
                  <Field label="Eligibility Rule">
                    <textarea className={styles.textarea} rows={2} value={item.eligibility_rule ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'eligibility_rule', e.target.value || null)} />
                  </Field>
                  <Field label="Notes">
                    <textarea className={styles.textarea} rows={2} value={item.notes ?? ''} onChange={e => updateAudienceDraft(setAudiencePolicies, index, 'notes', e.target.value || null)} />
                  </Field>
                  <div className={styles.flavourEditActions}>
                    <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setAudiencePolicies((items) => items.filter((_, currentIndex) => currentIndex !== index))}>
                      Remove row
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className={styles.flavourEditActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setAudiencePolicies((items) => [...items, emptyAudiencePolicy()])}>
                + Add audience row
              </button>
              <button type="button" className={styles.btnPrimary} onClick={handleAudienceSave} disabled={audienceBusy}>
                {audienceBusy ? 'Saving…' : 'Save audience policies'}
              </button>
            </div>
          </EditorSection>

          <EditorSection id="operational-links" title="7e. Operational Links">
            {linkError && <div className={styles.errorBanner}>{linkError}</div>}
            {operationalLinks.length > 0 ? (
              <div className={styles.phase4Stack}>
                {operationalLinks.map((link) => (
                  editLinkId === link.id ? (
                    <div key={link.id} className={styles.phase4Card}>
                      <div className={styles.fieldRow}>
                        <Field label="Offering">
                          <select className={styles.input} value={linkForm.offering_id ?? ''} onChange={e => setLinkForm((current) => ({ ...current, offering_id: e.target.value ? Number(e.target.value) : null }))}>
                            <option value="">— service level —</option>
                            {offerings.map((offering) => (
                              <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Link Type">
                          <select className={styles.input} value={linkForm.link_type ?? ''} onChange={e => setLinkForm((current) => ({ ...current, link_type: e.target.value || null }))}>
                            <option value="">— select type —</option>
                            {OPERATIONAL_LINK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </Field>
                        <Field label="Sort Order">
                          <input className={styles.input} type="number" value={linkForm.sort_order ?? ''} onChange={e => setLinkForm((current) => ({ ...current, sort_order: e.target.value ? Number(e.target.value) : null }))} />
                        </Field>
                      </div>
                      <div className={styles.fieldRow}>
                        <Field label="Title">
                          <input className={styles.input} value={linkForm.title ?? ''} onChange={e => setLinkForm((current) => ({ ...current, title: e.target.value }))} />
                        </Field>
                        <Field label="URL">
                          <input className={styles.input} value={linkForm.url ?? ''} onChange={e => setLinkForm((current) => ({ ...current, url: e.target.value }))} />
                        </Field>
                      </div>
                      <div className={styles.flavourEditActions}>
                        <button type="button" className={styles.btnPrimary} onClick={handleLinkSave} disabled={linkBusy}>Save</button>
                        <button type="button" className={styles.btnGhost} onClick={() => { setEditLinkId(null); setLinkForm({}); }}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div key={link.id} className={styles.phase4Row}>
                      <div className={styles.phase4Summary}>
                        <strong>{link.title}</strong>
                        <a href={link.url} target="_blank" rel="noreferrer" className={styles.link}>{link.url}</a>
                        <span className={styles.phase4Meta}>
                          {link.link_type ?? 'link'}{link.sort_order != null ? ` · order ${link.sort_order}` : ''}
                        </span>
                      </div>
                      <button type="button" className={styles.btnSmall} onClick={() => {
                        setEditLinkId(link.id);
                        setLinkForm({
                          offering_id: link.offering_id,
                          link_type: link.link_type,
                          title: link.title,
                          url: link.url,
                          sort_order: link.sort_order,
                        });
                      }}>Edit</button>
                      <button type="button" className={`${styles.btnSmall} ${styles.btnDanger}`} onClick={() => handleLinkDelete(link.id)} disabled={linkBusy}>Delete</button>
                    </div>
                  )
                ))}
              </div>
            ) : null}

            {showLinkAdd && editLinkId == null ? (
              <div className={styles.phase4Card}>
                <div className={styles.fieldRow}>
                  <Field label="Offering">
                    <select className={styles.input} value={linkForm.offering_id ?? ''} onChange={e => setLinkForm((current) => ({ ...current, offering_id: e.target.value ? Number(e.target.value) : null }))}>
                      <option value="">— service level —</option>
                      {offerings.map((offering) => (
                        <option key={offering.id} value={offering.id}>{offering.title} ({offering.offering_code})</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Link Type">
                    <input className={styles.input} value={linkForm.link_type ?? ''} onChange={e => setLinkForm((current) => ({ ...current, link_type: e.target.value || null }))} />
                  </Field>
                  <Field label="Sort Order">
                    <input className={styles.input} type="number" value={linkForm.sort_order ?? ''} onChange={e => setLinkForm((current) => ({ ...current, sort_order: e.target.value ? Number(e.target.value) : null }))} />
                  </Field>
                </div>
                <div className={styles.fieldRow}>
                  <Field label="Title">
                    <input className={styles.input} value={linkForm.title ?? ''} onChange={e => setLinkForm((current) => ({ ...current, title: e.target.value }))} />
                  </Field>
                  <Field label="URL">
                    <input className={styles.input} value={linkForm.url ?? ''} onChange={e => setLinkForm((current) => ({ ...current, url: e.target.value }))} />
                  </Field>
                </div>
                <div className={styles.flavourEditActions}>
                  <button type="button" className={styles.btnPrimary} onClick={handleLinkSave} disabled={linkBusy}>Add link</button>
                  <button type="button" className={styles.btnGhost} onClick={() => { setShowLinkAdd(false); setLinkForm({}); }}>Cancel</button>
                </div>
              </div>
            ) : (
              <button type="button" className={styles.btnSecondary} onClick={() => { setShowLinkAdd(true); setEditLinkId(null); setLinkForm({}); }}>
                + Add operational link
              </button>
            )}
          </EditorSection>

          {/* §7 Advanced evidence */}
          <EditorSection id="advanced-evidence" title="7. Advanced evidence" hidden={!canViewAdvancedEvidence}>
            <p className={styles.hint}>
              Admin/import evidence only. These fields preserve legacy import context and should not be needed for routine catalogue maintenance.
            </p>
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
            {/* Legacy SLA text fields kept as import evidence */}
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
              <span className={styles.hint}>Customer segments this service targets. Comma-separated values, e.g. &quot;Internal, External&quot;.</span>
            </Field>
            {/* Item 13: notes_json editable */}
            <Field label="Notes (JSON)">
              <CodeEditor
                name="notes_json"
                label="Notes JSON"
                language="json"
                value={watch('notes_json') ?? ''}
                onValueChange={(value) => setValue('notes_json', value, { shouldDirty: true, shouldValidate: true })}
                rows={4}
                placeholder={'{\n  "key": "value"\n}'}
              />
              <span className={styles.hint}>Free-form JSON notes (read from import).</span>
            </Field>
          </EditorSection>

          {/* §10 Raw fields — audit trail */}
          <EditorSection id="raw-fields" title="Import source evidence" hidden={!canViewAdvancedEvidence}>
            <p className={styles.hint}>
              Zdrojové texty z importu slouží jako auditní evidence původního vstupu.
              Tato data jsou read-only — upravují se přes import.
            </p>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={() => setRawFieldsOpen(o => !o)}
              style={{ marginBottom: 12 }}
            >
              {rawFieldsOpen ? '▲ Skrýt zdrojovou evidenci' : '▼ Zobrazit zdrojovou evidenci'}
            </button>
            {rawFieldsOpen && (
              rawFields.length === 0
                ? <p className={styles.hint}>Žádná zdrojová evidence — služba nebyla importována se zdrojovými texty.</p>
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
          if (isDirty && !confirm('Máte neuložené změny. Opravdu odejít?')) return;
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
  );
}

// ── Operational Readiness panel ──────────────────────────────────────────────
function OperationalReadinessPanel({
  requestable,
  channelType,
  channelUrl,
  supportModelCount,
  offeringsCount,
  defaultOfferingTitle,
}: {
  requestable: boolean | undefined;
  channelType: string | undefined;
  channelUrl: string | undefined;
  supportModelCount: number;
  offeringsCount: number;
  defaultOfferingTitle: string | null;
}) {
  const checks: { label: string; ok: boolean }[] = [
    { label: 'Offerings defined',  ok: offeringsCount > 0 },
    { label: 'Default offering',    ok: offeringsCount === 0 || !!defaultOfferingTitle },
    { label: 'Support model',      ok: supportModelCount > 0 },
    { label: 'Request channel',    ok: !requestable || !!(channelType?.trim() || channelUrl?.trim()) },
  ];
  const allOk = checks.every(c => c.ok);

  return (
    <div>
      {checks.map(c => (
        <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: c.ok ? 'var(--color-success)' : 'var(--color-warning)' }}>
            {c.ok ? '✓' : '⚠'}
          </span>
          <span style={{ font: 'var(--text-label-sm)', color: c.ok ? 'var(--color-text-secondary)' : 'var(--color-warning)' }}>
            {c.label}
          </span>
        </div>
      ))}
      {allOk && <div style={{ font: 'var(--text-body-sm)', color: 'var(--color-success)', marginTop: 4 }}>All checks pass</div>}
    </div>
  );
}

// ── Local helpers ─────────────────────────────────────────────────────────────
function EditorSection({ id, title, children, hidden = false }: { id: string; title: string; children: React.ReactNode; hidden?: boolean }) {
  if (hidden) return null;

  if (ADVANCED_DETAIL_SECTION_IDS.has(id)) {
    return (
      <details id={id} className={styles.advancedDetails}>
        <summary className={styles.advancedSummary}>{title}</summary>
        <div className={styles.advancedDetailsBody}>{children}</div>
      </details>
    );
  }

  if (!PRIMARY_EDITOR_SECTION_IDS.has(id)) {
    return (
      <section id={id} className={styles.inlineEditorBlock}>
        <h3 className={styles.inlineEditorTitle}>{title}</h3>
        <div className={styles.inlineEditorBody}>{children}</div>
      </section>
    );
  }

  return (
    <FormSection id={id} title={title}>
      {children}
    </FormSection>
  );
}

function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>{label}</label>
      {hint && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>{hint}</span>}
      {children}
      {error && <span className={styles.fieldError}>{error}</span>}
    </div>
  );
}

function fieldClass(error?: { message?: string }) {
  return error ? `${styles.input} ${styles.inputError}` : styles.input;
}

function isConflictMessage(message: string) {
  return /\b412\b/.test(message) || /precondition|conflict|etag/i.test(message);
}

const SECTION_LABELS: Record<string, string> = {
  identity: 'Identita',
  'value-scope': 'Hodnota a rozsah',
  'request-access': 'Request a přístup',
  'ownership-support': 'Vlastnictví a support',
  'availability-relations': 'Dostupnost a vazby',
  'readiness-governance': 'Readiness a governance',
  'advanced-evidence': 'Advanced evidence',
};

const EDITOR_SECTION_IDS = [
  'identity',
  'value-scope',
  'request-access',
  'ownership-support',
  'availability-relations',
  'readiness-governance',
  'advanced-evidence',
];

const PRIMARY_EDITOR_SECTION_IDS = new Set(EDITOR_SECTION_IDS);
const ADVANCED_DETAIL_SECTION_IDS = new Set(['flavours', 'raw-fields']);

const SECTION_FIELD_MAP: Record<string, string[]> = {
  identity: ['title', 'service_type', 'lifecycle_state', 'portfolio_group_code', 'service_line_code', 'security_classification'],
  'value-scope': ['summary', 'consumer_value', 'scope_text', 'exclusions'],
  'request-access': ['request_channel_type', 'request_channel_url', 'target_audience_summary', 'fulfillment_lead_time_text'],
  'ownership-support': ['service_owner', 'service_owner_email', 'manager'],
  'availability-relations': ['sla_availability', 'sla_restoration', 'sla_delivery', 'domains'],
  'readiness-governance': ['retired_note'],
  'advanced-evidence': ['source_url', 'notes_json'],
};

function emptySupportModel(): ServiceSupportModelBody {
  return {
    offering_id: null,
    support_owner_name: null,
    resolver_group: null,
    support_hours_code: null,
    support_channel: null,
    escalation_path: null,
    maintenance_window: null,
    review_cadence: null,
  };
}

function emptyAudiencePolicy(): ServiceAudiencePolicyBody {
  return {
    offering_id: null,
    audience_type: null,
    business_unit: null,
    region_code: null,
    eligibility_rule: null,
    notes: null,
  };
}

function updateSupportDraft<K extends keyof ServiceSupportModelBody>(
  setter: Dispatch<SetStateAction<ServiceSupportModelBody[]>>,
  index: number,
  key: K,
  value: ServiceSupportModelBody[K],
) {
  setter((items) => items.map((item, currentIndex) => currentIndex === index ? { ...item, [key]: value } : item));
}

function updateAudienceDraft<K extends keyof ServiceAudiencePolicyBody>(
  setter: Dispatch<SetStateAction<ServiceAudiencePolicyBody[]>>,
  index: number,
  key: K,
  value: ServiceAudiencePolicyBody[K],
) {
  setter((items) => items.map((item, currentIndex) => currentIndex === index ? { ...item, [key]: value } : item));
}
