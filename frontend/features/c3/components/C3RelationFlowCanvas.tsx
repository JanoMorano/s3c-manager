'use client';

import { useCallback, useEffect, useMemo } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  MarkerType,
  Position,
  Handle,
  useEdgesState,
  useNodesState,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { C3RelationGraphEdge, C3RelationGraphNode } from '@/features/services/model/service.types';
import styles from '../../../app/graph/overview.module.css';
import { applyLineStyleMode, resolveC3EdgeVisual, type GraphEdgeType, type GraphLineStyleMode } from '@/features/graph/graphVisuals';
import { compareText } from '@/app/i18n/format';
import { useLocale } from '@/app/i18n/useI18n';

const NODE_KIND_LABEL: Record<C3RelationGraphNode['node_kind'], string> = {
  c3_capability: 'Capability',
  c3_tin: 'Technology Interaction',
  c3_application: 'Application',
  c3_data_object: 'Data Object',
  c3_service: 'C3 Service',
};

const NODE_KIND_ORDER: C3RelationGraphNode['node_kind'][] = [
  'c3_capability',
  'c3_tin',
  'c3_application',
  'c3_data_object',
  'c3_service',
];

const NODE_KIND_COLOR: Record<C3RelationGraphNode['node_kind'], string> = {
  c3_capability: 'var(--color-info)',
  c3_tin: 'var(--color-info)',
  c3_application: 'var(--color-success)',
  c3_data_object: 'var(--color-warning)',
  c3_service: 'var(--color-domain-relay)',
};

const COLUMN_X: Record<C3RelationGraphNode['node_kind'], number> = {
  c3_capability: 0,
  c3_tin: 320,
  c3_application: 640,
  c3_data_object: 960,
  c3_service: 1280,
};

function RelationNodeCard({ data }: { data: Record<string, unknown> }) {
  const color = String(data.color ?? 'var(--color-text-secondary)');
  const label = String(data.label ?? '');
  const code = String(data.code ?? '');
  const kind = String(data.node_kind ?? 'c3_capability') as C3RelationGraphNode['node_kind'];
  const completeness = String(data.completeness_status ?? '');
  const status = String(data.status ?? '');
  const selected = data.selected === true;

  return (
    <div
      className={`${kind === 'c3_capability' ? styles.c3Node : styles.node} ${selected ? styles.nodeSelected : ''} ${selected ? styles.c3NodeSelected : ''}`}
      style={kind === 'c3_capability' ? undefined : { borderColor: color }}
      onClick={data.onSelect as () => void}
      title={label}
    >
      <Handle type="target" position={Position.Left} />
      <div className={kind === 'c3_capability' ? styles.c3Type : styles.nodeId} style={{ color }}>
        {NODE_KIND_LABEL[kind]}
      </div>
      <div className={kind === 'c3_capability' ? styles.c3Title : styles.nodeTitle}>
        {code ? `${code} · ${label}` : label}
      </div>
      {kind === 'c3_capability' && completeness ? (
        <div className={styles.meta}>Completeness: {completeness}</div>
      ) : null}
      {kind !== 'c3_capability' && status ? (
        <div className={styles.meta}>{status}</div>
      ) : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  relationNode: RelationNodeCard as NodeTypes[string],
};

function buildLayout(
  nodes: C3RelationGraphNode[],
  edges: C3RelationGraphEdge[],
  onSelectNode: (node: C3RelationGraphNode) => void,
  selectedNodeId: string | null,
  compactMode: boolean,
  edgeType: GraphEdgeType = 'straight',
  lineStyleMode: GraphLineStyleMode = 'auto',
  locale: string,
) {
  const grouped = new Map<C3RelationGraphNode['node_kind'], C3RelationGraphNode[]>();
  NODE_KIND_ORDER.forEach((kind) => grouped.set(kind, []));
  nodes.forEach((node) => grouped.get(node.node_kind)?.push(node));

  const rfNodes: Node[] = [];
  NODE_KIND_ORDER.forEach((kind) => {
    const items = (grouped.get(kind) ?? []).slice().sort((a, b) =>
      compareText(locale, `${a.code ?? ''} ${a.label}`, `${b.code ?? ''} ${b.label}`, { numeric: true, sensitivity: 'base' }),
    );
    items.forEach((item, index) => {
      rfNodes.push({
        id: item.id,
        type: 'relationNode',
        position: { x: COLUMN_X[kind], y: index * (compactMode ? 96 : 112) },
        data: {
          ...item,
          color: NODE_KIND_COLOR[item.node_kind],
          selected: selectedNodeId === item.id,
          onSelect: () => onSelectNode(item),
        },
      });
    });
  });

  const rfEdges: Edge[] = edges.map((edge) => {
    const visual = resolveC3EdgeVisual(edge);
    const dash = applyLineStyleMode(visual, lineStyleMode).dash;
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edgeType,
      animated: !compactMode && edge.edge_kind.startsWith('capability_'),
      label: compactMode ? undefined : edge.relation_type.replace(/_/g, ' '),
      markerEnd: { type: MarkerType.ArrowClosed, color: visual.color },
      style: {
        stroke: visual.color,
        strokeWidth: visual.width ?? (edge.edge_kind.startsWith('capability_') ? 2.2 : 1.6),
        strokeDasharray: dash,
      },
      labelStyle: compactMode ? undefined : { fontSize: 10, fill: 'var(--color-text-secondary)', fontWeight: 600 },
      labelBgStyle: compactMode ? undefined : { fill: 'var(--color-bg-surface)', fillOpacity: 0.88 },
      data: { raw: edge },
    };
  });

  return { rfNodes, rfEdges };
}

interface Props {
  graphNodes: C3RelationGraphNode[];
  graphEdges: C3RelationGraphEdge[];
  selectedNodeId: string | null;
  onSelectNode: (node: C3RelationGraphNode) => void;
  onSelectEdge: (edge: C3RelationGraphEdge | null) => void;
  onOpenNode: (node: C3RelationGraphNode) => void;
  compactMode?: boolean;
  edgeType?: GraphEdgeType;
  lineStyleMode?: GraphLineStyleMode;
}

export function C3RelationFlowCanvas({
  graphNodes,
  graphEdges,
  selectedNodeId,
  onSelectNode,
  onSelectEdge,
  onOpenNode,
  compactMode = false,
  edgeType = 'straight',
  lineStyleMode = 'auto',
}: Props) {
  const locale = useLocale();
  const { rfNodes, rfEdges } = useMemo(
    () => buildLayout(graphNodes, graphEdges, onSelectNode, selectedNodeId, compactMode, edgeType, lineStyleMode, locale),
    [compactMode, edgeType, graphEdges, graphNodes, lineStyleMode, locale, onSelectNode, selectedNodeId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(rfNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(rfEdges);

  useEffect(() => {
    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [rfEdges, rfNodes, setEdges, setNodes]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    onOpenNode(node.data as C3RelationGraphNode);
  }, [onOpenNode]);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    const raw = (edge.data as { raw?: C3RelationGraphEdge } | undefined)?.raw;
    onSelectEdge(raw ?? null);
  }, [onSelectEdge]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDoubleClick={onNodeDoubleClick}
      onEdgeClick={onEdgeClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: compactMode ? 0.1 : 0.15 }}
    >
      <Background />
      <Controls />
      {!compactMode && (
        <MiniMap nodeColor={(node) => NODE_KIND_COLOR[String(node.data?.node_kind ?? 'c3_capability') as C3RelationGraphNode['node_kind']] ?? 'var(--color-text-secondary)'} />
      )}
    </ReactFlow>
  );
}
