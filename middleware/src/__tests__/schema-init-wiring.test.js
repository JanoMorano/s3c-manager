'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const schemaDir = path.join(repoRoot, 'backend/db/postgres/schema');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

// Same order as apply_schema_files in init/init-db-postgres.sh (find | sort).
function schemaSlices() {
    return fs.readdirSync(schemaDir).filter((name) => name.endsWith('.sql')).sort();
}

describe('PostgreSQL schema runner', () => {
    const initScript = readRepoFile('init/init-db-postgres.sh');

    test('applies every schema file in file-name order and records it in the ledger', () => {
        expect(initScript).toContain('SCHEMA_DIR="${SCHEMA_DIR:-/pgdb/schema}"');
        expect(initScript).toMatch(/find "\$SCHEMA_DIR" -maxdepth 1 -name '\*\.sql' \| sort/);
        expect(initScript).toContain('--single-transaction');
        expect(initScript).toContain('platform.schema_file_ledger');
        expect(initScript).toMatch(/^apply_schema_files$/m);
    });

    test('schema files have unique two-digit order prefixes', () => {
        const prefixes = schemaSlices().map((name) => name.slice(0, 3));
        prefixes.forEach((prefix) => expect(prefix).toMatch(/^\d{2}_$/));
        expect(new Set(prefixes).size).toBe(prefixes.length);
    });

    test('does not list schema files individually any more', () => {
        expect(initScript).not.toMatch(/\/pgdb\/schema\/\d{2}_/);
    });

    test('objects queried by service detail and C3 dashboard are created by the schema', () => {
        const sql = schemaSlices().map((name) => fs.readFileSync(path.join(schemaDir, name), 'utf8')).join('\n');

        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS c3_board_state/);
        expect(sql).toMatch(/CREATE OR REPLACE VIEW v_c3_board_lane/);
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS howto_text/);
    });

    test('retired notification and service request objects are not recreated after cleanup', () => {
        const slices = schemaSlices();
        const cleanupIndex = slices.indexOf('29_reduction_low_risk_cleanup.sql');
        const later = slices.slice(cleanupIndex + 1)
            .map((name) => fs.readFileSync(path.join(schemaDir, name), 'utf8'))
            .join('\n');

        expect(cleanupIndex).toBeGreaterThan(-1);
        expect(later).not.toMatch(/CREATE TABLE IF NOT EXISTS (notification|user_notification|user_preferences|service_request)\b/);
    });
});
