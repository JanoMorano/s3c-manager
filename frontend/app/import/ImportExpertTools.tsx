/**
 * Admin-only expert/debug tools for import (moved from /administration/import).
 * GET  /api/v1/import/relation-raw            — unparsed relation import evidence
 * POST /api/v1/import/reparse-raw             — re-parse unparsed relations
 * GET  /api/v1/services/:id/raw-fields        — import source evidence per service
 * Rendered only for admins when NEXT_PUBLIC_ENABLE_IMPORT_DEBUG_TOOLS=true.
 */
'use client';

import { useState } from 'react';
import Link from '@/app/components/AppLink';
import useSWR from 'swr';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { useI18n } from '@/app/i18n/useI18n';
import { formatDate } from '@/app/i18n/format';
import styles from './import.module.css';

const BASE = '/api/v1/import';

interface RelationRaw {
  id: number;
  service_id: string;
  source_field: string;
  raw_value: string;
  parsed_ok: boolean;
  parser_version: string | null;
  parsed_at: string;
}

interface ImportSourceField {
  id: number;
  field_name: string;
  raw_value: string;
  parser_version: string | null;
  notes: string | null;
  created_at: string;
}

type ExpertTab = 'raw' | 'fields';

export default function ImportExpertTools() {
  const { locale, t } = useI18n();
  const [tab, setTab] = useState<ExpertTab>('raw');
  const [rawFieldsServiceId, setRawFieldsServiceId] = useState('');
  const [rawFieldsSearch, setRawFieldsSearch] = useState('');
  const [reparseState, setReparseState] = useState<{ busy: boolean; result: string | null }>({ busy: false, result: null });
  const fmt = (value: string | null) => (value ? formatDate(locale, value, { dateStyle: 'short', timeStyle: 'short' }) : '—');

  const { data: rawData, isLoading: rawLoading, mutate: mutateRaw } = useSWR<RelationRaw[]>(
    tab === 'raw' ? `${BASE}/relation-raw?parsedOk=0&limit=100` : null,
    apiFetch,
  );
  const { data: rawFieldsData, isLoading: rawFieldsLoading } = useSWR<ImportSourceField[]>(
    tab === 'fields' && rawFieldsSearch ? `/api/v1/services/${encodeURIComponent(rawFieldsSearch)}/raw-fields` : null,
    apiFetch,
  );

  const runReparse = async (body: { serviceId?: string; limit: number }, target: string) => {
    setReparseState({ busy: true, result: null });
    try {
      const res = await fetch(`${BASE}/reparse-raw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      setReparseState({
        busy: false,
        result: `✅ ${t('administration.import.reparse_result', { target, processed: json.processed, created: json.created, skipped: json.skipped })}${json.errors?.length ? t('administration.import.reparse_errors_suffix', { errors: json.errors.slice(0, 3).join('; ') }) : ''}`,
      });
      mutateRaw();
    } catch (e) {
      setReparseState({ busy: false, result: `❌ ${t('administration.import.error', { message: e instanceof Error ? e.message : String(e) })}` });
    }
  };

  const handleReparse = (serviceId: string) => {
    if (!confirm(t('administration.import.reparse_confirm_one', { serviceId }))) return;
    void runReparse({ serviceId, limit: 50 }, serviceId);
  };

  const handleReparseAll = () => {
    if (!confirm(t('administration.import.reparse_all_confirm'))) return;
    void runReparse({ limit: 200 }, t('administration.import.reparse_all'));
  };

  return (
    <details className={styles.section}>
      <summary className={styles.sectionSummary}>{t('administration.import.expert_tools')}</summary>
      <div className={styles.sectionBody}>
        <div className={styles.segmented} role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'raw'} className={`${styles.segment} ${tab === 'raw' ? styles.segmentActive : ''}`} onClick={() => setTab('raw')}>
            {t('administration.import.tab_raw_relations')}
          </button>
          <button type="button" role="tab" aria-selected={tab === 'fields'} className={`${styles.segment} ${tab === 'fields' ? styles.segmentActive : ''}`} onClick={() => setTab('fields')}>
            {t('administration.import.tab_source_evidence')}
          </button>
        </div>

        {tab === 'raw' && (
          <>
            <div className={styles.toolRow}>
              <span className={styles.toolTitle} title={t('administration.import.unparsed_relations_hint')}>
                {t('administration.import.unparsed_relations_title')}
              </span>
              <button
                type="button"
                className={styles.ghostBtn}
                onClick={handleReparseAll}
                disabled={reparseState.busy}
                title={t('administration.import.reparse_all_title')}
              >
                {reparseState.busy ? '…' : `↺ ${t('administration.import.reparse_all')}`}
              </button>
            </div>
            {reparseState.result && <div className={styles.toolResult}>{reparseState.result}</div>}
            {rawLoading && <div className={styles.state}>{t('administration.import.loading_raw_relations')}</div>}
            {rawData && rawData.length === 0 && <div className={styles.state}>{t('administration.import.no_unparsed_relations')}</div>}
            {rawData && rawData.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('administration.import.column_id')}</th>
                      <th>{t('administration.import.column_service_id')}</th>
                      <th>{t('administration.import.column_source_field')}</th>
                      <th>{t('administration.import.column_parser')}</th>
                      <th>{t('administration.import.column_captured')}</th>
                      <th>{t('administration.import.column_raw_value')}</th>
                      <th aria-label={t('administration.import.reparse_one_title')}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawData.map((r) => (
                      <tr key={r.id}>
                        <td className={styles.mono}>{r.id}</td>
                        <td><Link href={`/services/${r.service_id}`} className={styles.textLink}>{r.service_id}</Link></td>
                        <td><code className={styles.code}>{r.source_field}</code></td>
                        <td className={styles.muted}>{r.parser_version ?? '—'}</td>
                        <td className={styles.muted}>{fmt(r.parsed_at)}</td>
                        <td className={styles.rawValue} title={r.raw_value}>
                          {r.raw_value.slice(0, 120)}{r.raw_value.length > 120 ? '…' : ''}
                        </td>
                        <td>
                          <button
                            type="button"
                            className={styles.ghostBtn}
                            onClick={() => handleReparse(r.service_id)}
                            disabled={reparseState.busy}
                            title={t('administration.import.reparse_one_title')}
                            aria-label={t('administration.import.reparse_one_title')}
                          >
                            {reparseState.busy ? '…' : '↺'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'fields' && (
          <>
            <form
              className={styles.toolRow}
              onSubmit={(event) => { event.preventDefault(); setRawFieldsSearch(rawFieldsServiceId.trim()); }}
            >
              <span className={styles.toolTitle}>{t('administration.import.source_evidence_title')}</span>
              <input
                className={styles.input}
                aria-label={t('administration.import.column_service_id')}
                placeholder={t('administration.import.service_id_placeholder')}
                value={rawFieldsServiceId}
                onChange={(e) => setRawFieldsServiceId(e.target.value)}
              />
              <button type="submit" className={styles.ghostBtn} disabled={!rawFieldsServiceId.trim()}>
                {t('administration.import.load')}
              </button>
              {rawFieldsSearch && (
                <Link href={`/services/${rawFieldsSearch}`} className={styles.textLink}>
                  {t('administration.import.service_detail')} →
                </Link>
              )}
            </form>
            {rawFieldsLoading && <div className={styles.state}>{t('administration.import.loading_source_evidence')}</div>}
            {rawFieldsSearch && !rawFieldsLoading && rawFieldsData && rawFieldsData.length === 0 && (
              <div className={styles.state}>{t('administration.import.no_source_evidence', { serviceId: rawFieldsSearch })}</div>
            )}
            {rawFieldsData && rawFieldsData.length > 0 && (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('administration.import.column_field')}</th>
                      <th>{t('administration.import.column_parser')}</th>
                      <th>{t('administration.import.column_saved')}</th>
                      <th>{t('administration.import.column_source_value')}</th>
                      <th>{t('administration.import.column_notes')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rawFieldsData.map((rf) => (
                      <tr key={rf.id}>
                        <td><code className={styles.code}>{rf.field_name}</code></td>
                        <td className={styles.muted}>{rf.parser_version ?? '—'}</td>
                        <td className={styles.muted}>{fmt(rf.created_at)}</td>
                        <td className={styles.rawValue} title={rf.raw_value}>
                          {rf.raw_value.slice(0, 200)}{rf.raw_value.length > 200 ? '…' : ''}
                        </td>
                        <td className={styles.muted}>{rf.notes ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </details>
  );
}
