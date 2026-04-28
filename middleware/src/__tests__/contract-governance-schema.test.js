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

describe('contract governance schema', () => {
    test('exposes vendors, contracts, links, findings, and dismissal audit tables', () => {
        const sql = normalizeSql(readRepoFile('backend/db/postgres/schema/21_contract_governance.sql'));

        [
            'vendor',
            'contract',
            'contract_service_link',
            'contract_capability_link',
            'governance_finding',
            'governance_finding_dismissal',
        ].forEach((tableName) => {
            expect(sql).toContain(`create table if not exists ${tableName}`);
        });

        expect(sql).toContain('vendor_code');
        expect(sql).toContain('unique');
        expect(sql).toContain('contract_code');
        expect(sql).toContain('references vendor');
        expect(sql).toContain('references service_catalog');
        expect(sql).toContain('finding_key');
        expect(sql).toContain('severity');
        expect(sql).toContain('dismissed_by');
        expect(sql).toContain('dismissed_at');
    });

    test('is wired into PostgreSQL init after capability coverage views', () => {
        const initScript = readRepoFile('init/init-db-postgres.sh');

        const capabilityCoverageIndex = initScript.indexOf('/pgdb/schema/20_capability_coverage_views.sql');
        const contractGovernanceIndex = initScript.indexOf('/pgdb/schema/21_contract_governance.sql');

        expect(capabilityCoverageIndex).toBeGreaterThan(-1);
        expect(contractGovernanceIndex).toBeGreaterThan(capabilityCoverageIndex);
    });
});
