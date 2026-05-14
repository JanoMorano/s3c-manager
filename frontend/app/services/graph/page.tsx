/**
 * Global services graph: service-to-service relationship view.
 * Keeps the detailed C3 graph on /services/[id]/graph and restores a service tab
 * overview for managers who need to see catalogue dependencies as a map.
 */
'use client';

import Link from '@/app/components/AppLink';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GraphWorkspace } from '@/app/components/layout-v2';
import { StatusPill } from '@/features/services/components/StatusPill';
import { useGraphOverview } from '@/features/services/hooks/useServices';
import { applyLineStyleMode, resolveServiceGraphEdgeVisual, type GraphEdgeType, type GraphLineStyleMode } from '@/features/graph/graphVisuals';
import type { GraphOverviewEdge, GraphOverviewNode } from '@/features/services/model/service.types';
import { compareText } from '@/app/i18n/format';
import { useLocale } from '@/app/i18n/useI18n';
import shellStyles from '../../graph/overview.module.css';

type ServiceGraphNodeData = GraphOverviewNode & Record<string, unknown> & {
  selected?: boolean;
  onSelect?: () => void;
};
type ServiceGraphEdgeData = GraphOverviewEdge & Record<string, unknown>;
type ServicesGraphViewMode = 'detail' | 'graph-only' | 'text';

const NODE_WIDTH = 250;
const COLUMN_GAP = 300;
const ROW_GAP = 116;
const MAX_ROWS_PER_COLUMN = 10;

function normalizeViewMode(value: string | null | undefined): ServicesGraphViewMode {
  if (value === 'graph-only' || value === 'text' || value === 'detail') return value;
  return 'detail';
}

function serviceNodeKey(node: GraphOverviewNode) {
  return node.service_id ?? node.id.replace(/^svc:/, '');
}

function relationLabel(edge: GraphOverviewEdge) {
  return (edge.relation_label || edge.relation_type || edge.edge_kind).replace(/_/g, ' ');
}

function groupLabel(node: GraphOverviewNode) {
  return node.portfolio_group || 'No portfolio';
}

function layoutNodes(
  items: GraphOverviewNode[],
  selectedNodeId: string | null,
  onSelectNode: (node: GraphOverviewNode) => void,
  locale: string,
): Node<ServiceGraphNodeData>[] {
  const groups = Array.from(
    items.reduce((map, node) => {
      const key = groupLabel(node);
      map.set(key, [...(map.get(key) ?? []), node]);
      return map;
    }, new Map<string, GraphOverviewNode[]>()),
  ).sort((a, b) => compareText(locale, a[0], b[0], { sensitivity: 'base' }));

  return groups.flatMap(([portfolio, nodes], groupIndex) => {
    const sorted = nodes.slice().sort((a, b) => compareText(
      locale,
      `${a.service_status ?? ''} ${a.service_id ?? ''} ${a.title}`,
      `${b.service_status ?? ''} ${b.service_id ?? ''} ${b.title}`,
      { numeric: true, sensitivity: 'base' },
    ));

    return sorted.map((node, index) => {
      const lane = Math.floor(index / MAX_ROWS_PER_COLUMN);
      const row = index % MAX_ROWS_PER_COLUMN;
      return {
        id: node.id,
        type: 'serviceNode',
        position: {
          x: node.graph_x ?? (groupIndex * COLUMN_GAP) + (lane * (NODE_WIDTH + 36)),
          y: node.graph_y ?? row * ROW_GAP,
        },
        data: {
          ...node,
          portfolio_group: node.portfolio_group ?? portfolio,
          selected: selectedNodeId === node.id,
          onSelect: () => onSelectNode(node),
        },
      };
    });
  });
}

function layoutEdges(
  items: GraphOverviewEdge[],
  edgeType: GraphEdgeType,
  lineStyleMode: GraphLineStyleMode,
): Edge<ServiceGraphEdgeData>[] {
  return items.map((edge) => {
    const visual = resolveServiceGraphEdgeVisual(edge);
    const autoDash = edge.is_verified === false ? '6 4' : visual.dash;
    const dash = applyLineStyleMode({ ...visual, dash: autoDash }, lineStyleMode).dash;
    const strokeColor = edge.is_mandatory ? 'var(--color-danger)' : visual.color;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edgeType,
      label: edge.is_mandatory ? 'mandatory' : undefined,
      markerEnd: { type: MarkerType.ArrowClosed, color: strokeColor },
      style: {
        strokeWidth: edge.is_mandatory ? Math.max(visual.width ?? 1.8, 2.4) : (visual.width ?? 1.6),
        stroke: strokeColor,
        strokeDasharray: dash,
      },
      labelStyle: { fontSize: 10, fill: strokeColor, fontWeight: 600 },
      labelBgStyle: { fill: 'var(--color-bg-surface)', fillOpacity: 0.88 },
      data: edge as ServiceGraphEdgeData,
    };
  });
}

