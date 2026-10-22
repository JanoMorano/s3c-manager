'use client';

/**
 * Home — "What needs my attention": first-run checklist, three key numbers,
 * the user's own work list and a way into the operations queue. Detailed
 * portfolio and governance signals live on their own pages.
 */
import { useEffect, useState, type ReactNode } from 'react';
import Link from '@/app/components/AppLink';
import PageHeader from '@/app/components/PageHeader';
import { KpiCard } from '@/design-system/controls';
import { useCatalogQualitySummary, useDashboardSummary, useServices } from '@/features/services/hooks/useServices';
import { AUTH_STATE_EVENT, restoreAuthSession } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';
import { useInstallStatus } from '@/features/install/installStatus';
import GettingStarted from '@/features/home/GettingStarted';
import { useLocale, useT } from '@/app/i18n/useI18n';
import MyWork from './cockpit/my-tasks/MyWork';
import styles from './home.module.css';

function useRole() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const snapshot = await restoreAuthSession();
      if (!cancelled) setRole(snapshot?.role ?? null);
    };
    void sync();
    window.addEventListener(AUTH_STATE_EVENT, sync);
    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_STATE_EVENT, sync);
    };
  }, []);
  return role;
}

export default function HomePage() {
  const t = useT();
  const locale = useLocale();
  const role = useRole();
  const canEdit = hasRoleAccess(role, 'editor');
  const { c3Visible, managementVisible } = useInstallStatus();
  const quality = useCatalogQualitySummary();
  const summary = useDashboardSummary();
  const blockedQuery = useServices({ limit: 1, readiness: 'blocked' });
  const overdueQuery = useServices({ limit: 1, reviewDue: 'overdue' });
  const publishableQuery = useServices({ limit: 1, readiness: 'publishable' });

  const formatNumber = (value: number) => value.toLocaleString(locale === 'cs' ? 'cs-CZ' : 'en-GB');
  const totalServices = quality.data?.item.total_services ?? summary.data?.summary.total_services ?? 0;
  const blocked = blockedQuery.data?.total ?? summary.data?.summary.services_blocked_by_readiness ?? 0;
  const overdue = overdueQuery.data?.total ?? 0;
  const publishable = publishableQuery.data?.total ?? summary.data?.summary.services_ready_for_publish ?? 0;

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('home.v2.title')}
        purpose={t('home.v2.purpose')}
        primaryAction={canEdit
          ? { label: t('service_list.new_service'), href: '/management/new-service' }
          : { label: t('home.v2.browse_catalogue'), href: '/catalogue' }}
      />

      {canEdit && quality.data?.item && (
        <GettingStarted quality={quality.data.item} includeCapabilities={c3Visible} />
      )}

      <section className={styles.kpiGrid} aria-label={t('home.kpi.aria')}>
        <KpiLinkCard href="/services/list?readiness=blocked" ariaLabel={t('home.kpi.blocked.aria')}>
          <KpiCard label={t('home.kpi.blocked.label')} value={formatNumber(blocked)} tone={blocked ? 'danger' : 'success'} trendLabel={blocked ? t('home.kpi.blocked.trend_action') : t('home.kpi.blocked.trend_clear')} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?review_due=overdue" ariaLabel={t('home.kpi.overdue.aria')}>
          <KpiCard label={t('home.kpi.overdue.label')} value={formatNumber(overdue)} tone={overdue ? 'warning' : 'neutral'} trendLabel={overdue ? t('home.kpi.overdue.trend') : t('home.kpi.overdue.trend_clear')} />
        </KpiLinkCard>
        <KpiLinkCard href="/services/list?readiness=publishable" ariaLabel={t('home.kpi.ready.aria')}>
          <KpiCard
            label={t('service_list.readiness_option.publishable')}
            value={t('home.v2.ready_of_total', { ready: formatNumber(publishable), total: formatNumber(totalServices) })}
            tone="success"
            trendLabel={t('home.kpi.ready.trend', { percent: totalServices ? Math.round((publishable / totalServices) * 100) : 0 })}
          />
        </KpiLinkCard>
      </section>

      {managementVisible && (
        <section className={styles.workSection} aria-labelledby="my-work-title">
          <div className={styles.workHeader}>
            <h2 id="my-work-title" className={styles.workTitle}>{t('home.v2.my_work')}</h2>
            <Link href="/operations" className={styles.workLink}>{t('home.v2.open_queue')} →</Link>
          </div>
          <MyWork />
        </section>
      )}
    </main>
  );
}

function KpiLinkCard({ href, ariaLabel, children }: { href: string; ariaLabel: string; children: ReactNode }) {
  return (
    <Link href={href} className={styles.kpiLink} aria-label={ariaLabel}>
      {children}
    </Link>
  );
}
