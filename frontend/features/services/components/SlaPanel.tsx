'use client';

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
import { useT } from '@/app/i18n/useI18n';
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
  const t = useT();
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
              <span className={styles.summaryLabel}>{t('service_detail.text.availability')}</span>
              <AvailabilityBadge pct={summary.sla_availability} showLabel />
            </div>
          )}
          {summary.sla_restoration != null && (
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>{t('service_detail.text.restoration')}</span>
              <span className={styles.summaryValue}>{t('sla_panel.hours_value', { value: summary.sla_restoration })}</span>
            </div>
          )}
          {summary.sla_delivery != null && (
            <div className={styles.summaryCell}>
              <span className={styles.summaryLabel}>{t('service_detail.text.delivery')}</span>
              <span className={styles.summaryValue}>{t('sla_panel.days_value', { value: summary.sla_delivery })}</span>
            </div>
          )}
        </div>
      )}

      {/* SLA text descriptions (from raw fields) */}
      {(summary.sla_restoration_text || summary.sla_delivery_text) && (
        <div className={styles.slaTextBlock}>
          {summary.sla_restoration_text && (
            <p className={styles.slaText}><strong>{t('sla_panel.restoration_label')}</strong> {summary.sla_restoration_text}</p>
          )}
          {summary.sla_delivery_text && (
            <p className={styles.slaText}><strong>{t('sla_panel.delivery_label')}</strong> {summary.sla_delivery_text}</p>
          )}
        </div>
      )}

      {/* ── Detail tier ────────────────────────────────────────────── */}
      {hasRecords && (
        <div className={styles.detailBlock}>
          <div className={styles.detailLabel}>{t('sla_panel.records', { count: detail!.sla_records.length })}</div>
          <div className={styles.table}>
            <div className={styles.tableHeader}>
              <span>{t('sla_panel.col.window')}</span>
              <span>{t('service_detail.text.availability')}</span>
              <span>{t('service_detail.text.restoration')}</span>
              <span>{t('service_detail.text.delivery')}</span>
              <span>{t('sla_panel.col.legacy_variant')}</span>
              <span>{t('sla_panel.col.priority_model')}</span>
              <span>{t('sla_panel.col.note_source')}</span>
            </div>
            {detail!.sla_records.map((r: SlaRecord) => (
              <div key={r.id} className={styles.tableRow}>
                <span>{r.support_window_code ?? '—'}</span>
                <span><AvailabilityBadge pct={r.availability_pct} showLabel /></span>
                <span>{r.restoration_hours != null ? t('sla_panel.hours_value', { value: r.restoration_hours }) : '—'}</span>
                <span>{r.delivery_days     != null ? t('sla_panel.days_value', { value: r.delivery_days }) : '—'}</span>
                <span>{r.flavour_title ?? r.flavour_code ?? t('sla_panel.base_variant')}</span>
                <span className={styles.noteCell}>{r.priority_model_raw ?? '—'}</span>
                <span className={styles.noteCell}>
                  {r.sla_note_raw ?? ''}
                  {r.source_field && <span className={styles.srcTag} title={t('sla_panel.source_field', { field: r.source_field })}> [{r.source_field}]</span>}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
