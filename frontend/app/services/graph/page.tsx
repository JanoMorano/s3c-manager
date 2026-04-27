'use client';

import Link from '@/app/components/AppLink';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
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
  type NodeChange,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import useSWR from 'swr';
import { authHeaders, apiFetch } from '@/features/services/api/services.api';
import { useInstallStatus } from '@/features/install/installStatus';
import { useGraphOverview, useNetworkDomains } from '@/features/services/hooks/useServices';
import type { GraphOverviewEdge, GraphOverviewNode } from '@/features/services/model/service.types';
import { StatusPill } from '@/features/services/components/StatusPill';
import { exportGraphToPdf } from '@/features/graph/exportGraphPdf';
import { applyLineStyleMode, resolveServiceGraphEdgeVisual, SERVICE_RELATION_VISUAL } from '@/features/graph/graphVisuals';
import { compareText } from '@/app/i18n/format';
import { useLocale } from '@/app/i18n/useI18n';
import styles from '../../graph/overview.module.css';

const GROUP_COLOR: Record<string, string> = {
  'Application Services': 'var(--color-info)',
  'Platform Services': 'var(--color-info)',
  'Infrastructure Services': 'var(--color-domain-relay)',
  'Security Services': 'var(--color-danger)',
  'Network Services': 'var(--color-warning)',
  'Workplace Services': 'var(--color-success)',
  'Subject Matter Expertise Services': 'var(--color-success)',
  'Training Services': 'var(--color-success)',
};

const SERVICE_TYPE_COLOR: Record<string, string> = {
  CF: 'var(--color-info)',
  CFS: 'var(--color-domain-relay)',
  ES: 'var(--color-success)',
  SS: 'var(--color-danger)',
  MS: 'var(--color-warning)',
  AS: 'var(--color-success)',
};

const DEFAULT_COLOR = 'var(--color-text-secondary)';

const ALL_RELATION_TYPES = ['depends_on', 'prerequisite', 'underlying', 'replaces', 'related_to', 'provided_by'];
const NODE_W = 200;
const NODE_H = 74;
const GAP_X = 34;
const GAP_Y = 130;
const SERVICE_TYPE_ORDER = ['CF', 'CFS', 'ES', 'SS', 'MS', 'AS'];
const SWIMLANE_X_PADDING = 48;
const SWIMLANE_Y_PADDING = 30;
const SWIMLANE_MIN_HEIGHT = NODE_H + 72;
const C3_NODE_SIZE = 110;
const C3_OFFSET_X = 118;
const C3_OFFSET_Y = -18;
const C3_PARENT_OFFSET_Y = 150;
const ENTITY_COLUMN_X: Record<Exclude<GraphOverviewNode['node_kind'], 'service' | 'c3_capability'>, number> = {
  c3_tin: 980,
  c3_application: 1260,
  c3_data_object: 1540,
  c3_service: 1820,
};

function layoutServiceNodes(nodes: GraphOverviewNode[]): Map<string, { x: number; y: number }> {
  const byPortfolio = new Map<string, GraphOverviewNode[]>();
  for (const node of nodes) {
    const key = node.portfolio_group ?? 'Other';
    if (!byPortfolio.has(key)) byPortfolio.set(key, []);
    byPortfolio.get(key)!.push(node);
  }

  const positions = new Map<string, { x: number; y: number }>();
  let row = 0;
  for (const [, members] of byPortfolio) {
    members.forEach((node, index) => {
      positions.set(node.id, { x: index * (NODE_W + GAP_X), y: row });
    });
    row += NODE_H + GAP_Y;
  }
  return positions;
}

function sortServiceTypes(types: string[]) {
  return [...types].sort((a, b) => {
    const aIndex = SERVICE_TYPE_ORDER.indexOf(a);
    const bIndex = SERVICE_TYPE_ORDER.indexOf(b);
    if (aIndex !== -1 || bIndex !== -1) {
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    }
    return a.localeCompare(b);
  });
}

function choosePreferredType(types: string[]) {
  if (types.length === 0) return null;
  const counts = new Map<string, number>();
  types.forEach((type) => {
    counts.set(type, (counts.get(type) ?? 0) + 1);
  });
  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return sortServiceTypes([a[0], b[0]])[0] === a[0] ? -1 : 1;
    })[0]?.[0] ?? null;
}

function buildCapabilityPositionMap(
  c3Nodes: GraphOverviewNode[],
  mappingEdges: GraphOverviewEdge[],
  parentEdges: GraphOverviewEdge[],
  servicePositionMap: Map<string, { x: number; y: number }>,
  existingC3Positions: Map<string, { x: number; y: number }>,
) {
  const positions = new Map<string, { x: number; y: number }>();
  const fallbackBase = { x: 420, y: 180 };

  c3Nodes.forEach((node, index) => {
    const sourceMappings = mappingEdges.filter((edge) => edge.target === node.id);
    if (sourceMappings.length > 0) {
      const mappedPositions = sourceMappings
        .map((edge) => servicePositionMap.get(edge.source))
        .filter(Boolean) as Array<{ x: number; y: number }>;
      if (mappedPositions.length > 0) {
        const avgX = mappedPositions.reduce((sum, pos) => sum + pos.x, 0) / mappedPositions.length;
        const avgY = mappedPositions.reduce((sum, pos) => sum + pos.y, 0) / mappedPositions.length;
        positions.set(node.id, {
          x: avgX + NODE_W + C3_OFFSET_X,
          y: avgY + C3_OFFSET_Y,
        });
        return;
      }
    }

    const existing = existingC3Positions.get(node.id);
    if (existing) {
      positions.set(node.id, existing);
      return;
    }

    positions.set(node.id, {
      x: fallbackBase.x + (index % 4) * 180,
      y: fallbackBase.y + Math.floor(index / 4) * 150,
    });
  });

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    c3Nodes.forEach((node) => {
      const children = parentEdges
        .filter((edge) => edge.target === node.id)
        .map((edge) => positions.get(edge.source))
        .filter(Boolean) as Array<{ x: number; y: number }>;
      if (children.length === 0) return;
      const avgX = children.reduce((sum, pos) => sum + pos.x, 0) / children.length;
      const minY = Math.min(...children.map((pos) => pos.y));
      const next = { x: avgX, y: minY - C3_PARENT_OFFSET_Y };
      const current = positions.get(node.id);
      if (!current || current.x !== next.x || current.y !== next.y) {
        positions.set(node.id, next);
        changed = true;
      }
    });
    if (!changed) break;
  }

  return positions;
}

