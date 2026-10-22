'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { useSearchParams } from 'next/navigation';
import PageHeader from '@/app/components/PageHeader';
import { apiFetch } from '@/features/services/api/services.api';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
import { CapabilityGovernancePage } from '@/features/capabilities/CapabilityGovernancePage';
import styles from '@/features/capabilities/capabilities.module.css';

interface Capability { uuid: string; page_id: string; title: string; slug: string; parent?: { title?: string }; available_spirals: string[] }
type CapabilityView = 'overview' | 'coverage' | 'gaps' | 'overlaps';

function countKey(base: string, count: number) {
  return resolveCountForm(count, { one: `${base}.one`, few: `${base}.few`, many: `${base}.many` });
}

function resolveCapabilityView(value: string | null): CapabilityView {
  return value === 'coverage' || value === 'gaps' || value === 'overlaps' ? value : 'overview';
}

export default function CapabilitiesHubPage() {
  const t = useT();
  const searchParams = useSearchParams();
  const activeView = resolveCapabilityView(searchParams?.get('view') ?? null);
  const { data, isLoading, error } = useSWR<Capability[]>('/api/v1/capabilities/lvl3', apiFetch, { revalidateOnFocus: false });
  if (isLoading) return <div className={styles.state}>{t('capabilities.loading')}</div>;
  if (error) return <div className={styles.state}>{t('capabilities.unavailable')}</div>;
  const capabilities = data ?? [];
  const spiralCount = new Set(capabilities.flatMap((capability) => capability.available_spirals)).size;

  if (activeView !== 'overview') {
    return (
      <main className={styles.shell}>
        <PageHeader
          title={t('capabilities.hub.workspace_title')}
          purpose={t('capabilities.hub.workspace_purpose')}
          primaryAction={{ label: t('capabilities.tabs.overview'), href: '/capabilities' }}
        />
        <nav className={styles.tabs} aria-label={t('capabilities.hub.workspace_tabs_aria')}>
          <Link href="/capabilities" className={styles.tab}>{t('capabilities.tabs.overview')}</Link>
          <Link href="/capabilities?view=coverage" className={`${styles.tab} ${activeView === 'coverage' ? styles.tabActive : ''}`}>{t('capabilities.view.coverage')}</Link>
          <Link href="/capabilities?view=gaps" className={`${styles.tab} ${activeView === 'gaps' ? styles.tabActive : ''}`}>{t('capabilities.view.gaps')}</Link>
          <Link href="/capabilities?view=overlaps" className={`${styles.tab} ${activeView === 'overlaps' ? styles.tabActive : ''}`}>{t('capabilities.view.overlaps')}</Link>
        </nav>
        <CapabilityGovernancePage mode={activeView} embedded navigationMode="query" />
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <PageHeader
        title={t('capabilities.title')}
        purpose={t('capabilities.lead')}
        primaryAction={{ label: t('capabilities.view.coverage'), href: '/capabilities?view=coverage' }}
      />

      <CapabilityStudioHero capabilities={capabilities} spiralCount={spiralCount} />

      <section className={styles.kpiGrid} aria-label={t('capabilities.hub.kpi_aria')}>
        <Link href="/capabilities#level3-capabilities" className={styles.kpiLink} aria-label={t('capabilities.hub.open_level3_aria')}>
          <KpiCard label={t('capabilities.kpi.level3')} value={capabilities.length} hint={t('capabilities.hub.level3_hint')} />
        </Link>
        <Link href="/spirals" className={styles.kpiLink} aria-label={t('capabilities.hub.open_spirals_aria')}>
          <KpiCard label={t('capabilities.kpi.spirals')} value={spiralCount} hint="FMN" />
        </Link>
        <Link href="/capabilities?view=coverage" className={styles.kpiLink} aria-label={t('capabilities.hub.open_dashboards_aria')}>
          <KpiCard label={t('capabilities.kpi.dashboards')} value={capabilities.length} hint={t('capabilities.tabs.overview')} />
        </Link>
      </section>

      <nav className={styles.tabs} aria-label={t('capabilities.hub.sections_aria')}>
        <Link href="/capabilities" className={`${styles.tab} ${styles.tabActive}`}>{t('capabilities.tabs.overview')}</Link>
        <Link href="/capabilities?view=coverage" className={styles.tabLinkButton}>{t('capabilities.view.coverage')}</Link>
        <Link href="/capabilities?view=gaps" className={styles.tabLinkButton}>{t('capabilities.view.gaps')}</Link>
        <Link href="/capabilities?view=overlaps" className={styles.tabLinkButton}>{t('capabilities.view.overlaps')}</Link>
        <Link href="/c3/capability-map-spiral7" className={styles.tabLinkButton}>{t('capabilities.hub.spiral7_map')}</Link>
      </nav>

      <section className={styles.layout}>
        <article id="level3-capabilities" className={styles.panel}>
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
  const t = useT();
  const withoutSpiral = capabilities.filter((capability) => capability.available_spirals.length === 0).length;
  const parentCounts = capabilities.reduce<Record<string, number>>((acc, capability) => {
    const parent = capability.parent?.title ?? t('capabilities.hub.unassigned_parent');
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
      title: capabilities.length ? t('capabilities.hub.task.loaded_title') : t('capabilities.hub.task.import_missing_title'),
      detail: capabilities.length ? t(countKey('capabilities.hub.task.loaded_detail', capabilities.length), { count: capabilities.length }) : t('capabilities.hub.task.import_missing_detail'),
      href: '/import/upload',
      label: t('capabilities.hub.task.import_label'),
    },
    {
      tone: withoutSpiral ? 'warning' : 'success',
      title: withoutSpiral ? t('capabilities.hub.task.without_spiral_title') : t('capabilities.hub.task.spiral_visible_title'),
      detail: withoutSpiral ? t(countKey('capabilities.hub.task.without_spiral_detail', withoutSpiral), { count: withoutSpiral }) : t(countKey('capabilities.hub.task.spirals_detail', spiralCount), { count: spiralCount }),
      href: '/c3/capability-map-spiral7',
      label: t('capabilities.hub.task.spiral7_label'),
    },
    {
      tone: topParents.length ? 'info' : 'warning',
      title: t('capabilities.hub.task.largest_parent_title'),
      detail: topParents[0] ? t(countKey('capabilities.hub.task.largest_parent_detail', topParents[0][1]), { parent: topParents[0][0], count: topParents[0][1] }) : t('capabilities.hub.task.no_parent_detail'),
      href: '/capabilities?view=coverage',
      label: t('capabilities.view.coverage'),
    },
  ];

  return (
    <section className={styles.studioHero} aria-label={t('capabilities.hub.hero_aria')}>
      <div className={styles.studioSummary}>
        <div className={styles.studioTopline}>
          <div>
            <span className={styles.eyebrow}>{t('capabilities.hub.eyebrow_map')}</span>
            <h1 className={styles.studioTitle}>{t('capabilities.hub.studio_title')}</h1>
          </div>
          <Badge variant="info">{t('capabilities.hub.level3_badge', { count: capabilities.length })}</Badge>
        </div>
        <p className={styles.studioLead}>
          {t('capabilities.hub.studio_lead')}
        </p>
        <div className={styles.studioMetricGrid}>
          <StudioMetric value={String(capabilities.length)} label={t('capabilities.title')} detail={t('capabilities.hub.metric.capabilities_detail')} tone="success" href="/capabilities#level3-capabilities" />
          <StudioMetric value={String(spiralCount)} label={t('spirals.kpi.total')} detail={t('capabilities.hub.metric.spirals_detail')} tone={spiralCount ? 'success' : 'warning'} href="/spirals" />
          <StudioMetric value={String(withoutSpiral)} label={t('capabilities.hub.metric.needs_context')} detail={t('capabilities.hub.metric.needs_context_detail')} tone={withoutSpiral ? 'warning' : 'success'} href="/c3/capability-map-spiral7" />
        </div>
      </div>

      <div className={styles.studioQueue}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.eyebrow}>{t('capabilities.hub.admin_queue')}</span>
            <h2>{t('capabilities.hub.queue_title')}</h2>
          </div>
          <Badge variant={withoutSpiral ? 'warning' : 'success'}>{withoutSpiral ? t('common.action') : t('common.clean')}</Badge>
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
            <span className={styles.eyebrow}>{t('capabilities.hub.manager_story')}</span>
            <h2>{t('capabilities.hub.story_title')}</h2>
          </div>
          <Link href="/capabilities?view=coverage" className={styles.inlineLink}>{t('capabilities.view.coverage')}</Link>
        </div>
        <div className={styles.capabilityFlow}>
          {spotlight.length ? spotlight.map((capability) => (
            <Link key={capability.uuid} href={`/capabilities/${capability.slug}`} className={styles.capabilityFlowNode}>
              <span>{capability.parent?.title ?? t('capabilities.hub.flow_parent_fallback')}</span>
              <strong>{capability.title}</strong>
              <small>{capability.available_spirals.length ? capability.available_spirals.join(', ') : t('capabilities.hub.no_spiral')}</small>
            </Link>
          )) : (
            <div className={styles.capabilityFlowNode}>
              <span>C3</span>
              <strong>{t('capabilities.hub.no_capabilities')}</strong>
              <small>{t('capabilities.hub.import_first')}</small>
            </div>
          )}
        </div>
      </div>

      <div className={styles.parentStack}>
        <span className={styles.eyebrow}>{t('capabilities.hub.largest_areas')}</span>
        {topParents.length ? topParents.map(([parent, count]) => (
          <div key={parent} className={styles.parentRow}>
            <span>{parent}</span>
            <strong>{count}</strong>
          </div>
        )) : <p className={styles.bodyText}>{t('capabilities.hub.no_parent_areas')}</p>}
      </div>
    </section>
  );
}

function StudioMetric({ value, label, detail, tone, href }: { value: string; label: string; detail: string; tone: 'success' | 'warning' | 'info'; href: string }) {
  return (
    <Link href={href} className={`${styles.studioMetric} ${styles.studioMetricLink} ${styles[`studioMetric_${tone}`]}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </Link>
  );
}
