/**
 * Service Graph v2 — service dependencies + legacy variant evidence + C3 subgraph
 */
'use client';

import Link from '@/app/components/AppLink';
import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  type EdgeMouseHandler,
  MarkerType,
  Position,
  Handle,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { exportGraphToPdf } from '@/features/graph/exportGraphPdf';
import { applyLineStyleMode, resolveServiceGraphEdgeVisual, type GraphEdgeType, type GraphLineStyleMode } from '@/features/graph/graphVisuals';
import { useServiceGraph, useServices } from '@/features/services/hooks/useServices';
import type { ServiceGraphV2Response, ServiceGraphV2Node, ServiceGraphV2Edge } from '@/features/services/model/service.types';
import { StatusPill } from '@/features/services/components/StatusPill';
import { GraphWorkspace } from '@/app/components/layout-v2';
import shellStyles from '../../../graph/overview.module.css';
import localStyles from './graph.module.css';
import { compareText } from '@/app/i18n/format';
import { useLocale } from '@/app/i18n/useI18n';

interface Props {
  params: Promise<{ id: string }>;
}

type GraphNodeCardData = ServiceGraphV2Node & {
  selected?: boolean;
  onSelect?: () => void;
};
type ServiceGraphViewMode = 'detail' | 'graph-only' | 'text';

const COLUMN_X: Record<ServiceGraphV2Node['node_kind'], number> = {
  service: 0,
  flavour: 260,
  c3_capability: 560,
  c3_tin: 860,
  c3_application: 1160,
  c3_data_object: 1460,
  c3_service: 1760,
};

const NODE_KIND_LABEL: Record<ServiceGraphV2Node['node_kind'], string> = {
  service: 'Service',
  flavour: 'Legacy variant',
  c3_capability: 'Capability',
  c3_tin: 'Technology Interaction',
  c3_application: 'Application',
  c3_data_object: 'Data Object',
  c3_service: 'C3 Service',
};

const NODE_KIND_ORDER: ServiceGraphV2Node['node_kind'][] = [
  'service',
  'flavour',
  'c3_capability',
  'c3_tin',
  'c3_application',
  'c3_data_object',
  'c3_service',
];

const NODE_KIND_COLOR: Record<ServiceGraphV2Node['node_kind'], string> = {
  service: 'var(--color-info)',
  flavour: 'var(--color-warning)',
  c3_capability: 'var(--color-success)',
  c3_tin: 'var(--color-info)',
  c3_application: 'var(--color-success)',
  c3_data_object: 'var(--color-warning)',
  c3_service: 'var(--color-domain-relay)',
};

function normalizeViewMode(value: string | null | undefined): ServiceGraphViewMode {
  if (value === 'graph-only' || value === 'text' || value === 'detail') return value;
  return 'detail';
}

function edgeLabel(edge: ServiceGraphV2Edge & { mapping_type_code?: string | null }) {
  return (edge.relation_label || edge.mapping_type_code || edge.relation_type || edge.edge_kind).replace(/_/g, ' ');
}

function buildRootServiceGraph(graphData: ServiceGraphV2Response | undefined) {
  if (!graphData) return { nodes: [] as ServiceGraphV2Node[], edges: [] as ServiceGraphV2Edge[] };

  const rootNodeId = `svc:${graphData.root_service_id}`;
  const nodeById = new Map(graphData.nodes.map((node) => [node.id, node]));
  const visibleIds = new Set<string>(nodeById.has(rootNodeId) ? [rootNodeId] : []);
  const traversableEdges = graphData.edges.filter((edge) => edge.edge_kind !== 'service_relation');

  let changed = true;
  while (changed) {
    changed = false;
    for (const edge of traversableEdges) {
      if (visibleIds.has(edge.source) && !visibleIds.has(edge.target)) {
        visibleIds.add(edge.target);
        changed = true;
      }
    }
  }

  const nodes = graphData.nodes.filter((node) => visibleIds.has(node.id));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = traversableEdges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return { nodes, edges };
}

