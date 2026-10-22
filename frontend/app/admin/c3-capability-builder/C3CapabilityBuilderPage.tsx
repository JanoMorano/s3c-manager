'use client';

import Link from '@/app/components/AppLink';
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { RefTableEditor } from '@/features/admin/components/RefTableEditor';
import { formatFilteredCountLabel } from '../../lib/counts';
import { useT } from '@/app/i18n/useI18n';
import refStyles from '../ref.module.css';
import styles from './c3-capability-builder.module.css';

const ITEM_ENDPOINT = '/api/v1/taxonomy/c3-capability-builder';
const DOMAIN_ENDPOINT = '/api/v1/taxonomy/c3-capability-builder/domains';
const SETTINGS_ENDPOINT_BASE = '/api/v1/taxonomy/c3-capability-builder/settings';
const SPIRAL_ENDPOINT = '/api/v1/taxonomy/spiral';

type SpiralCode = string;

type Translate = (key: string, params?: Record<string, string | number>) => string;

// Labels are filled in at render time (spiralLabel) so they follow the UI locale.
const FALLBACK_SPIRALS: Omit<SpiralBaseline, 'spiral_label'>[] = [
  { id: 6, spiral_code: 'Spiral_6', is_active: false, notes: null },
  { id: 7, spiral_code: 'Spiral_7', is_active: true, notes: null },
];

function normalizeSpiralCode(value: string) {
  const cleaned = value.trim();
  const numeric = cleaned.match(/^(\d+)$/);
  if (numeric) return `Spiral_${numeric[1]}`;
  const spiral = cleaned.match(/^Spiral[_\s-]?(\d+)$/i);
  if (spiral) return `Spiral_${spiral[1]}`;
  return cleaned;
}

function spiralNumber(code: string) {
  return code.match(/^Spiral_(\d+)$/)?.[1] ?? code.replace(/\D+/g, '');
}

function spiralMapHref(code: string) {
  return `/c3/capability-map-spiral${spiralNumber(code)}`;
}

function spiralLabel(code: string, t: Translate) {
  const number = spiralNumber(code);
  return number ? t('c3_builder.spiral_label', { number }) : code;
}

interface CapabilityDomain {
  code: string;
  css_class: string;
  heading_color: string;
  background_color: string;
  label: string;
  sort_order: number;
}

interface CapabilityItem {
  id: number;
  page_id: string;
  uuid: string;
  title: string;
  parent_id: string | null;
  parent_title: string | null;
  level: number;
  state: string | null;
  domain_code: string;
  domain_label: string;
  domain_order: number;
}

interface CapabilityMapSettings {
  page_title: string;
}

interface SpiralBaseline {
  id: number;
  spiral_code: string;
  spiral_label: string;
  is_active: boolean;
  notes: string | null;
}

interface SpiralResponse {
  active: SpiralBaseline | null;
  all: SpiralBaseline[];
}

interface DraftItem {
  page_id: string;
  uuid: string;
  title: string;
  parent_id: string;
  level: string;
  state: string;
  domain_code: string;
}

const EMPTY_DRAFT: DraftItem = {
  page_id: '',
  uuid: '',
  title: '',
  parent_id: '',
  level: '1',
  state: 'approved',
  domain_code: '',
};

type SortKey = 'page_id' | 'title' | 'level' | 'domain_code' | 'state';
type SortDirection = 'asc' | 'desc';
type BuilderTab = 'items' | 'domains';

