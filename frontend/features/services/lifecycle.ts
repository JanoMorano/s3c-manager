import lifecycleDefinition from '../../../shared/service-catalogue/lifecycleStages.json';

export type LifecycleStage = 'draft' | 'design' | 'active' | 'retiring' | 'retired';

export const LIFECYCLE_STAGES = lifecycleDefinition.stages as LifecycleStage[];
export const LIFECYCLE_TRANSITIONS = lifecycleDefinition.transitions as Record<LifecycleStage, LifecycleStage[]>;
const LIFECYCLE_ALIASES = lifecycleDefinition.aliases as Record<string, LifecycleStage>;

/** Canonical lifecycle stage for a canonical or legacy lifecycle/status value, or null. */
export function toLifecycleStage(value: string | null | undefined): LifecycleStage | null {
  return LIFECYCLE_ALIASES[String(value ?? '').trim().toLowerCase()] ?? null;
}

/** Stages selectable from `current`: the current stage plus its allowed transitions (all stages when unset). */
export function selectableLifecycleStages(current: LifecycleStage | null): LifecycleStage[] {
  if (!current) return LIFECYCLE_STAGES;
  return LIFECYCLE_STAGES.filter((stage) => stage === current || LIFECYCLE_TRANSITIONS[current].includes(stage));
}

export function lifecycleStageLabelKey(stage: string): string {
  return `lifecycle_stage.${stage}`;
}
