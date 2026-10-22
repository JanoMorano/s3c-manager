'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { useParams, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/features/services/api/services.api';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import { useT } from '@/app/i18n/useI18n';
import { resolveCountForm } from '@/app/lib/counts';
import styles from '@/features/capabilities/capabilities.module.css';

function countKey(base: string, count: number) {
  return resolveCountForm(count, { one: `${base}.one`, few: `${base}.few`, many: `${base}.many` });
}

interface CoverageResponse {
  capability: { slug: string; title: string; page_id: string; parent?: { title?: string } };
  spiral: string;
  summary: { total_requirements: number; covered_count: number; coverage_percent: number };
  requirements: Array<{ code: string; title: string; kind: string; role: string; covered_by: string[] }>;
  services: Array<{ service_id: string; title: string; covered_count: number; coverage_percent: number }>;
  gaps: Array<{ requirement: { code: string; title: string; kind: string } }>;
  duplicate_coverage: Array<{ requirement: { code: string; title: string; kind: string }; services: string[] }>;
  consolidation_candidates: Array<{ service_a_id: string; service_b_id: string; shared_count: number; only_a: number; only_b: number; overlap_pct: number }>;
  documents: Array<{ id: string; title: string; kind: string; status: string; requirement_count: number }>;
}

export default function CapabilityDetailPage() {
  const t = useT();
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params?.slug ?? '';
  const spiral = search?.get('spiral') ?? 'Spiral_7';
  const tab = search?.get('tab') ?? 'overview';
  const { data, isLoading, error } = useSWR<CoverageResponse>(slug ? `/api/v1/capabilities/by-slug/${slug}/coverage?spiral=${encodeURIComponent(spiral)}` : null, apiFetch, { revalidateOnFocus: false });
  if (isLoading) return <div className={styles.state}>{t('capability_detail.loading')}</div>;
  if (error || !data) return <div className={styles.state}>{t('capability_detail.unavailable')}</div>;
  const tabs = ['overview', 'requirements', 'services', 'overlap', 'documents', 'gaps'];
  return (
    <main className={styles.shell}>
      <CapabilityDetailStudioHero data={data} slug={slug} spiral={spiral} />
      <section className={styles.kpiGrid}>
        <KpiCard label={t('capability_detail.coverage')} value={`${data.summary.coverage_percent}%`} hint={<ProgressBar value={data.summary.coverage_percent} tone={coverageTone(data.summary.coverage_percent)} />} />
        <KpiCard label={t('capability_detail.requirements')} value={data.summary.total_requirements} hint={t('capability_detail.covered_count', { count: data.summary.covered_count })} />
        <KpiCard label={t('capability_detail.largest_gap')} value={data.gaps.length} hint={data.gaps.length ? t('capability_detail.uncovered_requirements') : t('capability_detail.no_open_gaps')} />
      </section>
      <nav className={styles.tabs}>{tabs.map((name) => <Link key={name} href={`/capabilities/${slug}?spiral=${spiral}&tab=${name}`} className={`${styles.tab} ${tab === name ? styles.tabActive : ''}`}>{t(`capability_detail.tab.${name}`)}</Link>)}</nav>
      <section className={styles.layout}>
        <article className={styles.panel}>
          {tab === 'overview' && <Overview data={data} />}
          {tab === 'requirements' && <Requirements data={data} />}
          {tab === 'services' && <Services data={data} />}
          {tab === 'overlap' && <Overlap data={data} />}
          {tab === 'documents' && <Documents data={data} />}
          {tab === 'gaps' && <Gaps data={data} />}
        </article>
        <aside className={styles.panel}>
          <h2 className={styles.panelTitle}>{t('capability_detail.next_actions')}</h2>
          <div className={styles.actionStack}>
            <Link href={`/spirals/${spiral}?tab=fulfillment`}>{t('capability_detail.create_plan')}</Link>
            <span>{data.gaps.length ? t(countKey('capability_detail.gaps_need_evidence', data.gaps.length), { count: data.gaps.length }) : t('capability_detail.coverage_complete')}</span>
            <span>{data.consolidation_candidates.length ? t(countKey('capability_detail.overlap_need_review', data.consolidation_candidates.length), { count: data.consolidation_candidates.length }) : t('capability_detail.no_consolidation')}</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

function CapabilityDetailStudioHero({ data, slug, spiral }: { data: CoverageResponse; slug: string; spiral: string }) {
  const t = useT();
  const coverage = data.summary.coverage_percent;
  const tasks = [
    {
      tone: coverage >= 80 ? 'success' : coverage >= 50 ? 'warning' : 'danger',
      title: t('capability_detail.task.confidence_title'),
      detail: t('capability_detail.task.confidence_detail', { covered: data.summary.covered_count, total: data.summary.total_requirements, spiral: data.spiral }),
      href: `/capabilities/${slug}?spiral=${spiral}&tab=requirements`,
      label: t('capability_detail.requirements'),
    },
    {
      tone: data.gaps.length ? 'warning' : 'success',
      title: data.gaps.length ? t('capability_detail.task.gaps_title') : t('capability_detail.no_open_gaps'),
      detail: data.gaps.length ? t(countKey('capability_detail.task.gaps_detail', data.gaps.length), { count: data.gaps.length }) : t('capability_detail.task.no_gaps_detail'),
      href: `/capabilities/${slug}?spiral=${spiral}&tab=gaps`,
      label: t('capability_detail.tab.gaps'),
    },
    {
      tone: data.consolidation_candidates.length ? 'warning' : 'success',
      title: data.consolidation_candidates.length ? t('capability_detail.task.overlap_title') : t('capability_detail.task.no_overlap_title'),
      detail: data.consolidation_candidates.length ? t(countKey('capability_detail.task.overlap_detail', data.consolidation_candidates.length), { count: data.consolidation_candidates.length }) : t('capability_detail.no_consolidation'),
      href: `/capabilities/${slug}?spiral=${spiral}&tab=overlap`,
      label: t('capability_detail.tab.overlap'),
    },
  ];
  const flowNodes = [
    { label: t('capability_detail.requirements'), value: String(data.summary.total_requirements), detail: t('capability_detail.covered_count', { count: data.summary.covered_count }) },
    { label: t('capability_detail.tab.services'), value: String(data.services.length), detail: data.services[0]?.title ?? t('capability_detail.no_service_evidence') },
    { label: t('capability_detail.tab.gaps'), value: String(data.gaps.length), detail: data.gaps[0]?.requirement.code ?? t('capability_detail.no_open_gap') },
    { label: t('capability_detail.tab.documents'), value: String(data.documents.length), detail: data.documents[0]?.title ?? t('capability_detail.generated_evidence') },
  ];

  return (
    <section className={styles.studioHero} aria-label={t('capability_detail.hero_aria')}>
      <div className={styles.studioSummary}>
        <div className={styles.studioTopline}>
          <div>
            <p className={styles.lead}>{t('capability_detail.breadcrumb', { parent: data.capability.parent?.title ?? t('capability_detail.level2'), page: data.capability.page_id })}</p>
            <h1 className={styles.studioTitle}>{data.capability.title}</h1>
          </div>
          <div className={styles.pills}>{['Spiral_4', 'Spiral_5', 'Spiral_6', 'Spiral_7'].map((code) => <Link key={code} href={`/capabilities/${slug}?spiral=${code}`} className={`${styles.pill} ${code === spiral ? styles.activePill : ''}`}>{code.replace('Spiral_', 'S')}</Link>)}</div>
        </div>
        <p className={styles.studioLead}>
          {t('capability_detail.studio_lead', { spiral: data.spiral })}
        </p>
        <div className={styles.studioMetricGrid}>
          <StudioMetric value={`${coverage}%`} label={t('capability_detail.coverage')} detail={t('capability_detail.requirements_ratio', { covered: data.summary.covered_count, total: data.summary.total_requirements })} tone={coverage >= 80 ? 'success' : coverage >= 50 ? 'warning' : 'danger'} />
          <StudioMetric value={String(data.services.length)} label={t('capability_detail.tab.services')} detail={data.services[0]?.title ?? t('capability_detail.no_service_evidence')} tone={data.services.length ? 'success' : 'warning'} />
          <StudioMetric value={String(data.gaps.length)} label={t('capability_detail.tab.gaps')} detail={data.gaps[0]?.requirement.title ?? t('capability_detail.no_uncovered_requirement')} tone={data.gaps.length ? 'warning' : 'success'} />
        </div>
      </div>

      <div className={styles.studioQueue}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.eyebrow}>{t('capabilities.hub.admin_queue')}</span>
            <h2>{t('capability_detail.queue_title')}</h2>
          </div>
          <Badge variant={data.gaps.length ? 'warning' : 'success'}>{data.gaps.length ? t('common.action') : t('capability_detail.covered')}</Badge>
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
            <span className={styles.eyebrow}>{t('capability_detail.relationship_map')}</span>
            <h2>{t('capability_detail.coverage_story')}</h2>
          </div>
          <Link href={`/spirals/${spiral}?tab=fulfillment`} className={styles.inlineLink}>{t('spirals.detail.tab_fulfillment')}</Link>
        </div>
        <div className={styles.capabilityFlow}>
          {flowNodes.map((node) => (
            <div key={node.label} className={styles.capabilityFlowNode}>
              <span>{node.label}</span>
              <strong>{node.value}</strong>
              <small>{node.detail}</small>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.parentStack}>
        <span className={styles.eyebrow}>{t('capability_detail.plain_readout')}</span>
        <div className={styles.parentRow}>
          <span>{t('capability_detail.coverage')}</span>
          <strong>{coverage >= 80 ? t('capability_detail.strength.strong') : coverage >= 50 ? t('capability_detail.strength.partial') : t('capability_detail.strength.weak')}</strong>
        </div>
        <div className={styles.parentRow}>
          <span>{t('capability_detail.overlap_candidates')}</span>
          <strong>{data.consolidation_candidates.length}</strong>
        </div>
        <div className={styles.parentRow}>
          <span>{t('capability_detail.evidence_documents')}</span>
          <strong>{data.documents.length}</strong>
        </div>
      </div>
    </section>
  );
}

function StudioMetric({ value, label, detail, tone }: { value: string; label: string; detail: string; tone: 'success' | 'warning' | 'danger' }) {
  return (
    <div className={`${styles.studioMetric} ${styles[`studioMetric_${tone}`]}`}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{detail}</small>
    </div>
  );
}

function coverageTone(value: number): 'success' | 'warning' | 'danger' {
  if (value >= 80) return 'success';
  if (value >= 50) return 'warning';
  return 'danger';
}

function Overview({ data }: { data: CoverageResponse }) {
  const t = useT();
  const topServices = data.services.slice(0, 3);
  const topCandidate = data.consolidation_candidates[0];
  return (
    <div className={styles.overviewGrid}>
      <section className={styles.coverageHero}>
        <DonutCoverage value={data.summary.coverage_percent} />
        <div>
          <h2 className={styles.panelTitle}>{t('capability_detail.decision_view')}</h2>
          <p className={styles.bodyText}>
            {t('capability_detail.overview.covered_summary', { covered: data.summary.covered_count, total: data.summary.total_requirements, spiral: data.spiral })}
          </p>
          <p className={styles.bodyText}>
            {data.gaps.length ? t(countKey('capability_detail.overview.gaps_need_evidence', data.gaps.length), { count: data.gaps.length }) : t('capability_detail.overview.no_gaps')}
          </p>
        </div>
      </section>
      <section>
        <h3 className={styles.sectionTitle}>{t('capability_detail.top_services')}</h3>
        {topServices.length ? topServices.map((service) => (
          <ServiceBar key={service.service_id} service={service} />
        )) : <EmptyState title={t('capability_detail.no_service_evidence_yet')} description={t('capability_detail.no_service_evidence_hint')} />}
      </section>
      <section className={styles.callout}>
        <span className={styles.calloutEyebrow}>{t('capability_detail.consolidation_opportunity')}</span>
        {topCandidate ? (
          <>
            <strong>{t(countKey('capability_detail.overview.pair_overlap', topCandidate.shared_count), { a: topCandidate.service_a_id, b: topCandidate.service_b_id, count: topCandidate.shared_count })}</strong>
            <span>{t(countKey('capability_detail.overview.retire_review', Math.min(topCandidate.only_a, topCandidate.only_b)), { count: Math.min(topCandidate.only_a, topCandidate.only_b) })}</span>
          </>
        ) : (
          <>
            <strong>{t('capability_detail.no_material_overlap')}</strong>
            <span>{t('capability_detail.overview.no_overlap_hint')}</span>
          </>
        )}
      </section>
      <Gaps data={data} compact />
    </div>
  );
}

function DonutCoverage({ value }: { value: number }) {
  const t = useT();
  const normalized = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (normalized / 100) * circumference;
  return (
    <figure className={styles.donutCard} aria-label={t('capability_detail.donut_aria', { percent: normalized })}>
      <svg className={styles.donut} viewBox="0 0 100 100" role="img" aria-hidden="true">
        <circle className={styles.donutTrack} cx="50" cy="50" r="42" />
        <circle className={`${styles.donutValue} ${styles[coverageTone(normalized)]}`} cx="50" cy="50" r="42" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
      </svg>
      <figcaption>
        <strong>{normalized}%</strong>
        <span>{t('capability_detail.donut_label')}</span>
      </figcaption>
    </figure>
  );
}

function ServiceBar({ service }: { service: CoverageResponse['services'][number] }) {
  const t = useT();
  return (
    <div className={styles.serviceBar}>
      <div className={styles.serviceBarHeader}>
        <Link href={`/services/${service.service_id}`}>{service.title}</Link>
        <span>{service.coverage_percent}%</span>
      </div>
      <ProgressBar value={service.coverage_percent} tone={coverageTone(service.coverage_percent)} />
      <small>{t(countKey('capability_detail.covered_requirements', service.covered_count), { count: service.covered_count })}</small>
    </div>
  );
}

function Requirements({ data }: { data: CoverageResponse }) {
  const t = useT();
  return (
    <table className={styles.table}>
      <thead><tr><th>{t('capability_detail.col.code')}</th><th>{t('capability_detail.col.requirement')}</th><th>{t('capability_detail.col.role')}</th><th>{t('common.status')}</th></tr></thead>
      <tbody>
        {data.requirements.map((requirement) => (
          <tr key={`${requirement.kind}-${requirement.code}`}>
            <td>{requirement.code}</td>
            <td>{requirement.title}</td>
            <td>{requirement.role}</td>
            <td><Badge variant={requirement.covered_by.length ? 'success' : 'warning'}>{requirement.covered_by.length ? t('capability_detail.status.covered') : t('capability_detail.status.gap')}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Services({ data }: { data: CoverageResponse }) {
  const t = useT();
  if (!data.services.length) return <EmptyState title={t('capability_detail.no_services')} />;
  return (
    <div className={styles.serviceCoverageList}>
      {data.services.map((service) => <ServiceBar key={service.service_id} service={service} />)}
    </div>
  );
}

function Overlap({ data }: { data: CoverageResponse }) {
  const t = useT();
  if (!data.consolidation_candidates.length) return <EmptyState title={t('capability_detail.no_material_overlap')} />;
  return (
    <div className={styles.overlapStack}>
      <table className={styles.table}>
        <thead><tr><th>{t('capability_detail.col.pair')}</th><th>{t('capability_detail.tab.overlap')}</th><th>{t('capability_detail.col.unique_a')}</th><th>{t('capability_detail.col.unique_b')}</th><th>{t('capability_detail.col.signal')}</th></tr></thead>
        <tbody>
          {data.consolidation_candidates.map((pair) => (
            <tr key={`${pair.service_a_id}-${pair.service_b_id}`}>
              <td>{pair.service_a_id} ↔ {pair.service_b_id}</td>
              <td>{t('capability_detail.shared_overlap', { count: pair.shared_count, percent: pair.overlap_pct })}</td>
              <td>{pair.only_a}</td>
              <td>{pair.only_b}</td>
              <td><OverlapDots pair={pair} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h3 className={styles.sectionTitle}>{t('capability_detail.duplicate_evidence')}</h3>
        {data.duplicate_coverage.length ? (
          <div className={styles.dotMatrix}>
            {data.duplicate_coverage.slice(0, 12).map((item) => (
              <div key={`${item.requirement.kind}-${item.requirement.code}`} className={styles.matrixRow}>
                <span>{item.requirement.code}</span>
                <strong>{item.requirement.title}</strong>
                <em>{item.services.join(', ')}</em>
              </div>
            ))}
          </div>
        ) : <EmptyState title={t('capability_detail.no_duplicate_coverage')} />}
      </section>
    </div>
  );
}

function OverlapDots({ pair }: { pair: CoverageResponse['consolidation_candidates'][number] }) {
  const dots = Array.from({ length: 5 }, (_, index) => index < Math.ceil(pair.overlap_pct / 20));
  return <span className={styles.overlapDots}>{dots.map((active, index) => <span key={index} className={active ? styles.dotActive : styles.dotMuted} />)}</span>;
}

function Documents({ data }: { data: CoverageResponse }) {
  const t = useT();
  if (!data.documents?.length) {
    return <EmptyState title={t('capability_detail.no_documents')} description={t('capability_detail.no_documents_hint')} />;
  }
  return (
    <section>
      <h3 className={styles.sectionTitle}>{t('capability_detail.documents_title')}</h3>
      <p className={styles.bodyText}>
        {t('capability_detail.documents_lead')}
      </p>
      <table className={styles.table}>
        <thead><tr><th>{t('capability_detail.col.source')}</th><th>{t('capability_detail.col.type')}</th><th>{t('common.status')}</th><th>{t('capability_detail.requirements')}</th></tr></thead>
        <tbody>
          {data.documents.map((document) => (
            <tr key={document.id}>
              <td>{document.title}</td>
              <td>{document.kind.replace(/_/g, ' ')}</td>
              <td><Badge variant={document.status === 'traceable' ? 'success' : 'warning'}>{document.status.replace(/_/g, ' ')}</Badge></td>
              <td>{document.requirement_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Gaps({ data, compact = false }: { data: CoverageResponse; compact?: boolean }) {
  const t = useT();
  if (!data.gaps.length) return <EmptyState title={t('capability_detail.no_uncovered_requirements')} />;
  const rows = compact ? data.gaps.slice(0, 5) : data.gaps;
  return (
    <section>
      <h3 className={styles.sectionTitle}>{compact ? t('capability_detail.top_gaps') : t('capability_detail.uncovered_requirements')}</h3>
      <table className={styles.table}>
        <tbody>
          {rows.map((gap) => (
            <tr key={`${gap.requirement.kind}-${gap.requirement.code}`}>
              <td>{gap.requirement.code}</td>
              <td>{gap.requirement.title}</td>
              <td>{gap.requirement.kind}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
