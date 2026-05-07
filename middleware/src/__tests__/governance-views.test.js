'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function normalizeSql(sql) {
    return sql
        .replace(/--.*$/gm, '')
        .replace(/\s+/g, ' ')
        .toLowerCase();
}

describe('governance SQL views', () => {
    test('keeps owner load view used by the reduced operations surface', () => {
        const sql = normalizeSql(readRepoFile('backend/db/postgres/schema/32_final_reduction_sunset_cleanup.sql'));

        expect(sql).toContain('create view v_owner_load');

        expect(sql).toContain("'unassigned'");
        expect(sql).toContain('owned_services * 1');
        expect(sql).toContain('live_services * 2');
        expect(sql).toContain('critical_services * 3');
        expect(sql).toContain('readiness_blockers * 4');
        expect(sql).toContain('overdue_reviews * 3');
        expect(sql).toContain('c3_gaps * 2');
        expect(sql).toContain('is_deleted = false');
        expect(sql).toContain('is_stub = false');
        expect(sql).not.toContain('from contract_service_link');
        expect(sql).not.toContain('join contract_service_link');
        expect(sql).not.toContain('contract_gaps');
    });

    test('is wired into PostgreSQL init after governance views and locale cleanup', () => {
        const initScript = readRepoFile('init/init-db-postgres.sh');

        const governanceViewsIndex = initScript.indexOf('/pgdb/schema/22_governance_views.sql');
        const finalCleanupIndex = initScript.indexOf('/pgdb/schema/32_final_reduction_sunset_cleanup.sql');

        expect(governanceViewsIndex).toBeGreaterThan(-1);
        expect(finalCleanupIndex).toBeGreaterThan(governanceViewsIndex);
    });
});
