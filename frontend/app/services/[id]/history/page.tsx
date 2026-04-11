/**
 * §9.6 Audit History — chronological change timeline for the service.
 * GET /api/v1/services/:id/history -> AuditLog records.
 */
'use client';

import { use }    from 'react';
import Link       from 'next/link';
import { useServiceHistory } from '@/features/services/hooks/useServices';
import styles from './history.module.css';

interface Props { params: Promise<{ id: string }> }

export default function ServiceHistoryPage({ params }: Props) {
  const { id }  = use(params);
  const { data, isLoading, error } = useServiceHistory(id);

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Link href={`/services/${id}`} className={styles.backLink}>← {id}</Link>
        <h1 className={styles.title}>Audit History</h1>
      </header>

      {isLoading && <div className={styles.state}>Loading history…</div>}
      {error     && <div className={styles.stateError}>Failed to load history.</div>}

      {!isLoading && !error && data && (
        data.length === 0
          ? <div className={styles.state}>No history records found.</div>
          : (
            <div className={styles.timeline}>
              {data.map(entry => (
                <div key={entry.id} className={styles.entry}>
                  <div className={styles.entryDot} data-action={entry.action?.toLowerCase()} />
                  <div className={styles.entryContent}>
                    <div className={styles.entryHeader}>
                      <span className={styles.entryAction} data-action={entry.action?.toLowerCase()}>
                        {entry.action}
                      </span>
                      <span className={styles.entryTime}>
                        {entry.performed_at
                          ? new Date(entry.performed_at).toLocaleString('cs-CZ')
                          : entry.changed_at
                          ? new Date(entry.changed_at).toLocaleString('cs-CZ')
                          : '—'}
                      </span>
                      <span className={styles.entryBy}>
                        {entry.performed_by ?? entry.changed_by ?? 'system'}
                      </span>
                    </div>

                    {/* Changed fields list */}
                    {entry.changed_fields && (
                      <ChangedFields raw={entry.changed_fields} />
                    )}

                    {/* old_value → new_value */}
                    {(entry.old_value != null || entry.new_value != null) && (
                      <div className={styles.entryValues}>
                        {entry.old_value != null && (
                          <span className={styles.oldValue}>
                            <span className={styles.valueLabel}>from:</span>
                            <code className={styles.valueCode}>{String(entry.old_value)}</code>
                          </span>
                        )}
                        {entry.new_value != null && (
                          <span className={styles.newValue}>
                            <span className={styles.valueLabel}>to:</span>
                            <code className={styles.valueCode}>{truncate(String(entry.new_value), 200)}</code>
                          </span>
                        )}
                      </div>
                    )}

                    {/* new_values JSON (INSERT events) */}
                    {(entry as AuditEntryRaw).new_values != null && (
                      <NewValues raw={(entry as AuditEntryRaw).new_values} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function ChangedFields({ raw }: { raw: unknown }) {
  let fields: string[] = [];
  if (typeof raw === 'string') {
    try { fields = JSON.parse(raw); } catch { fields = raw.split(',').map(f => f.trim()); }
  } else if (Array.isArray(raw)) {
    fields = raw as string[];
  }
  if (!fields.length) return null;
  return (
    <div className={styles.fields}>
      {fields.map(f => <span key={f} className={styles.fieldChip}>{f}</span>)}
    </div>
  );
}

function NewValues({ raw }: { raw: unknown }) {
  if (raw == null) return null;
  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { return <code className={styles.valueCode}>{truncate(raw, 300)}</code>; }
  }
  if (typeof parsed === 'object' && parsed !== null) {
    const entries = Object.entries(parsed as Record<string, unknown>).slice(0, 12);
    if (!entries.length) return null;
    return (
      <div className={styles.kvGrid}>
        {entries.map(([k, v]) => (
          <div key={k} className={styles.kvRow}>
            <span className={styles.kvKey}>{k}</span>
            <span className={styles.kvVal}>{v != null ? String(v) : <em>null</em>}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

// Extended type — middleware AuditLog returns slightly different shape than ServiceHistoryEntry
interface AuditEntryRaw {
  new_values?: unknown;
  old_values?: unknown;
  performed_at?: string;
  performed_by?: string;
}