function buildEntityPositionMap(
  entityNodes: GraphOverviewNode[],
  graphEdges: GraphOverviewEdge[],
  anchorPositions: Map<string, { x: number; y: number }>,
  existingEntityPositions: Map<string, { x: number; y: number }>,
  locale: string,
) {
  const positions = new Map<string, { x: number; y: number }>();
  const byKind = new Map<GraphOverviewNode['node_kind'], GraphOverviewNode[]>();

  entityNodes.forEach((node) => {
    const bucket = byKind.get(node.node_kind) ?? [];
    bucket.push(node);
    byKind.set(node.node_kind, bucket);
  });

  Object.entries(ENTITY_COLUMN_X).forEach(([kind, x]) => {
    const items = (byKind.get(kind as GraphOverviewNode['node_kind']) ?? []).slice().sort((a, b) =>
      compareText(locale, `${a.code ?? ''} ${a.title ?? ''}`, `${b.code ?? ''} ${b.title ?? ''}`, { numeric: true, sensitivity: 'base' }),
    );

    items.forEach((node, index) => {
      const existing = existingEntityPositions.get(node.id);
      if (existing) {
        positions.set(node.id, existing);
        return;
      }

      const inbound = graphEdges.filter((edge) => edge.target === node.id);
      const anchorCandidates = inbound
        .map((edge) => anchorPositions.get(edge.source))
        .filter(Boolean) as Array<{ x: number; y: number }>;

      if (anchorCandidates.length > 0) {
        const avgX = anchorCandidates.reduce((sum, pos) => sum + pos.x, 0) / anchorCandidates.length;
        const avgY = anchorCandidates.reduce((sum, pos) => sum + pos.y, 0) / anchorCandidates.length;
        positions.set(node.id, {
          x: Math.max(x, avgX + 260),
          y: avgY + (index % 5) * 18,
        });
        return;
      }

      positions.set(node.id, {
        x,
        y: index * 120,
      });
    });
  });

  return positions;
}

function buildC3AnchorTypeMap(
  c3Nodes: GraphOverviewNode[],
  mappingEdges: GraphOverviewEdge[],
  parentEdges: GraphOverviewEdge[],
  serviceTypeById: Map<string, string>,
) {
  const groupedTypes = new Map<string, string[]>();
  const anchors = new Map<string, string>();

  const addType = (nodeId: string, type: string | null | undefined) => {
    const safeType = String(type ?? 'OTHER');
    if (!groupedTypes.has(nodeId)) groupedTypes.set(nodeId, []);
    groupedTypes.get(nodeId)!.push(safeType);
    const preferred = choosePreferredType(groupedTypes.get(nodeId)!);
    if (preferred) anchors.set(nodeId, preferred);
  };

  mappingEdges.forEach((edge) => {
    addType(edge.target, serviceTypeById.get(edge.source));
  });

  for (let pass = 0; pass < 4; pass += 1) {
    let changed = false;
    parentEdges.forEach((edge) => {
      const childType = anchors.get(edge.source);
      if (!childType) return;
      const before = anchors.get(edge.target);
      addType(edge.target, childType);
      if (anchors.get(edge.target) !== before) changed = true;
    });
    if (!changed) break;
  }

  c3Nodes.forEach((node) => {
    if (!anchors.has(node.id) && node.parent_uuid && anchors.has(`c3:${node.parent_uuid}`)) {
      anchors.set(node.id, anchors.get(`c3:${node.parent_uuid}`)!);
    }
  });

  return anchors;
}

function buildSwimlaneNodes(serviceNodes: Node[], c3Nodes: Node[], c3AnchorTypeMap: Map<string, string>): Node[] {
  const grouped = new Map<string, Array<{ x: number; y: number; width: number; height: number }>>();

  const addMember = (type: string, member: { x: number; y: number; width: number; height: number }) => {
    if (!grouped.has(type)) grouped.set(type, []);
    grouped.get(type)!.push(member);
  };

  serviceNodes.forEach((node) => {
    const type = String((node.data as Record<string, unknown>)?.service_type ?? 'OTHER');
    addMember(type, {
      x: node.position.x,
      y: node.position.y,
      width: Number(node.width ?? NODE_W),
      height: Number(node.height ?? NODE_H),
    });
  });

  c3Nodes.forEach((node) => {
    const type = c3AnchorTypeMap.get(node.id);
    if (!type) return;
    addMember(type, {
      x: node.position.x,
      y: node.position.y,
      width: Number(node.width ?? C3_NODE_SIZE),
      height: Number(node.height ?? C3_NODE_SIZE),
    });
  });

  return sortServiceTypes([...grouped.keys()]).map((type) => {
    const nodes = grouped.get(type) ?? [];
    const minX = Math.min(...nodes.map((node) => node.x));
    const maxX = Math.max(...nodes.map((node) => node.x + node.width));
    const minY = Math.min(...nodes.map((node) => node.y));
    const maxY = Math.max(...nodes.map((node) => node.y + node.height));
    const width = Math.max(maxX - minX + SWIMLANE_X_PADDING * 2, NODE_W + SWIMLANE_X_PADDING * 2);
    const height = Math.max(maxY - minY + SWIMLANE_Y_PADDING * 2, SWIMLANE_MIN_HEIGHT);
    const color = SERVICE_TYPE_COLOR[type] ?? DEFAULT_COLOR;

    return {
      id: `lane:${type}`,
      type: 'swimlaneNode',
      position: {
        x: minX - SWIMLANE_X_PADDING,
        y: minY - SWIMLANE_Y_PADDING,
      },
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: 0,
      data: {
        label: type,
        color,
        width,
        height,
      },
    };
  });
}

