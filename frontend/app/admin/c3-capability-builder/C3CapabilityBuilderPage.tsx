'use client';

import Link from '@/app/components/AppLink';
import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR, { mutate as globalMutate } from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { RefTableEditor } from '@/features/admin/components/RefTableEditor';
import { COUNT_LABELS, formatFilteredCountLabel } from '../../lib/counts';
import refStyles from '../ref.module.css';
import styles from './c3-capability-builder.module.css';

const ITEM_ENDPOINT = '/api/v1/taxonomy/c3-capability-builder';
const DOMAIN_ENDPOINT = '/api/v1/taxonomy/c3-capability-builder/domains';
const SETTINGS_ENDPOINT_BASE = '/api/v1/taxonomy/c3-capability-builder/settings';
const SPIRAL_ENDPOINT = '/api/v1/taxonomy/spiral';

type SpiralCode = string;

const FALLBACK_SPIRALS: SpiralBaseline[] = [
  { id: 6, spiral_code: 'Spiral_6', spiral_label: 'Spiral 6', is_active: false, notes: null },
  { id: 7, spiral_code: 'Spiral_7', spiral_label: 'Spiral 7', is_active: true, notes: null },
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

function spiralLabel(code: string) {
  const number = spiralNumber(code);
  return number ? `Spiral ${number}` : code;
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
  const [activeTab, setActiveTab] = useState<BuilderTab>('items');
  const [spiralCode, setSpiralCode] = useState<SpiralCode>('Spiral_7');
  const { data: spiralData } = useSWR<SpiralResponse>(SPIRAL_ENDPOINT, apiFetch, {
    revalidateOnFocus: false,
  });
  const spiralOptions = useMemo(() => {
    const byCode = new Map<string, SpiralBaseline>();
    FALLBACK_SPIRALS.forEach((spiral) => byCode.set(spiral.spiral_code, spiral));
    (spiralData?.all ?? []).forEach((spiral) => byCode.set(spiral.spiral_code, spiral));
    return [...byCode.values()].sort((left, right) => Number(spiralNumber(left.spiral_code)) - Number(spiralNumber(right.spiral_code)));
  }, [spiralData?.all]);
  const activeSpiral = spiralOptions.find((o) => o.spiral_code === spiralCode) ?? {
    id: 0,
    spiral_code: spiralCode,
    spiral_label: spiralLabel(spiralCode),
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

  useEffect(() => {
    if (settings?.page_title) setPageTitleDraft(settings.page_title);
  }, [settings]);

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
        throw new Error(text || `Uložení nastavení selhalo (${res.status})`);
      }

      await globalMutate(settingsEndpoint);
      await Promise.all([
        globalMutate('/api/v1/taxonomy/c3/capability-map-spiral6'),
        globalMutate('/api/v1/taxonomy/c3/capability-map-spiral7'),
        globalMutate(`/api/v1/taxonomy/c3/capability-map-spiral${spiralNumber(spiralCode)}`),
      ]);
      setSettingsOk(`Nadpis Capability Map (${activeSpiral.spiral_label}) byl uložen.`);
    } catch (error: unknown) {
      setSettingsErrorMessage(error instanceof Error ? error.message : 'Uložení nastavení selhalo');
    } finally {
      setSettingsSaving(false);
    }
  }

  async function handleCreateSpiral() {
    const normalized = normalizeSpiralCode(newSpiralNumber || newSpiralLabel);
    const number = spiralNumber(normalized);
    if (!number) {
      setSettingsErrorMessage('Zadej číslo spirály, například 99.');
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
          spiral_label: newSpiralLabel.trim() || `Spiral ${number}`,
          notes: 'Created from C3 Capability Builder',
        }),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Vytvoření spirály selhalo (${res.status})`);
      }
      await globalMutate(SPIRAL_ENDPOINT);
      setSpiralCode(normalized);
      setPageTitleDraft(`C3 Taxonomy Catalogue — Baseline ${number}`);
      setNewSpiralNumber('');
      setNewSpiralLabel('');
      setSettingsOk(`Capability mapa ${newSpiralLabel.trim() || `Spiral ${number}`} byla založena. Teď můžeš uložit nadpis a přidat položky.`);
    } catch (error: unknown) {
      setSettingsErrorMessage(error instanceof Error ? error.message : 'Vytvoření spirály selhalo');
    } finally {
      setSpiralSaving(false);
    }
  }

  return (
    <div className={refStyles.shell}>
      <div className={refStyles.pageHeader}>
        <Link href="/administration" className={refStyles.pageBack}>← Administration</Link>
        <h1 className={refStyles.pageTitle}>C3 Capability Builder</h1>
      </div>
      <p className={refStyles.pageSub}>
        Builder pro finální `C3 Capability Map`, který je inicializovaný z legacy `c3_poster_v2.html`.
        Můžeš tu upravovat jak jednotlivé položky mapy, tak i nadpis stránky zobrazený nad posterem.
      </p>

      <div className={styles.spiralSelectorSection}>
        <div className={styles.spiralSelectorLabel}>Volba editace Capability Map spirály:</div>
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
            placeholder="Nová spirála, např. 99"
            inputMode="numeric"
          />
          <input
            className={styles.input}
            value={newSpiralLabel}
            onChange={(event) => setNewSpiralLabel(event.target.value)}
            placeholder="Volitelný název, např. Spiral 99"
          />
          <button type="button" className={styles.button} onClick={handleCreateSpiral} disabled={spiralSaving}>
            {spiralSaving ? 'Zakládám…' : 'Založit mapu'}
          </button>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>Nastavení mapy</div>
          <div className={styles.panelMeta}>C3 Capability Map — {activeSpiral.spiral_label}</div>
        </div>
        <div className={styles.panelBody}>
          {settingsError && <div className={styles.error}>{settingsError.message}</div>}
          {settingsErrorMessage && <div className={styles.error}>{settingsErrorMessage}</div>}
          {settingsOk && <div className={styles.success}>{settingsOk}</div>}

          <div className={styles.fieldGrid}>
            <Field label={`Nadpis stránky (${activeSpiral.spiral_label})`}>
              <input
                className={styles.input}
                value={pageTitleDraft}
                onChange={(event) => setPageTitleDraft(event.target.value)}
                placeholder={`C3 Taxonomy Catalogue — Baseline ${spiralNumber(activeSpiral.spiral_code)}`}
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
              {settingsSaving ? 'Ukládám…' : `Uložit nadpis mapy (${activeSpiral.spiral_label})`}
            </button>
            <Link href={spiralMapHref(activeSpiral.spiral_code)} className={styles.actionLink}>
              Otevřít C3 Capability Map ({activeSpiral.spiral_label})
            </Link>
          </div>
        </div>
      </section>

      <div className={refStyles.tabs}>
        <button
          className={`${refStyles.tab} ${activeTab === 'items' ? refStyles.tabActive : ''}`}
          onClick={() => setActiveTab('items')}
        >
          Položky builderu
        </button>
        <button
          className={`${refStyles.tab} ${activeTab === 'domains' ? refStyles.tabActive : ''}`}
          onClick={() => setActiveTab('domains')}
        >
          Capability Domains
        </button>
      </div>

      {activeTab === 'items' && <CapabilityBuilderItemsEditor spiralCode={spiralCode} />}
      {activeTab === 'domains' && <RefTableEditor table="ref_C3CapabilityDomain" />}
    </div>
  );
}

function CapabilityBuilderItemsEditor({ spiralCode }: { spiralCode: SpiralCode }) {
  const searchParams = useSearchParams();
  const itemEndpointWithSpiral = `${ITEM_ENDPOINT}?spiral=${spiralCode}`;
  const activeSpiralLabel = spiralLabel(spiralCode);
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

  useEffect(() => {
    setSearch(searchParams?.get('search') ?? '');
  }, [searchParams]);

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
        throw new Error(text || `Uložení selhalo (${res.status})`);
      }

      await globalMutate(itemEndpointWithSpiral);
      resetForm(false);
      setSaveOk(editingId ? 'Builder položka byla upravena.' : 'Builder položka byla vytvořena.');
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: CapabilityItem) {
    if (!confirm(`Smazat položku ${item.page_id} – ${item.title}?`)) return;
    setSaveError(null);
    setSaveOk(null);
    try {
      const res = await fetch(`${ITEM_ENDPOINT}/${item.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Mazání selhalo (${res.status})`);
      }
      await globalMutate(itemEndpointWithSpiral);
      if (editingId === item.id) resetForm();
      setSaveOk('Builder položka byla smazána.');
    } catch (error: unknown) {
      setSaveError(error instanceof Error ? error.message : 'Mazání selhalo');
    }
  }

  return (
    <div className={styles.editorShell}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Položky builderu</div>
          <p className={styles.desc}>
            Editor položek pro `C3 Capability Map`, které byly jednorázově vygenerované z legacy `c3_poster_v2.html`.
            Struktura zůstává stejná jako v posteru: `pageId`, `uuid`, `title`, `parentId`, `level`, `state`, `domain`.
          </p>
        </div>
        <div className={styles.headerActions}>
          <Link href={spiralMapHref(spiralCode)} className={styles.actionLink}>Otevřít mapu ({activeSpiralLabel})</Link>
          <Link href="/c3/list" className={`${styles.actionLink} ${styles.actionPrimary}`}>C3 Taxonomy</Link>
        </div>
      </div>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div className={styles.panelTitle}>Domain Palette</div>
          <div className={styles.panelMeta}>{sortedDomains.length} domén z DB</div>
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
            <div className={styles.panelTitle}>{editingId ? 'Upravit položku' : 'Nová položka'}</div>
            <div className={styles.panelMeta}>{editingId ? `ID ${editingId}` : 'Create'}</div>
          </div>
          <div className={styles.panelBody}>
            {saveError && <div className={styles.error}>{saveError}</div>}
            {saveOk && <div className={styles.success}>{saveOk}</div>}

            <div className={styles.fieldGrid}>
              <div className={styles.fieldRow}>
                <Field label="Page ID">
                  <input className={styles.input} value={draft.page_id} onChange={(event) => updateDraft('page_id', event.target.value)} placeholder="BP-1016" />
                </Field>
                <Field label="UUID">
                  <input className={styles.input} value={draft.uuid} onChange={(event) => updateDraft('uuid', event.target.value)} placeholder="4ec1702a-..." />
                </Field>
              </div>

              <Field label="Title">
                <input className={styles.input} value={draft.title} onChange={(event) => updateDraft('title', event.target.value)} placeholder="Accounting" />
              </Field>

              <div className={styles.fieldRow}>
                <Field label="Domain">
                  <select className={styles.select} value={draft.domain_code} onChange={(event) => updateDraft('domain_code', event.target.value)}>
                    <option value="">— vyber domain —</option>
                    {sortedDomains.map((domain) => (
                      <option key={domain.code} value={domain.code}>
                        {domain.code}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="State">
                  <input className={styles.input} value={draft.state} onChange={(event) => updateDraft('state', event.target.value)} placeholder="approved" />
                </Field>
              </div>

              <div className={styles.fieldRow}>
                <Field label="Parent ID">
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
                    <option value="">— bez parenta —</option>
                    {parentOptions.map((item) => (
                      <option key={item.id} value={item.page_id}>
                        {item.page_id} — {item.title}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Level">
                  <input className={styles.input} type="number" min={1} max={20} value={draft.level} onChange={(event) => updateDraft('level', event.target.value)} />
                </Field>
              </div>

              {selectedDomain && (
                <div className={styles.hint}>
                  Aktivní doména používá barvy <strong>{selectedDomain.heading_color}</strong> / <strong>{selectedDomain.background_color}</strong>.
                </div>
              )}
            </div>

            <div className={styles.toolbar}>
              <button type="button" className={`${styles.button} ${styles.buttonPrimary}`} onClick={handleSave} disabled={saving}>
                {saving ? 'Ukládám…' : editingId ? 'Uložit změny' : 'Vytvořit položku'}
              </button>
              <button type="button" className={styles.button} onClick={() => resetForm()} disabled={saving}>
                Vyčistit formulář
              </button>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Položky builderu</div>
            <div className={styles.panelMeta}>
              {itemsLoading ? 'Načítám…' : formatFilteredCountLabel(filteredItems.length, items?.length ?? 0, COUNT_LABELS.records)}
            </div>
          </div>
          <div className={styles.searchWrap}>
            <input
              className={styles.input}
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filtrovat pageId, title, parentId, domain…"
            />
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('page_id')}>
                      Page ID {sortKey === 'page_id' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('title')}>
                      Title {sortKey === 'title' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('level')}>
                      Hierarchy {sortKey === 'level' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('domain_code')}>
                      Domain {sortKey === 'domain_code' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>
                    <button type="button" className={styles.sortButton} onClick={() => handleSort('state')}>
                      State {sortKey === 'state' ? (sortDirection === 'asc' ? '▲' : '▼') : '↕'}
                    </button>
                  </th>
                  <th>Akce</th>
                </tr>
              </thead>
              <tbody>
                {(itemsError || domainsError) && (
                  <tr>
                    <td colSpan={6} className={styles.error}>
                      {(itemsError ?? domainsError)?.message ?? 'Načtení selhalo'}
                    </td>
                  </tr>
                )}
                {!itemsLoading && !itemsError && filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={6} className={styles.muted}>Žádné položky neodpovídají filtru.</td>
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
                      <div>Level {item.level}</div>
                      <div className={styles.muted}>{item.parent_id ? `${item.parent_id}${item.parent_title ? ` — ${item.parent_title}` : ''}` : 'root'}</div>
                    </td>
                    <td>
                      <span className={styles.badge}>{item.domain_code}</span>
                    </td>
                    <td>{item.state ?? '—'}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button type="button" className={styles.button} onClick={() => startEdit(item)}>Edit</button>
                        <button type="button" className={`${styles.button} ${styles.buttonDanger}`} onClick={() => handleDelete(item)}>Delete</button>
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
