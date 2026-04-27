'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { apiFetch } from '@/features/services/api/services.api';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useT } from '@/app/i18n/useI18n';
import styles from '@/features/capabilities/capabilities.module.css';

interface Spiral { code: string; name: string | null; description: string | null; is_active: boolean }

export default function SpiralsPage() {
  const t = useT();
  const { data, isLoading, error } = useSWR<{ items: Spiral[] }>('/api/v1/spirals', apiFetch, { revalidateOnFocus: false });
  if (isLoading) return <div className={styles.state}>{t('spirals.loading')}</div>;
  if (error) return <div className={styles.state}>{t('spirals.unavailable')}</div>;
  const spirals = data?.items ?? [];
  const activeCount = spirals.filter((spiral) => spiral.is_active).length;
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('spirals.eyebrow')}</span>
          <h1 className={styles.title}>{t('spirals.title')}</h1>
          <p className={styles.lead}>{t('spirals.lead')}</p>
        </div>
        <Badge variant="info">{spirals.length} FMN</Badge>
      </header>

      <section className={styles.kpiGrid} aria-label="Spiral headline KPIs">
        <KpiCard label={t('spirals.kpi.total')} value={spirals.length} hint="FMN" />
        <KpiCard label={t('spirals.kpi.active')} value={activeCount} hint={t('spirals.active_baseline')} />
        <KpiCard label={t('spirals.kpi.heatmaps')} value={spirals.length} hint="coverage" />
      </section>

      <nav className={styles.tabs} aria-label="Spiral sections">
        <Link href="/spirals" className={`${styles.tab} ${styles.tabActive}`}>{t('spirals.tabs.overview')}</Link>
        <Link href="/c3/fmn-air-c2" className={styles.tabLinkButton}>{t('spirals.tabs.fmn_air_c2')}</Link>
      </nav>

      <section className={styles.layout}>
        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('spirals.decision.title')}</h2>
          <p className={styles.bodyText}>{t('spirals.decision.lead')}</p>
          {spirals.length === 0 ? (
            <EmptyState title={t('spirals.unavailable')} />
          ) : (
            <div className={styles.grid}>
              {spirals.map((spiral) => (
                <Link key={spiral.code} href={`/spirals/${spiral.code}`} className={styles.card}>
                  <small>{spiral.is_active ? t('spirals.active_baseline') : t('spirals.baseline')}</small>
                  <strong>{spiral.name ?? spiral.code}</strong>
                  <span>{spiral.description ?? t('spirals.card.fallback_desc')}</span>
                </Link>
              ))}
            </div>
          )}
        </article>
        <aside className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('spirals.evidence.title')}</h2>
          <div className={styles.actionStack}>
            {spirals.map((spiral) => (
              <Link key={spiral.code} href={`/spirals/${spiral.code}`} className={styles.pill}>{spiral.name ?? spiral.code}</Link>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
