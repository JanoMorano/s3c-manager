'use client';

import Link from '@/app/components/AppLink';
import { Badge, EmptyState, KpiCard } from '@/design-system/controls';
import { useGraphOverview } from '@/features/services/hooks/useServices';
import type { GraphOverviewEdge, GraphOverviewNode } from '@/features/services/model/service.types';
import styles from '../decision-graphs.module.css';

type ServiceNode = GraphOverviewNode & { node_kind: 'service' };

function asService(node: GraphOverviewNode): node is ServiceNode {
  return node.node_kind === 'service';
}

function relationEdges(edges: GraphOverviewEdge[]) {
  return edges.filter((edge) => edge.edge_kind === 'service_relation');
}

function mappingEdges(edges: GraphOverviewEdge[]) {
  return edges.filter((edge) => edge.edge_kind === 'service_c3_mapping');
}

function uniqueById(nodes: GraphOverviewNode[]) {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

export default function DependencyFlowPage() {
  const { data, isLoading, error } = useGraphOverview({ includeC3: true });

  if (isLoading) return <div className={styles.state}>Loading dependency flow…</div>;
  if (error || !data) return <div className={styles.stateError}>Dependency flow unavailable.</div>;

  const services = data.nodes.filter(asService);
  const serviceRelations = relationEdges(data.edges);
  const c3Mappings = mappingEdges(data.edges);
  const topServices = services
    .slice()
    .sort((left, right) => {
      const leftLinks = data.edges.filter((edge) => edge.source === left.id || edge.target === left.id).length;
      const rightLinks = data.edges.filter((edge) => edge.source === right.id || edge.target === right.id).length;
      return rightLinks - leftLinks;
    })
    .slice(0, 5);

  const enablingNodes = uniqueById(topServices.flatMap((service) => (
    serviceRelations
      .filter((edge) => edge.target === service.id)
      .map((edge) => data.nodes.find((node) => node.id === edge.source))
      .filter(Boolean) as GraphOverviewNode[]
  ))).slice(0, 5);

  const capabilityNodes = uniqueById(topServices.flatMap((service) => (
    c3Mappings
      .filter((edge) => edge.source === service.id)
      .map((edge) => data.nodes.find((node) => node.id === edge.target))
      .filter(Boolean) as GraphOverviewNode[]
  ))).slice(0, 5);

  const needs = uniqueById(topServices.map((service) => ({
    ...service,
    id: `need:${service.portfolio_group ?? service.service_type ?? service.id}`,
    title: service.portfolio_group ?? service.service_type ?? 'Operational need',
  }))).slice(0, 5);

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Service graph · dependency flow</span>
          <h1 className={styles.title}>Dependency flow</h1>
          <p className={styles.lead}>
            Decision-first view across consumer need, business service, enabling services, C3 capability and FMN/C3 requirement evidence.
          </p>
        </div>
        <div className={styles.actions}>
          <Link className={styles.ghostButton} href="/services/impact">Impact analysis</Link>
          <Link className={styles.ghostButton} href="/services/graph">Open graph canvas</Link>
          <Link className={styles.linkButton} href="/services/consolidation-matrix">Consolidation matrix</Link>
        </div>
      </header>

      <section className={styles.kpiGrid}>
        <KpiCard label="Services" value={services.length} hint="Business/service catalogue nodes" />
        <KpiCard label="Dependencies" value={serviceRelations.length} hint="Service-to-service relations" />
        <KpiCard label="C3 mappings" value={c3Mappings.length} hint="Evidence links into taxonomy" />
      </section>

      <section className={styles.flowBoard} aria-label="Dependency flow map">
        <FlowColumn title="Consumer need">
          {needs.length ? needs.map((need) => <NodeCard key={need.id} title={need.title} subtitle="Portfolio or service type signal" />) : <EmptyState title="No needs" />}
        </FlowColumn>
        <FlowColumn title="Business service">
          {topServices.map((service) => (
            <NodeCard
              key={service.id}
              href={`/services/${service.service_id}`}
              title={service.title}
              subtitle={service.service_id ?? 'service'}
              meta={service.service_status ?? undefined}
              variant="service"
            />
          ))}
        </FlowColumn>
        <FlowColumn title="Enabling service">
          {enablingNodes.length ? enablingNodes.map((node) => (
            <NodeCard key={node.id} href={node.service_id ? `/services/${node.service_id}` : undefined} title={node.title} subtitle={node.service_id ?? node.code ?? 'dependency'} variant="service" />
          )) : <EmptyState title="No upstream dependencies" />}
        </FlowColumn>
        <FlowColumn title="C3 capability">
          {capabilityNodes.length ? capabilityNodes.map((node) => (
            <NodeCard key={node.id} href={node.c3_uuid ? `/c3/${node.c3_uuid}` : undefined} title={node.title} subtitle={node.code ?? node.item_type ?? 'C3'} variant="capability" />
          )) : <EmptyState title="No C3 mapping" />}
        </FlowColumn>
        <FlowColumn title="FMN requirement">
          {capabilityNodes.length ? capabilityNodes.map((node) => (
            <NodeCard key={`req:${node.id}`} title={node.code ?? node.title} subtitle="Derived from mapped C3 evidence" variant="requirement" />
          )) : <EmptyState title="No requirement evidence" />}
        </FlowColumn>
      </section>
    </main>
  );
}

function FlowColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.flowColumn}>
      <h2 className={styles.columnTitle}>{title}</h2>
      {children}
    </div>
  );
}

function NodeCard({
  href,
  title,
  subtitle,
  meta,
  variant,
}: {
  href?: string;
  title: string;
  subtitle?: string | null;
  meta?: string;
  variant?: 'service' | 'capability' | 'requirement';
}) {
  const className = `${styles.nodeCard} ${variant === 'service' ? styles.serviceNode : variant === 'capability' ? styles.capabilityNode : variant === 'requirement' ? styles.requirementNode : ''}`;
  const body = (
    <>
      <strong>{title}</strong>
      {subtitle && <span>{subtitle}</span>}
      {meta && <small><Badge variant="info">{meta}</Badge></small>}
    </>
  );
  return href ? <Link href={href} className={className}>{body}</Link> : <div className={className}>{body}</div>;
}
