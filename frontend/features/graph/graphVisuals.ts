import type { Edge } from '@xyflow/react';
import type { GraphOverviewEdge, ServiceGraphV2Edge } from '@/features/services/model/service.types';
import { getRelationTypeCategory, RELATION_TYPE_CATEGORIES, type RelationTypeCategory } from '@/features/services/relationTypes';

export type GraphEdgeType = 'smoothstep' | 'straight';
export type GraphLineStyleMode = 'auto' | 'solid' | 'dashed';

/**
 * Edge encoding rules (one visual channel per meaning):
 * - colour  = relation category (only three validated hues + neutral; see tokens.css)
 * - dash    = secondary distinction inside a colour (never verification state)
 * - width   = mandatory / impact
 * - opacity = unverified relation
 */
export interface EdgeVisual {
  color: string;
  type: Edge['type'];
  dash?: string;
  width?: number;
  opacity?: number;
}

const SERIES_1 = 'var(--graph-series-1)';
const SERIES_2 = 'var(--graph-series-2)';
const SERIES_3 = 'var(--graph-series-3)';
const NEUTRAL = 'var(--graph-neutral)';

const DASH_LONG = '8 4';
const DASH_SHORT = '5 3';
const DASH_DOT = '2 4';

export const EDGE_WIDTH_DEFAULT = 1.6;
export const EDGE_WIDTH_MANDATORY = 2.8;
export const EDGE_OPACITY_UNVERIFIED = 0.45;

const DEFAULT_EDGE_VISUAL: EdgeVisual = {
  color: NEUTRAL,
  type: 'smoothstep',
  width: EDGE_WIDTH_DEFAULT,
};

export const RELATION_CATEGORY_VISUAL: Record<RelationTypeCategory, Pick<EdgeVisual, 'color' | 'dash'>> = {
  dependency: { color: SERIES_2 },
  provision: { color: SERIES_1 },
  composition: { color: SERIES_1, dash: DASH_LONG },
  succession: { color: SERIES_3 },
  association: { color: NEUTRAL, dash: DASH_DOT },
};

export function resolveServiceRelationVisual(edge: {
  relation_type?: string | null;
  is_mandatory?: boolean | null;
  is_verified?: boolean | null;
}): EdgeVisual {
  const category = getRelationTypeCategory(edge.relation_type) ?? 'association';
  return {
    ...RELATION_CATEGORY_VISUAL[category],
    type: 'smoothstep',
    width: edge.is_mandatory ? EDGE_WIDTH_MANDATORY : EDGE_WIDTH_DEFAULT,
    opacity: edge.is_verified === false ? EDGE_OPACITY_UNVERIFIED : undefined,
  };
}

function resolveC3MappingVisual(mappingType: string | null | undefined, isPrimary: boolean | undefined): EdgeVisual {
  if (isPrimary || mappingType === 'fully_fulfills') return { color: NEUTRAL, type: 'smoothstep', width: 2.2 };
  if (mappingType === 'partially_fulfills') return { color: NEUTRAL, type: 'smoothstep', dash: '6 3', width: 1.8 };
  return { color: NEUTRAL, type: 'smoothstep', dash: DASH_DOT, width: 1.8 };
}

/** C3 structure edges inside service graphs stay neutral so the colours keep meaning relation category. */
function resolveNeutralC3StructureVisual(edgeKind: string): EdgeVisual {
  const fromTin = edgeKind.startsWith('tin_');
  return { color: NEUTRAL, type: 'smoothstep', dash: fromTin ? DASH_SHORT : undefined, width: fromTin ? 1.3 : 1.6 };
}

