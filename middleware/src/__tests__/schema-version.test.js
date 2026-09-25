'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { SCHEMA_VERSION } = require('../config/schema-version');

function compareVersions(a, b) {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
    return 0;
}

test('SCHEMA_VERSION is the highest schema_version registered by the schema files', () => {
    const dir = path.resolve(__dirname, '../../../backend/db/postgres/schema');
    const versions = fs.readdirSync(dir)
        .filter((file) => file.endsWith('.sql'))
        .flatMap((file) => {
            const sql = fs.readFileSync(path.join(dir, file), 'utf8');
            return [...sql.matchAll(/INSERT INTO schema_migrations[\s\S]*?VALUES\s*\([\s\S]*?'(\d+\.\d+\.\d+)'/g)].map((m) => m[1]);
        });
    expect(versions.length).toBeGreaterThan(0);
    const highest = versions.sort(compareVersions).pop();
    expect(SCHEMA_VERSION).toBe(highest);
});
