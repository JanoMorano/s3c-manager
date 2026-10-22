'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useNodesInitialized,
  useReactFlow,
  useStore,
  type Edge,
  type EdgeMouseHandler,
  type Node,
  type NodeMouseHandler,
  type NodeTypes,
  type OnEdgesChange,
  type OnNodesChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTheme } from '@/features/theme/ThemeContext';
import { GraphLegend } from './GraphLegend';
import { GraphLayoutControlButtons, GraphLayoutNote } from './GraphLayoutControls';
import { GRAPH_NODE_TYPES } from './GraphNodeCard';
import type { GraphLegendItem } from './graphVisuals';
import type { useGraphLayout } from './useGraphLayout';
import legendStyles from './GraphLegend.module.css';

/** Graphs this large render only visible elements and hide the minimap. */
export function isLargeGraph(nodeCount: number, edgeCount: number): boolean {
  return nodeCount > 250 || edgeCount > 500;
}

/** The first view never zooms out below this, so node text stays readable. */
export const READABLE_MIN_ZOOM = 0.85;
const INITIAL_MAX_ZOOM = 1.1;
/** The fit control and manual zoom may go further out, to see the whole graph. */
const OVERVIEW_MIN_ZOOM = 0.1;
const VIEW_EDGE_PX = 24;
/** Left inset when the graph is wider than the canvas, so the zoom controls do not cover nodes. */
const VIEW_LEFT_PX = 64;

interface GraphCanvasProps<N extends Node, E extends Edge> {
  nodes: N[];
  edges: E[];
  onNodesChange: OnNodesChange<N>;
  onEdgesChange: OnEdgesChange<E>;
  onNodeClick?: NodeMouseHandler<N>;
  onNodeDoubleClick?: NodeMouseHandler<N>;
  onEdgeClick?: EdgeMouseHandler<E>;
  onPaneClick?: () => void;
  nodeTypes?: NodeTypes;
  fitViewPadding?: number;
  minimapNodeColor?: (node: N) => string;
  legend?: { title: string; items: GraphLegendItem[] };
  /** Saved per-view positions: enables drag-to-save and the reset control. */
  layout?: ReturnType<typeof useGraphLayout>;
}

/**
 * Frames the graph once per node set: fits it when that keeps text readable,
 * otherwise shows it at a readable zoom from its top-left corner.
 */
function ReadableInitialView({ fitKey, padding, ready }: { fitKey: string; padding: number; ready: boolean }) {
  const { getNodes, getNodesBounds, setViewport } = useReactFlow();
  const initialized = useNodesInitialized();
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const framedKey = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !initialized || !fitKey || width === 0 || height === 0 || framedKey.current === fitKey) return;
    const bounds = getNodesBounds(getNodes());
    if (bounds.width === 0 || bounds.height === 0) return;
    framedKey.current = fitKey;
    const fitZoom = Math.min(
      width / (bounds.width * (1 + 2 * padding)),
      height / (bounds.height * (1 + 2 * padding)),
    );
    const zoom = Math.max(READABLE_MIN_ZOOM, Math.min(INITIAL_MAX_ZOOM, fitZoom));
    const place = (size: number, start: number, extent: number, inset: number) => (
      extent * zoom + 2 * inset <= size
        ? (size - extent * zoom) / 2 - start * zoom
        : inset - start * zoom
    );
    setViewport({
      x: place(width, bounds.x, bounds.width, VIEW_LEFT_PX),
      y: place(height, bounds.y, bounds.height, VIEW_EDGE_PX),
      zoom,
    });
  }, [fitKey, getNodes, getNodesBounds, height, initialized, padding, ready, setViewport, width]);

  return null;
}

/**
 * The graph canvas shared by the service overview and service graphs:
 * background, controls, a theme-aware minimap, legend and layout controls.
 */
export function GraphCanvas<N extends Node = Node, E extends Edge = Edge>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onNodeClick,
  onNodeDoubleClick,
  onEdgeClick,
  onPaneClick,
  nodeTypes = GRAPH_NODE_TYPES,
  fitViewPadding = 0.15,
  minimapNodeColor,
  legend,
  layout,
}: GraphCanvasProps<N, E>) {
  const { appliedTheme } = useTheme();
  const large = isLargeGraph(nodes.length, edges.length);
  const fitKey = useMemo(() => nodes.map((node) => node.id).sort().join('|'), [nodes]);
  return (
    <div className={legendStyles.frame}>
      <ReactFlow<N, E>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeDragStop={layout?.onNodeDragStop}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        nodesConnectable={false}
        onlyRenderVisibleElements={large}
        colorMode={appliedTheme === 'dark' ? 'dark' : 'light'}
        minZoom={OVERVIEW_MIN_ZOOM}
        className={legendStyles.flow}
        style={{ flex: '1 1 0', minHeight: 0, height: 'auto' }}
      >
        <ReadableInitialView fitKey={fitKey} padding={fitViewPadding} ready={!layout?.loading} />
        <Background gap={24} size={1} />
        <Controls position="bottom-left" fitViewOptions={{ padding: fitViewPadding, minZoom: OVERVIEW_MIN_ZOOM }}>
          {layout && (
            <GraphLayoutControlButtons hasCustomLayout={layout.hasCustomLayout} onReset={layout.resetLayout} />
          )}
        </Controls>
        {nodes.length <= 350 && (
          <MiniMap
            nodeColor={minimapNodeColor}
            bgColor="var(--color-bg-surface)"
            maskColor="color-mix(in srgb, var(--color-bg-canvas) 70%, transparent)"
            style={{ width: 160, height: 100 }}
            pannable
            zoomable
          />
        )}
      </ReactFlow>
      {(legend || layout) && (
        <div className={legendStyles.strip}>
          {legend && <GraphLegend title={legend.title} items={legend.items} />}
          {layout && <GraphLayoutNote canSave={layout.canSave} saveError={layout.saveError} />}
        </div>
      )}
    </div>
  );
}
