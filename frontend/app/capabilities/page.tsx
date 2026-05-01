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
      <CapabilityStudioHero capabilities={capabilities} spiralCount={spiralCount} />

      <section className={styles.kpiGrid} aria-label="Capability headline KPIs">
        <KpiCard label={t('capabilities.kpi.level3')} value={capabilities.length} hint="C3 taxonomy" />
        <KpiCard label={t('capabilities.kpi.spirals')} value={spiralCount} hint="FMN" />
        <KpiCard label={t('capabilities.kpi.dashboards')} value={capabilities.length} hint={t('capabilities.tabs.overview')} />
      </section>

      <nav className={styles.tabs} aria-label="Capability sections">
        <Link href="/capabilities" className={`${styles.tab} ${styles.tabActive}`}>{t('capabilities.tabs.overview')}</Link>
        <Link href="/capabilities/coverage" className={styles.tabLinkButton}>Coverage</Link>
        <Link href="/capabilities/gaps" className={styles.tabLinkButton}>Gaps</Link>
        <Link href="/capabilities/overlaps" className={styles.tabLinkButton}>Overlaps</Link>
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

function CapabilityStudioHero({ capabilities, spiralCount }: { capabilities: Capability[]; spiralCount: number }) {
  const withoutSpiral = capabilities.filter((capability) => capability.available_spirals.length === 0).length;
  const parentCounts = capabilities.reduce<Record<string, number>>((acc, capability) => {
    const parent = capability.parent?.title ?? 'Unassigned parent';
    acc[parent] = (acc[parent] ?? 0) + 1;
    return acc;
  }, {});
  const topParents = Object.entries(parentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const spotlight = capabilities.slice(0, 4);
  const tasks = [
    {
      tone: capabilities.length ? 'success' : 'warning',
      title: capabilities.length ? 'Capability catalogue is loaded' : 'Capability import missing',
      detail: capabilities.length ? `${capabilities.length} Level-3 capabilities are available for managers.` : 'Import C3 capabilities before managers can compare service coverage.',
      href: '/admin/c3/capability-builder',
      label: 'Builder',
    },
    {
      tone: withoutSpiral ? 'warning' : 'success',
      title: withoutSpiral ? 'Capabilities without spiral' : 'Spiral membership visible',
      detail: withoutSpiral ? `${withoutSpiral} capabilities need FMN spiral context.` : `${spiralCount} spirals are represented in this hub.`,
      href: '/spirals',
      label: 'Open spirals',
    },
    {
      tone: topParents.length ? 'info' : 'warning',
      title: 'Largest parent area',
      detail: topParents[0] ? `${topParents[0][0]} contains ${topParents[0][1]} capabilities.` : 'No parent structure is available yet.',
      href: '/capabilities/coverage',
      label: 'Coverage',
    },
  ];

  return (
    <section className={styles.studioHero} aria-label="Capability relationship overview">
      <div className={styles.studioSummary}>
        <div className={styles.studioTopline}>
          <div>
            <span className={styles.eyebrow}>Capability map</span>
            <h1 className={styles.studioTitle}>What NATO capabilities are covered, missing, or duplicated.</h1>
          </div>
          <Badge variant="info">{capabilities.length} Level-3</Badge>
        </div>
        <p className={styles.studioLead}>
          Use this page as the manager-readable layer above C3. It connects capability names,
          FMN spirals, service evidence, and admin work queues without forcing people to read
          raw taxonomy tables first.
        </p>
        <div className={styles.studioMetricGrid}>
          <StudioMetric value={String(capabilities.length)} label="Capabilities" detail="Level-3 decision areas" tone="success" />
          <StudioMetric value={String(spiralCount)} label="Spirals" detail="FMN context available" tone={spiralCount ? 'success' : 'warning'} />
          <StudioMetric value={String(withoutSpiral)} label="Needs context" detail="No spiral assigned" tone={withoutSpiral ? 'warning' : 'success'} />
        </div>
      </div>

      <div className={styles.studioQueue}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.eyebrow}>Admin queue</span>
            <h2>Explain the map next</h2>
          </div>
          <Badge variant={withoutSpiral ? 'warning' : 'success'}>{withoutSpiral ? 'Action' : 'Clean'}</Badge>
        </div>
        <div className={styles.studioTaskList}>
          {tasks.map((task) => (
            <Link key={task.title} href={task.href} className={styles.studioTask}>
              <span className={`${styles.studioDot} ${styles[`studioDot_${task.tone}`]}`} />
              <span>
                <strong>{task.title}</strong>
                <small>{task.detail}</small>
              </span>
              <em>{task.label}</em>
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.capabilityMapPreview}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.eyebrow}>Manager story</span>
            <h2>From capability to service evidence</h2>
          </div>
          <Link href="/c3/dashboard" className={styles.inlineLink}>C3 board</Link>
        </div>
        <div className={styles.capabilityFlow}>
          {spotlight.length ? spotlight.map((capability) => (
            <Link key={capability.uuid} href={`/capabilities/${capability.slug}`} className={styles.capabilityFlowNode}>
              <span>{capability.parent?.title ?? 'Capability parent'}</span>
              <strong>{capability.title}</strong>
              <small>{capability.available_spirals.length ? capability.available_spirals.join(', ') : 'No spiral'}</small>
            </Link>
          )) : (
            <div className={styles.capabilityFlowNode}>
              <span>C3</span>
              <strong>No capabilities loaded</strong>
              <small>Import taxonomy first</small>
            </div>
          )}
        </div>
      </div>

      <div className={styles.parentStack}>
        <span className={styles.eyebrow}>Largest areas</span>
        {topParents.length ? topParents.map(([parent, count]) => (
          <div key={parent} className={styles.parentRow}>
            <span>{parent}</span>
            <strong>{count}</strong>
          </div>
        )) : <p className={styles.bodyText}>No parent areas available yet.</p>}
      </div>
    </section>
  );
}

function StudioMetric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: 'success' | 'warning' | 'info' }) {
  return (
    <div className={`${styles.studioMetric} ${styles[`studioMetric_${tone}`]}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}
