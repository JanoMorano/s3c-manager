import type { Edge } from '@xyflow/react';
import type { C3RelationGraphEdge, GraphOverviewEdge, ServiceGraphV2Edge } from '@/features/services/model/service.types';

export type GraphEdgeType = 'smoothstep' | 'straight';
export type GraphLineStyleMode = 'auto' | 'solid' | 'dashed';

interface EdgeVisual {
  color: string;
  type: Edge['type'];
  dash?: string;
  width?: number;
}

const DEFAULT_EDGE_VISUAL: EdgeVisual = {
  color: '#6b778c',
  type: 'smoothstep',
  width: 1.8,
};

export const SERVICE_RELATION_VISUAL: Record<string, EdgeVisual> = {
  prerequisite: { color: '#ff5630', type: 'smoothstep', width: 2.1 },
  depends_on: { color: '#ff8b00', type: 'smoothstep', dash: '3 3', width: 1.8 },
  underlying: { color: '#0065ff', type: 'smoothstep', dash: '6 3', width: 1.8 },
  replaces: { color: '#8777d9', type: 'smoothstep', dash: '8 3 2 3', width: 1.7 },
  related_to: { color: '#57d9a3', type: 'smoothstep', dash: '4 4', width: 1.5 },
  provided_by: { color: '#36b37e', type: 'smoothstep', dash: '10 4', width: 1.8 },
  c3_parent: { color: '#36b37e', type: 'smoothstep', dash: '3 4', width: 1.8 },
};

export const C3_EDGE_VISUAL: Record<C3RelationGraphEdge['edge_kind'], EdgeVisual> = {
  capability_application: { color: '#36b37e', type: 'smoothstep', width: 2.2 },
  capability_tin: { color: '#4c9aff', type: 'smoothstep', width: 2.2, dash: '5 3' },
  capability_data_object: { color: '#ff8b00', type: 'smoothstep', width: 2.2, dash: '7 3' },
  capability_c3_service: { color: '#6554c0', type: 'smoothstep', width: 2.2, dash: '3 4' },
  tin_application: { color: '#79f2c0', type: 'smoothstep', width: 1.7, dash: '4 3' },
  tin_data_object: { color: '#ffbd5c', type: 'smoothstep', width: 1.7, dash: '4 3' },
  tin_c3_service: { color: '#998dd9', type: 'smoothstep', width: 1.7, dash: '4 3' },
};

export function resolveServiceGraphEdgeVisual(edge: ServiceGraphV2Edge | GraphOverviewEdge): EdgeVisual {
  if (edge.edge_kind === 'service_relation') {
    return SERVICE_RELATION_VISUAL[edge.relation_type] ?? DEFAULT_EDGE_VISUAL;
  }
  if (edge.edge_kind === 'service_flavour') {
    return { color: '#f6c90e', type: 'smoothstep', dash: '4 3', width: 1.4 };
  }
  if (edge.edge_kind === 'service_c3_mapping') {
    const mappingType = String('mapping_type_code' in edge ? edge.mapping_type_code ?? edge.relation_type : edge.relation_type);
    if (mappingType === 'primary') return { color: '#0052cc', type: 'smoothstep', width: 2.4 };
    if (mappingType === 'implements') return { color: '#0052cc', type: 'smoothstep', dash: '6 3', width: 2.1 };
    return { color: '#0052cc', type: 'smoothstep', dash: '2 4', width: 1.9 };
  }
  if (edge.edge_kind === 'c3_parent') {
    return SERVICE_RELATION_VISUAL.c3_parent;
  }
  return C3_EDGE_VISUAL[edge.edge_kind as C3RelationGraphEdge['edge_kind']] ?? DEFAULT_EDGE_VISUAL;
}

export function resolveC3EdgeVisual(edge: C3RelationGraphEdge): EdgeVisual {
  return C3_EDGE_VISUAL[edge.edge_kind] ?? DEFAULT_EDGE_VISUAL;
}

export function applyLineStyleMode(
  visual: EdgeVisual,
  lineStyleMode: GraphLineStyleMode,
): Pick<EdgeVisual, 'dash'> {
  if (lineStyleMode === 'solid') return { dash: undefined };
  if (lineStyleMode === 'dashed') return { dash: visual.dash ?? '6 3' };
  return { dash: visual.dash };
}