export default function C3CapabilityBuilderPage() {
  const t = useT();
  const [activeTab, setActiveTab] = useState<BuilderTab>('items');
  const [spiralCode, setSpiralCode] = useState<SpiralCode>('Spiral_7');
  const { data: spiralData } = useSWR<SpiralResponse>(SPIRAL_ENDPOINT, apiFetch, {
    revalidateOnFocus: false,
  });
  const spiralOptions = useMemo(() => {
    const byCode = new Map<string, SpiralBaseline>();
    FALLBACK_SPIRALS.forEach((spiral) => byCode.set(spiral.spiral_code, { ...spiral, spiral_label: spiralLabel(spiral.spiral_code, t) }));
    (spiralData?.all ?? []).forEach((spiral) => byCode.set(spiral.spiral_code, spiral));
    return [...byCode.values()].sort((left, right) => Number(spiralNumber(left.spiral_code)) - Number(spiralNumber(right.spiral_code)));
  }, [spiralData?.all, t]);
  const activeSpiral = spiralOptions.find((o) => o.spiral_code === spiralCode) ?? {
    id: 0,
    spiral_code: spiralCode,
    spiral_label: spiralLabel(spiralCode, t),
    is_active: false,
    notes: null,
  };
  const settingsEndpoint = `${SETTINGS_ENDPOINT_BASE}?spiral=${spiralCode}`;
  const { data: settings, error: settingsError } = useSWR<CapabilityMapSettings>(settingsEndpoint, apiFetch, {
    revalidateOnFocus: false,
  });
  const [pageTitleDraft, setPageTitleDraft] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [spiralSaving, setSpiralSaving] = useState(false);
  const [newSpiralNumber, setNewSpiralNumber] = useState('');
  const [newSpiralLabel, setNewSpiralLabel] = useState('');
  const [settingsErrorMessage, setSettingsErrorMessage] = useState<string | null>(null);
  const [settingsOk, setSettingsOk] = useState<string | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect -- U5: local draft mirrors async map settings before the admin edits them. */
  useEffect(() => {
    if (settings?.page_title) setPageTitleDraft(settings.page_title);
  }, [settings]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleSaveMapSettings() {
    setSettingsSaving(true);
    setSettingsErrorMessage(null);
    setSettingsOk(null);

    try {
      const res = await fetch(SETTINGS_ENDPOINT_BASE, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          page_title: pageTitleDraft,
          spiral: spiralCode,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || t('c3_builder.settings_save_failed_status', { status: res.status }));
      }

      await globalMutate(settingsEndpoint);
      await Promise.all([
        globalMutate('/api/v1/taxonomy/c3/capability-map-spiral6'),
        globalMutate('/api/v1/taxonomy/c3/capability-map-spiral7'),
        globalMutate(`/api/v1/taxonomy/c3/capability-map-spiral${spiralNumber(spiralCode)}`),
      ]);
      setSettingsOk(t('c3_builder.settings_saved', { label: activeSpiral.spiral_label }));
    } catch (error: unknown) {
      setSettingsErrorMessage(error instanceof Error ? error.message : t('c3_builder.settings_save_failed'));
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleCreateSpiral() {
    const normalized = normalizeSpiralCode(newSpiralNumber || newSpiralLabel);
    const number = spiralNumber(normalized);
    if (!number) {
      setSettingsErrorMessage(t('c3_builder.spiral_number_required'));
      return;
    }

    setSpiralSaving(true);
    setSettingsErrorMessage(null);
    setSettingsOk(null);
    try {
      const res = await fetch(SPIRAL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          spiral_code: normalized,
          // Stored data value: default label follows the existing 'Spiral N' convention in the DB.
          spiral_label: newSpiralLabel.trim() || `Spiral ${number}`,
          notes: 'Created from C3 Capability Builder',
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || t('c3_builder.spiral_create_failed_status', { status: res.status }));
      }
      await globalMutate(SPIRAL_ENDPOINT);
      setSpiralCode(normalized);
      setPageTitleDraft(t('c3_builder.default_page_title', { number }));
      setNewSpiralNumber('');
      setNewSpiralLabel('');
      setSettingsOk(t('c3_builder.spiral_created', { label: newSpiralLabel.trim() || `Spiral ${number}` }));
    } catch (error: unknown) {
      setSettingsErrorMessage(error instanceof Error ? error.message : t('c3_builder.spiral_create_failed'));
    } finally {
      setSpiralSaving(false);
    }
  }

  return (
    <div className={refStyles.shell}>
      <div className={refStyles.pageHeader}>
        <Link href="/administration" className={refStyles.pageBack}>{t('c3_builder.back')}</Link>
        <h1 className={refStyles.pageTitle}>{t('c3_builder.title')}</h1>
      </div>
      <p className={refStyles.pageSub}>
        {t('c3_builder.lead')}
      </p>

      <div className={styles.spiralSelectorSection}>
        <div className={styles.spiralSelectorLabel}>{t('c3_builder.spiral_selector')}</div>
        <div className={styles.spiralSelector}>
          {spiralOptions.map((opt) => (
            <button
              key={opt.spiral_code}
              type="button"
              className={`${styles.spiralButton} ${spiralCode === opt.spiral_code ? styles.spiralButtonActive : ''}`}
              onClick={() => {
                setSpiralCode(opt.spiral_code);
                setSettingsOk(null);
                setSettingsErrorMessage(null);
              }}
            >
              {opt.spiral_label}
            </button>
          ))}
        </div>
        <div className={styles.createSpiralForm}>
          <input
            className={styles.input}
            value={newSpiralNumber}
            onChange={(event) => setNewSpiralNumber(event.target.value)}
            placeholder={t('c3_builder.new_spiral_placeholder')}
            inputMode="numeric"
          />
          <input
            className={styles.input}
            value={newSpiralLabel}
            onChange={(event) => setNewSpiralLabel(event.target.value)}
            placeholder={t('c3_builder.new_spiral_label_placeholder')}
          />
          <button type="button" className={styles.button} onClick={handleCreateSpiral} disabled={spiralSaving}>
            {spiralSaving ? t('c3_builder.creating') : t('c3_builder.create_map')}
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>{t('c3_builder.map_settings')}</div>
          <div className={styles.panelMeta}>{t('c3_builder.map_meta', { label: activeSpiral.spiral_label })}</div>
        </div>
        <div className={styles.panelBody}>
          {settingsError && <div className={styles.error}>{settingsError.message}</div>}
          {settingsErrorMessage && <div className={styles.error}>{settingsErrorMessage}</div>}
          {settingsOk && <div className={styles.success}>{settingsOk}</div>}

          <div className={styles.fieldGrid}>
            <Field label={t('c3_builder.page_title_label', { label: activeSpiral.spiral_label })}>
              <input
                className={styles.input}
                value={pageTitleDraft}
                onChange={(event) => setPageTitleDraft(event.target.value)}
                placeholder={t('c3_builder.default_page_title', { number: spiralNumber(activeSpiral.spiral_code) })}
              />
            </Field>
          </div>

          <div className={styles.toolbar}>
            <button
              type="button"
              className={`${styles.button} ${styles.buttonPrimary}`}
              onClick={handleSaveMapSettings}
              disabled={settingsSaving}
            >
              {settingsSaving ? t('c3_builder.saving') : t('c3_builder.save_page_title', { label: activeSpiral.spiral_label })}
            </button>
            <Link href={spiralMapHref(activeSpiral.spiral_code)} className={styles.actionLink}>
              {t('c3_builder.open_capability_map', { label: activeSpiral.spiral_label })}
            </Link>
          </div>
        </div>
      </section>

      <div className={refStyles.tabs}>
        <button
          className={`${refStyles.tab} ${activeTab === 'items' ? refStyles.tabActive : ''}`}
          onClick={() => setActiveTab('items')}
        >
          {t('c3_builder.items')}
        </button>
        <button
          className={`${refStyles.tab} ${activeTab === 'domains' ? refStyles.tabActive : ''}`}
          onClick={() => setActiveTab('domains')}
        >
          {t('c3_builder.capability_domains')}
        </button>
      </div>

      {activeTab === 'items' && <CapabilityBuilderItemsEditor spiralCode={spiralCode} />}
      {activeTab === 'domains' && <RefTableEditor table="ref_C3CapabilityDomain" />}
    </div>
  );
}

function CapabilityBuilderItemsEditor({ spiralCode }: { spiralCode: SpiralCode }) {
  const t = useT();
  const searchParams = useSearchParams();
  const itemEndpointWithSpiral = `${ITEM_ENDPOINT}?spiral=${spiralCode}`;
  const activeSpiralLabel = spiralLabel(spiralCode, t);
  const { data: items, error: itemsError, isLoading: itemsLoading } = useSWR<CapabilityItem[]>(itemEndpointWithSpiral, apiFetch, {
    revalidateOnFocus: false,
  });
  const { data: domains, error: domainsError } = useSWR<CapabilityDomain[]>(DOMAIN_ENDPOINT, apiFetch, {
    revalidateOnFocus: false,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<DraftItem>(EMPTY_DRAFT);
  const [search, setSearch] = useState(searchParams?.get('search') ?? '');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('page_id');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const deferredSearch = useDeferredValue(search);

  /* eslint-disable react-hooks/set-state-in-effect -- U5: URL query remains the source for the admin search draft. */
  useEffect(() => {
    setSearch(searchParams?.get('search') ?? '');
  }, [searchParams]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const sortedDomains = useMemo(
    () => [...(domains ?? [])].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code, 'cs')),
    [domains],
  );

  const filteredItems = useMemo(() => {
    const rows = items ?? [];
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((item) =>
      item.page_id.toLowerCase().includes(query) ||
      item.uuid.toLowerCase().includes(query) ||
      item.title.toLowerCase().includes(query) ||
      String(item.parent_id ?? '').toLowerCase().includes(query) ||
      String(item.parent_title ?? '').toLowerCase().includes(query) ||
      String(item.state ?? '').toLowerCase().includes(query) ||
      item.domain_code.toLowerCase().includes(query)
    );
  }, [deferredSearch, items]);

  const sortedItems = useMemo(() => {
    const direction = sortDirection === 'asc' ? 1 : -1;
    return [...filteredItems].sort((left, right) => {
      const leftValue = sortKey === 'level'
        ? left.level
        : String(left[sortKey] ?? '').toLocaleLowerCase('cs');
      const rightValue = sortKey === 'level'
        ? right.level
        : String(right[sortKey] ?? '').toLocaleLowerCase('cs');

      if (leftValue < rightValue) return -1 * direction;
      if (leftValue > rightValue) return 1 * direction;
      return left.page_id.localeCompare(right.page_id, 'cs') * direction;
    });
  }, [filteredItems, sortDirection, sortKey]);

  const parentOptions = useMemo(
    () =>
      [...(items ?? [])]
        .filter((item) => item.id !== editingId)
        .sort((a, b) => a.page_id.localeCompare(b.page_id, 'cs') || a.title.localeCompare(b.title, 'cs')),
    [editingId, items],
  );

  const selectedDomain = useMemo(
    () => sortedDomains.find((domain) => domain.code === draft.domain_code) ?? null,
    [draft.domain_code, sortedDomains],
  );

  function resetForm(clearMessages = true) {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
    if (clearMessages) {
      setSaveError(null);
      setSaveOk(null);
    }
  }

  function startEdit(item: CapabilityItem) {
    setEditingId(item.id);
    setDraft({
      page_id: item.page_id,
      uuid: item.uuid,
      title: item.title,
      parent_id: item.parent_id ?? '',
      level: String(item.level),
      state: item.state ?? '',
      domain_code: item.domain_code,
    });
    setSaveError(null);
    setSaveOk(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function updateDraft<Key extends keyof DraftItem>(key: Key, value: DraftItem[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortKey(nextKey);
    setSortDirection('asc');
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(editingId ? `${ITEM_ENDPOINT}/${editingId}` : ITEM_ENDPOINT, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({
          page_id: draft.page_id,
          uuid: draft.uuid,
          title: draft.title,
          parent_id: draft.parent_id || null,
          level: Number.parseInt(draft.level, 10),
          state: draft.state || null,
          domain_code: draft.domain_code,
          spiral: spiralCode,
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || t('c3_builder.save_failed_status', { status: res.status }));
      }

      await globalMutate(itemEndpointWithSpiral);
      resetForm(false);
      setSaveOk(editingId ? t('c3_builder.item_updated') : t('c3_builder.item_created'));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : t('c3_builder.save_failed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: CapabilityItem) {
    if (!confirm(t('c3_builder.delete_confirm', { id: item.page_id, title: item.title }))) return;
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`${ITEM_ENDPOINT}/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || t('c3_builder.delete_failed_status', { status: res.status }));
      }
      await globalMutate(itemEndpointWithSpiral);
      if (editingId === item.id) resetForm();
      setSaveOk(t('c3_builder.item_deleted'));
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : t('c3_builder.delete_failed'));
    }
  }

  return (
    <div className={styles.editorShell}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>{t('c3_builder.items')}</div>
          <p className={styles.desc}>
            {t('c3_builder.items_lead')}
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={spiralMapHref(spiralCode)} className={styles.actionLink}>{t('c3_builder.open_map', { label: activeSpiralLabel })}</Link>
          <Link href="/c3/list" className={`${styles.actionLink} ${styles.actionPrimary}`}>{t('nav.c3_taxonomy')}</Link>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>{t('c3_builder.domain_palette')}</div>
          <div className={styles.panelMeta}>{t('c3_builder.domains_from_db', { count: sortedDomains.length })}</div>
        </div>
        <div className={styles.panelBody}>
          <div className={styles.paletteGrid}>
            {sortedDomains.map((domain) => (
              <div key={domain.code} className={styles.paletteCard}>
                <div className={styles.paletteLabel}>{domain.label}</div>
                <div
                  className={styles.paletteSwatch}
                  style={{ background: domain.background_color, color: domain.heading_color }}
                />
                <div className={styles.paletteCode}>{domain.code}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>{editingId ? t('c3_builder.edit_item') : t('c3_builder.new_item')}</div>
            <div className={styles.panelMeta}>{editingId ? t('c3_builder.item_id', { id: editingId }) : t('c3_builder.create')}</div>
          </div>
          <div className={styles.panelBody}>
            {saveError && <div className={styles.error}>{saveError}</div>}
            {saveOk && <div className={styles.success}>{saveOk}</div>}

            <div className={styles.fieldGrid}>
              <div className={styles.fieldRow}>
                <Field label={t('c3_builder.field.page_id')}>
                  <input className={styles.input} value={draft.page_id} onChange={(event) => updateDraft('page_id', event.target.value)} placeholder="BP-1016" />
                </Field>
                <Field label={t('c3_builder.field.uuid')}>
                  <input className={styles.input} value={draft.uuid} onChange={(event) => updateDraft('uuid', event.target.value)} placeholder="4ec1702a-..." />
                </Field>
              </div>

              <Field label={t('c3_builder.field.title')}>
                <input className={styles.input} value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder={t('c3_builder.field.title_placeholder')} />
              </Field>

              <div className={styles.fieldRow}>
                <Field label={t('c3_builder.field.domain')}>
                  <select className={styles.select} value={draft.domain_code} onChange={(event) => updateDraft('domain_code', event.target.value)}>
                    <option value="">{t('c3_builder.select_domain')}</option>
                    {sortedDomains.map((domain) => (
                      <option key={domain.code} value={domain.code}>
                        {domain.code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('c3_builder.field.state')}>
                  <input className={styles.input} value={draft.state} onChange={(event) => updateDraft('state', event.target.value)} placeholder="approved" />
                </Field>
              </div>

              <div className={styles.fieldRow}>
                <Field label={t('c3_builder.field.parent_id')}>
                  <select
                    className={styles.select}
                    value={draft.parent_id}
                    onChange={(event) => {
                      const nextParentId = event.target.value;
                      const parent = parentOptions.find((item) => item.page_id === nextParentId);
                      setDraft((current) => ({
                        ...current,
                        parent_id: nextParentId,
                        level: parent ? String(Math.max(Number.parseInt(current.level || '1', 10), parent.level + 1)) : current.level,
                        domain_code: parent ? parent.domain_code : current.domain_code,
                      }));
                    }}
                  >
                    <option value="">{t('c3_builder.no_parent')}</option>
                    {parentOptions.map((item) => (
                      <option key={item.id} value={item.page_id}>
                        {item.page_id} — {item.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('c3_builder.field.level')}>
                  <input className={styles.input} type="number" min={1} max={20} value={draft.level} onChange={(event) => updateDraft('level', event.target.value)} />
                </Field>
              </div>

              {selectedDomain && (
                <div className={styles.hint}>
                  {t('c3_builder.domain_colors_hint')} <strong>{selectedDomain.heading_color}</strong> / <strong>{selectedDomain.background_color}</strong>.
                </div>
              )}
            </div>

            <div className={styles.toolbar}>
              <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleSave} disabled={saving}>
                {saving ? t('c3_builder.saving') : editingId ? t('c3_builder.save_changes') : t('c3_builder.create_item')}
              </button>
              <button type="button" className={styles.button} onClick={() => resetForm()} disabled={saving}>
                {t('c3_builder.clear_form')}
              </button>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>{t('c3_builder.items')}</div>
            <div className={styles.panelMeta}>
              {itemsLoading ? t('common.loading') : formatFilteredCountLabel(filteredItems.length, items?.length ?? 0, { one: t('ref_table.count_records.one'), few: t('ref_table.count_records.few'), many: t('ref_table.count_records.many') })}
            </div>
          </div>
          <div className={styles.searchWrap}>
            <input
              className={styles.input}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('c3_builder.filter_placeholder')}
            />
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('page_id')}>
                      {t('c3_builder.field.page_id')} {sortKey === 'page_id' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('title')}>
                      {t('c3_builder.field.title')} {sortKey === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('level')}>
                      {t('c3_builder.col.hierarchy')} {sortKey === 'level' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('domain_code')}>
                      {t('c3_builder.field.domain')} {sortKey === 'domain_code' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('state')}>
                      {t('c3_builder.field.state')} {sortKey === 'state' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {(itemsError || domainsError) && (
                  <tr>
                    <td colSpan={6} className={styles.error}>
                      {(itemsError ?? domainsError)?.message ?? t('c3_builder.load_failed')}
                    </td>
                  </tr>
                )}
                {!itemsLoading && !itemsError && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.muted}>{t('c3_builder.empty_filtered')}</td>
                  </tr>
                )}
                {sortedItems.map((item) => (
                  <tr key={item.id}>
                    <td className={styles.code}>{item.page_id}</td>
                    <td>
                      <div>{item.title}</div>
                      <div className={styles.muted}>{item.uuid}</div>
                    </td>
                    <td>
                      <div>{t('c3_builder.level_value', { level: item.level })}</div>
                      <div className={styles.muted}>{item.parent_id ? `${item.parent_id}${item.parent_title ? ` — ${item.parent_title}` : ''}` : t('c3_builder.root')}</div>
                    </td>
                    <td>
                      <span className={styles.badge}>{item.domain_code}</span>
                    </td>
                    <td>{item.state ?? '—'}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.button} onClick={() => startEdit(item)}>{t('common.edit')}</button>
                        <button type="button" className={`${styles.button} ${styles.buttonDanger}`} onClick={() => handleDelete(item)}>{t('common.delete')}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      {children}
    </label>
  );
}
