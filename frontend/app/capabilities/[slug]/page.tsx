'use client';

import useSWR from 'swr';
import Link from '@/app/components/AppLink';
import { useParams, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/features/services/api/services.api';
import { Badge, EmptyState, KpiCard, ProgressBar } from '@/design-system/controls';
import styles from '@/features/capabilities/capabilities.module.css';

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
  const params = useParams<{ slug: string }>();
  const search = useSearchParams();
  const slug = params?.slug ?? '';
  const spiral = search?.get('spiral') ?? 'Spiral_7';
  const tab = search?.get('tab') ?? 'overview';
  const { data, isLoading, error } = useSWR<CoverageResponse>(slug ? `/api/v1/capabilities/by-slug/${slug}/coverage?spiral=${encodeURIComponent(spiral)}` : null, apiFetch, { revalidateOnFocus: false });
  if (isLoading) return <div className={styles.state}>Loading capability…</div>;
  if (error || !data) return <div className={styles.state}>Capability unavailable.</div>;
  const tabs = ['overview', 'requirements', 'services', 'overlap', 'documents', 'gaps'];
  return (
    <main className={styles.shell}>
      <CapabilityDetailStudioHero data={data} slug={slug} spiral={spiral} />
      <section className={styles.kpiGrid}>
        <KpiCard label="Coverage" value={`${data.summary.coverage_percent}%`} hint={<ProgressBar value={data.summary.coverage_percent} tone={coverageTone(data.summary.coverage_percent)} />} />
        <KpiCard label="Requirements" value={data.summary.total_requirements} hint={`${data.summary.covered_count} covered`} />
        <KpiCard label="Largest gap" value={data.gaps.length} hint={data.gaps.length ? 'Uncovered requirements' : 'No open gaps'} />
      </section>
      <nav className={styles.tabs}>{tabs.map((name) => <Link key={name} href={`/capabilities/${slug}?spiral=${spiral}&tab=${name}`} className={`${styles.tab} ${tab === name ? styles.tabActive : ''}`}>{name}</Link>)}</nav>
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
          <h2 className={styles.panelTitle}>Next actions</h2>
          <div className={styles.actionStack}>
            <Link href={`/spirals/${spiral}?tab=fulfillment`}>Create fulfillment plan</Link>
            <span>{data.gaps.length ? `${data.gaps.length} requirements still need service evidence.` : 'Coverage is complete for this spiral.'}</span>
            <span>{data.consolidation_candidates.length ? `${data.consolidation_candidates.length} overlap candidates need owner review.` : 'No consolidation candidates detected.'}</span>
          </div>
        </aside>
      </section>
    </main>
  );
}

