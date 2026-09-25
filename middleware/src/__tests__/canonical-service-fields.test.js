'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { toLifecycleStage, LIFECYCLE_STAGE_ALIASES } = require('../utils/lifecycle');

const repoRoot = path.resolve(__dirname, '../../..');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function sqlStageAliases(sql) {
    const start = sql.indexOf('fn_lifecycle_stage_from_state(p_state TEXT)');
    const body = sql.slice(start, sql.indexOf('$$;', start));
    return Object.fromEntries([...body.matchAll(/WHEN '([a-z_]+)' THEN '([a-z_]+)'/g)].map((match) => [match[1], match[2]]));
}

describe('canonical service fields', () => {
    const sql = readRepoFile('backend/db/postgres/schema/35_canonical_service_fields.sql');

    test('JS lifecycle aliases mirror the SQL mapping', () => {
        expect(LIFECYCLE_STAGE_ALIASES).toEqual(sqlStageAliases(sql));
    });

    test('toLifecycleStage normalises legacy values', () => {
        expect(toLifecycleStage('live')).toBe('active');
        expect(toLifecycleStage(' Deprecated ')).toBe('retiring');
        expect(toLifecycleStage('design')).toBe('design');
        expect(toLifecycleStage('unknown')).toBeNull();
        expect(toLifecycleStage(null)).toBeNull();
    });

    test('keeps legacy columns in sync through a trigger', () => {
        expect(sql).toContain('CREATE TRIGGER trg_service_catalog_sync_canonical');
        expect(sql).toContain('BEFORE INSERT OR UPDATE ON service_catalog');
        expect(sql).toContain('NEW.next_review_due_at := NEW.review_due_at;');
    });

    test('owner load reads canonical lifecycle, criticality and review date', () => {
        const view = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW v_owner_load'));
        expect(view).toContain("sc.lifecycle_stage_code = 'active'");
        expect(view).toContain("sc.criticality_code = 'mission_critical'");
        expect(view).toContain('sc.review_due_at IS NULL');
        expect(view).not.toContain('lifecycle_state');
        expect(view).not.toContain('next_review_due_at');
        expect(view).not.toContain("service_type_code IN ('CF', 'CFS')");
    });

    test('service and portfolio repositories no longer fall back to legacy columns', () => {
        ['middleware/src/db/services.repo.js', 'middleware/src/db/portfolio.repo.js'].forEach((file) => {
            const source = readRepoFile(file);
            expect(source).not.toMatch(/COALESCE\([\w${}.]*review_due_at, [\w${}.]*next_review_due_at\)/);
            expect(source).not.toMatch(/COALESCE\([\w${}.]*lifecycle_stage_code, [\w${}.]*lifecycle_state\)/);
        });
    });
});

describe('canonical service-level SLA', () => {
    const sql = readRepoFile('backend/db/postgres/schema/36_service_sla_canonical.sql');

    test('syncs service_catalog sla_* columns with the primary service-level service_sla row both ways', () => {
        expect(sql).toContain('CREATE TRIGGER trg_service_catalog_sync_sla');
        expect(sql).toContain('CREATE TRIGGER trg_service_sla_sync_catalog');
        expect(sql).toContain('WHERE service_id = p_service_id AND flavour_id IS NULL');
        // Recursion guard: each side ignores writes made by the other trigger.
        expect(sql.match(/pg_trigger_depth\(\) > 1/g)).toHaveLength(2);
    });

    test('keeps the SLA text fields on service_sla', () => {
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS restoration_text TEXT NULL');
        expect(sql).toContain('ADD COLUMN IF NOT EXISTS delivery_text TEXT NULL');
    });
});