function ServiceNodeCard({ data }: { data: ServiceGraphNodeData }) {
  return (
    <button
      type="button"
      className={`${shellStyles.node} ${data.selected ? shellStyles.nodeSelected : ''}`}
      onClick={data.onSelect}
      title={data.title}
      aria-label={`Select service ${data.title}`}
      aria-pressed={data.selected ? 'true' : 'false'}
    >
      <Handle type="target" position={Position.Left} />
      <div className={shellStyles.nodeId}>{data.service_id ?? data.code ?? data.id}</div>
      <div className={shellStyles.nodeTitle}>{data.title}</div>
      <div className={shellStyles.nodeStatus}>
        <StatusPill status={data.service_status ?? data.status ?? 'draft'} size="sm" />
      </div>
      <div className={shellStyles.meta}>{data.portfolio_group ?? 'No portfolio'}</div>
      <Handle type="source" position={Position.Right} />
    </button>
  );
}

const nodeTypes: NodeTypes = { serviceNode: ServiceNodeCard };

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={shellStyles.railSection}>
      <div className={shellStyles.filterLabel}>{label}</div>
      <div className={shellStyles.filterOptions}>{children}</div>
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={shellStyles.panelRow}>
      <span className={shellStyles.panelKey}>{label}</span>
      <span className={shellStyles.panelVal}>{children}</span>
    </div>
  );
}

function nodeColor(node: Node) {
  const status = String(node.data?.service_status ?? node.data?.status ?? '').toLowerCase();
  if (status.includes('retired')) return 'var(--color-danger)';
  if (status.includes('deprecated') || status.includes('retiring')) return 'var(--color-warning)';
  if (status.includes('active') || status.includes('live')) return 'var(--color-success)';
  return 'var(--color-info)';
}

