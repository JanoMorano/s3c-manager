'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '../../..');
const schemaDir = path.join(repoRoot, 'backend/db/postgres/schema');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function initScriptSlices() {
    return [...readRepoFile('init/init-db-postgres.sh').matchAll(/\/pgdb\/schema\/([0-9A-Za-z_]+\.sql)/g)]
        .map((match) => match[1]);
}

describe('PostgreSQL init wiring', () => {
    test('every schema slice on disk is applied by init-db-postgres.sh', () => {
        const applied = new Set(initScriptSlices());
        const onDisk = fs.readdirSync(schemaDir).filter((name) => name.endsWith('.sql'));

        expect(onDisk.filter((name) => !applied.has(name))).toEqual([]);
    });

    test('schema slices are applied in numeric order', () => {
        const slices = initScriptSlices();

        expect(slices).toEqual([...slices].sort());
    });

    test('objects queried by service detail and C3 dashboard are created by init', () => {
        const slices = initScriptSlices();
        const sql = slices.map((name) => fs.readFileSync(path.join(schemaDir, name), 'utf8')).join('\n');

        expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS c3_board_state/);
        expect(sql).toMatch(/CREATE OR REPLACE VIEW v_c3_board_lane/);
        expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS howto_text/);
    });

    test('retired notification and service request objects are not recreated after cleanup', () => {
        const slices = initScriptSlices();
        const cleanupIndex = slices.indexOf('29_reduction_low_risk_cleanup.sql');
        const later = slices.slice(cleanupIndex + 1)
            .map((name) => fs.readFileSync(path.join(schemaDir, name), 'utf8'))
            .join('\n');

        expect(cleanupIndex).toBeGreaterThan(-1);
        expect(later).not.toMatch(/CREATE TABLE IF NOT EXISTS (notification|user_notification|user_preferences|service_request)\b/);
    });
});
