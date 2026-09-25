import dagre from '@dagrejs/dagre';

export interface LayoutNodeInput {
  id: string;
  width: number;
  height: number;
}

export interface LayoutEdgeInput {
  source: string;
  target: string;
}

export interface LayoutPosition {
  x: number;
  y: number;
}

export interface DependencyLayoutOptions {
  rankSep?: number;
  nodeSep?: number;
  /** Nodes without any edge are placed in a grid under the layered graph. */
  isolatedColumns?: number;
  isolatedGap?: number;
}

/**
 * Layered left-to-right layout: the relation source sits left of its target, so
 * dependency chains read in one direction and edge crossings are minimised.
 */
export function layoutByDependency(
  nodes: LayoutNodeInput[],
  edges: LayoutEdgeInput[],
  options: DependencyLayoutOptions = {},
): Map<string, LayoutPosition> {
  const { rankSep = 140, nodeSep = 36, isolatedColumns = 6, isolatedGap = 36 } = options;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const connected = new Set<string>();
  const layoutEdges = edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target) && edge.source !== edge.target);
  layoutEdges.forEach((edge) => {
    connected.add(edge.source);
    connected.add(edge.target);
  });

  const positions = new Map<string, LayoutPosition>();
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: 'LR', ranksep: rankSep, nodesep: nodeSep, marginx: 0, marginy: 0 });
  graph.setDefaultEdgeLabel(() => ({}));

  nodes.filter((node) => connected.has(node.id)).forEach((node) => {
    graph.setNode(node.id, { width: node.width, height: node.height });
  });
  layoutEdges.forEach((edge, index) => graph.setEdge(edge.source, edge.target, {}, `e${index}`));

  let maxY = 0;
  if (graph.nodeCount() > 0) {
    dagre.layout(graph);
    graph.nodes().forEach((id) => {
      const node = graph.node(id);
      // dagre returns centre points; React Flow positions are top-left corners.
      const position = { x: node.x - node.width / 2, y: node.y - node.height / 2 };
      positions.set(id, position);
      maxY = Math.max(maxY, position.y + node.height);
    });
  }

  const isolated = nodes.filter((node) => !connected.has(node.id));
  const startY = graph.nodeCount() > 0 ? maxY + rankSep : 0;
  isolated.forEach((node, index) => {
    const column = index % isolatedColumns;
    const row = Math.floor(index / isolatedColumns);
    positions.set(node.id, {
      x: column * (node.width + isolatedGap),
      y: startY + row * (node.height + isolatedGap),
    });
  });

  return positions;
}