function ServiceNodeCard({ data }: { data: Record<string, unknown> }) {
  const color = GROUP_COLOR[String(data.portfolio_group ?? '')] ?? DEFAULT_COLOR;
  return (
    <div
      className={`${styles.node} ${data.selected ? styles.nodeSelected : ''}`}
      style={{ borderColor: color }}
      onClick={data.onSelect as () => void}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.nodeId} style={{ color }}>{data.service_id as string}</div>
      <div className={styles.nodeTitle}>{data.label as string}</div>
      <div className={styles.nodeStatus}>
        <StatusPill status={String(data.service_status ?? 'draft')} size="sm" />
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function C3NodeCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      className={`${styles.c3Node} ${data.selected ? styles.c3NodeSelected : ''}`}
      onClick={data.onSelect as () => void}
      title={String(data.label ?? '')}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.c3Type}>{String(data.item_type ?? 'C3')}</div>
      <div className={styles.c3Title}>{String(data.shortLabel ?? data.label ?? '')}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function EntityNodeCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      className={`${styles.node} ${data.selected ? styles.nodeSelected : ''}`}
      onClick={data.onSelect as () => void}
      title={String(data.label ?? '')}
      style={{ borderColor: 'var(--color-text-secondary)' }}
    >
      <Handle type="target" position={Position.Left} />
      <div className={styles.nodeId}>{String(data.code ?? '')}</div>
      <div className={styles.nodeTitle}>{String(data.label ?? '')}</div>
      <div className={styles.meta}>{String(data.nodeKindLabel ?? data.node_kind ?? '')}</div>
      {data.status ? <div className={styles.meta}>{String(data.status)}</div> : null}
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function SwimlaneNodeCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div
      className={styles.swimlaneNode}
      style={{
        width: Number(data.width ?? 0),
        height: Number(data.height ?? 0),
        borderColor: String(data.color ?? DEFAULT_COLOR),
        background: `${String(data.color ?? DEFAULT_COLOR)}14`,
      }}
    >
      <span className={styles.swimlaneNodeLabel} style={{ color: String(data.color ?? DEFAULT_COLOR) }}>
        {String(data.label ?? '')}
      </span>
    </div>
  );
}

