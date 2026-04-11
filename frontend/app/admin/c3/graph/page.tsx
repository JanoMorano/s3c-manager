/**
 * C3 Taxonomy — Graph
 * Modes:
 *   - Hierarchy: parent → child tree
 *   - Relations: capability → TIN / APP / DO / C3 Service
 */
'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  MarkerType,
  Handle,
  Position,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { useC3RelationGraph } from '@/features/services/hooks/useServices';
import type { C3RelationGraphNode, C3RelationGraphEdge } from '@/features/services/model/service.types';
import styles from './c3graph.module.css';

type GraphMode = 'hierarchy' | 'relations';

interface C3Item {
  uuid: string;
  external_id: string | null;
  title: string;
  description: string | null;
  item_type: string | null;
  parent_uuid: string | null;
  parent_code: string | null;
  item_status: string | null;
  application: string | null;
}

const TYPE_COLOR: Record<string, string> = {
  BP: '#0052cc',
  BR: '#00875a',
  CI: '#6554c0',
  CO: '#ff8b00',
  CR: '#de350b',
  UA: '#0065ff',
};
const TYPE_LABEL: Record<string, string> = {
  BP: 'Business Process',
  BR: 'Business Role',
  CI: 'COI Service',
  CO: 'Communications Service',
  CR: 'Core Service',
  UA: 'User Application',
};
const ALL_TYPES = ['BP', 'BR', 'CI', 'CO', 'CP', 'CR', 'IP', 'UA'];

const NODE_W = 200;
const NODE_H = 64;
const GAP_X = 24;
const GAP_Y = 80;

const RELATION_KIND_COLOR: Record<string, string> = {
  c3_capability: '#0b5fff',
  c3_tin: '#4c9aff',
  c3_application: '#36b37e',
  c3_data_object: '#ff8b00',
  c3_service: '#6554c0',
};

const RELATION_EDGE_COLOR: Record<string, string> = {
  capability_application: '#36b37e',
  capability_tin: '#4c9aff',
  capability_data_object: '#ff8b00',
  capability_c3_service: '#6554c0',
  tin_application: '#79f2c0',
  tin_data_object: '#ffbd5c',
  tin_c3_service: '#998dd9',
};

function treeLayout(items: C3Item[], selectedType: string, search: string): { nodes: Node[]; edges: Edge[] } {
  const srch = search.toLowerCase().trim();
  const filtered = items.filter((i) =>
    (i.item_type ?? '').toUpperCase() === selectedType &&
    (!srch || (i.title?.toLowerCase().includes(srch) || (i.external_id ?? '').toLowerCase().includes(srch)))
  );

  if (filtered.length === 0) return { nodes: [], edges: [] };

  const uuidSet = new Set(filtered.map((i) => i.uuid));
  const children = new Map<string | null, C3Item[]>();
  for (const item of filtered) {
    const parent = item.parent_uuid && uuidSet.has(item.parent_uuid) ? item.parent_uuid : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent)!.push(item);
  }

  const roots = children.get(null) ?? [];
  const subtreeWidth = new Map<string, number>();
  function calcWidth(item: C3Item): number {
    const kids = children.get(item.uuid) ?? [];
    if (kids.length === 0) {
      subtreeWidth.set(item.uuid, NODE_W + GAP_X);
      return NODE_W + GAP_X;
    }
    const total = kids.reduce((sum, kid) => sum + calcWidth(kid), 0);
    subtreeWidth.set(item.uuid, total);
    return total;
  }
  roots.forEach((root) => calcWidth(root));

  const color = TYPE_COLOR[selectedType] ?? '#0052cc';
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  function place(item: C3Item, xLeft: number, depth: number) {
    const width = subtreeWidth.get(item.uuid) ?? (NODE_W + GAP_X);
    const xCenter = xLeft + width / 2 - NODE_W / 2;
    const y = depth * (NODE_H + GAP_Y);

    rfNodes.push({
      id: item.uuid,
      type: 'c3Node',
      position: { x: xCenter, y },
      data: {
        label: item.title,
        code: item.external_id ?? '',
        status: item.item_status ?? '',
        color,
        node_kind: 'c3_capability',
        uuid: item.uuid,
        hasChildren: (children.get(item.uuid) ?? []).length > 0,
      },
    });

    if (item.parent_uuid && uuidSet.has(item.parent_uuid)) {
      rfEdges.push({
        id: `${item.parent_uuid}-${item.uuid}`,
        source: item.parent_uuid,
        target: item.uuid,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: '#6b778c' },
        style: { stroke: '#6b778c', strokeWidth: 1.5 },
      });
    }

    let childX = xLeft;
    for (const child of children.get(item.uuid) ?? []) {
      place(child, childX, depth + 1);
      childX += subtreeWidth.get(child.uuid) ?? (NODE_W + GAP_X);
    }
  }

  let rootX = 0;
  roots.forEach((root) => {
    place(root, rootX, 0);
    rootX += subtreeWidth.get(root.uuid) ?? (NODE_W + GAP_X);
  });

  return { nodes: rfNodes, edges: rfEdges };
}