export default function ServicesGraphPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const { data, isLoading, error } = useGraphOverview({ compact: true, includeC3: false });
  const [selectedNode, setSelectedNode] = useState<GraphOverviewNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphOverviewEdge | null>(null);
  const [edgeType, setEdgeType] = useState<GraphEdgeType>('smoothstep');
  const [lineStyleMode, setLineStyleMode] = useState<GraphLineStyleMode>('auto');
  const viewMode = normalizeViewMode(searchParams?.get('view'));
  const canvasOnly = viewMode === 'graph-only';
  const showTextAlternative = viewMode === 'text';
  const detailOpen = viewMode === 'detail';

  const services = useMemo(() => (data?.nodes ?? []).filter((node) => node.node_kind === 'service'), [data?.nodes]);
  const serviceIds = useMemo(() => new Set(services.map((node) => node.id)), [services]);
  const relations = useMemo(
    () => (data?.edges ?? []).filter((edge) => edge.edge_kind === 'service_relation' && serviceIds.has(edge.source) && serviceIds.has(edge.target)),
    [data?.edges, serviceIds],
  );

  const onSelectNode = useCallback((node: GraphOverviewNode) => {
    setSelectedNode(node);
    setSelectedEdge(null);
  }, []);

  const selectViewMode = useCallback((mode: ServicesGraphViewMode) => {
    const nextUrl = mode === 'detail' ? '/services/graph' : `/services/graph?view=${mode}`;
    router.push(nextUrl, { scroll: false });
  }, [router]);

  const initialNodes = useMemo(() => layoutNodes(services, selectedNode?.id ?? null, onSelectNode, locale), [locale, onSelectNode, selectedNode?.id, services]);
  const initialEdges = useMemo(() => layoutEdges(relations, edgeType, lineStyleMode), [edgeType, lineStyleMode, relations]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const nodeCountsByPortfolio = useMemo(() => {
    const counts = new Map<string, number>();
    services.forEach((node) => counts.set(groupLabel(node), (counts.get(groupLabel(node)) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => compareText(locale, a[0], b[0], { sensitivity: 'base' }));
  }, [locale, services]);

  const mandatoryCount = relations.filter((edge) => edge.is_mandatory).length;
  const unverifiedCount = relations.filter((edge) => edge.is_verified === false).length;
  const performanceMode = nodes.length > 250 || edges.length > 500;
  const showMiniMap = nodes.length <= 350;
  const serviceByNodeId = useMemo(() => new Map(services.map((node) => [node.id, node])), [services]);
  const textRelationRows = useMemo(() => relations.map((relation) => ({
    id: relation.id,
    source: serviceByNodeId.get(relation.source),
    target: serviceByNodeId.get(relation.target),
    label: relationLabel(relation),
    mandatory: Boolean(relation.is_mandatory),
    verified: relation.is_verified !== false,
  })), [relations, serviceByNodeId]);

  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedNode(node.data as unknown as ServiceGraphNodeData);
    setSelectedEdge(null);
  }, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_, node) => {
    const dataNode = node.data as unknown as ServiceGraphNodeData;
    const serviceId = serviceNodeKey(dataNode);
    if (serviceId) router.push(`/services/${encodeURIComponent(serviceId)}`);
  }, [router]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    setSelectedEdge(edge.data as unknown as GraphOverviewEdge);
    setSelectedNode(null);
  }, []);

  if (isLoading) return <div className={shellStyles.state}>Načítám graf služeb…</div>;
  if (error || !data) return <div className={shellStyles.stateError}>Graf služeb není dostupný.</div>;

  return (
    <GraphWorkspace
      title="Service graph"
      purpose="Pohled na vazby mezi službami. Dvojklik na uzel otevře detail služby."
      canvasOnly={canvasOnly}
      detailOpen={detailOpen}
      showWorkspaceActions={false}
      toolbar={(
        <>
          <FilterGroup label="Pohledy">
            <Link href="/services/list" className={shellStyles.panelLink}>Seznam Služeb</Link>
            <button
              type="button"
              className={`${shellStyles.viewModeButton} ${viewMode === 'graph-only' ? shellStyles.viewModeButtonActive : ''}`}
              onClick={() => selectViewMode('graph-only')}
            >
              Pouze graf
            </button>
            <button
              type="button"
              className={`${shellStyles.viewModeButton} ${viewMode === 'text' ? shellStyles.viewModeButtonActive : ''}`}
              onClick={() => selectViewMode('text')}
            >
              Vazby textově
            </button>
            <button
              type="button"
              className={`${shellStyles.viewModeButton} ${viewMode === 'detail' ? shellStyles.viewModeButtonActive : ''}`}
              onClick={() => selectViewMode('detail')}
            >
              Detail
            </button>
          </FilterGroup>

          <FilterGroup label="Souhrn">
            <div className={shellStyles.meta}>Services: {services.length}</div>
            <div className={shellStyles.meta}>Relations: {relations.length}</div>
            <div className={shellStyles.meta}>Mandatory: {mandatoryCount}</div>
            <div className={shellStyles.meta}>Unverified: {unverifiedCount}</div>
          </FilterGroup>

          <FilterGroup label="Portfolio">
            {nodeCountsByPortfolio.slice(0, 12).map(([portfolio, count]) => (
              <div key={portfolio} className={shellStyles.meta}>{portfolio}: {count}</div>
            ))}
          </FilterGroup>

          <FilterGroup label="Typ spojnic">
            <div className={shellStyles.typeList}>
              <button
                type="button"
                className={`${shellStyles.typeBtn} ${edgeType === 'smoothstep' ? shellStyles.typeBtnOn : ''}`}
                onClick={() => setEdgeType('smoothstep')}
              >
                Pravoúhlé
              </button>
              <button
                type="button"
                className={`${shellStyles.typeBtn} ${edgeType === 'straight' ? shellStyles.typeBtnOn : ''}`}
                onClick={() => setEdgeType('straight')}
              >
                Přímé
              </button>
            </div>
          </FilterGroup>

          <FilterGroup label="Styl čar">
            <div className={shellStyles.typeList}>
              {[
                { value: 'auto', label: 'Dle vazby' },
                { value: 'solid', label: 'Plné' },
                { value: 'dashed', label: 'Čárkované' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${shellStyles.typeBtn} ${lineStyleMode === option.value ? shellStyles.typeBtnOn : ''}`}
                  onClick={() => setLineStyleMode(option.value as GraphLineStyleMode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </FilterGroup>
        </>
      )}
      canvas={(
        <main className={`${shellStyles.main} ${canvasOnly ? shellStyles.mainGraphOnly : ''}`}>
          <div className={shellStyles.header}>
            <div className={shellStyles.title}>Services Graph</div>
            <div className={shellStyles.meta}>{services.length} services · {relations.length} relationships</div>
            {performanceMode && <div className={shellStyles.performanceBadge}>Large graph mode</div>}
          </div>
          <div className={shellStyles.canvasWrap}>
            <div className={shellStyles.canvas} role="region" aria-label="Interactive service relationship graph">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onEdgeClick={onEdgeClick}
                nodesConnectable={false}
                onlyRenderVisibleElements={performanceMode}
                fitView
                fitViewOptions={{ padding: 0.18 }}
              >
                <Background gap={24} size={1} />
                <Controls />
                {showMiniMap && <MiniMap nodeColor={nodeColor} />}
              </ReactFlow>
            </div>
          </div>
          {!canvasOnly && showTextAlternative ? (
          <section
            className={shellStyles.graphTextAlternative}
            aria-labelledby="service-graph-text-alt"
          >
            <div className={shellStyles.graphTextHeader}>
              <h2 id="service-graph-text-alt">Textová alternativa vazeb</h2>
              <div className={shellStyles.graphTextHeaderActions}>
                <span>{relations.length} vazeb, zobrazeno {Math.min(textRelationRows.length, 200)}</span>
              </div>
            </div>
            {textRelationRows.length > 0 ? (
              <ul id="service-graph-text-alt-content" className={shellStyles.graphRelationList}>
                {textRelationRows.slice(0, 200).map((relation) => (
                  <li key={relation.id}>
                    <strong>{relation.source?.title ?? relation.source?.service_id ?? relation.id}</strong>
                    <span>{relation.label}</span>
                    <strong>{relation.target?.title ?? relation.target?.service_id ?? 'Unknown target'}</strong>
                    <small>
                      {relation.mandatory ? 'mandatory' : 'optional'} · {relation.verified ? 'verified' : 'unverified'}
                    </small>
                  </li>
                ))}
              </ul>
            ) : null}
            {textRelationRows.length === 0 ? (
              <p id="service-graph-text-alt-content" className={shellStyles.meta}>Žádné service-to-service vazby nejsou evidované.</p>
            ) : null}
          </section>
          ) : null}
        </main>
      )}
      detailPanelContent={(
        <>
          <div className={shellStyles.panelHeader}>
            <div className={shellStyles.panelTitle}>Detail</div>
          </div>
          <div className={shellStyles.panelBody}>
            {selectedNode ? (
              <>
                <PanelRow label="Service ID">{selectedNode.service_id ?? selectedNode.code ?? selectedNode.id}</PanelRow>
                <PanelRow label="Title">{selectedNode.title}</PanelRow>
                <PanelRow label="Status">{selectedNode.service_status ?? selectedNode.status ?? '—'}</PanelRow>
                <PanelRow label="Portfolio">{selectedNode.portfolio_group ?? '—'}</PanelRow>
                <PanelRow label="Type">{selectedNode.service_type ?? '—'}</PanelRow>
                <PanelRow label="SLA">{selectedNode.sla_availability != null ? `${selectedNode.sla_availability}%` : '—'}</PanelRow>
                <Link href={`/services/${encodeURIComponent(serviceNodeKey(selectedNode))}`} className={shellStyles.panelLink}>Otevřít detail služby →</Link>
                <Link href={`/services/${encodeURIComponent(serviceNodeKey(selectedNode))}/graph`} className={shellStyles.panelLink}>Otevřít detailní graf →</Link>
              </>
            ) : null}

            {selectedEdge ? (
              <>
                <PanelRow label="Relation">{relationLabel(selectedEdge)}</PanelRow>
                <PanelRow label="Type">{selectedEdge.relation_type}</PanelRow>
                <PanelRow label="Mandatory">{selectedEdge.is_mandatory ? 'Ano' : 'Ne'}</PanelRow>
                <PanelRow label="Verified">{selectedEdge.is_verified ? 'Ano' : 'Ne'}</PanelRow>
                <PanelRow label="Impact">{selectedEdge.impact_level ?? '—'}</PanelRow>
              </>
            ) : null}

            {!selectedNode && !selectedEdge ? (
              <div className={shellStyles.meta}>
                Klikni na službu nebo vazbu. Dvojklik na službu otevře detail, odkud lze jít do konkrétního dependency graphu.
              </div>
            ) : null}
          </div>
        </>
      )}
    />
  );
}
