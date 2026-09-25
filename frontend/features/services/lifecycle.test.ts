import { describe, expect, test } from 'vitest';
import { LIFECYCLE_STAGE_SERVICE_STATUS, LIFECYCLE_STAGES, selectableLifecycleStages, toLifecycleStage } from './lifecycle';

describe('lifecycle stages', () => {
  test('maps legacy values to canonical stages', () => {
    expect(toLifecycleStage('live')).toBe('active');
    expect(toLifecycleStage(' Deprecated ')).toBe('retiring');
    expect(toLifecycleStage('unknown')).toBeNull();
  });

  test('offers the current stage and its allowed transitions', () => {
    expect(selectableLifecycleStages('draft')).toEqual(['draft', 'design', 'active']);
    expect(selectableLifecycleStages(null)).toEqual(LIFECYCLE_STAGES);
  });

  test('every stage has an API service status', () => {
    LIFECYCLE_STAGES.forEach((stage) => expect(LIFECYCLE_STAGE_SERVICE_STATUS[stage]).toBeTruthy());
  });
});
