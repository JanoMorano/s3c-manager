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
  MarkerType,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
} from '@xyflow/react';
import { GraphWorkspace } from '@/app/components/layout-v2';
import { useGraphOverview, usePortfolioGroups } from '@/features/services/hooks/useServices';
import { LIFECYCLE_STAGES, LIFECYCLE_STAGE_SERVICE_STATUS, lifecycleStageLabelKey } from '@/features/services/lifecycle';
import { applyNodePositions, useGraphLayout } from '@/features/graph/useGraphLayout';
import { applyLineStyleMode, resolveServiceRelationVisual, serviceGraphLegendItems, type GraphEdgeType, type GraphLineStyleMode } from '@/features/graph/graphVisuals';
import { GraphCanvas, isLargeGraph } from '@/features/graph/GraphCanvas';
import { GraphOptionGroup, GraphOptionsMenu, GraphSegmented, graphToolbarStyles } from '@/features/graph/GraphToolbar';
import { GRAPH_NODE_TYPE } from '@/features/graph/GraphNodeCard';
import { layoutByDependency } from '@/features/graph/autoLayout';
import { computeGraphHighlight, DIMMED_EDGE_OPACITY, DIMMED_NODE_OPACITY, type GraphHighlight } from '@/features/graph/graphHighlight';
import { relationTypeLabelKey } from '@/features/services/relationTypes';
import type { GraphOverviewEdge, GraphOverviewNode } from '@/features/services/model/service.types';
import { compareText } from '@/app/i18n/format';
import { useLocale, useT } from '@/app/i18n/useI18n';
import shellStyles from '../../graph/overview.module.css';

type ServiceGraphNodeData = GraphOverviewNode & Record<string, unknown>;
type ServiceGraphEdgeData = GraphOverviewEdge & Record<string, unknown>;
type ServicesGraphViewMode = 'graph' | 'text';
type ServicesGraphLayoutMode = 'dependency' | 'portfolio';

const NODE_WIDTH = 250;
const COLUMN_GAP = 300;
const ROW_GAP = 116;
const MAX_ROWS_PER_COLUMN = 10;
const LAYOUT_NODE_WIDTH = 220;
const LAYOUT_NODE_HEIGHT = 104;
const HIGHLIGHT_DEPTHS = [1, 2, 3, 5];

/** `?view=text` adds the text list of relations; older `detail` / `graph-only` links show the graph. */
function normalizeViewMode(value: string | null | undefined): ServicesGraphViewMode {
  return value === 'text' ? 'text' : 'graph';
}

function serviceNodeKey(node: GraphOverviewNode) {
  return node.service_id ?? node.id.replace(/^svc:/, '');
}

function relationLabel(edge: GraphOverviewEdge, t: (key: string) => string) {
  if (edge.relation_label) return edge.relation_label;
  return edge.relation_type ? t(relationTypeLabelKey(edge.relation_type)) : edge.edge_kind.replace(/_/g, ' ');
}

function groupLabel(node: GraphOverviewNode, noPortfolioLabel: string) {
  return node.portfolio_group || noPortfolioLabel;
}

function toFlowNode(
  node: GraphOverviewNode,
  position: { x: number; y: number },
  selectedNodeId: string | null,
  highlight: GraphHighlight | null,
  onSelectNode: (node: GraphOverviewNode) => void,
  noPortfolioLabel: string,
  portfolio?: string,
): Node<ServiceGraphNodeData> {
  const dimmed = highlight !== null && !highlight.nodeIds.has(node.id);
  const portfolioGroup = node.portfolio_group ?? portfolio ?? null;
  return {
    id: node.id,
    type: GRAPH_NODE_TYPE,
    position,
    style: dimmed ? { opacity: DIMMED_NODE_OPACITY } : undefined,
    data: {
      ...node,
      portfolio_group: portfolioGroup,
      card: {
        variant: 'service',
        code: node.service_id ?? node.code ?? node.id,
        title: node.title,
        status: node.service_status ?? node.status ?? 'draft',
        meta: [portfolioGroup ?? noPortfolioLabel],
        selected: selectedNodeId === node.id,
        onSelect: () => onSelectNode(node),
      },
    },
  };
}

