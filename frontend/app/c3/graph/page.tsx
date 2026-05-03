'use client';

import Link from '@/app/components/AppLink';
import dynamic from 'next/dynamic';
import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { apiFetch } from '@/features/services/api/services.api';
import { useC3RelationGraph } from '@/features/services/hooks/useServices';
import type { C3RelationGraphEdge, C3RelationGraphNode } from '@/features/services/model/service.types';
import { exportGraphToPdf } from '@/features/graph/exportGraphPdf';
import { C3_ROUTES, readStoredC3TaxonomySort } from '../../lib/c3Routes';
import { GraphWorkspace } from '@/app/components/layout-v2';
import styles from '../../graph/overview.module.css';

const NODE_KIND_ORDER: C3RelationGraphNode['node_kind'][] = [
  'c3_capability',
  'c3_tin',
  'c3_application',
  'c3_data_object',
  'c3_service',
];

const NODE_KIND_LABEL: Record<C3RelationGraphNode['node_kind'], string> = {
  c3_capability: 'Capability',
  c3_tin: 'Technology Interaction',
  c3_application: 'Application',
  c3_data_object: 'Data Object',
  c3_service: 'C3 Service',
};

const NODE_KIND_COLOR: Record<C3RelationGraphNode['node_kind'], string> = {
  c3_capability: 'var(--color-info)',
  c3_tin: 'var(--color-info)',
  c3_application: 'var(--color-success)',
  c3_data_object: 'var(--color-warning)',
  c3_service: 'var(--color-domain-relay)',
};

const DOMAIN_TO_ITEM_TYPE: Record<string, string> = {
  BusinessProcesses: 'BP',
  BusinessRoles: 'BR',
  Capabilities: 'CP',
  COIServices: 'CI',
  CommunicationsServices: 'CO',
  CoreServices: 'CR',
  InformationProducts: 'IP',
  UserApplications: 'UA',
};

const AUTO_RENDER_NODE_LIMIT = 20;
const COMPACT_RENDER_NODE_LIMIT = 80;

const LazyC3RelationFlowCanvas = dynamic(
  () => import('@/features/c3/components/C3RelationFlowCanvas').then((mod) => mod.C3RelationFlowCanvas),
  {
    ssr: false,
    loading: () => <div className={styles.state}>Načítám canvas grafu…</div>,
  },
);

interface CapabilityDomain {
  code: string;
  heading_color: string;
  background_color: string;
  label: string;
  sort_order: number;
}

interface CapabilityMapItem {
  page_id: string;
  title: string;
  level: number;
  parent_id: string | null;
  domain_code: string;
  linked_c3_uuid?: string | null;
}

interface CapabilityMapResponse {
  domains: CapabilityDomain[];
  items: CapabilityMapItem[];
}

