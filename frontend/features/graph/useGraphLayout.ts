'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import useSWR from 'swr';
import type { Node, OnNodeDrag } from '@xyflow/react';
import { apiFetch, authHeaders } from '@/features/services/api/services.api';
import { AUTH_STATE_EVENT, getAuthSnapshot } from '@/features/auth/authStore';
import { hasRoleAccess } from '@/features/auth/roles';

/**
 * Saved node positions of one graph view (GET/PUT/DELETE /api/v1/graph/layout).
 *
 * View keys: 'service-overview/portfolio', 'service-overview/dependency',
 * 'service/<SERVICE_ID>', 'c3-relations'. Dragged positions apply at once;
 * editors also save them for everyone, other roles keep them for the session.
 */

export interface GraphNodePosition {
  node_id: string;
  x: number;
  y: number;
}

interface GraphLayoutResponse {
  view_key: string;
  positions: GraphNodePosition[];
}

type PositionMap = ReadonlyMap<string, { x: number; y: number }>;

export function graphLayoutUrl(viewKey: string): string {
  return `/api/v1/graph/layout?view=${encodeURIComponent(viewKey)}`;
}

async function sendLayout(method: 'PUT' | 'DELETE', viewKey: string, positions?: GraphNodePosition[]) {
  const res = await fetch(method === 'PUT' ? '/api/v1/graph/layout' : graphLayoutUrl(viewKey), {
    method,
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: method === 'PUT' ? JSON.stringify({ view: viewKey, positions }) : undefined,
  });
  if (!res.ok) throw new Error(`${method} graph layout ${res.status}`);
}

/** Replaces computed node positions with saved or dragged ones. */
export function applyNodePositions<T extends Node>(nodes: T[], positions: PositionMap): T[] {
  if (positions.size === 0) return nodes;
  return nodes.map((node) => {
    const saved = positions.get(node.id);
    return saved ? { ...node, position: { x: saved.x, y: saved.y } } : node;
  });
}

function subscribeAuth(onChange: () => void) {
  window.addEventListener(AUTH_STATE_EVENT, onChange);
  return () => window.removeEventListener(AUTH_STATE_EVENT, onChange);
}

const canEditSnapshot = () => hasRoleAccess(getAuthSnapshot()?.role, 'editor');

interface LocalState {
  viewKey: string | null;
  positions: Map<string, { x: number; y: number }>;
  saveError: boolean;
}

export function useGraphLayout(viewKey: string | null) {
  const { data, mutate } = useSWR<GraphLayoutResponse>(
    viewKey ? graphLayoutUrl(viewKey) : null,
    apiFetch,
    { revalidateOnFocus: false },
  );
  const canSave = useSyncExternalStore(subscribeAuth, canEditSnapshot, () => false);
  const [localState, setLocalState] = useState<LocalState>(() => ({ viewKey, positions: new Map(), saveError: false }));
  // Local drags and save errors belong to one view.
  const current = localState.viewKey === viewKey ? localState : null;
  const localPositions = current?.positions;
  const saveError = current?.saveError ?? false;
  const update = useCallback((change: (state: LocalState) => Partial<LocalState>) => {
    setLocalState((previous) => {
      const base = previous.viewKey === viewKey ? previous : { viewKey, positions: new Map(), saveError: false };
      return { ...base, ...change(base) };
    });
  }, [viewKey]);

  const positions = useMemo<PositionMap>(() => {
    const merged = new Map<string, { x: number; y: number }>();
    (data?.positions ?? []).forEach((position) => merged.set(position.node_id, { x: position.x, y: position.y }));
    localPositions?.forEach((position, nodeId) => merged.set(nodeId, position));
    return merged;
  }, [data?.positions, localPositions]);

  const onNodeDragStop = useCallback<OnNodeDrag>((_event, _node, draggedNodes) => {
    if (!viewKey || draggedNodes.length === 0) return;
    const moved = draggedNodes.map((node) => ({ node_id: node.id, x: Math.round(node.position.x), y: Math.round(node.position.y) }));
    update((state) => {
      const next = new Map(state.positions);
      moved.forEach((position) => next.set(position.node_id, { x: position.x, y: position.y }));
      return { positions: next };
    });
    if (!canSave) return;
    sendLayout('PUT', viewKey, moved)
      .then(() => update(() => ({ saveError: false })))
      .catch(() => update(() => ({ saveError: true })));
  }, [canSave, update, viewKey]);

  const resetLayout = useCallback(async () => {
    if (!viewKey) return;
    update(() => ({ positions: new Map() }));
    if (canSave && (data?.positions.length ?? 0) > 0) {
      try {
        await sendLayout('DELETE', viewKey);
        update(() => ({ saveError: false }));
      } catch {
        update(() => ({ saveError: true }));
        return;
      }
    }
    await mutate({ view_key: viewKey, positions: [] }, { revalidate: false });
  }, [canSave, data?.positions.length, mutate, update, viewKey]);

  return {
    positions,
    canSave,
    saveError,
    hasCustomLayout: positions.size > 0,
    onNodeDragStop,
    resetLayout,
  };
}
