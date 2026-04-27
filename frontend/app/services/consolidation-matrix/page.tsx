'use client';

import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useGraphOverview } from '@/features/services/hooks/useServices';
import type { GraphOverviewEdge, GraphOverviewNode } from '@/features/services/model/service.types';
import styles from '../decision-graphs.module.css';

type ServiceNode = GraphOverviewNode & { node_kind: 'service' };

interface Candidate {
  a: ServiceNode;
  b: ServiceNode;
  shared: number;
  aOnly: number;
  bOnly: number;
  overlapPct: number;
  relationCount: number;
}

function isService(node: GraphOverviewNode): node is ServiceNode {
  return node.node_kind === 'service';
}

function serviceCode(node: ServiceNode) {
  return node.service_id ?? node.code ?? node.id.replace(/^svc:/, '');
}

function buildMappingSets(services: ServiceNode[], edges: GraphOverviewEdge[]) {
  const map = new Map<string, Set<string>>();
  services.forEach((service) => map.set(service.id, new Set()));
  edges
    .filter((edge) => edge.edge_kind === 'service_c3_mapping')
    .forEach((edge) => map.get(edge.source)?.add(edge.target));
  return map;
}

function relationCountBetween(edges: GraphOverviewEdge[], left: string, right: string) {
  return edges.filter((edge) => (
    edge.edge_kind === 'service_relation' &&
    ((edge.source === left && edge.target === right) || (edge.source === right && edge.target === left))
  )).length;
}

function scorePair(a: ServiceNode, b: ServiceNode, mappings: Map<string, Set<string>>, edges: GraphOverviewEdge[]): Candidate {
  const aSet = mappings.get(a.id) ?? new Set<string>();
  const bSet = mappings.get(b.id) ?? new Set<string>();
  const shared = [...aSet].filter((item) => bSet.has(item)).length;
  const uniqueTotal = new Set([...aSet, ...bSet]).size;
  return {
    a,
    b,
    shared,
    aOnly: [...aSet].filter((item) => !bSet.has(item)).length,
    bOnly: [...bSet].filter((item) => !aSet.has(item)).length,
    overlapPct: uniqueTotal ? Math.round((shared / uniqueTotal) * 100) : 0,
    relationCount: relationCountBetween(edges, a.id, b.id),
  };
}

function signalClass(value: number) {
  if (value >= 50) return styles.signalHigh;
  if (value >= 25) return styles.signalMedium;
  return value > 0 ? styles.signalLow : '';
}

export default function ConsolidationMatrixPage() {
  const { data, isLoading, error } = useGraphOverview({ includeC3: true });

  if (isLoading) return <div className={styles.state}>Loading consolidation matrix…</div>;
  if (error || !data) return <div className={styles.stateError}>Consolidation matrix unavailable.</div>;

  const services = data.nodes.filter(isService).slice(0, 10);
  const mappings = buildMappingSets(services, data.edges);
  const candidates: Candidate[] = [];
  services.forEach((service, index) => {
    services.slice(index + 1).forEach((other) => {
      candidates.push(scorePair(service, other, mappings, data.edges));
    });
  });
  const ranked = candidates
    .filter((candidate) => candidate.shared > 0 || candidate.relationCount > 0)
    .sort((left, right) => right.overlapPct - left.overlapPct || right.shared - left.shared || right.relationCount - left.relationCount)
    .slice(0, 5);

  const mappedServices = services.filter((service) => (mappings.get(service.id)?.size ?? 0) > 0).length;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Service graph · consolidation</span>
          <h1 className={styles.title}>Consolidation matrix</h1>
          <p className={styles.lead}>
            Requirement-overlap matrix that proposes where service owners should review duplicated capability coverage before running two applications or services.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.ghostButton} href="/services/dependency-flow">Dependency flow</Link>
          <Link className={styles.linkButton} href="/operations">Open governance cockpit</Link>
        </div>
      </header>

      <section className={styles.kpiGrid}>
        <KpiCard label="Services compared" value={services.length} hint="Top graph-visible services" />
        <KpiCard label="Mapped services" value={mappedServices} hint="Services with C3 requirement evidence" />
        <KpiCard label="Review candidates" value={ranked.length} hint="Overlap or direct dependency signal" />
      </section>

      <section className={styles.matrixLayout}>
        <article className={styles.panel}>
          <h2 className={styles.panelTitle}>Service overlap matrix</h2>
          {services.length < 2 ? (
            <EmptyState title="Not enough services to compare" />
          ) : (
            <>
              <div className={styles.matrix}>
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      {services.map((service) => <th key={service.id}>{serviceCode(service)}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((row) => (
                      <tr key={row.id}>
                        <td>{serviceCode(row)}</td>
                        {services.map((col) => {
                          if (row.id === col.id) return <td key={col.id}>—</td>;
                          const pair = scorePair(row, col, mappings, data.edges);
                          return (
                            <td key={col.id}>
                              <span className={`${styles.signal} ${signalClass(pair.overlapPct)}`}>
                                {pair.overlapPct || pair.relationCount ? `${pair.overlapPct}%` : '0'}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={styles.legend}>
                <span><Badge variant="danger">High</Badge> ≥50% overlap</span>
                <span><Badge variant="warning">Medium</Badge> ≥25% overlap</span>
                <span><Badge variant="success">Low</Badge> evidence link</span>
              </div>
            </>
          )}
        </article>

        <aside className={styles.panel}>
          <h2 className={styles.panelTitle}>What to connect / review</h2>
          {ranked.length ? (
            <div className={styles.candidateList}>
              {ranked.map((candidate) => (
                <article key={`${candidate.a.id}-${candidate.b.id}`} className={styles.candidate}>
                  <strong>{serviceCode(candidate.a)} ↔ {serviceCode(candidate.b)}</strong>
                  <span>{candidate.shared} shared C3 requirement(s), {candidate.aOnly} unique to A, {candidate.bOnly} unique to B.</span>
                  <span>{candidate.relationCount ? `${candidate.relationCount} direct graph relation(s) already exist.` : 'No direct service relation; review whether this should be linked.'}</span>
                  <Badge variant={candidate.overlapPct >= 50 ? 'danger' : candidate.overlapPct >= 25 ? 'warning' : 'success'}>{candidate.overlapPct}% overlap</Badge>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No consolidation evidence yet" description="Add C3 mappings or service relations to produce overlap candidates." />
          )}
        </aside>
      </section>
    </main>
  );
}