function layoutNodes(
  items: ServiceGraphV2Node[],
  selectedNodeId: string | null,
  onSelectNode: (node: ServiceGraphV2Node) => void,
  locale: string,
): Node[] {
  const grouped = new Map<ServiceGraphV2Node['node_kind'], ServiceGraphV2Node[]>();
  items.forEach((item) => {
    if (!grouped.has(item.node_kind)) grouped.set(item.node_kind, []);
    grouped.get(item.node_kind)!.push(item);
  });

  return Object.entries(COLUMN_X).flatMap(([kind, x]) => {
    const rows = (grouped.get(kind as ServiceGraphV2Node['node_kind']) ?? []).slice().sort((a, b) => {
      if (a.node_kind === 'service' && a.is_root !== b.is_root) return a.is_root ? -1 : 1;
      return compareText(locale, `${a.code ?? ''} ${a.label}`, `${b.code ?? ''} ${b.label}`, { numeric: true, sensitivity: 'base' });
    });

    return rows.map((item, index) => ({
      id: item.id,
      type: item.node_kind === 'service'
        ? 'serviceNode'
        : item.node_kind === 'flavour'
          ? 'flavourNode'
          : item.node_kind === 'c3_capability'
            ? 'capabilityNode'
            : 'entityNode',
      position: {
        x,
        y: index * 110,
      },
      data: {
        ...item,
        selected: selectedNodeId === item.id,
        onSelect: () => onSelectNode(item),
      },
    }));
  });
}

