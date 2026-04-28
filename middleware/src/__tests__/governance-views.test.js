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
    test('exposes deterministic risk, owner load, contract, renewal, and advisor views', () => {
        const sql = normalizeSql(readRepoFile('backend/db/postgres/schema/22_governance_views.sql'));

        [
            'v_service_risk_radar',
            'v_owner_load',
            'v_contract_overlap',
            'v_contract_renewal_risk',
            'v_gap_duplication_advisor',
        ].forEach((viewName) => {
            expect(sql).toContain(`create or replace view ${viewName}`);
        });

        expect(sql).toContain("'unassigned'");
        expect(sql).toContain('owned_services * 1');
        expect(sql).toContain('live_services * 2');
        expect(sql).toContain('critical_services * 3');
        expect(sql).toContain('readiness_blockers * 4');
        expect(sql).toContain('overdue_reviews * 3');
        expect(sql).toContain('contract_gaps * 2');
        expect(sql).toContain('c3_gaps * 2');
        expect(sql).toContain('is_deleted = false');
        expect(sql).toContain('is_stub = false');
        expect(sql).toContain("'/c3/' || c3_candidate_uuid");
        expect(sql).toContain("'c3_capability'");
        expect(sql).toContain("'missing_c3_mapping'::text");
    });

    test('is wired into PostgreSQL init after contract governance schema', () => {
        const initScript = readRepoFile('init/init-db-postgres.sh');

        const contractGovernanceIndex = initScript.indexOf('/pgdb/schema/21_contract_governance.sql');
        const governanceViewsIndex = initScript.indexOf('/pgdb/schema/22_governance_views.sql');

        expect(contractGovernanceIndex).toBeGreaterThan(-1);
        expect(governanceViewsIndex).toBeGreaterThan(contractGovernanceIndex);
    });
});
