/**
 * SlaPanel — Summary + Detail SLA panel
 *
 * Shows the SLA summary scalar values from ServiceCatalog together
 * with the detailed SLA records table from ServiceSla.
 *
 * Based on zadani_projektu.md section 7:
 *   - summary SLA in Service
 *   - detailed SLA in ServiceSla
 * Visually separates both tiers as one panel, not two independent blocks.
 */
import { AvailabilityBadge } from './AvailabilityBadge';
import type { SlaResponse, SlaRecord } from '../model/service.types';
import styles                 from './SlaPanel.module.css';

interface SlaSummary {
  sla_availability:    number | null;
  sla_restoration:     number | null;
  sla_delivery:        number | null;
  sla_restoration_text?: string | null;
  sla_delivery_text?:    string | null;
}

interface SlaPanelProps {
  summary:   SlaSummary;
  detail:    SlaResponse | undefined;
}

export function SlaPanel({ summary, detail }: SlaPanelProps) {
  const hasSummary = summary.sla_availability != null
    || summary.sla_restoration != null
    || summary.sla_delivery    != null;
  const hasRecords = detail?.sla_records && detail.sla_records.length > 0;

  if (!hasSummary && !hasRecords) return null;

  return (
    <div className={styles.panel}>
      <div className={styles.panelTitle}>SLA</div>

      {/* ── Summary tier ───────────────────────────────────────────── */}
      {hasSummary && (
        <div className={styles.summaryRow}>
          {summary.sla_availability != null && (
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>Availability</span>
              <AvailabilityBadge pct={summary.sla_availability} showLabel />
            </div>
          )}
          {summary.sla_restoration != null && (
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>Restoration</span>
              <span className={styles.summaryValue}>{summary.sla_restoration}h</span>
            </div>
          )}
          {summary.sla_delivery != null && (
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>Delivery</span>
              <span className={styles.summaryValue}>{summary.sla_delivery}d</span>
            </div>
          )}
        </div>
      )}

      {/* SLA text descriptions (from raw fields) */}
      {(summary.sla_restoration_text || summary.sla_delivery_text) && (
        <div className={styles.slaTextBlock}>
          {summary.sla_restoration_text && (
            <p className={styles.slaText}><strong>Restoration:</strong> {summary.sla_restoration_text}</p>
          )}
          {summary.sla_delivery_text && (
            <p className={styles.slaText}><strong>Delivery:</strong> {summary.sla_delivery_text}</p>
          )}
        </div>
      )}

      {/* ── Detail tier ────────────────────────────────────────────── */}
      {hasRecords && (
        <div className={styles.detailBlock}>
          <div className={styles.detailLabel}>SLA Records ({detail!.sla_records.length})</div>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>Window</span>
              <span>Availability</span>
              <span>Restoration</span>
              <span>Delivery</span>
              <span>Legacy variant</span>
              <span>Priority model</span>
              <span>Note / Source</span>
            </div>
            {detail!.sla_records.map((r: SlaRecord) => (
              <div key={r.id} className={styles.tableRow}>
                <span>{r.support_window_code ?? '—'}</span>
                <span><AvailabilityBadge pct={r.availability_pct} showLabel /></span>
                <span>{r.restoration_hours != null ? `${r.restoration_hours}h` : '—'}</span>
                <span>{r.delivery_days     != null ? `${r.delivery_days}d`     : '—'}</span>
                <span>{r.flavour_title ?? r.flavour_code ?? 'Base'}</span>
                <span className={styles.noteCell}>{r.priority_model_raw ?? '—'}</span>
                <span className={styles.noteCell}>
                  {r.sla_note_raw ?? ''}
                  {r.source_field && <span className={styles.srcTag} title={`Source field: ${r.source_field}`}> [{r.source_field}]</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
