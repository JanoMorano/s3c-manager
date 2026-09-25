import relationTypeDefinition from '../../../shared/service-catalogue/relationTypes.json';

export type RelationTypeCategory = 'dependency' | 'provision' | 'composition' | 'succession' | 'association';

export interface RelationTypeDefinition {
  code: string;
  category: RelationTypeCategory;
  editable: boolean;
}

export const RELATION_TYPE_CATEGORIES = relationTypeDefinition.categories as RelationTypeCategory[];
export const RELATION_TYPES = relationTypeDefinition.types as RelationTypeDefinition[];
export const RELATION_TYPE_CODES = RELATION_TYPES.map((type) => type.code);
export const EDITABLE_RELATION_TYPE_CODES = RELATION_TYPES.filter((type) => type.editable).map((type) => type.code);

export function getRelationTypeCategory(code: string | null | undefined): RelationTypeCategory | null {
  return RELATION_TYPES.find((type) => type.code === code)?.category ?? null;
}

/**
 * Types offered in a relation type select. Non-editable types are hidden for new
 * relations, but an existing relation keeps its current type as an option so that
 * saving the form never silently rewrites it.
 */
export function relationTypeOptions(currentCode?: string | null): string[] {
  if (!currentCode || EDITABLE_RELATION_TYPE_CODES.includes(currentCode)) return EDITABLE_RELATION_TYPE_CODES;
  return [...EDITABLE_RELATION_TYPE_CODES, currentCode];
}

export function relationTypeLabelKey(code: string): string {
  return `relation_type.${code}`;
}