function FlavourNodeCard({ data }: { data: Record<string, unknown> }) {
  return (
    <div style={{
      background: 'var(--color-bg-surface)ae6', border: '1px solid var(--color-warning)', borderRadius: 6,
      padding: '4px 8px', fontSize: '0.7rem', minWidth: 110, textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ fontWeight: 600, color: 'var(--color-warning)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>
        {String(data.label ?? '')}
      </div>
      {data.price != null && (
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.65rem' }}>{String(data.price)}</div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  serviceNode: ServiceNodeCard as NodeTypes[string],
  c3Node: C3NodeCard as NodeTypes[string],
  entityNode: EntityNodeCard as NodeTypes[string],
  swimlaneNode: SwimlaneNodeCard as NodeTypes[string],
  flavourNode: FlavourNodeCard as NodeTypes[string],
};

export default function GlobalGraphPage() {
  const { c3Visible } = useInstallStatus();
  const locale = useLocale();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [portfolioFilter, setPortfolioFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showC3, setShowC3] = useState(true);
  const [showFlavours, setShowFlavours] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(true);
  const [compactPayload, setCompactPayload] = useState(false);
  const [miniMapEnabled, setMiniMapEnabled] = useState(false);
  const [edgeType, setEdgeType] = useState<'smoothstep' | 'straight'>('straight');
  const [lineStyleMode, setLineStyleMode] = useState<'auto' | 'solid' | 'dashed'>('auto');
  const [selectedNode, setSelectedNode] = useState<GraphOverviewNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<GraphOverviewEdge | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set(ALL_RELATION_TYPES));
  const [activeDomains, setActiveDomains] = useState<Set<string>>(new Set());
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const { data, isLoading, error } = useGraphOverview({ compact: compactPayload, includeC3: showC3 });
  const { data: networkDomains } = useNetworkDomains();
  // Flavour nodes are loaded only when showFlavours is enabled.
  const { data: allFlavours } = useSWR<Array<{
    id: number; service_id: string; flavour_code: string;
    title: string | null; unit_price: number | null; currency: string | null;
  }>>(
    showFlavours ? '/api/v1/flavours?all=1' : null,
    apiFetch,
    { revalidateOnFocus: false }
  );

  const domainColorMap = useMemo(
    () => new Map((networkDomains ?? []).map((domain) => [domain.code, domain.color_hex ?? undefined])),
    [networkDomains],
  );

  useEffect(() => {
    if (!c3Visible) {
      setShowC3(false);
    }
  }, [c3Visible]);

  const allNodes = data?.nodes ?? [];
  const allEdges = data?.edges ?? [];

  const serviceNodes = useMemo(() => allNodes.filter((node) => node.node_kind === 'service'), [allNodes]);
  const capabilityNodes = useMemo(() => allNodes.filter((node) => node.node_kind === 'c3_capability'), [allNodes]);
  const c3EntityNodes = useMemo(() => allNodes.filter((node) => node.node_kind !== 'service' && node.node_kind !== 'c3_capability'), [allNodes]);
  const portfolioOptions = useMemo(
    () => [...new Set(serviceNodes.map((node) => node.portfolio_group).filter(Boolean) as string[])].sort((left, right) => compareText(locale, left, right)),
    [locale, serviceNodes],
  );
  const statusOptions = useMemo(
    () => [...new Set(serviceNodes.map((node) => node.service_status).filter(Boolean) as string[])].sort((left, right) => compareText(locale, left, right)),
    [locale, serviceNodes],
  );
  const typeOptions = useMemo(
    () => [...new Set(serviceNodes.map((node) => node.service_type).filter(Boolean) as string[])].sort((left, right) => compareText(locale, left, right)),
    [locale, serviceNodes],
  );
  const domainOptions = useMemo(
    () => (networkDomains?.map((domain) => domain.code) ?? ['NEXUS', 'VERTEX', 'ORBIT', 'PULSE', 'RELAY', 'CLOUD', 'GRID', 'PRISM', 'HELIX', 'ZENITH', 'APEX', 'VORTEX', 'MATRIX']),
    [networkDomains],
  );

  const visibleServices = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return serviceNodes.filter((node) => {
      if (statusFilter && node.service_status !== statusFilter) return false;
      if (portfolioFilter && node.portfolio_group !== portfolioFilter) return false;
      if (typeFilter && node.service_type !== typeFilter) return false;
      if (activeDomains.size > 0) {
        const domains = String(node.available_on ?? '').split(',').map((item) => item.trim()).filter(Boolean);
        if (![...activeDomains].every((domain) => domains.includes(domain))) return false;
      }
      if (!q) return true;
      return (
        String(node.service_id ?? '').toLowerCase().includes(q) ||
        String(node.title ?? '').toLowerCase().includes(q)
      );
    });
  }, [serviceNodes, statusFilter, portfolioFilter, typeFilter, activeDomains, deferredSearch]);

  const visibleServiceIds = useMemo(
    () => new Set(visibleServices.map((node) => node.id)),
    [visibleServices],
  );

  const visibleMappingEdges = useMemo(
    () => allEdges.filter((edge) => edge.edge_kind === 'service_c3_mapping' && visibleServiceIds.has(edge.source)),
    [allEdges, visibleServiceIds],
  );

  const visibleC3Ids = useMemo(() => {
    const ids = new Set<string>();

    // Build parent/child lookup maps from c3_parent edges (source = child, target = parent)
    const c3ParentEdges = allEdges.filter((edge) => edge.edge_kind === 'c3_parent');
    const parentOf = new Map<string, string>();
    const childrenOf = new Map<string, string[]>();
    c3ParentEdges.forEach((edge) => {
      parentOf.set(edge.source, edge.target);
      if (!childrenOf.has(edge.target)) childrenOf.set(edge.target, []);
      childrenOf.get(edge.target)!.push(edge.source);
    });

    const addWithFullTree = (nodeId: string) => {
      if (ids.has(nodeId)) return;
      ids.add(nodeId);
      // Walk up to all ancestors
      let current = nodeId;
      while (parentOf.has(current)) {
        const parent = parentOf.get(current)!;
        if (ids.has(parent)) break;
        ids.add(parent);
        current = parent;
      }
      // Walk down to all descendants (BFS)
      const queue = [nodeId];
      while (queue.length > 0) {
        const cur = queue.shift()!;
        for (const child of childrenOf.get(cur) ?? []) {
          if (!ids.has(child)) {
            ids.add(child);
            queue.push(child);
          }
        }
      }
    };

    visibleMappingEdges.forEach((edge) => {
      addWithFullTree(edge.target);
    });

    if (deferredSearch.trim()) {
      const q = deferredSearch.trim().toLowerCase();
      capabilityNodes.forEach((node) => {
        if (String(node.title ?? '').toLowerCase().includes(q) || String(node.c3_uuid ?? '').toLowerCase().includes(q)) {
          addWithFullTree(node.id);
        }
      });
    }
    return ids;
  }, [visibleMappingEdges, capabilityNodes, allEdges, deferredSearch]);

  const visibleC3Nodes = useMemo(
    () => capabilityNodes.filter((node) => visibleC3Ids.has(node.id)),
    [capabilityNodes, visibleC3Ids],
  );
  const visibleServiceTypeById = useMemo(
    () => new Map(visibleServices.map((node) => [node.id, node.service_type ?? 'OTHER'])),
    [visibleServices],
  );

  const layoutMap = useMemo(() => layoutServiceNodes(visibleServices), [visibleServices]);
  const visibleParentEdges = useMemo(
    () => allEdges.filter((edge) => edge.edge_kind === 'c3_parent' && visibleC3Ids.has(edge.source) && visibleC3Ids.has(edge.target)),
    [allEdges, visibleC3Ids],
  );
  const c3AnchorTypeMap = useMemo(
    () => buildC3AnchorTypeMap(visibleC3Nodes, visibleMappingEdges, visibleParentEdges, visibleServiceTypeById),
    [visibleC3Nodes, visibleMappingEdges, visibleParentEdges, visibleServiceTypeById],
  );

  const visibleCapabilityEntityEdges = useMemo(
    () => allEdges.filter((edge) =>
      ['capability_application', 'capability_tin', 'capability_data_object', 'capability_c3_service'].includes(edge.edge_kind)
      && visibleC3Ids.has(edge.source)
    ),
    [allEdges, visibleC3Ids],
  );

  const visibleTinIds = useMemo(
    () => new Set(visibleCapabilityEntityEdges.filter((edge) => edge.edge_kind === 'capability_tin').map((edge) => edge.target)),
    [visibleCapabilityEntityEdges],
  );

  const visibleTinEntityEdges = useMemo(
    () => allEdges.filter((edge) =>
      ['tin_application', 'tin_data_object', 'tin_c3_service'].includes(edge.edge_kind)
      && visibleTinIds.has(edge.source)
    ),
    [allEdges, visibleTinIds],
  );

  const visibleEntityIds = useMemo(() => {
    const ids = new Set<string>();
    visibleCapabilityEntityEdges.forEach((edge) => ids.add(edge.target));
    visibleTinEntityEdges.forEach((edge) => {
      ids.add(edge.source);
      ids.add(edge.target);
    });
    return ids;
  }, [visibleCapabilityEntityEdges, visibleTinEntityEdges]);

  const visibleC3EntityNodes = useMemo(
    () => c3EntityNodes.filter((node) => visibleEntityIds.has(node.id)),
    [c3EntityNodes, visibleEntityIds],
  );

  const rfNodes = useMemo<Node[]>(() => {
    const serviceRfNodes = visibleServices.map((node) => ({
      id: node.id,
      type: 'serviceNode',
      position: {
        x: node.graph_x ?? layoutMap.get(node.id)?.x ?? 0,
        y: node.graph_y ?? layoutMap.get(node.id)?.y ?? 0,
      },
      zIndex: 2,
      data: {
        label: node.title,
        service_id: node.service_id,
        service_status: node.service_status,
        portfolio_group: node.portfolio_group,
        service_type: node.service_type,
        node_kind: node.node_kind,
        code: node.service_id,
        selected: selectedNode?.id === node.id,
        onSelect: () => {
          setSelectedNode(node);
          setSelectedEdge(null);
        },
      },
    }));

    const servicePositionMap = new Map(serviceRfNodes.map((node) => [node.id, node.position]));
    const capabilityPositionMap = buildCapabilityPositionMap(visibleC3Nodes, visibleMappingEdges, visibleParentEdges, servicePositionMap, new Map());

    const c3RfNodes = visibleC3Nodes.map((node) => ({
      id: node.id,
      type: 'c3Node',
      position: capabilityPositionMap.get(node.id) ?? { x: 0, y: 0 },
      zIndex: 3,
      data: {
        label: node.title,
        shortLabel: String(node.title ?? '').slice(0, 24),
        item_type: node.item_type,
        node_kind: node.node_kind,
        c3_uuid: node.c3_uuid,
        code: node.code,
        selected: selectedNode?.id === node.id,
        onSelect: () => {
          setSelectedNode(node);
          setSelectedEdge(null);
        },
      },
    }));

    const anchorPositionMap = new Map<string, { x: number; y: number }>([
      ...servicePositionMap.entries(),
      ...capabilityPositionMap.entries(),
    ]);
    const entityPositionMap = buildEntityPositionMap(
      visibleC3EntityNodes,
      [...visibleCapabilityEntityEdges, ...visibleTinEntityEdges],
      anchorPositionMap,
      new Map(),
      locale,
    );

    const entityRfNodes = visibleC3EntityNodes.map((node) => ({
      id: node.id,
      type: 'entityNode',
      position: entityPositionMap.get(node.id) ?? { x: 0, y: 0 },
      zIndex: 2,
      data: {
        label: node.title,
        code: node.code,
        status: node.status,
        node_kind: node.node_kind,
        entity_uuid: node.entity_uuid,
        nodeKindLabel: node.node_kind.replace('c3_', '').replace(/_/g, ' '),
        selected: selectedNode?.id === node.id,
        onSelect: () => {
          setSelectedNode(node);
          setSelectedEdge(null);
        },
      },
    }));

    // ── Flavour nodes (leaf nodes under each visible service) ──────────────
    const flavourRfNodes: Node[] = [];
    if (showFlavours && allFlavours) {
      const FLAV_W = 130; const FLAV_H = 40; const FLAV_GAP = 8;
      // Group flavours by service_id.
      const flavoursByService = new Map<string, typeof allFlavours>();
      allFlavours.forEach(f => {
        const svcNodeId = `svc:${f.service_id}`;
        if (!visibleServiceIds.has(svcNodeId)) return;
        if (!flavoursByService.has(svcNodeId)) flavoursByService.set(svcNodeId, []);
        flavoursByService.get(svcNodeId)!.push(f);
      });
      flavoursByService.forEach((flavours, svcNodeId) => {
        const svcNode = serviceRfNodes.find(n => n.id === svcNodeId);
        if (!svcNode) return;
        const baseX = svcNode.position.x - ((flavours.length - 1) * (FLAV_W + FLAV_GAP)) / 2;
        const baseY = svcNode.position.y + 90;
        flavours.forEach((f, i) => {
          flavourRfNodes.push({
            id: `flv:${f.id}`,
            type: 'flavourNode',
            position: { x: baseX + i * (FLAV_W + FLAV_GAP), y: baseY },
            draggable: false,
            zIndex: 1,
            data: {
              label: f.title ?? f.flavour_code,
              price: f.unit_price != null ? `${f.unit_price} ${f.currency ?? ''}`.trim() : null,
              service_id: f.service_id,
              node_kind: 'flavour',
            },
          });
        });
      });
    }

    return [...serviceRfNodes, ...c3RfNodes, ...entityRfNodes, ...flavourRfNodes];
  }, [
    visibleServices,
    visibleC3Nodes,
    visibleC3EntityNodes,
    visibleMappingEdges,
    visibleParentEdges,
    visibleCapabilityEntityEdges,
    visibleTinEntityEdges,
    layoutMap,
    locale,
    selectedNode,
    showFlavours,
    allFlavours,
    visibleServiceIds,
  ]);

  const visibleRawEdges = useMemo(
    () => allEdges.filter((edge) => {
      if (edge.edge_kind === 'service_relation') {
        return visibleServiceIds.has(edge.source) && visibleServiceIds.has(edge.target) && activeTypes.has(edge.relation_type);
      }
      if (edge.edge_kind === 'service_c3_mapping') {
        return visibleServiceIds.has(edge.source) && visibleC3Ids.has(edge.target);
      }
      if (edge.edge_kind === 'c3_parent') {
        return visibleC3Ids.has(edge.source) && visibleC3Ids.has(edge.target);
      }
      if (['capability_application', 'capability_tin', 'capability_data_object', 'capability_c3_service'].includes(edge.edge_kind)) {
        return visibleC3Ids.has(edge.source) && visibleEntityIds.has(edge.target);
      }
      if (['tin_application', 'tin_data_object', 'tin_c3_service'].includes(edge.edge_kind)) {
        return visibleTinIds.has(edge.source) && visibleEntityIds.has(edge.target);
      }
      return false;
    }),
    [allEdges, visibleServiceIds, visibleC3Ids, visibleEntityIds, visibleTinIds, activeTypes],
  );

  const performanceMode = useMemo(
    () => (visibleServices.length + visibleC3Nodes.length + visibleC3EntityNodes.length) >= 140 || visibleRawEdges.length >= 240,
    [visibleServices.length, visibleC3Nodes.length, visibleC3EntityNodes.length, visibleRawEdges.length],
  );

  const rfEdges = useMemo<Edge[]>(() => {
    return visibleRawEdges.map((edge) => {
        const visual = resolveServiceGraphEdgeVisual(edge);
        const dash = applyLineStyleMode(visual, lineStyleMode).dash
          ?? (edge.edge_kind === 'service_relation' && !edge.is_verified ? '6 3' : undefined);
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          type: edgeType,
          label: (!showEdgeLabels || performanceMode) ? undefined : (edge.edge_kind === 'service_c3_mapping' ? edge.mapping_type_code ?? edge.relation_type : edge.relation_type),
          markerEnd: { type: MarkerType.ArrowClosed, color: visual.color },
          style: {
            stroke: visual.color,
            strokeWidth: edge.edge_kind === 'service_relation' && edge.is_mandatory ? Math.max(visual.width ?? 1.8, 3) : (visual.width ?? 1.8),
            strokeDasharray: dash,
          },
          labelStyle: (!showEdgeLabels || performanceMode) ? undefined : { fontSize: 10, fill: visual.color, fontWeight: 600 },
          labelBgStyle: (!showEdgeLabels || performanceMode) ? undefined : { fill: 'var(--color-bg-surface)', fillOpacity: 0.88 },
          data: { raw: edge },
        };
      });
  }, [edgeType, lineStyleMode, performanceMode, showEdgeLabels, visibleRawEdges]);

  // Flavour hrany (service → flavour leaf)
  const flavourEdges = useMemo<Edge[]>(() => {
    if (!showFlavours || !allFlavours) return [];
    return allFlavours
      .filter(f => visibleServiceIds.has(`svc:${f.service_id}`))
      .map(f => ({
        id: `flv-edge:${f.id}`,
        source: `svc:${f.service_id}`,
        target: `flv:${f.id}`,
        type: 'bezier' as Edge['type'],
        style: { stroke: 'var(--color-warning)', strokeWidth: 1.2, strokeDasharray: '4 3' },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--color-warning)' },
      }));
  }, [showFlavours, allFlavours, visibleServiceIds]);

  const [nodes, setNodes] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes((currentNodes) => {
      const currentPositions = new Map(currentNodes.map((node) => [node.id, node.position]));
      return rfNodes.map((node) => ({
        ...node,
        position: currentPositions.get(node.id) ?? node.position,
      }));
    });
  }, [rfNodes, setNodes]);
  useEffect(() => { setEdges([...rfEdges, ...flavourEdges]); }, [rfEdges, flavourEdges, setEdges]);

  const handleNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((currentNodes) => applyNodeChanges(changes, currentNodes));
  }, [setNodes]);

  const toggleDomain = useCallback((domain: string) => {
    setActiveDomains((prev) => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  }, []);

  const toggleRelationType = useCallback((type: string) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }, []);

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    const raw = node.data as unknown as GraphOverviewNode & {
      node_kind?: string;
      c3_uuid?: string | null;
      code?: string | null;
      service_id?: string | null;
    };
    const kind = String(raw.node_kind ?? '');
    const code = String(raw.code ?? '').trim();

    if (kind === 'service') {
      window.location.href = `/services/${String(raw.service_id ?? '').trim()}`;
      return;
    }
    if (kind === 'c3_capability' && raw.c3_uuid) {
      window.location.href = `/c3/${encodeURIComponent(String(raw.c3_uuid))}`;
      return;
    }
    if (kind === 'c3_application' && code) {
      window.location.href = `/c3/applications/${encodeURIComponent(code)}`;
      return;
    }
    if (kind === 'c3_tin' && code) {
      window.location.href = `/c3/technology-interactions/${encodeURIComponent(code)}`;
      return;
    }
    if (kind === 'c3_data_object' && code) {
      window.location.href = `/c3/data-objects/${encodeURIComponent(code)}`;
      return;
    }
    if (kind === 'c3_service' && code) {
      window.location.href = `/c3/services/${encodeURIComponent(code)}`;
    }
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedEdge((edge.data as { raw?: GraphOverviewEdge } | undefined)?.raw ?? null);
    setSelectedNode(null);
  }, []);

  const handleSaveLayout = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const positions = nodes
        .filter((node) => node.id.startsWith('svc:'))
        .map((node) => ({
          node_kind: 'service',
          service_id: node.id.replace('svc:', ''),
          x: node.position.x,
          y: node.position.y,
        }));

      const res = await fetch('/api/v1/graph/overview/layout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ positions }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSaveMsg('Pozice grafu byly uloženy.');
    } catch (saveError: unknown) {
      setSaveMsg(saveError instanceof Error ? saveError.message : 'Uložení selhalo');
    } finally {
      setSaving(false);
    }
  }, [nodes]);

  if (isLoading) return <div className={styles.state}>Načítám graf…</div>;
  if (error) return <div className={styles.stateError}>Graf nedostupný — zkontroluj middleware.</div>;

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.railSection}>
          <input
            className={styles.searchInput}
            type="search"
            placeholder="Hledat služby nebo C3…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <FilterGroup label="Status">
          <select className={styles.selectInput} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">Vše</option>
            {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <button type="button" className={styles.saveButtonInline} onClick={handleSaveLayout} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </FilterGroup>

        <FilterGroup label="Portfolio">
          <select className={styles.selectInput} value={portfolioFilter} onChange={(event) => setPortfolioFilter(event.target.value)}>
            <option value="">Vše</option>
            {portfolioOptions.map((portfolio) => <option key={portfolio} value={portfolio}>{portfolio}</option>)}
          </select>
        </FilterGroup>

        <FilterGroup label="Type">
          <select className={styles.selectInput} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">Vše</option>
            {typeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
          </select>
        </FilterGroup>

        <FilterGroup label="Domains">
          <div className={styles.domainFilterGrid}>
            {domainOptions.map((domain) => {
              const active = activeDomains.has(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  className={`${styles.domainFilterChip} ${active ? styles.domainFilterChipActive : ''}`}
                  style={{
                    borderColor: domainColorMap.get(domain) ?? undefined,
                    background: active ? (domainColorMap.get(domain) ?? 'var(--color-bg-canvas)') : undefined,
                  }}
                  onClick={() => toggleDomain(domain)}
                >
                  <span>{domain}</span>
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup label="Typy vazeb">
          <div className={styles.typeList}>
            {ALL_RELATION_TYPES.map((type) => {
              const active = activeTypes.has(type);
              const style = SERVICE_RELATION_VISUAL[type];
              return (
                <button
                  key={type}
                  type="button"
                  className={`${styles.typeBtn} ${active ? styles.typeBtnOn : ''}`}
                  style={active ? { borderColor: style.color, color: style.color } : undefined}
                  onClick={() => toggleRelationType(type)}
                >
                  {type.replace(/_/g, ' ')}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup label="Typ spojnic">
          <div className={styles.typeList}>
            <button
              type="button"
              className={`${styles.typeBtn} ${edgeType === 'straight' ? styles.typeBtnOn : ''}`}
              onClick={() => setEdgeType('straight')}
            >
              Přímé
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${edgeType === 'smoothstep' ? styles.typeBtnOn : ''}`}
              onClick={() => setEdgeType('smoothstep')}
            >
              Zaoblené
            </button>
          </div>
        </FilterGroup>

        <FilterGroup label="Styl čar">
          <div className={styles.typeList}>
            {[
              { value: 'auto', label: 'Dle vazby' },
              { value: 'solid', label: 'Plné' },
              { value: 'dashed', label: 'Čárkované' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                className={`${styles.typeBtn} ${lineStyleMode === option.value ? styles.typeBtnOn : ''}`}
                onClick={() => setLineStyleMode(option.value as 'auto' | 'solid' | 'dashed')}
              >
                {option.label}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup label="Zobrazení">
          {c3Visible ? (
            <label className={styles.switchRow}>
              <input type="checkbox" checked={showC3} onChange={(event) => setShowC3(event.target.checked)} />
              <span>C3 Taxonomy</span>
            </label>
          ) : (
            <div className={styles.performanceNote}>C3 modul není v této instalaci aktivní.</div>
          )}
          <label className={styles.switchRow}>
            <input type="checkbox" checked={showFlavours} onChange={(event) => setShowFlavours(event.target.checked)} />
            <span>Flavours (pricing)</span>
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={showEdgeLabels} onChange={(event) => setShowEdgeLabels(event.target.checked)} />
            <span>Edge labels</span>
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={compactPayload} onChange={(event) => setCompactPayload(event.target.checked)} />
            <span>Compact payload</span>
          </label>
          <label className={styles.switchRow}>
            <input type="checkbox" checked={miniMapEnabled} onChange={(event) => setMiniMapEnabled(event.target.checked)} />
            <span>MiniMap</span>
          </label>
          <button
            type="button"
            className={styles.saveButtonInline}
            onClick={() => exportGraphToPdf(graphCanvasRef.current, 'Service Catalogue Graph')}
          >
            Export do PDF
          </button>
          {performanceMode && <div className={styles.performanceNote}>Výkonový režim: edge labels a MiniMap jsou při hustém grafu omezené.</div>}
          {saveMsg && <div className={styles.saveMsg}>{saveMsg}</div>}
        </FilterGroup>
      </aside>

      <main className={styles.main}>
        <div className={styles.header}>
          <h1 className={styles.title}>Dependency Graph</h1>
          <nav className={styles.graphTabs} aria-label="Service graph views">
            <span className={`${styles.graphTab} ${styles.graphTabActive}`}>Canvas</span>
            <Link className={styles.graphTab} href="/services/dependency-flow">Dependency flow</Link>
            <Link className={styles.graphTab} href="/services/consolidation-matrix">Consolidation matrix</Link>
          </nav>
          <span className={styles.meta}>
            {visibleServices.length} služeb · {visibleC3Nodes.length + visibleC3EntityNodes.length} C3 objektů · {rfEdges.length} vazeb
          </span>
          {performanceMode && <span className={styles.performanceBadge}>performance mode</span>}
        </div>

        <div className={styles.canvasWrap}>
          <div className={styles.canvas} ref={graphCanvasRef}>
            <div className={styles.flowSurface}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeDoubleClick={onNodeDoubleClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.16 }}
                minZoom={0.05}
                maxZoom={2}
                onlyRenderVisibleElements
                nodesFocusable={false}
                edgesFocusable={false}
              >
                <Background gap={24} size={1} />
                <Controls />
                {miniMapEnabled && !performanceMode && (
                  <MiniMap
                    nodeColor={(node) => {
                      const nodeKind = String(node.data?.node_kind ?? '');
                      if (nodeKind === 'service') {
                        return GROUP_COLOR[String(node.data?.portfolio_group ?? '')] ?? DEFAULT_COLOR;
                      }
                      return ({
                        c3_capability: 'var(--color-success)',
                        c3_tin: 'var(--color-info)',
                        c3_application: 'var(--color-success)',
                        c3_data_object: 'var(--color-warning)',
                        c3_service: 'var(--color-domain-relay)',
                        flavour: 'var(--color-warning)',
                      } as Record<string, string>)[nodeKind] ?? DEFAULT_COLOR;
                    }}
                    maskColor="rgba(0,0,0,0.04)"
                  />
                )}
              </ReactFlow>
            </div>
          </div>

          {(selectedNode || selectedEdge) && (
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelTitle}>{selectedNode ? 'Detail uzlu' : 'Detail vazby'}</span>
                <button className={styles.panelClose} onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}>✕</button>
              </div>
              <div className={styles.panelBody}>
                {selectedNode && selectedNode.node_kind === 'service' && (
                  <>
                    <PanelRow label="Service ID">{selectedNode.service_id ?? '—'}</PanelRow>
                    <PanelRow label="Title">{selectedNode.title}</PanelRow>
                    <PanelRow label="Status"><StatusPill status={selectedNode.service_status ?? 'draft'} size="sm" /></PanelRow>
                    <PanelRow label="Type">{selectedNode.service_type ?? '—'}</PanelRow>
                    <PanelRow label="Portfolio">{selectedNode.portfolio_group ?? '—'}</PanelRow>
                    <PanelRow label="Domains">{selectedNode.available_on ?? '—'}</PanelRow>
                    <a href={`/services/${selectedNode.service_id}`} className={styles.panelLink}>Detail služby →</a>
                  </>
                )}

                {selectedNode && selectedNode.node_kind !== 'service' && (
                  <>
                    <PanelRow label="Typ">{selectedNode.node_kind.replace('c3_', '').replace(/_/g, ' ')}</PanelRow>
                    <PanelRow label="Kód">{selectedNode.code ?? '—'}</PanelRow>
                    <PanelRow label="Title">{selectedNode.title}</PanelRow>
                    {selectedNode.item_type ? <PanelRow label="Item Type">{selectedNode.item_type}</PanelRow> : null}
                    {selectedNode.parent_uuid ? <PanelRow label="Parent">{selectedNode.parent_uuid}</PanelRow> : null}
                    {selectedNode.completeness_status ? <PanelRow label="Completeness">{selectedNode.completeness_status}</PanelRow> : null}
                    {selectedNode.c3_uuid && <a href={`/c3/${selectedNode.c3_uuid}`} className={styles.panelLink}>Detail C3 →</a>}
                    {selectedNode.node_kind === 'c3_application' && selectedNode.code && <a href={`/c3/applications/${encodeURIComponent(selectedNode.code)}`} className={styles.panelLink}>Detail Application →</a>}
                    {selectedNode.node_kind === 'c3_tin' && selectedNode.code && <a href={`/c3/technology-interactions/${encodeURIComponent(selectedNode.code)}`} className={styles.panelLink}>Detail TIN →</a>}
                    {selectedNode.node_kind === 'c3_data_object' && selectedNode.code && <a href={`/c3/data-objects/${encodeURIComponent(selectedNode.code)}`} className={styles.panelLink}>Detail Data Object →</a>}
                    {selectedNode.node_kind === 'c3_service' && selectedNode.code && <a href={`/c3/services/${encodeURIComponent(selectedNode.code)}`} className={styles.panelLink}>Detail C3 Service →</a>}
                  </>
                )}

                {selectedEdge && (
                  <>
                    <PanelRow label="Source">{selectedEdge.source}</PanelRow>
                    <PanelRow label="Target">{selectedEdge.target}</PanelRow>
                    <PanelRow label="Typ">{selectedEdge.mapping_type_code ?? selectedEdge.relation_type}</PanelRow>
                    <PanelRow label="Kind">{selectedEdge.edge_kind}</PanelRow>
                    <PanelRow label="Verified">{selectedEdge.is_verified ? 'Ano' : 'Ne'}</PanelRow>
                    {selectedEdge.relation_note && <PanelRow label="Poznámka">{selectedEdge.relation_note}</PanelRow>}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.railSection}>
      <div className={styles.filterLabel}>{label}</div>
      <div className={styles.filterOptions}>{children}</div>
    </div>
  );
}

function PanelRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className={styles.panelRow}>
      <span className={styles.panelKey}>{label}</span>
      <span className={styles.panelVal}>{children}</span>
    </div>
  );
}
