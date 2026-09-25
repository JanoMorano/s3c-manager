export interface DirectedEdge {
  id: string;
  source: string;
  target: string;
}

export interface GraphHighlight {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

function walk(startId: string, edges: DirectedEdge[], direction: 'down' | 'up', depth: number, result: GraphHighlight) {
  let frontier = [startId];
  const visited = new Set<string>([startId]);
  for (let level = 0; level < depth && frontier.length > 0; level += 1) {
    const next: string[] = [];
    edges.forEach((edge) => {
      const from = direction === 'down' ? edge.source : edge.target;
      const to = direction === 'down' ? edge.target : edge.source;
      if (!frontier.includes(from)) return;
      result.edgeIds.add(edge.id);
      result.nodeIds.add(to);
      if (!visited.has(to)) {
        visited.add(to);
        next.push(to);
      }
    });
    frontier = next;
  }
}

/** Nodes and edges reachable from the selected node in both directions, up to `depth` hops. */
export function computeGraphHighlight(selectedId: string | null, edges: DirectedEdge[], depth = 3): GraphHighlight | null {
  if (!selectedId) return null;
  const result: GraphHighlight = { nodeIds: new Set([selectedId]), edgeIds: new Set() };
  walk(selectedId, edges, 'down', depth, result);
  walk(selectedId, edges, 'up', depth, result);
  return result;
}

export const DIMMED_NODE_OPACITY = 0.25;
export const DIMMED_EDGE_OPACITY = 0.12;
