/**
 * CapabilityLinksPanel
 * Displays and edits structured C3 capability links to entity tables:
 *   - C3Application (APP)
 *   - C3DataObject  (DO)
 *   - C3TechnologyInteraction (TIN)
 *   - C3Service     (SVC)
 *
 * + Completeness panel (GAP #2)
 *
 * Mounting: /api/v1/taxonomy/c3/:uuid/links/*
 */
'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { useT } from '@/app/i18n/useI18n';
import styles from './CapabilityLinksPanel.module.css';

// ── Types ────────────────────────────────────────────────────────────────────
interface LinkedEntity {
  id: number;
  link_role: string | null;
  created_at: string;
  entity_id: number;
  entity_uuid: string;
  title: string;
  code: string;
  item_status: string | null;
}

interface Completeness {
  app_count: number;
  data_object_count: number;
  tin_count: number;
  c3_service_count: number;
  service_mapping_count: number;
  has_app: boolean;
  has_data_object: boolean;
  has_tin: boolean;
  has_c3_service: boolean;
  has_service_mapping: boolean;
  completeness_status: 'complete' | 'partial' | 'incomplete';
}

interface ServiceCatalogueMapping {
  id: number;
  service_id: string;
  title: string;
  service_status: string | null;
  mapping_type_code: string | null;
  is_primary: boolean;
}

interface LinksResponse {
  uuid: string;
  apps: LinkedEntity[];
  data_objects: LinkedEntity[];
  tins: LinkedEntity[];
  c3_services: LinkedEntity[];
  service_catalogue_mappings: ServiceCatalogueMapping[];
  completeness: Completeness | null;
}

// Picker entity for the add dialog.
interface PickerItem { id: number; uuid: string; title: string; code: string; item_status: string | null; }

const LINK_ROLES = ['supports', 'implements', 'uses', 'depends_on', 'produces'];

// Display labels for link role codes; the codes themselves are sent to the API.
const LINK_ROLE_LABEL_KEYS: Record<string, string> = {
  supports: 'capability_detail.links.role.supports',
  implements: 'capability_detail.links.role.implements',
  uses: 'capability_detail.links.role.uses',
  depends_on: 'capability_detail.links.role.depends_on',
  produces: 'capability_detail.links.role.produces',
};

function linkRoleLabel(t: (key: string) => string, role: string) {
  return LINK_ROLE_LABEL_KEYS[role] ? t(LINK_ROLE_LABEL_KEYS[role]) : role;
}

// ── Completeness badge ────────────────────────────────────────────────────────
function CompleteBadge({ status }: { status: 'complete' | 'partial' | 'incomplete' }) {
  const t = useT();
  const map = {
    complete:   { icon: '✓', labelKey: 'capability_detail.links.status.complete',   cls: styles.badgeComplete   },
    partial:    { icon: '⚠', labelKey: 'capability_detail.links.status.partial',    cls: styles.badgePartial    },
    incomplete: { icon: '✕', labelKey: 'capability_detail.links.status.incomplete', cls: styles.badgeIncomplete },
  };
  const { icon, labelKey, cls } = map[status];
  return <span className={`${styles.badge} ${cls}`}>{icon} {t(labelKey)}</span>;
}

// ── Linked entity row ─────────────────────────────────────────────────────────
function EntityRow({
  item,
  href,
  onDelete,
  readOnly = false,
}: {
  item: LinkedEntity;
  href: string;
  onDelete: () => void;
  readOnly?: boolean;
}) {
  const t = useT();
  return (
    <div className={styles.entityRow}>
      <div className={styles.entityInfo}>
        <Link href={href} className={styles.entityTitle}>{item.title}</Link>
        <span className={styles.entityCode}>{item.code}</span>
        {item.link_role && <span className={styles.entityRole}>{linkRoleLabel(t, item.link_role)}</span>}
        {item.item_status && <span className={styles.entityStatus}>{item.item_status}</span>}
      </div>
      {!readOnly && <button className={styles.btnRemove} onClick={onDelete} title={t('capability_detail.links.remove')} aria-label={t('capability_detail.links.remove')}>✕</button>}
    </div>
  );
}