function relationLayout(data: { nodes: C3RelationGraphNode[]; edges: C3RelationGraphEdge[] }): { nodes: Node[]; edges: Edge[] } {
  const grouped = new Map<string, C3RelationGraphNode[]>();
  const order = ['c3_capability', 'c3_tin', 'c3_application', 'c3_data_object', 'c3_service'];

  data.nodes.forEach((node) => {
    if (!grouped.has(node.node_kind)) grouped.set(node.node_kind, []);
    grouped.get(node.node_kind)!.push(node);
  });

  const rfNodes: Node[] = [];
  order.forEach((kind, columnIndex) => {
    const items = (grouped.get(kind) ?? []).slice().sort((a, b) =>
      `${a.code ?? ''} ${a.label}`.localeCompare(`${b.code ?? ''} ${b.label}`)
    );
    items.forEach((item, rowIndex) => {
      rfNodes.push({
        id: item.id,
        type: 'relationNode',
        position: { x: columnIndex * 320, y: rowIndex * 106 },
        data: {
          label: item.label,
          code: item.code,
          status: item.status,
          node_kind: item.node_kind,
          color: RELATION_KIND_COLOR[item.node_kind] ?? '#6b778c',
          completeness_status: item.completeness_status ?? null,
          item_type: item.item_type ?? null,
        },
      });
    });
  });

  const rfEdges: Edge[] = data.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: edge.edge_kind.startsWith('capability_'),
    markerEnd: { type: MarkerType.ArrowClosed, color: RELATION_EDGE_COLOR[edge.relation_type] ?? '#6b778c' },
    style: {
      stroke: RELATION_EDGE_COLOR[edge.relation_type] ?? '#6b778c',
      strokeWidth: edge.edge_kind.startsWith('capability_') ? 2.2 : 1.6,
      strokeDasharray: edge.edge_kind.startsWith('tin_') ? '5 3' : undefined,
    },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

function C3NodeCard({ data }: { data: Record<string, unknown> }) {
  const color = String(data.color ?? '#0052cc');
  const code = data.code == null ? '' : String(data.code);
  const label = data.label == null ? '' : String(data.label);
  const status = data.status == null ? '' : String(data.status);
  const hasChildren = data.hasChildren === true;

  return (
    <div className={styles.node} style={{ borderColor: color }}>
      <Handle type="target" position={Position.Top} />
      {code ? <div className={styles.nodeCode} style={{ color }}>{code}</div> : null}
      <div className={styles.nodeTitle}>{label}</div>
      {status ? <div className={styles.nodeStatus}>{status}</div> : null}
      {hasChildren ? <Handle type="source" position={Position.Bottom} /> : null}
    </div>
  );
}

function RelationNodeCard({ data }: { data: Record<string, unknown> }) {
  const color = String(data.color ?? '#6b778c');
  const nodeKind = data.node_kind == null ? '' : String(data.node_kind);
  const code = data.code == null ? '' : String(data.code);
  const label = data.label == null ? '' : String(data.label);
  const itemType = data.item_type == null ? '' : String(data.item_type);
  const completenessStatus = data.completeness_status == null ? '' : String(data.completeness_status);
  const status = data.status == null ? '' : String(data.status);

  return (
    <div className={styles.relationNode} style={{ borderColor: color }}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.relationKind} style={{ color }}>
        {nodeKind.replace('c3_', '').replace(/_/g, ' ')}
      </div>
      {code ? <div className={styles.nodeCode}>{code}</div> : null}
      <div className={styles.nodeTitle}>{label}</div>
      {itemType ? <div className={styles.relationMeta}>Type: {itemType}</div> : null}
      {completenessStatus ? <div className={styles.relationMeta}>Completeness: {completenessStatus}</div> : null}
      {status ? <div className={styles.nodeStatus}>{status}</div> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  c3Node: C3NodeCard as NodeTypes[string],
  relationNode: RelationNodeCard as NodeTypes[string],
};

export default function C3GraphPage() {
  const router = useRouter();
  const [mode, setMode] = useState<GraphMode>('hierarchy');
  const [selectedType, setSelectedType] = useState<string>('BP');
  const [search, setSearch] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const { data: allItems, isLoading, error } = useSWR<C3Item[]>(
    '/api/v1/taxonomy/c3',
    apiFetch,
    { revalidateOnFocus: false },
  );
  const {
    data: relationData,
    isLoading: isRelationLoading,
    error: relationError,
  } = useC3RelationGraph({ search, itemType: selectedType });

  const typeCounts = useMemo(() => {
    if (!allItems) return {} as Record<string, number>;
    return allItems.reduce((acc, item) => {
      const type = (item.item_type ?? '').toUpperCase();
      acc[type] = (acc[type] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }, [allItems]);

  useEffect(() => {
    if (mode === 'hierarchy') {
      if (!allItems) return;
      const next = treeLayout(allItems, selectedType, search);
      setNodes(next.nodes);
      setEdges(next.edges);
      return;
    }

    if (!relationData) return;
    const next = relationLayout(relationData);
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [allItems, relationData, mode, search, selectedType, setEdges, setNodes]);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    const kind = String(node.data?.node_kind ?? 'c3_capability');
    const code = String(node.data?.code ?? '');

    if (kind === 'c3_capability') {
      const uuid = node.id.startsWith('c3:') ? node.id.slice(3) : node.id;
      router.push(`/c3/${uuid}`);
      return;
    }
    if (kind === 'c3_application') {
      router.push(`/c3/applications?exact=${encodeURIComponent(code)}&search=${encodeURIComponent(code)}`);
      return;
    }
    if (kind === 'c3_tin') {
      router.push(`/c3/technology-interactions?exact=${encodeURIComponent(code)}&search=${encodeURIComponent(code)}`);
      return;
    }
    if (kind === 'c3_data_object') {
      router.push(`/c3/data-objects?exact=${encodeURIComponent(code)}&search=${encodeURIComponent(code)}`);
      return;
    }
    if (kind === 'c3_service') {
      router.push(`/c3/services?exact=${encodeURIComponent(code)}&search=${encodeURIComponent(code)}`);
    }
  }, [router]);

  const currentError = mode === 'hierarchy' ? error : relationError;
  const currentLoading = mode === 'hierarchy' ? isLoading : isRelationLoading;
  const visibleCount = nodes.length;
  const relationCount = edges.length;
  const totalOfType = typeCounts[selectedType] ?? 0;
  const filtered = search.trim().length > 0;

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <span className={styles.title}>C3 Taxonomy — Graf vazeb</span>
        <span className={styles.meta}>
          {currentLoading
            ? 'Načítám…'
            : mode === 'hierarchy'
              ? `${visibleCount}${filtered ? `/${totalOfType}` : ''} uzlů · double-click → detail`
              : `${visibleCount} uzlů · ${relationCount} vazeb · double-click → detail`}
        </span>
        <div className={styles.modeSwitch}>
          <button
            className={`${styles.modeBtn} ${mode === 'hierarchy' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('hierarchy')}
            type="button"
          >
            Hierarchie
          </button>
          <button
            className={`${styles.modeBtn} ${mode === 'relations' ? styles.modeBtnActive : ''}`}
            onClick={() => setMode('relations')}
            type="button"
          >
            Relations
          </button>
        </div>
        <input
          className={styles.search}
          placeholder={mode === 'hierarchy' ? 'Hledat kód nebo název…' : 'Hledat capability, APP, TIN, DO nebo SVC…'}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <a href="/c3/list" className={styles.backLink}>← Seznam</a>
      </div>

      <div className={styles.tabs}>
        {ALL_TYPES.map((type) => (
          <button
            key={type}
            className={`${styles.tab} ${selectedType === type ? styles.tabActive : ''}`}
            style={selectedType === type ? { borderBottomColor: TYPE_COLOR[type], color: TYPE_COLOR[type] } : {}}
            onClick={() => setSelectedType(type)}
            type="button"
          >
            {type}
            {typeCounts[type] != null && <span className={styles.tabCount}>{typeCounts[type]}</span>}
          </button>
        ))}
        <span className={styles.tabDesc}>
          {TYPE_LABEL[selectedType]} {mode === 'relations' ? '· relation mode' : ''}
        </span>
      </div>

      <div className={styles.canvas}>
        {currentError && <div className={styles.state} style={{ color: 'var(--color-danger)' }}>Chyba při načítání C3 dat</div>}
        {currentLoading && <div className={styles.state}>Načítám C3 data…</div>}
        {!currentLoading && !currentError && visibleCount === 0 && (
          <div className={styles.state}>
            {mode === 'hierarchy'
              ? `Žádné položky pro typ ${selectedType}${filtered ? ' a zadaný filtr' : ''}`
              : `Žádné relation uzly pro typ ${selectedType}${filtered ? ' a zadaný filtr' : ''}`}
          </div>
        )}
        {!currentLoading && visibleCount > 0 && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeDoubleClick={onNodeDoubleClick}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            minZoom={0.05}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={24} size={1} color="var(--color-border-subtle, #f4f5f7)" />
            <Controls />
            <MiniMap
              nodeColor={(node) => (node.data?.color as string) ?? '#0052cc'}
              maskColor="rgba(0,0,0,0.04)"
              style={{ border: '1px solid var(--color-border-default)' }}
            />
          </ReactFlow>
        )}
      </div>

      <div className={styles.legend}>
        {mode === 'hierarchy' ? (
          ALL_TYPES.map((type) => (
            <span key={type} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: TYPE_COLOR[type] }} />
              {type} — {TYPE_LABEL[type]}
            </span>
          ))
        ) : (
          Object.entries(RELATION_KIND_COLOR).map(([kind, color]) => (
            <span key={kind} className={styles.legendItem}>
              <span className={styles.legendDot} style={{ background: color }} />
              {kind.replace('c3_', '').replace(/_/g, ' ')}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