function CapabilityDetailStudioHero({ data, slug, spiral }: { data: CoverageResponse; slug: string; spiral: string }) {
  const coverage = data.summary.coverage_percent;
  const tasks = [
    {
      tone: coverage >= 80 ? 'success' : coverage >= 50 ? 'warning' : 'danger',
      title: 'Coverage confidence',
      detail: `${data.summary.covered_count} of ${data.summary.total_requirements} requirements are backed by evidence for ${data.spiral}.`,
      href: `/capabilities/${slug}?spiral=${spiral}&tab=requirements`,
      label: 'Requirements',
    },
    {
      tone: data.gaps.length ? 'warning' : 'success',
      title: data.gaps.length ? 'Gaps need service evidence' : 'No open gaps',
      detail: data.gaps.length ? `${data.gaps.length} uncovered requirements remain.` : 'Managers can treat this spiral as covered by current mappings.',
      href: `/capabilities/${slug}?spiral=${spiral}&tab=gaps`,
      label: 'Gaps',
    },
    {
      tone: data.consolidation_candidates.length ? 'warning' : 'success',
      title: data.consolidation_candidates.length ? 'Overlap needs owner review' : 'No material overlap',
      detail: data.consolidation_candidates.length ? `${data.consolidation_candidates.length} service pairs may duplicate coverage.` : 'No consolidation candidates are detected.',
      href: `/capabilities/${slug}?spiral=${spiral}&tab=overlap`,
      label: 'Overlap',
    },
  ];
  const flowNodes = [
    { label: 'Requirements', value: String(data.summary.total_requirements), detail: `${data.summary.covered_count} covered` },
    { label: 'Services', value: String(data.services.length), detail: data.services[0]?.title ?? 'No service evidence' },
    { label: 'Gaps', value: String(data.gaps.length), detail: data.gaps[0]?.requirement.code ?? 'No open gap' },
    { label: 'Documents', value: String(data.documents.length), detail: data.documents[0]?.title ?? 'Generated evidence' },
  ];

  return (
    <section className={styles.studioHero} aria-label="Capability relationship detail">
      <div className={styles.studioSummary}>
        <div className={styles.studioTopline}>
          <div>
            <p className={styles.lead}>Capabilities / {data.capability.parent?.title ?? 'Level 2'} / {data.capability.page_id}</p>
            <h1 className={styles.studioTitle}>{data.capability.title}</h1>
          </div>
          <div className={styles.pills}>{['Spiral_4', 'Spiral_5', 'Spiral_6', 'Spiral_7'].map((code) => <Link key={code} href={`/capabilities/${slug}?spiral=${code}`} className={`${styles.pill} ${code === spiral ? styles.activePill : ''}`}>{code.replace('Spiral_', 'S')}</Link>)}</div>
        </div>
        <p className={styles.studioLead}>
          Manager view for {data.spiral}: see whether the capability is covered,
          which services prove it, and what an admin must fix before the story is defensible.
        </p>
        <div className={styles.studioMetricGrid}>
          <StudioMetric value={`${coverage}%`} label="Coverage" detail={`${data.summary.covered_count}/${data.summary.total_requirements} requirements`} tone={coverage >= 80 ? 'success' : coverage >= 50 ? 'warning' : 'danger'} />
          <StudioMetric value={String(data.services.length)} label="Services" detail={data.services[0]?.title ?? 'No service evidence'} tone={data.services.length ? 'success' : 'warning'} />
          <StudioMetric value={String(data.gaps.length)} label="Gaps" detail={data.gaps[0]?.requirement.title ?? 'No uncovered requirement'} tone={data.gaps.length ? 'warning' : 'success'} />
        </div>
      </div>

      <div className={styles.studioQueue}>
        <div className={styles.studioPanelHeader}>
          <div>
            <span className={styles.eyebrow}>Admin queue</span>
            <h2>Make this capability explainable</h2>
          </div>
          <Badge variant={data.gaps.length ? 'warning' : 'success'}>{data.gaps.length ? 'Action' : 'Covered'}</Badge>
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
            <span className={styles.eyebrow}>Relationship map</span>
            <h2>Coverage story</h2>
          </div>
          <Link href={`/spirals/${spiral}?tab=fulfillment`} className={styles.inlineLink}>Fulfillment plan</Link>
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
        <span className={styles.eyebrow}>Plain readout</span>
        <div className={styles.parentRow}>
          <span>Coverage</span>
          <strong>{coverage >= 80 ? 'Strong' : coverage >= 50 ? 'Partial' : 'Weak'}</strong>
        </div>
        <div className={styles.parentRow}>
          <span>Overlap candidates</span>
          <strong>{data.consolidation_candidates.length}</strong>
        </div>
        <div className={styles.parentRow}>
          <span>Evidence documents</span>
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
  const topServices = data.services.slice(0, 3);
  const topCandidate = data.consolidation_candidates[0];
  return (
    <div className={styles.overviewGrid}>
      <section className={styles.coverageHero}>
        <DonutCoverage value={data.summary.coverage_percent} />
        <div>
          <h2 className={styles.panelTitle}>Decision view</h2>
          <p className={styles.bodyText}>
            {data.summary.covered_count} of {data.summary.total_requirements} requirements are currently covered for {data.spiral}.
          </p>
          <p className={styles.bodyText}>
            {data.gaps.length ? `${data.gaps.length} gaps still need fulfillment evidence.` : 'No uncovered requirements remain for this capability.'}
          </p>
        </div>
      </section>
      <section>
        <h3 className={styles.sectionTitle}>Top contributing services</h3>
        {topServices.length ? topServices.map((service) => (
          <ServiceBar key={service.service_id} service={service} />
        )) : <EmptyState title="No service evidence yet" description="Map services to this C3 capability or its requirements to unlock contribution analysis." />}
      </section>
      <section className={styles.callout}>
        <span className={styles.calloutEyebrow}>Consolidation opportunity</span>
        {topCandidate ? (
          <>
            <strong>{topCandidate.service_a_id} and {topCandidate.service_b_id} overlap on {topCandidate.shared_count} requirements.</strong>
            <span>Retiring either service would need review of {Math.min(topCandidate.only_a, topCandidate.only_b)} unique requirement(s). Cost saving requires service cost data.</span>
          </>
        ) : (
          <>
            <strong>No material overlap detected.</strong>
            <span>Once multiple services cover the same requirements, this panel highlights rationalization candidates for owner review.</span>
          </>
        )}
      </section>
      <Gaps data={data} compact />
    </div>
  );
}

function DonutCoverage({ value }: { value: number }) {
  const normalized = Math.min(100, Math.max(0, value));
  const circumference = 2 * Math.PI * 42;
  const dashOffset = circumference - (normalized / 100) * circumference;
  return (
    <figure className={styles.donutCard} aria-label={`Coverage ${normalized}%`}>
      <svg className={styles.donut} viewBox="0 0 100 100" role="img" aria-hidden="true">
        <circle className={styles.donutTrack} cx="50" cy="50" r="42" />
        <circle className={`${styles.donutValue} ${styles[coverageTone(normalized)]}`} cx="50" cy="50" r="42" strokeDasharray={circumference} strokeDashoffset={dashOffset} />
      </svg>
      <figcaption>
        <strong>{normalized}%</strong>
        <span>coverage</span>
      </figcaption>
    </figure>
  );
}

function ServiceBar({ service }: { service: CoverageResponse['services'][number] }) {
  return (
    <div className={styles.serviceBar}>
      <div className={styles.serviceBarHeader}>
        <Link href={`/services/${service.service_id}`}>{service.title}</Link>
        <span>{service.coverage_percent}%</span>
      </div>
      <ProgressBar value={service.coverage_percent} tone={coverageTone(service.coverage_percent)} />
      <small>{service.covered_count} covered requirements</small>
    </div>
  );
}

function Requirements({ data }: { data: CoverageResponse }) {
  return (
    <table className={styles.table}>
      <thead><tr><th>Code</th><th>Requirement</th><th>Role</th><th>Status</th></tr></thead>
      <tbody>
        {data.requirements.map((requirement) => (
          <tr key={`${requirement.kind}-${requirement.code}`}>
            <td>{requirement.code}</td>
            <td>{requirement.title}</td>
            <td>{requirement.role}</td>
            <td><Badge variant={requirement.covered_by.length ? 'success' : 'warning'}>{requirement.covered_by.length ? 'covered' : 'gap'}</Badge></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Services({ data }: { data: CoverageResponse }) {
  if (!data.services.length) return <EmptyState title="No services cover this capability yet" />;
  return (
    <div className={styles.serviceCoverageList}>
      {data.services.map((service) => <ServiceBar key={service.service_id} service={service} />)}
    </div>
  );
}

function Overlap({ data }: { data: CoverageResponse }) {
  if (!data.consolidation_candidates.length) return <EmptyState title="No material overlap detected" />;
  return (
    <div className={styles.overlapStack}>
      <table className={styles.table}>
        <thead><tr><th>Pair</th><th>Overlap</th><th>Unique to A</th><th>Unique to B</th><th>Signal</th></tr></thead>
        <tbody>
          {data.consolidation_candidates.map((pair) => (
            <tr key={`${pair.service_a_id}-${pair.service_b_id}`}>
              <td>{pair.service_a_id} ↔ {pair.service_b_id}</td>
              <td>{pair.shared_count} shared · {pair.overlap_pct}%</td>
              <td>{pair.only_a}</td>
              <td>{pair.only_b}</td>
              <td><OverlapDots pair={pair} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <section>
        <h3 className={styles.sectionTitle}>Duplicate coverage evidence</h3>
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
        ) : <EmptyState title="No duplicate requirement coverage" />}
      </section>
    </div>
  );
}

function OverlapDots({ pair }: { pair: CoverageResponse['consolidation_candidates'][number] }) {
  const dots = Array.from({ length: 5 }, (_, index) => index < Math.ceil(pair.overlap_pct / 20));
  return <span className={styles.overlapDots}>{dots.map((active, index) => <span key={index} className={active ? styles.dotActive : styles.dotMuted} />)}</span>;
}

function Documents({ data }: { data: CoverageResponse }) {
  if (!data.documents?.length) {
    return <EmptyState title="No evidence documents linked" description="Coverage still remains traceable through requirement identifiers and service mappings." />;
  }
  return (
    <section>
      <h3 className={styles.sectionTitle}>Evidence documents and sources</h3>
      <p className={styles.bodyText}>
        These records are generated by the generic coverage engine from imported C3 taxonomy, spiral membership, and service mappings. They intentionally do not contain developer-local PDF paths.
      </p>
      <table className={styles.table}>
        <thead><tr><th>Source</th><th>Type</th><th>Status</th><th>Requirements</th></tr></thead>
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
  if (!data.gaps.length) return <EmptyState title="No uncovered requirements" />;
  const rows = compact ? data.gaps.slice(0, 5) : data.gaps;
  return (
    <section>
      <h3 className={styles.sectionTitle}>{compact ? 'Top gaps' : 'Uncovered requirements'}</h3>
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
