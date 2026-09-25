'use client';

import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
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
import { GraphLayoutControls } from './GraphLayoutControls';
import { GRAPH_NODE_TYPES } from './GraphNodeCard';
import type { GraphLegendItem } from './graphVisuals';
import type { useGraphLayout } from './useGraphLayout';

/** Graphs this large render only visible elements and hide the minimap. */
export function isLargeGraph(nodeCount: number, edgeCount: number): boolean {
  return nodeCount > 250 || edgeCount > 500;
}

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
  return (
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
      fitView
      fitViewOptions={{ padding: fitViewPadding }}
    >
      <Background gap={24} size={1} />
      <Controls />
      {nodes.length <= 350 && (
        <MiniMap
          nodeColor={minimapNodeColor}
          bgColor="var(--color-bg-surface)"
          maskColor="color-mix(in srgb, var(--color-bg-canvas) 70%, transparent)"
          pannable
          zoomable
        />
      )}
      {legend && (
        <Panel position="bottom-left">
          <GraphLegend title={legend.title} items={legend.items} />
        </Panel>
      )}
      {layout && (
        <Panel position="top-right">
          <GraphLayoutControls
            canSave={layout.canSave}
            hasCustomLayout={layout.hasCustomLayout}
            saveError={layout.saveError}
            onReset={layout.resetLayout}
          />
        </Panel>
      )}
    </ReactFlow>
  );
}
