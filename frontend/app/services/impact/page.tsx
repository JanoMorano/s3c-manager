'use client';

import { useMemo, useState } from 'react';
import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useServiceImpact, useServices } from '@/features/services/hooks/useServices';
import type { ImpactNode } from '@/features/services/model/service.types';
import styles from '../decision-graphs.module.css';

const IMPACT_INCLUDE = ['services', 'c3', 'applications', 'data_objects', 'tins', 'c3_services'];

function kindLabel(kind: string) {
  switch (kind) {
    case 'service': return 'Service';
    case 'c3_capability': return 'Capability';
    case 'c3_application': return 'Application';
    case 'c3_data_object': return 'Data object';
    case 'c3_tin': return 'TIN';
    case 'c3_service': return 'C3 service';
    default: return kind;
  }
}

function groupNodes(nodes: ImpactNode[]) {
  return {
    services: nodes.filter((node) => node.node_kind === 'service'),
    capabilities: nodes.filter((node) => node.node_kind === 'c3_capability'),
    entities: nodes.filter((node) => !['service', 'c3_capability'].includes(node.node_kind)),
  };
}

export default function ImpactAnalysisPage() {
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [direction, setDirection] = useState<'downstream' | 'upstream'>('downstream');
  const [depth, setDepth] = useState(3);
  const [hasRun, setHasRun] = useState(false);
  const { data: servicesData, isLoading: servicesLoading } = useServices({ limit: 100 });
  const serviceOptions = servicesData?.items ?? [];
  const effectiveServiceId = selectedServiceId || serviceOptions[0]?.service_id || '';
  const impact = useServiceImpact({
    serviceId: effectiveServiceId,
    direction,
    depth,
    include: IMPACT_INCLUDE,
    enabled: Boolean(effectiveServiceId),
  });
  const grouped = useMemo(() => groupNodes(impact.data?.nodes ?? []), [impact.data?.nodes]);
  const impactedNodes = Math.max(0, (impact.data?.nodes.length ?? 0) - 1);
  const selectedService = serviceOptions.find((service) => service.service_id === effectiveServiceId);
  const shouldShowOutput = hasRun || Boolean(impact.data);

  function runAnalysis() {
    setHasRun(true);
    void impact.mutate();
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Service graph · impact engine</span>
          <h1 className={styles.title}>Impact Analysis</h1>
          <p className={styles.lead}>
            Trace upstream dependencies and downstream consumers across services, C3 capabilities, applications, data objects and implementation evidence.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.ghostButton} href="/services/dependency-flow">Dependency flow</Link>
          <Link className={styles.linkButton} href="/services/graph">Graph canvas</Link>
        </div>
      </header>

      <section className={styles.impactControls} aria-label="Impact analysis controls">
        <label>
          <span>Root service</span>
          <select
            aria-label="Root service"
            value={effectiveServiceId}
            onChange={(event) => {
              setSelectedServiceId(event.target.value);
              setHasRun(false);
            }}
            disabled={servicesLoading || serviceOptions.length === 0}
          >
            {serviceOptions.map((service) => (
              <option key={service.service_id} value={service.service_id}>
                {service.service_id} · {service.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Direction</span>
          <select
            aria-label="Direction"
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value as 'downstream' | 'upstream');
              setHasRun(false);
            }}
          >
            <option value="downstream">Downstream</option>
            <option value="upstream">Upstream</option>
          </select>
        </label>
        <label>
          <span>Depth</span>
          <select
            aria-label="Depth"
            value={depth}
            onChange={(event) => {
              setDepth(Number(event.target.value));
              setHasRun(false);
            }}
          >
            {[1, 2, 3, 4, 5].map((value) => (
              <option key={value} value={value}>{value}</option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.linkButton} onClick={runAnalysis} disabled={!effectiveServiceId}>
          Run analysis
        </button>
      </section>

      {!shouldShowOutput && (
        <section className={styles.panel}>
          <h2 className={styles.panelTitle}>Analysis output</h2>
          <p className={styles.outputLead}>Vyber root službu a spusť analýzu. Výstup se zobrazí jako grafický dopad a textový rozhodovací seznam.</p>
        </section>
      )}

      {shouldShowOutput && impact.isLoading && <div className={styles.state}>Loading impact analysis…</div>}
      {impact.error && <div className={styles.stateError}>Impact analysis unavailable.</div>}
      {shouldShowOutput && !impact.isLoading && !impact.error && !impact.data && (
        <EmptyState title="No service selected" />
      )}

      {shouldShowOutput && impact.data && (
        <>
          <section className={styles.kpiGrid}>
            <KpiCard label="Impacted nodes" value={impactedNodes} hint={`${impact.data.direction} · depth ${impact.data.depth_reached}`} />
            <KpiCard label="Edges" value={impact.data.edges.length} hint="Traversed relationships" />
            <KpiCard label="Paths" value={impact.data.paths.length} hint="Export-friendly impact paths" />
          </section>

          <section className={styles.impactLayout}>
            <ImpactColumn title="Services" nodes={grouped.services} />
            <ImpactColumn title="Capabilities" nodes={grouped.capabilities} />
            <ImpactColumn title="C3 evidence" nodes={grouped.entities} />
          </section>

          <section className={styles.impactDual}>
            <article className={styles.impactGraphPanel}>
              <div>
                <h2 className={styles.panelTitle}>Impact graph</h2>
                <p className={styles.outputLead}>{selectedService?.title ?? effectiveServiceId} jako root a první vrstvy dopadu.</p>
              </div>
              <ImpactMiniGraph rootTitle={selectedService?.title ?? effectiveServiceId} nodes={impact.data.nodes.slice(1, 7)} />
            </article>

            <article className={styles.impactTextPanel}>
              <h2 className={styles.panelTitle}>Management impact summary</h2>
              <div className={styles.impactList}>
                <ImpactSummaryItem title="Direct impact" value={`${grouped.services.length} services, ${grouped.capabilities.length} capabilities`} />
                <ImpactSummaryItem title={`Downstream depth ${impact.data.depth_reached}`} value={`${impact.data.edges.length} traversed relationships`} />
                <ImpactSummaryItem title="Affected capabilities / C3" value={`${grouped.capabilities.length + grouped.entities.length} architecture objects`} />
                <ImpactSummaryItem title="Services needing review" value={`${Math.max(0, grouped.services.length - 1)} service owner checks`} />
                <ImpactSummaryItem title="Recommended actions" value="Open service detail, review dependencies, record decision if risk is accepted." />
              </div>
            </article>
          </section>

          <section className={styles.panel}>
            <h2 className={styles.panelTitle}>Impact paths</h2>
            {impact.data.paths.length ? (
              <div className={styles.pathList}>
                {impact.data.paths.map((path) => (
                  <article key={`${path.node_id}:${path.path.join('/')}`} className={styles.pathItem}>
                    <strong>{path.path.join(' -> ')}</strong>
                    <span>{path.relation_path.join(' -> ') || 'direct'}</span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="No impacted paths" />
            )}
          </section>
        </>
      )}
    </main>
  );
}

function ImpactMiniGraph({ rootTitle, nodes }: { rootTitle: string; nodes: ImpactNode[] }) {
  const visibleNodes = nodes.length ? nodes : [
    { node_id: 'placeholder-review', node_kind: 'service', node_key: null, title: 'No downstream dependency found', depth: 1 },
  ];
  return (
    <svg className={styles.impactGraphSvg} viewBox="0 0 680 260" role="img" aria-label="Impact graph preview">
      <rect x="24" y="96" width="180" height="68" rx="8" className={styles.graphRoot} />
      <text x="42" y="124" className={styles.graphNodeLabel}>Root service</text>
      <text x="42" y="148" className={styles.graphNodeTitle}>{shortGraphTitle(rootTitle, 18)}</text>
      {visibleNodes.slice(0, 6).map((node, index) => {
        const x = 300 + (index % 2) * 190;
        const y = 18 + Math.floor(index / 2) * 80;
        return (
          <g key={node.node_id}>
            <path d={`M204 130 C248 130 250 ${y + 34} ${x} ${y + 34}`} className={styles.graphEdge} />
            <rect x={x} y={y} width="154" height="58" rx="8" className={styles.graphNode} />
            <text x={x + 14} y={y + 23} className={styles.graphNodeLabel}>{kindLabel(node.node_kind)}</text>
            <text x={x + 14} y={y + 44} className={styles.graphNodeTitle}>{shortGraphTitle(node.title, 10)}</text>
          </g>
        );
      })}
    </svg>
  );
}

function shortGraphTitle(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function ImpactSummaryItem({ title, value }: { title: string; value: string }) {
  return (
    <div className={styles.impactSummaryItem}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ImpactColumn({ title, nodes }: { title: string; nodes: ImpactNode[] }) {
  return (
    <section className={styles.panel}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {nodes.length ? (
        <div className={styles.impactNodeList}>
          {nodes.map((node) => <ImpactNodeCard key={node.node_id} node={node} />)}
        </div>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()}`} />
      )}
    </section>
  );
}

function ImpactNodeCard({ node }: { node: ImpactNode }) {
  const body = (
    <>
      <span className={styles.impactNodeMeta}>
        <Badge variant={node.depth === 0 ? 'success' : 'info'}>{node.depth === 0 ? 'Root' : `Depth ${node.depth}`}</Badge>
        <Badge variant="neutral">{kindLabel(node.node_kind)}</Badge>
      </span>
      <strong>{node.title}</strong>
      <span>{node.node_key ?? node.node_id}</span>
    </>
  );

  return node.url
    ? <Link className={styles.impactNode} href={node.url}>{body}</Link>
    : <article className={styles.impactNode}>{body}</article>;
}
