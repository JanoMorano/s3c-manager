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

describe('final reduction DB cleanup schema', () => {
    test('drops retired procurement and finding tables after the compatibility sunset', () => {
        const sql = normalizeSql(readRepoFile('backend/db/postgres/schema/32_final_reduction_sunset_cleanup.sql'));

        [
            'vendor',
            'contract',
            'contract_service_link',
            'contract_capability_link',
            'governance_finding',
            'governance_finding_dismissal',
        ].forEach((tableName) => {
            expect(sql).toContain(`drop table if exists ${tableName}`);
        });

        expect(sql).toContain('drop view if exists v_service_risk_radar');
        expect(sql).toContain('drop view if exists v_contract_overlap');
        expect(sql).toContain('drop view if exists v_contract_renewal_risk');
        expect(sql).toContain('drop view if exists v_gap_duplication_advisor');
    });

    test('is wired into PostgreSQL init after locale cleanup', () => {
        const initScript = readRepoFile('init/init-db-postgres.sh');

        const localeCleanupIndex = initScript.indexOf('/pgdb/schema/31_locale_cs_en_only.sql');
        const finalCleanupIndex = initScript.indexOf('/pgdb/schema/32_final_reduction_sunset_cleanup.sql');

        expect(localeCleanupIndex).toBeGreaterThan(-1);
        expect(finalCleanupIndex).toBeGreaterThan(localeCleanupIndex);
    });
});
