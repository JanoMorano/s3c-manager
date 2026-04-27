'use client';

import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import { useOperationsDashboard } from '@/features/services/hooks/useServices';
import type { CompletenessItem } from '@/features/services/hooks/useServices';
import { useT } from '@/app/i18n/useI18n';
import styles from '../dashboard/dashboard.module.css';

function readinessTone(score: number) {
  if (score >= 80) return 'success';
  if (score >= 50) return 'warning';
  return 'danger';
}

function ServiceRows({ items, empty }: { items: CompletenessItem[]; empty: string }) {
  if (items.length === 0) return <EmptyState title={empty} />;
  return (
    <div className={styles.auditList}>
      {items.map((service) => {
        const score = service.completeness_score ?? 0;
        return (
          <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.queueRowLink}>
            <span>
              <strong>{service.title}</strong>
              <small>{service.service_id} · {service.service_status ?? 'unknown'}</small>
            </span>
            <span className={styles.workProgress}>
              <ProgressBar value={score} tone={readinessTone(score)} label={`${service.title} readiness`} />
              <small>{score}%</small>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default function OperationsPage() {
  const t = useT();
  const { data, isLoading, error } = useOperationsDashboard();

  if (isLoading) return <div className={styles.state}>{t('operations.loading')}</div>;
  if (error || !data) return <div className={styles.stateError}>{t('operations.unavailable')}</div>;

  const pricing = data.sections.pricing_patrol;
  const incomplete = data.sections.incomplete_metadata;
  const missingOwners = data.sections.missing_owners;
  const c3GapTotal = data.sections.c3_mapping_gap.reduce((sum, row) => sum + row.gap_count, 0);

  return (
    <main className={styles.shell}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>{t('operations.eyebrow')}</span>
          <h1 className={styles.pageTitle}>{t('operations.title')}</h1>
          <p className={styles.pageLead}>{t('operations.lead')}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.cachedBadge}>{t('operations.badge.governance')}</span>
          <span className={styles.cachedBadge}>{t('operations.badge.evidence')}</span>
          <Link href="/catalogue" className={styles.secondaryLink}>{t('operations.link.catalogue')}</Link>
        </div>
      </header>

      <section className={styles.kpiThree} aria-label="Operations headline KPIs">
        <KpiCard label={t('operations.kpi.metadata')} value={incomplete.length} hint={<span className={styles.kpiHint}><Badge variant={incomplete.length ? 'warning' : 'success'}>{incomplete.length ? t('common.action') : t('common.clean')}</Badge><span>{t('operations.kpi.metadata_hint')}</span></span>} />
        <KpiCard label={t('operations.kpi.owner_gaps')} value={missingOwners.length} hint={<span className={styles.kpiHint}><Badge variant={missingOwners.length ? 'warning' : 'success'}>{missingOwners.length ? t('operations.assign') : t('operations.covered')}</Badge><span>{t('operations.kpi.owner_hint')}</span></span>} />
        <KpiCard label={t('operations.kpi.c3_gaps')} value={c3GapTotal} hint={<span className={styles.kpiHint}><Badge variant={c3GapTotal ? 'warning' : 'success'}>{c3GapTotal ? t('operations.map') : t('operations.covered')}</Badge><span>{t('operations.kpi.c3_hint')}</span></span>} />
      </section>

      <nav className={styles.tabs} aria-label="Operations sections">
        <Link href="/operations" className={`${styles.tab} ${styles.tabActive}`}>{t('common.health')}</Link>
        <Link href="/operations#pricing" className={styles.tab}>{t('operations.tabs.pricing')}</Link>
        <Link href="/operations#owners" className={styles.tab}>{t('operations.tabs.owners')}</Link>
        <Link href="/operations#c3" className={styles.tab}>{t('operations.tabs.c3')}</Link>
      </nav>

      <section className={styles.decisionLayout}>
        <div className={styles.decisionMain}>
          <article className={styles.decisionCard}>
            <div className={styles.decisionCardHeader}>
              <div>
                <h2 className={styles.decisionTitle}>{t('operations.board.title')}</h2>
                <p className={styles.decisionLead}>{t('operations.board.lead')}</p>
              </div>
              <Link href="/services/list" className={styles.secondaryLink}>{t('operations.open_service_list')}</Link>
            </div>
            <div className={styles.insightGrid}>
              <div className={styles.insightTile}>
                <strong>{pricing.coverage_percent}%</strong>
                <span>{t('operations.insight.pricing')}</span>
              </div>
              <div className={styles.insightTile}>
                <strong>{data.sections.top_completeness.length}</strong>
                <span>{t('operations.insight.references')}</span>
              </div>
              <div className={styles.insightTile}>
                <strong>{data.sections.deprecated_retired.length}</strong>
                <span>{t('operations.insight.lifecycle')}</span>
              </div>
            </div>
          </article>

          <article className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t('operations.incomplete.title')}</h2>
                <p className={styles.sectionHint}>{t('operations.incomplete.hint')}</p>
              </div>
            </div>
            <ServiceRows items={incomplete} empty={t('operations.incomplete.empty')} />
          </article>

          <article id="pricing" className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
              <div>
                <h2 className={styles.cardTitle}>{t('operations.pricing.title')}</h2>
                <p className={styles.sectionHint}>{t('operations.pricing.hint')}</p>
              </div>
            </div>
            <div className={styles.kpiThree}>
              <KpiCard label={t('operations.pricing.coverage')} value={`${pricing.coverage_percent}%`} hint={`${pricing.with_pricing}/${pricing.total_services} ${t('operations.services')}`} />
              <KpiCard label={t('operations.pricing.missing')} value={pricing.missing.length} hint={t('operations.pricing.missing_hint')} />
              <KpiCard label={t('operations.pricing.decision')} value={pricing.missing.length ? t('operations.review') : t('operations.clean')} hint={t('operations.pricing.decision_hint')} />
            </div>
            <ServiceRows items={pricing.missing} empty={t('operations.pricing.empty')} />
          </article>
        </div>

        <aside className={styles.decisionRail}>
          <article id="owners" className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.owners.title')}</h2>
            {missingOwners.length === 0 ? (
              <EmptyState title={t('operations.owners.empty')} />
            ) : (
              <div className={styles.auditList}>
                {missingOwners.map((service) => (
                  <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.queueRowLink}>
                    <span>
                      <strong>{service.title}</strong>
                      <small>{service.service_id}</small>
                    </span>
                    <Badge variant="warning">{t('operations.owner_missing')}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.top_completeness.title')}</h2>
            <ServiceRows items={data.sections.top_completeness} empty={t('operations.no_data')} />
          </article>

          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.lifecycle.title')}</h2>
            <ServiceRows items={data.sections.deprecated_retired} empty={t('operations.lifecycle.empty')} />
          </article>

          <article id="c3" className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('operations.c3_gap.title')}</h2>
            {data.sections.c3_mapping_gap.length === 0 ? (
              <EmptyState title={t('operations.c3_gap.empty')} />
            ) : (
              <div className={styles.auditList}>
                {data.sections.c3_mapping_gap.map((row) => (
                  <Link key={row.item_type} href={`/c3/list?item_type=${encodeURIComponent(row.item_type)}`} className={styles.queueRowLink}>
                    <span>
                      <strong>{row.item_type}</strong>
                      <small>{row.mapped_count}/{row.total_count} {t('operations.c3_gap.mapped')}</small>
                    </span>
                    <Badge variant={row.gap_count > 0 ? 'warning' : 'success'}>{row.gap_count > 0 ? `${row.gap_count} ${t('operations.c3_gap.gap')}` : t('operations.covered')}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </article>
        </aside>
      </section>
    </main>
  );
}