export function resolveServiceGraphEdgeVisual(edge: ServiceGraphV2Edge | GraphOverviewEdge): EdgeVisual {
  if (edge.edge_kind === 'service_relation') return resolveServiceRelationVisual(edge);
  if (edge.edge_kind === 'service_flavour') return { color: NEUTRAL, type: 'smoothstep', dash: '4 3', width: 1.2 };
  if (edge.edge_kind === 'service_c3_mapping') {
    const mappingType = 'mapping_type_code' in edge ? edge.mapping_type_code ?? edge.relation_type : edge.relation_type;
    const isPrimary = 'is_primary' in edge ? Boolean(edge.is_primary) : undefined;
    return resolveC3MappingVisual(mappingType, isPrimary);
  }
  if (edge.edge_kind === 'c3_parent') return { color: NEUTRAL, type: 'smoothstep', dash: '3 4', width: 1.4 };
  return resolveNeutralC3StructureVisual(edge.edge_kind);
}

export function applyLineStyleMode(
  visual: EdgeVisual,
  lineStyleMode: GraphLineStyleMode,
): Pick<EdgeVisual, 'dash'> {
  if (lineStyleMode === 'solid') return { dash: undefined };
  if (lineStyleMode === 'dashed') return { dash: visual.dash ?? '6 3' };
  return { dash: visual.dash };
}

export interface GraphLegendItem {
  key: string;
  label: string;
  color: string;
  dash?: string;
  width?: number;
  opacity?: number;
}

type Translate = (key: string) => string;

type LegendEdge = {
  edge_kind: string;
  relation_type?: string | null;
  is_mandatory?: boolean | null;
  is_verified?: boolean | null;
  mapping_type_code?: string | null;
  is_primary?: boolean | null;
};

/** Legend for service graphs; lists only the encodings that occur in `edges`. */
export function serviceGraphLegendItems(t: Translate, edges: LegendEdge[]): GraphLegendItem[] {
  const relations = edges.filter((edge) => edge.edge_kind === 'service_relation');
  const presentCategories = new Set(relations.map((edge) => getRelationTypeCategory(edge.relation_type) ?? 'association'));
  const items: GraphLegendItem[] = RELATION_TYPE_CATEGORIES
    .filter((category) => presentCategories.has(category))
    .map((category) => ({
      key: category,
      label: t(`relation_type.category.${category}`),
      ...RELATION_CATEGORY_VISUAL[category],
      width: 2,
    }));
  if (relations.some((edge) => edge.is_mandatory)) {
    items.push({ key: 'mandatory', label: t('graph.legend.mandatory'), color: 'var(--color-text-secondary)', width: EDGE_WIDTH_MANDATORY });
  }
  if (relations.some((edge) => edge.is_verified === false)) {
    items.push({ key: 'unverified', label: t('graph.legend.unverified'), color: 'var(--color-text-secondary)', width: 2, opacity: EDGE_OPACITY_UNVERIFIED });
  }

  const mappings = edges.filter((edge) => edge.edge_kind === 'service_c3_mapping');
  const mappingStyles = new Map<string, GraphLegendItem>();
  mappings.forEach((edge) => {
    const visual = resolveC3MappingVisual(edge.mapping_type_code ?? edge.relation_type, Boolean(edge.is_primary));
    const key = `mapping:${visual.dash ?? 'solid'}`;
    if (mappingStyles.has(key)) return;
    const labelKey = !visual.dash ? 'graph.legend.mapping_primary' : visual.dash === DASH_DOT ? 'graph.legend.mapping_supporting' : 'graph.legend.mapping_partial';
    mappingStyles.set(key, { key, label: t(labelKey), color: visual.color, dash: visual.dash, width: visual.width });
  });
  items.push(...mappingStyles.values());

  if (edges.some((edge) => edge.edge_kind === 'service_flavour')) {
    items.push({ key: 'flavour', label: t('graph.legend.offering'), color: NEUTRAL, dash: '4 3', width: 1.2 });
  }
  if (edges.some((edge) => edge.edge_kind.startsWith('capability_') || edge.edge_kind.startsWith('tin_') || edge.edge_kind === 'c3_parent')) {
    items.push({ key: 'c3_structure', label: t('graph.legend.c3_structure'), color: NEUTRAL, width: 1.6 });
  }
  return items;
}
