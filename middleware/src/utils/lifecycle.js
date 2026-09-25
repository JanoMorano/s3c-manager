'use strict';

const definition = require('../../../shared/service-catalogue/lifecycleStages.json');

// Stages, transitions and legacy aliases are shared with the frontend.
// Aliases mirror data.fn_lifecycle_stage_from_state (35_canonical_service_fields.sql).
const LIFECYCLE_STAGES = Object.freeze([...definition.stages]);
const LIFECYCLE_TRANSITIONS = Object.freeze(Object.fromEntries(
    Object.entries(definition.transitions).map(([stage, next]) => [stage, Object.freeze([...next])]),
));
const LIFECYCLE_STAGE_ALIASES = Object.freeze({ ...definition.aliases });

/** Canonical lifecycle_stage_code for a canonical or legacy lifecycle/status value, or null. */
function toLifecycleStage(value) {
    const key = String(value ?? '').trim().toLowerCase();
    return LIFECYCLE_STAGE_ALIASES[key] ?? null;
}

module.exports = { LIFECYCLE_STAGES, LIFECYCLE_TRANSITIONS, LIFECYCLE_STAGE_ALIASES, toLifecycleStage };
