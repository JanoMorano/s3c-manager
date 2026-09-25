'use strict';

// Mirrors data.fn_lifecycle_stage_from_state (35_canonical_service_fields.sql).
const LIFECYCLE_STAGE_ALIASES = Object.freeze({
    draft: 'draft',
    design: 'design',
    planned: 'design',
    under_review: 'design',
    approved: 'active',
    live: 'active',
    production: 'active',
    published: 'active',
    active: 'active',
    deprecated: 'retiring',
    retiring: 'retiring',
    retired: 'retired',
});

/** Canonical lifecycle_stage_code for a canonical or legacy lifecycle/status value, or null. */
function toLifecycleStage(value) {
    const key = String(value ?? '').trim().toLowerCase();
    return LIFECYCLE_STAGE_ALIASES[key] ?? null;
}

module.exports = { LIFECYCLE_STAGE_ALIASES, toLifecycleStage };