function computeDependencyPositions(items: GraphOverviewNode[], relations: GraphOverviewEdge[], locale: string, noPortfolioLabel: string) {
  // Stable input order keeps dagre's placement deterministic between renders.
  const ordered = items.slice().sort((a, b) => compareText(
    locale,
    `${groupLabel(a, noPortfolioLabel)} ${a.service_id ?? ''}`,
    `${groupLabel(b, noPortfolioLabel)} ${b.service_id ?? ''}`,
    { numeric: true, sensitivity: 'base' },
  ));
  return layoutByDependency(
    ordered.map((node) => ({ id: node.id, width: LAYOUT_NODE_WIDTH, height: LAYOUT_NODE_HEIGHT })),
    relations,
    // Tight rank spacing keeps typical catalogues within one screen.
    { rankSep: 70, nodeSep: 28 },
  );
}

function layoutNodesByDependency(
  items: GraphOverviewNode[],
  positions: Map<string, { x: number; y: number }>,
  selectedNodeId: string | null,
  highlight: GraphHighlight | null,
  onSelectNode: (node: GraphOverviewNode) => void,
  noPortfolioLabel: string,
): Node<ServiceGraphNodeData>[] {
  return items.map((node) => toFlowNode(node, positions.get(node.id) ?? { x: 0, y: 0 }, selectedNodeId, highlight, onSelectNode, noPortfolioLabel));
}

function layoutNodesByPortfolio(
  items: GraphOverviewNode[],
  selectedNodeId: string | null,
  highlight: GraphHighlight | null,
  onSelectNode: (node: GraphOverviewNode) => void,
  locale: string,
  noPortfolioLabel: string,
): Node<ServiceGraphNodeData>[] {
  const groups = Array.from(
    items.reduce((map, node) => {
      const key = groupLabel(node, noPortfolioLabel);
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
      return toFlowNode(node, {
        x: (groupIndex * COLUMN_GAP) + (lane * (NODE_WIDTH + 36)),
        y: row * ROW_GAP,
      }, selectedNodeId, highlight, onSelectNode, noPortfolioLabel, portfolio);
    });
  });
}