export default function PublicC3GraphPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState('');
  const [selectedDomain, setSelectedDomain] = useState('');
  const [selectedL3PageId, setSelectedL3PageId] = useState('');
  const [selectedNode, setSelectedNode] = useState<C3RelationGraphNode | null>(null);
  const [selectedEdge, setSelectedEdge] = useState<C3RelationGraphEdge | null>(null);
  const [renderGraph, setRenderGraph] = useState(false);
  const [edgeType, setEdgeType] = useState<'smoothstep' | 'straight'>('straight');
  const [lineStyleMode, setLineStyleMode] = useState<'auto' | 'solid' | 'dashed'>('auto');
  const [listHref, setListHref] = useState<string>(C3_ROUTES.list);
  const graphCanvasRef = useRef<HTMLDivElement | null>(null);
  const deferredSearch = useDeferredValue(search);
  const {
    data: capabilityMap,
    isLoading: isCapabilityMapLoading,
    error: capabilityMapError,
  } = useSWR<CapabilityMapResponse>('/api/v1/taxonomy/c3/capability-map-spiral7', apiFetch, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (!capabilityMap?.domains?.length) return;
    const validDomainCodes = new Set(capabilityMap.domains.map((domain) => domain.code));
    const fromQuery = searchParams?.get('domain') ?? '';
    const fallback = capabilityMap.domains[0]?.code ?? '';
    setSelectedDomain((current) => {
      if (current && validDomainCodes.has(current)) return current;
      if (fromQuery && validDomainCodes.has(fromQuery)) return fromQuery;
      return fallback;
    });
  }, [capabilityMap?.domains, searchParams]);

  useEffect(() => {
    const l3FromQuery = searchParams?.get('l3') ?? '';
    if (l3FromQuery) setSelectedL3PageId(l3FromQuery);
  }, [searchParams]);

  const sortedDomains = useMemo(
    () =>
      (Array.isArray(capabilityMap?.domains) ? [...capabilityMap.domains] : []).sort(
        (a, b) => a.sort_order - b.sort_order || String(a.label ?? '').localeCompare(String(b.label ?? ''), 'cs'),
      ),
    [capabilityMap?.domains],
  );

  const effectiveDomain = selectedDomain || sortedDomains[0]?.code || '';

  useEffect(() => {
    const params = new URLSearchParams();
    const taxonomyItemType = DOMAIN_TO_ITEM_TYPE[effectiveDomain] ?? effectiveDomain;
    if (taxonomyItemType) params.set('item_type', taxonomyItemType);
    const storedSort = readStoredC3TaxonomySort();
    if (storedSort?.sort) {
      params.set('sort', storedSort.sort);
      params.set('dir', storedSort.dir);
    }
    setListHref(params.toString() ? `${C3_ROUTES.list}?${params.toString()}` : C3_ROUTES.list);
  }, [effectiveDomain]);

  const { data, isLoading, error } = useC3RelationGraph({
    search: deferredSearch || undefined,
    domainCode: effectiveDomain || undefined,
    l3PageId: selectedL3PageId || undefined,
    enabled: Boolean(capabilityMap?.domains?.length && effectiveDomain),
  });

  const l3Options = useMemo(
    () =>
      (Array.isArray(capabilityMap?.items) ? [...capabilityMap.items] : [])
        .filter((item) => item.domain_code === effectiveDomain && item.level === 3)
        .sort((a, b) => String(a.title ?? '').localeCompare(String(b.title ?? ''), 'cs')),
    [capabilityMap?.items, effectiveDomain],
  );

  const graphNodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const graphEdges = Array.isArray(data?.edges) ? data.edges : [];

  useEffect(() => {
    if (!effectiveDomain) return;
    if (!selectedL3PageId) return;
    if (!l3Options.some((item) => item.page_id === selectedL3PageId)) {
      setSelectedL3PageId('');
    }
  }, [effectiveDomain, l3Options, selectedL3PageId]);

  const nodeCounts = useMemo(() => {
    const counts = new Map<C3RelationGraphNode['node_kind'], number>();
    NODE_KIND_ORDER.forEach((kind) => counts.set(kind, 0));
    graphNodes.forEach((node) => counts.set(node.node_kind, (counts.get(node.node_kind) ?? 0) + 1));
    return counts;
  }, [graphNodes]);

  const edgeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    graphEdges.forEach((edge) => counts.set(edge.edge_kind, (counts.get(edge.edge_kind) ?? 0) + 1));
    return counts;
  }, [graphEdges]);

  const openNode = useCallback((node: C3RelationGraphNode) => {
    const kind = String(node.node_kind ?? '');
    const code = String(node.code ?? '');
    if (kind === 'c3_capability') {
      const uuid = String(node.c3_uuid ?? '').trim();
      if (uuid) router.push(`/c3/${uuid}`);
      return;
    }
    if (kind === 'c3_application') router.push(`/c3/applications/${encodeURIComponent(code)}`);
    if (kind === 'c3_tin') router.push(`/c3/technology-interactions/${encodeURIComponent(code)}`);
    if (kind === 'c3_data_object') router.push(`/c3/data-objects/${encodeURIComponent(code)}`);
    if (kind === 'c3_service') router.push(`/c3/services/${encodeURIComponent(code)}`);
  }, [router]);

  // NOTE: this effect MUST live before any conditional returns — React requires hooks to be
  // called unconditionally. Moving it here prevents "Rendered fewer hooks than expected" errors
  // which previously caused the error boundary to fire whenever the graph was empty or loading.
  useEffect(() => {
    startTransition(() => {
      setRenderGraph(graphNodes.length <= AUTO_RENDER_NODE_LIMIT);
    });
  }, [graphEdges.length, graphNodes.length, deferredSearch, effectiveDomain, selectedL3PageId]);

  if (isCapabilityMapLoading || isLoading || (!data && effectiveDomain)) {
    return <div className={styles.state}>Načítám C3 relation graph…</div>;
  }
  if (capabilityMapError || error || !capabilityMap?.domains?.length || !data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    return <div className={styles.stateError}>C3 graph není dostupný.</div>;
  }

  const isLargeGraph = graphNodes.length > AUTO_RENDER_NODE_LIMIT;
  const compactMode = graphNodes.length > COMPACT_RENDER_NODE_LIMIT;
  const topNodesByKind = NODE_KIND_ORDER.map((kind) => ({
    kind,
    items: graphNodes
      .filter((node) => node.node_kind === kind)
      .slice()
      .sort((a, b) => `${a.code ?? ''} ${String(a.label ?? '')}`.localeCompare(`${b.code ?? ''} ${String(b.label ?? '')}`, 'cs', { numeric: true, sensitivity: 'base' }))
      .slice(0, 8),
  })).filter((entry) => entry.items.length > 0);

  return (
    <GraphWorkspace
      title="C3 relation graph"
      purpose="Capability, TIN, Application, Data Object a C3 Service vazby ve společné pracovní ploše."
      toolbar={(
        <>
        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Vyhledávání</div>
          <input
            className={styles.searchInput}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Capability, TIN, APP, DO, SVC…"
          />
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>L1 Capability</div>
          <div className={styles.filterOptions}>
            {sortedDomains.map((domain) => (
              <button
                key={domain.code}
                type="button"
                className={`${styles.domainFilterChip} ${effectiveDomain === domain.code ? styles.domainFilterChipActive : ''}`}
                style={effectiveDomain === domain.code
                  ? { background: domain.heading_color, borderColor: domain.heading_color, color: 'var(--color-bg-surface)' }
                  : { background: domain.background_color, color: domain.heading_color, borderColor: domain.background_color }}
                onClick={() => {
                  setSelectedDomain(domain.code);
                  setSelectedL3PageId('');
                  setSelectedNode(null);
                  setSelectedEdge(null);
                }}
              >
                {domain.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <Link
              href={listHref}
              style={{ color: 'var(--color-action-primary)', textDecoration: 'none', fontSize: '0.85rem' }}
            >
              Otevřít aktuální L1 v taxonomy listu →
            </Link>
          </div>
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>L3 Capability</div>
          <select
            className={styles.selectInput}
            value={selectedL3PageId}
            onChange={(event) => {
              setSelectedL3PageId(event.target.value);
              setSelectedNode(null);
              setSelectedEdge(null);
            }}
          >
            <option value="">Vše v rámci vybraného L1</option>
            {l3Options.map((item) => (
              <option key={item.page_id} value={item.page_id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Uzly</div>
          <div className={styles.filterOptions}>
            {NODE_KIND_ORDER.map((kind) => (
              <div key={kind} className={styles.meta}>
                {NODE_KIND_LABEL[kind]}: {nodeCounts.get(kind) ?? 0}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Vazby</div>
          <div className={styles.filterOptions}>
            {Array.from(edgeCounts.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([kind, count]) => (
              <div key={kind} className={styles.meta}>
                {kind.replace(/_/g, ' ')}: {count}
              </div>
            ))}
          </div>
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Typ spojnic</div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              className={styles.typeBtn}
              style={edgeType === 'straight' ? { background: 'var(--color-action-primary)', color: 'var(--color-bg-surface)', borderColor: 'var(--color-action-primary)' } : {}}
              onClick={() => setEdgeType('straight')}
            >
              Přímé
            </button>
            <button
              type="button"
              className={styles.typeBtn}
              style={edgeType === 'smoothstep' ? { background: 'var(--color-action-primary)', color: 'var(--color-bg-surface)', borderColor: 'var(--color-action-primary)' } : {}}
              onClick={() => setEdgeType('smoothstep')}
            >
              Zaoblené
            </button>
          </div>
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Styl čar</div>
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
        </div>

        <div className={styles.railSection}>
          <div className={styles.filterLabel}>Export</div>
          <button
            type="button"
            className={styles.saveButtonInline}
            onClick={() => exportGraphToPdf(graphCanvasRef.current, 'C3 Relation Graph')}
          >
            Export do PDF
          </button>
        </div>
        </>
      )}
      canvas={(
        <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.title}>C3 Relation Graph</div>
          <div className={styles.meta}>
            {graphNodes.length} nodes · {graphEdges.length} edges
          </div>
          {isLargeGraph && <div className={styles.performanceBadge}>Large graph mode</div>}
        </div>

        <div className={styles.canvasWrap}>
          <div className={styles.canvas} ref={graphCanvasRef}>
            {!renderGraph ? (
              <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
                <div className={styles.performanceNote}>
                  Dataset je větší než {AUTO_RENDER_NODE_LIMIT} uzlů. Pro rychlou práci nejdřív zúž pohled přes `L1/L3 Capability`,
                  nebo ručně načti plný graf.
                </div>
                <button
                  type="button"
                  className={styles.saveButtonInline}
                  onClick={() => setRenderGraph(true)}
                >
                  Načíst plný graf
                </button>
                <div className={styles.filterOptions}>
                  {topNodesByKind.map(({ kind, items }) => (
                    <div key={kind} className={styles.railSection} style={{ padding: '0.75rem 1rem' }}>
                      <div className={styles.filterLabel}>{NODE_KIND_LABEL[kind]}</div>
                      <div className={styles.filterOptions}>
                        {items.map((node) => (
                          <button
                            key={node.id}
                            type="button"
                            className={styles.typeBtn}
                            style={{ opacity: 1, textAlign: 'left' }}
                            onClick={() => openNode(node)}
                          >
                            {node.code ? `${node.code} · ` : ''}{node.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <LazyC3RelationFlowCanvas
                graphNodes={graphNodes}
                graphEdges={graphEdges}
                selectedNodeId={selectedNode?.id ?? null}
                onSelectNode={(node) => {
                  setSelectedNode(node);
                  setSelectedEdge(null);
                }}
                onSelectEdge={(edge) => {
                  setSelectedEdge(edge);
                  if (edge) setSelectedNode(null);
                }}
                onOpenNode={openNode}
                compactMode={compactMode}
                edgeType={edgeType}
                lineStyleMode={lineStyleMode}
              />
            )}
          </div>
        </div>
      </main>
      )}
      detailPanelContent={(
        <>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Detail</div>
          </div>
          <div className={styles.panelBody}>
            {selectedNode ? (
              <>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Typ</span>
                  <span className={styles.panelVal}>{NODE_KIND_LABEL[selectedNode.node_kind]}</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Kód</span>
                  <span className={styles.panelVal}>{selectedNode.code ?? '—'}</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Název</span>
                  <span className={styles.panelVal}>{selectedNode.label}</span>
                </div>
                {selectedNode.item_type && (
                  <div className={styles.panelRow}>
                    <span className={styles.panelKey}>Item Type</span>
                    <span className={styles.panelVal}>{selectedNode.item_type}</span>
                  </div>
                )}
                {selectedNode.completeness_status && (
                  <div className={styles.panelRow}>
                    <span className={styles.panelKey}>Completeness</span>
                    <span className={styles.panelVal}>{selectedNode.completeness_status}</span>
                  </div>
                )}
                {selectedNode.status && (
                  <div className={styles.panelRow}>
                    <span className={styles.panelKey}>Status</span>
                    <span className={styles.panelVal}>{selectedNode.status}</span>
                  </div>
                )}
              </>
            ) : null}

            {selectedEdge ? (
              <>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Edge</span>
                  <span className={styles.panelVal}>{selectedEdge.edge_kind}</span>
                </div>
                <div className={styles.panelRow}>
                  <span className={styles.panelKey}>Typ vazby</span>
                  <span className={styles.panelVal}>{selectedEdge.relation_type}</span>
                </div>
              </>
            ) : null}

            {!selectedNode && !selectedEdge ? (
              <div className={styles.meta}>
                Klikni na uzel nebo hranu. Dvojklik na uzel otevře odpovídající C3 detail nebo seznam.
              </div>
            ) : null}
          </div>
        </>
      )}
    />
  );
}