function ServiceNodeCard({ data }: { data: GraphNodeCardData }) {
  return (
    <div
      className={`${localStyles.node} ${data.is_root ? localStyles.nodeRoot : ''} ${data.selected ? localStyles.nodeSelected : ''}`}
      onClick={data.onSelect}
      title={data.label}
    >
      <Handle type="target" position={Position.Left} />
      <div className={localStyles.nodeId}>{data.code}</div>
      <div className={localStyles.nodeTitle}>{data.label}</div>
      <div className={localStyles.nodeStatus}>
        <StatusPill status={data.status ?? 'draft'} size="sm" />
      </div>
      {data.portfolio_group && <div className={localStyles.nodePortfolio}>{data.portfolio_group}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function FlavourNodeCard({ data }: { data: GraphNodeCardData }) {
  return (
    <div
      className={`${localStyles.flavourNode} ${data.selected ? localStyles.nodeSelected : ''}`}
      onClick={data.onSelect}
      title={data.label}
    >
      <Handle type="target" position={Position.Left} />
      <div className={localStyles.flavourTitle}>{data.label}</div>
      {data.price_label && <div className={localStyles.flavourPrice}>{data.price_label}</div>}
    </div>
  );
}

function CapabilityNodeCard({ data }: { data: GraphNodeCardData }) {
  return (
    <div
      className={`${localStyles.capabilityNode} ${data.selected ? localStyles.nodeSelected : ''}`}
      onClick={data.onSelect}
      title={data.label}
    >
      <Handle type="target" position={Position.Left} />
      <div className={localStyles.capabilityCode}>{data.code}</div>
      <div className={localStyles.capabilityTitle}>{data.label}</div>
      {data.item_type && <div className={localStyles.capabilityMeta}>{data.item_type}</div>}
      {data.completeness_status && (
        <div className={localStyles.capabilityMeta}>Completeness: {data.completeness_status}</div>
      )}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function EntityNodeCard({ data }: { data: GraphNodeCardData }) {
  return (
    <div
      className={`${localStyles.entityNode} ${data.selected ? localStyles.nodeSelected : ''}`}
      onClick={data.onSelect}
      title={data.label}
    >
      <Handle type="target" position={Position.Left} />
      <div className={localStyles.entityKind}>{data.node_kind.replace('c3_', '').replace(/_/g, ' ')}</div>
      <div className={localStyles.entityCode}>{data.code}</div>
      <div className={localStyles.entityTitle}>{data.label}</div>
      {data.status && <div className={localStyles.entityStatus}>{data.status}</div>}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNodeCard as NodeTypes[string],
  flavourNode: FlavourNodeCard as NodeTypes[string],
  capabilityNode: CapabilityNodeCard as NodeTypes[string],
  entityNode: EntityNodeCard as NodeTypes[string],
};

function formatEdgeLabel(edge: ServiceGraphV2Edge & { mapping_type_code?: string | null }) {
  if (edge.edge_kind === 'service_relation') return edge.relation_type;
  if (edge.edge_kind === 'service_c3_mapping') return edge.mapping_type_code ?? edge.relation_type;
  return undefined;
}

function resolveNodeHref(node: ServiceGraphV2Node): string | null {
  const code = String(node.code ?? '').trim();
  if (node.node_kind === 'service') return node.service_id ? `/services/${String(node.service_id).trim()}` : null;
  if (node.node_kind === 'c3_capability') return node.c3_uuid ? `/c3/${String(node.c3_uuid).trim()}` : null;
  if (node.node_kind === 'c3_application') return code ? `/c3/applications/${encodeURIComponent(code)}` : null;
  if (node.node_kind === 'c3_tin') return code ? `/c3/technology-interactions/${encodeURIComponent(code)}` : null;
  if (node.node_kind === 'c3_data_object') return code ? `/c3/data-objects/${encodeURIComponent(code)}` : null;
  if (node.node_kind === 'c3_service') return code ? `/c3/services/${encodeURIComponent(code)}` : null;
  return null;
}

export default function GraphPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const [selectedNode, setSelectedNode] = useState<ServiceGraphV2Node | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<ServiceGraphV2Edge | null>(null);
  const [edgeType, setEdgeType] = useState<GraphEdgeType>('smoothstep');
  const [lineStyleMode, setLineStyleMode] = useState<GraphLineStyleMode>('auto');
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const { data: serviceList } = useServices({ limit: 500, sort: 'service_id', order: 'ASC' });

  const viewMode = normalizeViewMode(searchParams?.get('view'));
  const canvasOnly = viewMode === 'graph-only';
  const showTextAlternative = viewMode === 'text';
  const detailOpen = viewMode === 'detail';

  const { data, isLoading, error } = useServiceGraph(id, 1, 'v2');
  const graphData = data as ServiceGraphV2Response | undefined;
  const rootGraph = useMemo(() => buildRootServiceGraph(graphData), [graphData]);
  const graphNodeById = useMemo(() => new Map(rootGraph.nodes.map((node) => [node.id, node])), [rootGraph.nodes]);

  const rfNodes = useMemo(
    () => layoutNodes(rootGraph.nodes, selectedNode?.id ?? null, (node) => {
      setSelectedNode(node);
      setSelectedEdge(null);
    }, locale),
    [locale, rootGraph.nodes, selectedNode?.id],
  );

  const rfEdges = useMemo<Edge[]>(() => {
    return rootGraph.edges.map((edge) => {
      const typedEdge = edge as ServiceGraphV2Edge & { mapping_type_code?: string | null };
      const visual = resolveServiceGraphEdgeVisual(typedEdge);
      const dash = applyLineStyleMode(visual, lineStyleMode).dash
        ?? (edge.edge_kind.startsWith('tin_') || edge.edge_kind === 'service_flavour' ? '5 3' : undefined);

      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: edgeType,
        label: formatEdgeLabel(typedEdge),
        markerEnd: { type: MarkerType.ArrowClosed, color: visual.color },
        style: {
          stroke: visual.color,
          strokeWidth: edge.edge_kind === 'service_relation' && edge.is_mandatory ? Math.max(visual.width ?? 1.8, 3) : (visual.width ?? 1.8),
          strokeDasharray: dash,
        },
        labelStyle: { fontSize: 10, fill: visual.color, fontWeight: 600 },
        labelBgStyle: { fill: 'var(--color-bg-surface)', fillOpacity: 0.88 },
        data: { raw: edge },
      };
    });
  }, [edgeType, lineStyleMode, rootGraph.edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => { setNodes(rfNodes); }, [rfNodes, setNodes]);
  useEffect(() => { setEdges(rfEdges); }, [rfEdges, setEdges]);

  const nodeCounts = useMemo(() => {
    const counts = new Map<ServiceGraphV2Node['node_kind'], number>();
    NODE_KIND_ORDER.forEach((kind) => counts.set(kind, 0));
    rootGraph.nodes.forEach((node) => counts.set(node.node_kind, (counts.get(node.node_kind) ?? 0) + 1));
    return counts;
  }, [rootGraph.nodes]);

  const edgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    rootGraph.edges.forEach((edge) => counts.set(edge.edge_kind, (counts.get(edge.edge_kind) ?? 0) + 1));
    return counts;
  }, [rootGraph.edges]);

  const textRelationRows = useMemo(() => rootGraph.edges.map((edge) => ({
    id: edge.id,
    source: graphNodeById.get(edge.source),
    target: graphNodeById.get(edge.target),
    label: edgeLabel(edge as ServiceGraphV2Edge & { mapping_type_code?: string | null }),
    kind: edge.edge_kind.replace(/_/g, ' '),
  })), [graphNodeById, rootGraph.edges]);

  const selectViewMode = useCallback((mode: ServiceGraphViewMode) => {
    const basePath = `/services/${encodeURIComponent(id)}/graph`;
    router.push(mode === 'detail' ? basePath : `${basePath}?view=${mode}`, { scroll: false });
  }, [id, router]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    const href = resolveNodeHref(node.data as ServiceGraphV2Node);
    if (href) router.push(href);
  }, [router]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const raw = (edge.data as { raw?: ServiceGraphV2Edge } | undefined)?.raw;
    setSelectedEdge(raw ?? null);
    setSelectedNode(null);
  }, []);

  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    setSelectedNode(node.data as ServiceGraphV2Node);
    setSelectedEdge(null);
  }, []);

  if (isLoading) return <div className={shellStyles.state}>Načítám service graph…</div>;
  if (error || !graphData) return <div className={shellStyles.stateError}>Service graph není dostupný.</div>;

  const selectedNodeHref = selectedNode ? resolveNodeHref(selectedNode) : null;
  const typedSelectedEdge = selectedEdge as (ServiceGraphV2Edge & { mapping_type_code?: string | null }) | null;

  return (
    <GraphWorkspace
      title="Service graph"
      purpose="Vazby služby, offeringů, C3 prvků a readiness kontext v jedné pracovní ploše."
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
          <div className={shellStyles.meta}>Service: {graphData.root_service_id}</div>
          <div className={shellStyles.meta}>Bloky: {rootGraph.nodes.length}</div>
          <div className={shellStyles.meta}>Vazby: {rootGraph.edges.length}</div>
        </FilterGroup>

        <FilterGroup label="Uzly">
          {NODE_KIND_ORDER.map((kind) => (
            <div key={kind} className={shellStyles.meta}>
              {NODE_KIND_LABEL[kind]}: {nodeCounts.get(kind) ?? 0}
            </div>
          ))}
        </FilterGroup>

        <FilterGroup label="Vazby">
          {Array.from(edgeCounts.entries()).sort((a, b) => compareText(locale, a[0], b[0])).map(([kind, count]) => (
            <div key={kind} className={shellStyles.meta}>
              {kind.replace(/_/g, ' ')}: {count}
            </div>
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

        {graphData.readiness && (
          <FilterGroup label="Readiness">
            <div className={shellStyles.meta}>Blockers: {graphData.readiness.blockers.length}</div>
            <div className={shellStyles.meta}>Warnings: {graphData.readiness.warnings.length}</div>
            <div className={shellStyles.meta}>Primary C3: {graphData.readiness.primary_c3_code ?? '—'}</div>
            <div className={shellStyles.meta}>Legacy variants: {graphData.readiness.active_flavour_count}</div>
          </FilterGroup>
        )}

        <FilterGroup label="Export">
          <button
            type="button"
            className={shellStyles.saveButtonInline}
            onClick={() => exportGraphToPdf(graphCanvasRef.current, `Service Graph ${graphData.root_service_id}`)}
          >
            Export do PDF
          </button>
        </FilterGroup>
        </>
      )}
      canvas={(
        <main className={`${shellStyles.main} ${canvasOnly ? shellStyles.mainGraphOnly : ''}`}>
        <div className={shellStyles.header}>
          <div className={shellStyles.title}>Service Graph</div>
          <div className={shellStyles.meta}>
            {graphData.root_service_id} · {rootGraph.nodes.length} bloků · {rootGraph.edges.length} vazeb
          </div>
          <select
            className={shellStyles.selectInput}
            style={{ maxWidth: 340, marginLeft: 'auto' }}
            value={id}
            onChange={(event) => {
              const nextId = event.target.value;
              if (!nextId || nextId === id) return;
              router.push(`/services/${encodeURIComponent(nextId)}/graph`);
            }}
          >
            <option value={id}>{id}</option>
            {(serviceList?.items ?? []).filter((service) => service.service_id !== id).map((service) => (
              <option key={service.service_id} value={service.service_id}>
                {service.service_id} · {service.title}
              </option>
            ))}
          </select>
          {graphData.readiness && (
            <span className={graphData.readiness.is_publishable ? localStyles.readinessOk : localStyles.readinessBlocked}>
              {graphData.readiness.is_publishable ? 'Publish ready' : 'Publish blocked'}
            </span>
          )}
        </div>

        <div className={shellStyles.canvasWrap}>
          <div className={shellStyles.canvas} ref={graphCanvasRef}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onNodeDoubleClick={onNodeDoubleClick}
              onEdgeClick={onEdgeClick}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
            >
              <Background gap={24} size={1} />
              <Controls />
              <MiniMap nodeColor={(node) => NODE_KIND_COLOR[String(node.data?.node_kind ?? 'service') as ServiceGraphV2Node['node_kind']] ?? 'var(--color-text-secondary)'} />
            </ReactFlow>
          </div>
        </div>
        {!canvasOnly && showTextAlternative ? (
          <section
            className={shellStyles.graphTextAlternative}
            aria-labelledby="service-detail-graph-text-alt"
          >
            <div className={shellStyles.graphTextHeader}>
              <h2 id="service-detail-graph-text-alt">Textová alternativa vazeb</h2>
              <div className={shellStyles.graphTextHeaderActions}>
                <span>{rootGraph.edges.length} vazeb, zobrazeno {Math.min(textRelationRows.length, 200)}</span>
              </div>
            </div>
            {textRelationRows.length > 0 ? (
              <ul id="service-detail-graph-text-alt-content" className={shellStyles.graphRelationList}>
                {textRelationRows.slice(0, 200).map((relation) => (
                  <li key={relation.id}>
                    <strong>{relation.source?.label ?? relation.source?.code ?? relation.source?.id ?? relation.id}</strong>
                    <span>{relation.label}</span>
                    <strong>{relation.target?.label ?? relation.target?.code ?? relation.target?.id ?? 'Neznámý cíl'}</strong>
                    <small>{relation.kind}</small>
                  </li>
                ))}
              </ul>
            ) : null}
            {textRelationRows.length === 0 ? (
              <p id="service-detail-graph-text-alt-content" className={shellStyles.meta}>Pro tuto službu nejsou evidované žádné vazby grafu.</p>
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
                <PanelRow label="Typ">{NODE_KIND_LABEL[selectedNode.node_kind]}</PanelRow>
                <PanelRow label="Kód">{selectedNode.code ?? '—'}</PanelRow>
                <PanelRow label="Název">{selectedNode.label}</PanelRow>
                {selectedNode.status && <PanelRow label="Status">{selectedNode.status}</PanelRow>}
                {selectedNode.service_type && <PanelRow label="Service type">{selectedNode.service_type}</PanelRow>}
                {selectedNode.portfolio_group && <PanelRow label="Portfolio">{selectedNode.portfolio_group}</PanelRow>}
                {selectedNode.item_type && <PanelRow label="Item type">{selectedNode.item_type}</PanelRow>}
                {selectedNode.completeness_status && <PanelRow label="Completeness">{selectedNode.completeness_status}</PanelRow>}
                {selectedNodeHref ? (
                  <Link href={selectedNodeHref} className={shellStyles.panelLink}>
                    Otevřít detail →
                  </Link>
                ) : null}
              </>
            ) : null}

            {typedSelectedEdge ? (
              <>
                <PanelRow label="Edge">{typedSelectedEdge.edge_kind}</PanelRow>
                <PanelRow label="Typ">{typedSelectedEdge.mapping_type_code ?? typedSelectedEdge.relation_type}</PanelRow>
                {typedSelectedEdge.relation_label ? <PanelRow label="Label">{typedSelectedEdge.relation_label}</PanelRow> : null}
                {typedSelectedEdge.pace_code ? <PanelRow label="PACE">{typedSelectedEdge.pace_code}</PanelRow> : null}
                {typedSelectedEdge.impact_level ? <PanelRow label="Impact">{typedSelectedEdge.impact_level}</PanelRow> : null}
                {typedSelectedEdge.is_primary != null ? <PanelRow label="Primary">{typedSelectedEdge.is_primary ? 'Ano' : 'Ne'}</PanelRow> : null}
                {typedSelectedEdge.is_mandatory != null ? <PanelRow label="Mandatory">{typedSelectedEdge.is_mandatory ? 'Ano' : 'Ne'}</PanelRow> : null}
                {typedSelectedEdge.relation_note ? <PanelRow label="Poznámka">{typedSelectedEdge.relation_note}</PanelRow> : null}
              </>
            ) : null}

            {!selectedNode && !typedSelectedEdge && graphData.readiness ? (
              <>
                <div className={shellStyles.meta}>
                  Klikni na uzel nebo hranu. Dvojklik na uzel otevře detail služby nebo C3 entity.
                </div>
                <PanelRow label="Primary C3">
                  {graphData.readiness.primary_c3_code ?? '—'} {graphData.readiness.primary_c3_title ?? ''}
                </PanelRow>
                <PanelRow label="Capability">
                  {graphData.readiness.primary_c3_completeness_status ?? '—'}
                </PanelRow>
                <PanelRow label="Legacy variants">{graphData.readiness.active_flavour_count}</PanelRow>
                {graphData.readiness.blockers.length > 0 ? (
                  <div className={localStyles.edgePanelBlock}>
                    <strong>Blockers</strong>
                    <ul className={localStyles.edgePanelList}>
                      {graphData.readiness.blockers.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}
                {graphData.readiness.warnings.length > 0 ? (
                  <div className={localStyles.edgePanelBlock}>
                    <strong>Warnings</strong>
                    <ul className={localStyles.edgePanelList}>
                      {graphData.readiness.warnings.map((item) => <li key={item}>{item}</li>)}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>
        </>
      )}
    />
  );
}

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
