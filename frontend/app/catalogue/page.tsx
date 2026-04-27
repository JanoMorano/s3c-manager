'use client';

import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import {
  useCompleteness,
  useDashboardHeadline,
  useDashboardInbox,
} from '@/features/services/hooks/useServices';
import { useT } from '@/app/i18n/useI18n';
import styles from '../dashboard/dashboard.module.css';

function formatKpiValue(value: number, unit: string) {
  if (unit === 'percent') return `${value}%`;
  return value.toLocaleString('cs-CZ');
}

function badgeVariant(value: number, unit: string) {
  if (unit !== 'percent') return value > 0 ? 'success' : 'warning';
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

export default function CataloguePage() {
  const t = useT();
  const headline = useDashboardHeadline();
  const inbox = useDashboardInbox();
  const completeness = useCompleteness();

  const isLoading = headline.isLoading || completeness.isLoading;
  const hasError = headline.error || completeness.error;

  if (isLoading) return <div className={styles.state}>{t('catalogue.loading')}</div>;
  if (hasError) return <div className={styles.stateError}>{t('catalogue.unavailable')}</div>;

  const services = completeness.data ?? [];
  const attention = services
    .filter((service) => service.service_status !== 'retired')
    .filter((service) => (service.completeness_score ?? 0) < 80 || !service.summary || !service.has_c3_mapping || (service.flavour_count ?? 0) === 0)
    .sort((a, b) => (a.completeness_score ?? 0) - (b.completeness_score ?? 0))
    .slice(0, 8);
  const inboxItems = inbox.data?.items ?? [];

  return (
    <main className={styles.shell}>
      <div className={styles.pageHeader}>
        <div>
          <span className={styles.pageEyebrow}>{t('catalogue.eyebrow')}</span>
          <h1 className={styles.pageTitle}>{t('catalogue.title')}</h1>
          <p className={styles.pageLead}>{t('catalogue.lead')}</p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.cachedBadge}>{t('catalogue.badge.languages')}</span>
          <span className={styles.cachedBadge}>{t('catalogue.badge.theme')}</span>
          <Link href="/operations" className={styles.secondaryLink}>{t('catalogue.link.operations')}</Link>
        </div>
      </div>

      <section className={styles.kpiThree} aria-label="Catalogue headline KPIs">
        {(headline.data?.kpis ?? []).map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={formatKpiValue(kpi.value, kpi.unit)}
            hint={(
              <span className={styles.kpiHint}>
                <Badge variant={badgeVariant(kpi.value, kpi.unit)}>{kpi.unit === 'percent' ? t('common.action') : t('common.active')}</Badge>
                <span>{kpi.hint}</span>
              </span>
            )}
          />
        ))}
      </section>

      <nav className={styles.tabs} aria-label="Catalogue sections">
        <Link href="/catalogue" className={`${styles.tab} ${styles.tabActive}`}>{t('common.overview')}</Link>
        <Link href="/services/list" className={styles.tabLinkButton}>{t('catalogue.links.services')}</Link>
        <Link href="/operations" className={styles.tabLinkButton}>{t('catalogue.links.operations')}</Link>
        <Link href="/capabilities" className={styles.tabLinkButton}>{t('catalogue.links.capabilities')}</Link>
      </nav>

      <section className={styles.decisionLayout}>
        <div className={styles.decisionMain}>
          <article className={styles.decisionCard}>
            <div className={styles.decisionCardHeader}>
              <div>
                <h2 className={styles.decisionTitle}>{t('catalogue.attention.title')}</h2>
                <p className={styles.decisionLead}>{t('catalogue.attention.lead')}</p>
              </div>
              <Link href="/services/list" className={styles.secondaryLink}>{t('catalogue.open_list')}</Link>
            </div>

            <div className={styles.insightGrid}>
              <div className={styles.insightTile}>
                <strong>{attention.length}</strong>
                <span>{t('catalogue.metric.need_action')}</span>
              </div>
              <div className={styles.insightTile}>
                <strong>{inboxItems.length}</strong>
                <span>{t('catalogue.metric.inbox')}</span>
              </div>
              <div className={styles.insightTile}>
                <strong>{services.length}</strong>
                <span>{t('catalogue.metric.readiness_scan')}</span>
              </div>
            </div>
          </article>

          <article className={styles.decisionCard}>
            <div className={styles.sectionHeader}>
            <div>
              <h2 className={styles.cardTitle}>{t('catalogue.evidence.title')}</h2>
              <p className={styles.sectionHint}>{t('catalogue.evidence.hint')}</p>
            </div>
          </div>

          {attention.length === 0 ? (
            <EmptyState title={t('catalogue.empty.ready')} description={t('catalogue.empty.ready_desc')} />
          ) : (
            <div className={styles.evidenceTable}>
              <div className={styles.evidenceHeader}>
                <span>{t('catalogue.table.service')}</span>
                <span>{t('catalogue.table.readiness')}</span>
                <span>{t('catalogue.table.signal')}</span>
              </div>
              {attention.map((service) => {
                const score = service.completeness_score ?? 0;
                const tone = score >= 70 ? 'warning' : 'danger';
                return (
                  <Link key={service.service_id} href={`/services/${service.service_id}/edit`} className={styles.evidenceRow}>
                    <span className={styles.evidencePrimary}>
                      <strong>{service.title}</strong>
                      <small>{service.service_id} · {service.service_type ?? 'untyped'}</small>
                    </span>
                    <span className={styles.workProgress}>
                      <ProgressBar value={score} tone={tone} label={`${service.title} readiness`} />
                      <small>{score}%</small>
                    </span>
                    <Badge variant={tone}>{score >= 70 ? t('catalogue.signal.review') : t('catalogue.signal.fix')}</Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </article>
        </div>

        <aside className={styles.decisionRail}>
          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('catalogue.inbox.title')}</h2>
            {inboxItems.length === 0 ? (
              <EmptyState title={t('catalogue.inbox.empty')} description={t('catalogue.inbox.empty_desc')} />
            ) : (
              <div className={styles.inboxList}>
                {inboxItems.map((item) => (
                  <Link key={item.id} href={item.href} className={styles.inboxItem}>
                    <Badge variant={item.severity}>{item.type.replaceAll('_', ' ')}</Badge>
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </Link>
                ))}
              </div>
            )}
          </article>

          <article className={styles.railCard}>
            <h2 className={styles.railTitle}>{t('catalogue.decision_model')}</h2>
            <div className={styles.auditList}>
              <div className={styles.metricLine}><span>{t('catalogue.model.decision')}</span><strong>{t('catalogue.model.readiness')}</strong></div>
              <div className={styles.metricLine}><span>{t('catalogue.model.evidence')}</span><strong>{t('catalogue.model.gaps')}</strong></div>
              <div className={styles.metricLine}><span>{t('catalogue.model.raw')}</span><strong>{t('catalogue.model.table')}</strong></div>
            </div>
          </article>
        </aside>
      </section>
    </main>
  );
}