function layoutEdges(
  items: GraphOverviewEdge[],
  edgeType: GraphEdgeType,
  lineStyleMode: GraphLineStyleMode,
  highlight: GraphHighlight | null,
): Edge<ServiceGraphEdgeData>[] {
  return items.map((edge) => {
    const visual = resolveServiceRelationVisual(edge);
    const dash = applyLineStyleMode(visual, lineStyleMode).dash;
    const dimmed = highlight !== null && !highlight.edgeIds.has(edge.id);

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edgeType,
      markerEnd: { type: MarkerType.ArrowClosed, color: visual.color },
      style: {
        strokeWidth: visual.width,
        stroke: visual.color,
        strokeDasharray: dash,
        opacity: dimmed ? DIMMED_EDGE_OPACITY : visual.opacity,
      },
      zIndex: highlight !== null && !dimmed ? 1 : 0,
      data: edge as ServiceGraphEdgeData,
    };
  });
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
  const t = useT();
  const noPortfolioLabel = t('service_graph.no_portfolio');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [portfolioFilter, setPortfolioFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
  // Filters run on the server, so large catalogues load only the visible services.
  const { data, isLoading, error } = useGraphOverview({
    compact: true,
    includeC3: false,
    search,
    portfolio: portfolioFilter,
    status: statusFilter,
  });
  const { data: portfolioGroups } = usePortfolioGroups();
  const [selectedNode, setSelectedNode] = useState<GraphOverviewNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphOverviewEdge | null>(null);
  const [edgeType, setEdgeType] = useState<GraphEdgeType>('smoothstep');
  const [lineStyleMode, setLineStyleMode] = useState<GraphLineStyleMode>('auto');
  const [layoutMode, setLayoutMode] = useState<ServicesGraphLayoutMode>('dependency');
  const layout = useGraphLayout(`service-overview/${layoutMode}`);
  const [highlightDepth, setHighlightDepth] = useState<number>(2);
  const viewMode = normalizeViewMode(searchParams?.get('view'));
  const showTextAlternative = viewMode === 'text';

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
    const nextUrl = mode === 'text' ? '/services/graph?view=text' : '/services/graph';
    router.push(nextUrl, { scroll: false });
  }, [router]);

  const highlight = useMemo(
    () => computeGraphHighlight(selectedNode?.id ?? null, relations, highlightDepth),
    [highlightDepth, relations, selectedNode?.id],
  );
  const dependencyPositions = useMemo(
    () => (layoutMode === 'dependency' ? computeDependencyPositions(services, relations, locale, noPortfolioLabel) : null),
    [layoutMode, locale, noPortfolioLabel, relations, services],
  );
  const initialNodes = useMemo(
    () => applyNodePositions(dependencyPositions
      ? layoutNodesByDependency(services, dependencyPositions, selectedNode?.id ?? null, highlight, onSelectNode, noPortfolioLabel)
      : layoutNodesByPortfolio(services, selectedNode?.id ?? null, highlight, onSelectNode, locale, noPortfolioLabel), layout.positions),
    [dependencyPositions, highlight, layout.positions, locale, noPortfolioLabel, onSelectNode, selectedNode?.id, services],
  );
  const initialEdges = useMemo(
    () => layoutEdges(relations, edgeType, lineStyleMode, highlight),
    [edgeType, highlight, lineStyleMode, relations],
  );
  const legendItems = useMemo(() => serviceGraphLegendItems(t, relations), [relations, t]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  const mandatoryCount = relations.filter((edge) => edge.is_mandatory).length;
  const unverifiedCount = relations.filter((edge) => edge.is_verified === false).length;
  const performanceMode = isLargeGraph(nodes.length, edges.length);
  const serviceByNodeId = useMemo(() => new Map(services.map((node) => [node.id, node])), [services]);
  const textRelationRows = useMemo(() => relations.map((relation) => ({
    id: relation.id,
    source: serviceByNodeId.get(relation.source),
    target: serviceByNodeId.get(relation.target),
    label: relationLabel(relation, t),
    mandatory: Boolean(relation.is_mandatory),
    verified: relation.is_verified !== false,
  })), [relations, serviceByNodeId, t]);

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

  const clearSelection = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  if (isLoading) return <div className={shellStyles.state}>{t('service_graph.text.loading_service_graph')}</div>;
  if (error || !data) return <div className={shellStyles.stateError}>{t('service_graph.text.service_graph_is_not_available')}</div>;

  const filtersActive = Boolean(searchInput || portfolioFilter || statusFilter);
  const detailTitle = selectedNode
    ? selectedNode.title
    : selectedEdge
      ? relationLabel(selectedEdge, t)
      : undefined;

  return (
    <GraphWorkspace
      title={t('service_graph.text.service_graph')}
      purpose={t('service_graph.overview.purpose')}
      meta={(
        <>
          <span title={`${t('service_graph.overview.summary_mandatory', { count: mandatoryCount })} · ${t('service_graph.overview.summary_unverified', { count: unverifiedCount })}`}>
            {t('service_graph.overview.meta', { services: services.length, relations: relations.length })}
          </span>
          {performanceMode && <span className={shellStyles.performanceBadge}>{t('service_graph.overview.large_graph')}</span>}
        </>
      )}
      toolbar={(
        <>
          <input
            type="search"
            className={graphToolbarStyles.search}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder={t('graph.filter.search')}
            aria-label={t('graph.filter.search')}
          />
          <select
            className={graphToolbarStyles.select}
            value={portfolioFilter}
            onChange={(event) => setPortfolioFilter(event.target.value)}
            aria-label={t('graph.filter.portfolio')}
          >
            <option value="">{t('graph.filter.portfolio')}: {t('graph.filter.all')}</option>
            {(portfolioGroups ?? []).map((group) => (
              <option key={group.code} value={group.code}>{group.name || group.code}</option>
            ))}
          </select>
          <select
            className={graphToolbarStyles.select}
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            aria-label={t('graph.filter.status')}
          >
            <option value="">{t('graph.filter.status')}: {t('graph.filter.all')}</option>
            {LIFECYCLE_STAGES.map((stage) => (
              <option key={stage} value={LIFECYCLE_STAGE_SERVICE_STATUS[stage]}>{t(lifecycleStageLabelKey(stage))}</option>
            ))}
          </select>
          <GraphSegmented
            label={t('graph.view.label')}
            value={viewMode}
            options={[
              { value: 'graph', label: t('graph.view.graph') },
              { value: 'text', label: t('service_graph.text.text_relationships') },
            ]}
            onChange={selectViewMode}
          />
          <GraphOptionsMenu label={t('graph.options.title')}>
            <GraphOptionGroup label={t('graph.layout.title')}>
              <GraphSegmented
                label={t('graph.layout.title')}
                value={layoutMode}
                options={[
                  { value: 'dependency', label: t('graph.layout.dependency') },
                  { value: 'portfolio', label: t('graph.layout.portfolio') },
                ]}
                onChange={setLayoutMode}
              />
            </GraphOptionGroup>
            <GraphOptionGroup label={t('graph.highlight.depth')}>
              <GraphSegmented
                label={t('graph.highlight.depth')}
                value={highlightDepth}
                options={HIGHLIGHT_DEPTHS.map((depth) => ({ value: depth, label: String(depth) }))}
                onChange={setHighlightDepth}
              />
            </GraphOptionGroup>
            <GraphOptionGroup label={t('service_graph.text.typ_spojnic')}>
              <GraphSegmented
                label={t('service_graph.text.typ_spojnic')}
                value={edgeType}
                options={[
                  { value: 'smoothstep', label: t('service_graph.text.orthogonal') },
                  { value: 'straight', label: t('service_graph.text.direct') },
                ]}
                onChange={setEdgeType}
              />
            </GraphOptionGroup>
            <GraphOptionGroup label={t('service_graph.text.line_style')}>
              <GraphSegmented
                label={t('service_graph.text.line_style')}
                value={lineStyleMode}
                options={[
                  { value: 'auto', label: t('service_graph.text.by_relation') },
                  { value: 'solid', label: t('service_graph.text.full') },
                  { value: 'dashed', label: t('service_graph.text.dashed') },
                ]}
                onChange={setLineStyleMode}
              />
            </GraphOptionGroup>
          </GraphOptionsMenu>
        </>
      )}
      canvas={(
        <div className={shellStyles.main}>
          <div className={shellStyles.canvasWrap}>
            <div className={shellStyles.canvas} role="region" aria-label={t('service_graph.overview.canvas_aria')}>
              <GraphCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                onNodeDoubleClick={onNodeDoubleClick}
                onEdgeClick={onEdgeClick}
                onPaneClick={clearSelection}
                fitViewPadding={0.08}
                minimapNodeColor={nodeColor}
                legend={{ title: t('graph.legend.title'), items: legendItems }}
                layout={layout}
              />
              {services.length === 0 && (
                <div className={graphToolbarStyles.emptyCanvas}>
                  <p>{filtersActive ? t('graph.filter.empty') : t('service_graph.overview.empty')}</p>
                  {filtersActive ? (
                    <button
                      type="button"
                      className={graphToolbarStyles.emptyAction}
                      onClick={() => { setSearchInput(''); setPortfolioFilter(''); setStatusFilter(''); }}
                    >
                      {t('graph.filter.clear')}
                    </button>
                  ) : (
                    <Link href="/management/new-service" className={graphToolbarStyles.emptyAction}>{t('nav.new_service')}</Link>
                  )}
                </div>
              )}
            </div>
          </div>
          {showTextAlternative ? (
          <section
            className={shellStyles.graphTextAlternative}
            aria-labelledby="service-graph-text-alt"
          >
            <div className={shellStyles.graphTextHeader}>
              <h2 id="service-graph-text-alt">{t('service_graph.text.text_alternative_for_relations')}</h2>
              <div className={shellStyles.graphTextHeaderActions}>
                <span>{t('service_graph.text_alt_count', { total: relations.length, shown: Math.min(textRelationRows.length, 200) })}</span>
              </div>
            </div>
            {textRelationRows.length > 0 ? (
              <ul id="service-graph-text-alt-content" className={shellStyles.graphRelationList}>
                {textRelationRows.slice(0, 200).map((relation) => (
                  <li key={relation.id}>
                    <strong>{relation.source?.title ?? relation.source?.service_id ?? relation.id}</strong>
                    <span>{relation.label}</span>
                    <strong>{relation.target?.title ?? relation.target?.service_id ?? t('service_graph.text.unknown_target')}</strong>
                    <small>
                      {relation.mandatory ? t('service_graph.relation.mandatory') : t('service_graph.relation.optional')} · {relation.verified ? t('service_graph.relation.verified') : t('service_graph.relation.unverified')}
                    </small>
                  </li>
                ))}
              </ul>
            ) : null}
            {textRelationRows.length === 0 ? (
              <p id="service-graph-text-alt-content" className={shellStyles.meta}>{t('service_graph.overview.no_relations')}</p>
            ) : null}
          </section>
          ) : null}
        </div>
      )}
      detailOpen={Boolean(selectedNode || selectedEdge)}
      detailTitle={detailTitle}
      onDetailPanelClose={clearSelection}
      detailPanelContent={(
        <div className={shellStyles.panelBody}>
          {selectedNode ? (
            <>
              <PanelRow label={t('service_graph.field.service_id')}>{selectedNode.service_id ?? selectedNode.code ?? selectedNode.id}</PanelRow>
              <PanelRow label={t('service_graph.text.status')}>{selectedNode.service_status ?? selectedNode.status ?? '—'}</PanelRow>
              <PanelRow label={t('service_graph.text.portfolio')}>{selectedNode.portfolio_group ?? '—'}</PanelRow>
              <PanelRow label={t('service_graph.text.typ')}>{selectedNode.service_type ?? '—'}</PanelRow>
              <PanelRow label="SLA">{selectedNode.sla_availability != null ? `${selectedNode.sla_availability}%` : '—'}</PanelRow>
              <Link href={`/services/${encodeURIComponent(serviceNodeKey(selectedNode))}`} className={shellStyles.panelLink}>{t('service_graph.overview.open_service_detail')}</Link>
              <Link href={`/services/${encodeURIComponent(serviceNodeKey(selectedNode))}/graph`} className={shellStyles.panelLink}>{t('service_graph.overview.open_detail_graph')}</Link>
            </>
          ) : null}

          {selectedEdge ? (
            <>
              <PanelRow label={t('service_graph.text.typ')}>{t(relationTypeLabelKey(selectedEdge.relation_type))}</PanelRow>
              <PanelRow label={t('service_graph.text.mandatory')}>{selectedEdge.is_mandatory ? t('common.yes') : t('common.no')}</PanelRow>
              <PanelRow label={t('service_graph.field.verified')}>{selectedEdge.is_verified ? t('common.yes') : t('common.no')}</PanelRow>
              <PanelRow label={t('service_graph.text.impact')}>{selectedEdge.impact_level ?? '—'}</PanelRow>
            </>
          ) : null}
        </div>
      )}
    />
  );
}
