'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { apiFetch } from '@/features/services/api/services.api';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useT } from '@/app/i18n/useI18n';
import styles from '@/features/capabilities/capabilities.module.css';

interface Capability { uuid: string; page_id: string; title: string; slug: string; parent?: { title?: string }; available_spirals: string[] }

export default function CapabilitiesHubPage() {
  const t = useT();
  const { data, isLoading, error } = useSWR<Capability[]>('/api/v1/capabilities/lvl3', apiFetch, { revalidateOnFocus: false });
  if (isLoading) return <div className={styles.state}>{t('capabilities.loading')}</div>;
  if (error) return <div className={styles.state}>{t('capabilities.unavailable')}</div>;
  const capabilities = data ?? [];
  const spiralCount = new Set(capabilities.flatMap((capability) => capability.available_spirals)).size;
  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>{t('capabilities.eyebrow')}</span>
          <h1 className={styles.title}>{t('capabilities.title')}</h1>
          <p className={styles.lead}>{t('capabilities.lead')}</p>
        </div>
        <Badge variant="info">{capabilities.length} Level-3</Badge>
      </header>

      <section className={styles.kpiGrid} aria-label="Capability headline KPIs">
        <KpiCard label={t('capabilities.kpi.level3')} value={capabilities.length} hint="C3 taxonomy" />
        <KpiCard label={t('capabilities.kpi.spirals')} value={spiralCount} hint="FMN" />
        <KpiCard label={t('capabilities.kpi.dashboards')} value={capabilities.length} hint={t('capabilities.tabs.overview')} />
      </section>

      <nav className={styles.tabs} aria-label="Capability sections">
        <Link href="/capabilities" className={`${styles.tab} ${styles.tabActive}`}>{t('capabilities.tabs.overview')}</Link>
        <Link href="/spirals" className={styles.tabLinkButton}>{t('capabilities.tabs.spirals')}</Link>
      </nav>

      <section className={styles.layout}>
        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('capabilities.decision.title')}</h2>
          <p className={styles.bodyText}>{t('capabilities.decision.lead')}</p>
          {capabilities.length === 0 ? (
            <EmptyState title={t('capabilities.unavailable')} />
          ) : (
            <div className={styles.grid}>
              {capabilities.map((capability) => (
                <Link key={capability.uuid} href={`/capabilities/${capability.slug}`} className={styles.card}>
                  <small>{capability.parent?.title ?? t('capabilities.card.fallback_parent')} · {capability.page_id}</small>
                  <strong>{capability.title}</strong>
                  <span>{capability.available_spirals.length ? capability.available_spirals.join(', ') : t('capabilities.card.no_spiral')}</span>
                </Link>
              ))}
            </div>
          )}
        </article>
        <aside className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('capabilities.evidence.title')}</h2>
          <p className={styles.bodyText}>{t('capabilities.evidence.hint')}</p>
          <div className={styles.actionStack}>
            {capabilities.slice(0, 5).map((capability) => (
              <Link key={capability.uuid} href={`/capabilities/${capability.slug}`} className={styles.pill}>{capability.title}</Link>
            ))}
          </div>
        </aside>
      </section>
    </main>
  );
}
