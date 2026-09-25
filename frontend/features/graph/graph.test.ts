import { describe, expect, test } from 'vitest';
import { layoutByDependency } from './autoLayout';
import { computeGraphHighlight } from './graphHighlight';
import { applyNodePositions } from './useGraphLayout';

describe('computeGraphHighlight', () => {
  const edges = [
    { id: 'a-b', source: 'a', target: 'b' },
    { id: 'b-c', source: 'b', target: 'c' },
    { id: 'x-a', source: 'x', target: 'a' },
    { id: 'y-z', source: 'y', target: 'z' },
  ];

  test('returns null without a selection', () => {
    expect(computeGraphHighlight(null, edges)).toBeNull();
  });

  test('follows upstream and downstream paths up to the depth', () => {
    const highlight = computeGraphHighlight('a', edges, 1)!;
    expect([...highlight.nodeIds].sort()).toEqual(['a', 'b', 'x']);
    const deep = computeGraphHighlight('a', edges, 5)!;
    expect([...deep.nodeIds].sort()).toEqual(['a', 'b', 'c', 'x']);
    expect(deep.edgeIds.has('y-z')).toBe(false);
  });
});

describe('layoutByDependency', () => {
  test('places a relation source left of its target', () => {
    const positions = layoutByDependency(
      [{ id: 'a', width: 100, height: 50 }, { id: 'b', width: 100, height: 50 }, { id: 'lonely', width: 100, height: 50 }],
      [{ source: 'a', target: 'b' }],
    );
    expect(positions.get('a')!.x).toBeLessThan(positions.get('b')!.x);
    expect(positions.has('lonely')).toBe(true);
  });
});

describe('applyNodePositions', () => {
  test('replaces only nodes with a saved position', () => {
    const nodes = [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 5, y: 5 }, data: {} },
    ];
    const result = applyNodePositions(nodes, new Map([['a', { x: 10, y: 20 }]]));
    expect(result[0].position).toEqual({ x: 10, y: 20 });
    expect(result[1]).toBe(nodes[1]);
  });
});
