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

  function runAnalysis() {
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
            onChange={(event) => setSelectedServiceId(event.target.value)}
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
            onChange={(event) => setDirection(event.target.value as 'downstream' | 'upstream')}
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
            onChange={(event) => setDepth(Number(event.target.value))}
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

      {impact.isLoading && <div className={styles.state}>Loading impact analysis…</div>}
      {impact.error && <div className={styles.stateError}>Impact analysis unavailable.</div>}
      {!impact.isLoading && !impact.error && !impact.data && (
        <EmptyState title="No service selected" />
      )}

      {impact.data && (
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