// ── Add entity dialog ─────────────────────────────────────────────────────────
function AddEntityDialog({
  title,
  items,
  onAdd,
  onClose,
}: {
  title: string;
  items: PickerItem[];
  onAdd: (id: number, role: string) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT();
  const [selectedId, setSelectedId] = useState<number | ''>('');
  const [role, setRole] = useState('supports');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);

  const filtered = items.filter(i =>
    i.title.toLowerCase().includes(search.toLowerCase()) ||
    i.code.toLowerCase().includes(search.toLowerCase())
  );

  async function handleAdd() {
    if (!selectedId) return;
    setBusy(true);
    await onAdd(Number(selectedId), role);
    setBusy(false);
  }

  return (
    <div className={styles.dialogOverlay}>
      <div className={styles.dialog}>
        <div className={styles.dialogHeader}>
          <span>{title}</span>
          <button onClick={onClose} className={styles.dialogClose} aria-label={t('common.cancel')}>✕</button>
        </div>
        <input
          className={styles.dialogSearch}
          placeholder={t('capability_detail.links.search_placeholder')}
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className={styles.dialogList}
          size={8}
          value={selectedId}
          onChange={e => setSelectedId(Number(e.target.value))}
        >
          {filtered.map(i => (
            <option key={i.id} value={i.id}>
              [{i.code}] {i.title}
              {i.item_status ? ` — ${i.item_status}` : ''}
            </option>
          ))}
        </select>
        <div className={styles.dialogFooter}>
          <select value={role} onChange={e => setRole(e.target.value)} className={styles.roleSelect}>
            {LINK_ROLES.map(r => <option key={r} value={r}>{linkRoleLabel(t, r)}</option>)}
          </select>
          <button className={styles.btnAdd} onClick={handleAdd} disabled={!selectedId || busy}>
            {busy ? t('capability_detail.links.adding') : t('capability_detail.links.add_link')}
          </button>
          <button className={styles.btnCancel} onClick={onClose}>{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
function EntitySection({
  label,
  icon,
  items,
  linkPrefix,
  onDelete,
  onAdd,
  pickerItems,
  pickerTitle,
  readOnly = false,
}: {
  label: string;
  icon: string;
  items: LinkedEntity[];
  linkPrefix: string;
  onDelete: (id: number) => void;
  onAdd: (entityId: number, role: string) => Promise<void>;
  pickerItems: PickerItem[];
  pickerTitle: string;
  readOnly?: boolean;
}) {
  const t = useT();
  const [showDialog, setShowDialog] = useState(false);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>{icon}</span>
        <span className={styles.sectionLabel}>{label}</span>
        <span className={styles.sectionCount}>{items.length}</span>
        {!readOnly && (
          <button
            className={styles.btnAddSection}
            onClick={() => setShowDialog(true)}
          >+ {t('capability_detail.links.add')}</button>
        )}
      </div>
      {items.length === 0 ? (
        <div className={styles.emptyMsg}>{t('capability_detail.links.empty')}</div>
      ) : (
        <div className={styles.entityList}>
          {items.map(item => (
            <EntityRow
              key={item.id}
              item={item}
              href={`${linkPrefix}/${item.entity_uuid}`}
              onDelete={() => onDelete(item.id)}
              readOnly={readOnly}
            />
          ))}
        </div>
      )}
      {!readOnly && showDialog && (
        <AddEntityDialog
          title={pickerTitle}
          items={pickerItems}
          onAdd={async (id, role) => {
            await onAdd(id, role);
            setShowDialog(false);
          }}
          onClose={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}

function ServiceCatalogueSection({ items }: { items: ServiceCatalogueMapping[] }) {
  const t = useT();
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon}>📦</span>
        <span className={styles.sectionLabel}>{t('capability_detail.links.catalogue_title')}</span>
        <span className={styles.sectionCount}>{items.length}</span>
      </div>
      {items.length === 0 ? (
        <div className={styles.emptyMsg}>{t('capability_detail.links.catalogue_empty')}</div>
      ) : (
        <div className={styles.entityList}>
          {items.map((item) => (
            <div key={item.id} className={styles.entityRow}>
              <div className={styles.entityInfo}>
                <Link href={`/services/${item.service_id}`} className={styles.entityTitle}>
                  {item.title || item.service_id}
                </Link>
                <span className={styles.entityCode}>{item.service_id}</span>
                {item.mapping_type_code && <span className={styles.entityRole}>{item.mapping_type_code}</span>}
                {item.is_primary && <span className={styles.entityRole}>{t('capability_detail.links.primary')}</span>}
                {item.service_status && <span className={styles.entityStatus}>{item.service_status}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
interface Props {
  capabilityUuid: string;
  readOnly?: boolean;
}

export function CapabilityLinksPanel({ capabilityUuid, readOnly = false }: Props) {
  const t = useT();
  const cacheKey = `/api/v1/taxonomy/c3/${capabilityUuid}/links`;
  const { data, error, isLoading, mutate } = useSWR<LinksResponse>(cacheKey, apiFetch);

  // Picker lists (lazy-loaded entity tables)
  const { data: appItems }  = useSWR<PickerItem[]>('/api/v1/taxonomy/c3-applications',   apiFetch);
  const { data: doItems }   = useSWR<PickerItem[]>('/api/v1/taxonomy/c3-data-objects',    apiFetch);
  const { data: tinItems }  = useSWR<PickerItem[]>('/api/v1/taxonomy/c3-tins',            apiFetch);
  const { data: svcItems }  = useSWR<PickerItem[]>('/api/v1/taxonomy/c3-services-list',   apiFetch);

  const [linkError, setLinkError] = useState<string | null>(null);

  const postLink = useCallback(async (entityType: string, body: Record<string, unknown>) => {
    setLinkError(null);
    const res = await fetch(
      `/api/v1/taxonomy/c3/${capabilityUuid}/links/${entityType}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      throw new Error(j.error ?? `HTTP ${res.status}`);
    }
    await mutate();
  }, [capabilityUuid, mutate]);

  const deleteLink = useCallback(async (entityType: string, linkId: number) => {
    if (!confirm(t('capability_detail.links.remove_confirm'))) return;
    setLinkError(null);
    const res = await fetch(
      `/api/v1/taxonomy/c3/${capabilityUuid}/links/${entityType}/${linkId}`,
      { method: 'DELETE', headers: authHeaders() }
    );
    if (!res.ok) {
      const j = await res.json().catch(() => ({})) as { error?: string };
      setLinkError(j.error ?? `HTTP ${res.status}`);
      return;
    }
    await mutate();
  }, [capabilityUuid, mutate, t]);

  if (isLoading) return <div className={styles.loading}>{t('capability_detail.links.loading')}</div>;
  if (error)     return <div className={styles.loadError}>⚠ {t('capability_detail.links.load_error', { message: error.message })}</div>;
  if (!data)     return null;

  const { completeness } = data;

  return (
    <div className={styles.panel}>
      {/* ── Completeness panel ── */}
      {completeness && (
        <div className={styles.completenessBar}>
          <div className={styles.completenessLeft}>
            <span className={styles.completenessTitle}>{t('capability_detail.links.completeness')}</span>
            <CompleteBadge status={completeness.completeness_status} />
          </div>
          <div className={styles.completenessChecks}>
            <span className={completeness.has_app           ? styles.checkOk : styles.checkMiss}>
              {completeness.has_app ? '✓' : '✕'} {t('capability_detail.links.check.apps', { count: completeness.app_count })}
            </span>
            <span className={completeness.has_data_object   ? styles.checkOk : styles.checkMiss}>
              {completeness.has_data_object ? '✓' : '✕'} {t('capability_detail.links.check.data_objects', { count: completeness.data_object_count })}
            </span>
            <span className={completeness.has_tin           ? styles.checkOk : styles.checkMiss}>
              {completeness.has_tin ? '✓' : '✕'} {t('capability_detail.links.check.tins', { count: completeness.tin_count })}
            </span>
            <span className={completeness.has_c3_service    ? styles.checkOk : styles.checkMiss}>
              {completeness.has_c3_service ? '✓' : '✕'} {t('capability_detail.links.check.c3_services', { count: completeness.c3_service_count })}
            </span>
            <span className={completeness.has_service_mapping ? styles.checkOk : styles.checkMiss}>
              {completeness.has_service_mapping ? '✓' : '✕'} {t('capability_detail.links.check.sc_mappings', { count: completeness.service_mapping_count })}
            </span>
          </div>
        </div>
      )}

      {linkError && (
        <div className={styles.linkError}>⚠ {linkError}</div>
      )}

      {/* ── Linked entities ── */}
      <EntitySection
        label={t('capability_detail.links.section.apps')} icon="🖥"
        items={data.apps}
        linkPrefix="/c3/applications"
        onDelete={id => deleteLink('app', id)}
        onAdd={(entityId, role) => postLink('app', { c3_application_id: entityId, link_role: role })}
        pickerItems={(appItems ?? []).map(i => ({ ...i, code: (i as PickerItem & { application_code?: string }).application_code ?? i.code }))}
        pickerTitle={t('capability_detail.links.picker.app')}
        readOnly={readOnly}
      />
      <EntitySection
        label={t('capability_detail.links.section.data_objects')} icon="🗄"
        items={data.data_objects}
        linkPrefix="/c3/data-objects"
        onDelete={id => deleteLink('data-object', id)}
        onAdd={(entityId, role) => postLink('data-object', { c3_data_object_id: entityId, link_role: role })}
        pickerItems={(doItems ?? []).map(i => ({ ...i, code: (i as PickerItem & { data_object_code?: string }).data_object_code ?? i.code }))}
        pickerTitle={t('capability_detail.links.picker.data_object')}
        readOnly={readOnly}
      />
      <EntitySection
        label={t('capability_detail.links.section.tins')} icon="🔗"
        items={data.tins}
        linkPrefix="/c3/technology-interactions"
        onDelete={id => deleteLink('tin', id)}
        onAdd={(entityId, role) => postLink('tin', { c3_tin_id: entityId, link_role: role })}
        pickerItems={(tinItems ?? []).map(i => ({ ...i, code: (i as PickerItem & { technology_interaction_code?: string }).technology_interaction_code ?? i.code }))}
        pickerTitle={t('capability_detail.links.picker.tin')}
        readOnly={readOnly}
      />
      <EntitySection
        label={t('capability_detail.links.section.c3_services')} icon="⚙"
        items={data.c3_services}
        linkPrefix="/c3/services"
        onDelete={id => deleteLink('c3-service', id)}
        onAdd={(entityId, role) => postLink('c3-service', { c3_service_id: entityId, link_role: role })}
        pickerItems={(svcItems ?? []).map(i => ({ ...i, code: (i as PickerItem & { service_code?: string }).service_code ?? i.code }))}
        pickerTitle={t('capability_detail.links.picker.c3_service')}
        readOnly={readOnly}
      />
      <ServiceCatalogueSection items={data.service_catalogue_mappings ?? []} />
    </div>
  );
}
