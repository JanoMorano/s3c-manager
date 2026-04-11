'use strict';
/**
 * Completeness scoring — schema v2.1.
 * 13 checkpoints, weights sum to 100.
 * Pure function with no side effects.
 *
 * Current mappings:
 *   description      → detailed_description
 *   unit             → unit_of_measure
 *   rate_eur         → flavours.some(f => f.service_rate_eur != null)
 *   has_sla          → sla_availability + sla_delivery oba != null (governance signal)
 *   description      → aliased as detailed_description in SC_COLUMNS ✓
 *   short_description → aliased as summary in SC_COLUMNS ✓
 *   price_value      → aliased as serviceRateEUR in flavours.repo ✓
 *   portfolio_group_code → aliased as portfolio_group in SC_COLUMNS ✓
 *   status           → service_status
 *   has_owner        → ServiceRoleAssignment subquery AS service_owner in SC_COLUMNS
 */

const CHECKPOINTS = [
    // [ weight, label, testFn(service, flavours) ]
    [10, 'title',              s => s.title && s.title.trim().length > 2],
    [5,  'service_type',       s => {
        const v = String(s.service_type || s.serviceType || '').trim();
        return [
            'CF','ES','SS','CFS','MS','AS',
            'Customer Facing',
            'Customer Facing/Support',
            'Enabling Service',
            'Supporting Service'
        ].includes(v);
    }],
    [10, 'detailed_description', s => s.detailed_description && s.detailed_description.trim().length > 10],
    [5,  'service_id',         s => s.service_id && s.service_id.trim().length > 0],
    [5,  'unit_of_measure',    s => s.unit_of_measure && String(s.unit_of_measure).trim().length > 0],
    [5,  'has_rate',           (s, flavours) =>
        Array.isArray(flavours) &&
        flavours.some(f => f.serviceRateEUR != null)  // price_value AS serviceRateEUR
    ],
    [15, 'has_sla',            s => s.sla_availability != null && s.sla_delivery != null],
    [5,  'available_on',       s => Array.isArray(s.available_on) ? s.available_on.length > 0 : (s.available_on != null && String(s.available_on).trim().length > 2)],
    [5,  'portfolio_group',    s => s.portfolio_group && String(s.portfolio_group).trim().length > 0],
    [5,  'has_owner',          s => !!(s.service_owner && String(s.service_owner).trim().length > 0)],
    [10, 'c3_linked',          s => s.c3_uuid && String(s.c3_uuid).trim().length > 0],
    [10, 'has_flavours',       (s, flavours) => Array.isArray(flavours) && flavours.length > 0],
    [5,  'summary',            s => s.summary && String(s.summary).trim().length > 0],
];

function serviceScore(service, flavours = []) {
    if (!service) return 0;
    let total = 0;
    for (const [weight, , testFn] of CHECKPOINTS) {
        try {
            if (testFn(service, flavours)) total += weight;
        } catch { /* safe */ }
    }
    return Math.min(100, Math.max(0, total));
}

function serviceScoreDetailed(service, flavours = []) {
    const passed = [], failed = [], breakdown = [];
    for (const [weight, name, testFn] of CHECKPOINTS) {
        let ok = false;
        try { ok = !!testFn(service, flavours); } catch {}
        breakdown.push({ name, weight, passed: ok });
        if (ok) passed.push(name); else failed.push(name);
    }
    return { score: serviceScore(service, flavours), passed, failed, breakdown };
}

module.exports = { serviceScore, serviceScoreDetailed, CHECKPOINTS };
