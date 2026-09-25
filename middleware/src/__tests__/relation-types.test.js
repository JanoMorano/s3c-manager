'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
    RELATION_TYPE_CATEGORIES,
    RELATION_TYPES,
    RELATION_TYPE_CODES,
    EDITABLE_RELATION_TYPE_CODES,
    DEPENDENCY_RELATION_TYPE_CODES,
} = require('../../../shared/service-catalogue/relationTypes');

const repoRoot = path.resolve(__dirname, '../../..');

function readRepoFile(relativePath) {
    return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function seededRelationTypeCodes() {
    const sql = readRepoFile('backend/db/postgres/schema/02_ref.sql');
    const block = sql.slice(sql.indexOf('INSERT INTO ref_relation_type'));
    const values = block.slice(0, block.indexOf('ON CONFLICT'));
    return [...values.matchAll(/\(\s*'([a-z_]+)'/g)].map((match) => match[1]);
}

function sqlInList(sql, anchor) {
    const start = sql.indexOf(anchor);
    expect(start).toBeGreaterThan(-1);
    const list = sql.slice(start + anchor.length, sql.indexOf(')', start + anchor.length));
    return [...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
}

describe('shared relation types', () => {
    test('match the ref_relation_type seed exactly', () => {
        expect([...RELATION_TYPE_CODES].sort()).toEqual(seededRelationTypeCodes().sort());
    });

    test('every type has a known category and codes are unique', () => {
        expect(new Set(RELATION_TYPE_CODES).size).toBe(RELATION_TYPE_CODES.length);
        RELATION_TYPES.forEach((type) => expect(RELATION_TYPE_CATEGORIES).toContain(type.category));
    });

    test('editable types are a subset of accepted types', () => {
        expect(EDITABLE_RELATION_TYPE_CODES.length).toBeGreaterThan(0);
        EDITABLE_RELATION_TYPE_CODES.forEach((code) => expect(RELATION_TYPE_CODES).toContain(code));
    });

    test('SQL dependency counts use the dependency category', () => {
        const c3Sql = readRepoFile('backend/db/postgres/schema/11_c3.sql');
        const anchor = 'relation_type_code IN (';
        const c3List = sqlInList(c3Sql, anchor);

        expect(c3List.sort()).toEqual([...DEPENDENCY_RELATION_TYPE_CODES].sort());
    });

    test('every relation type has a cs and en label', () => {
        ['cs', 'en'].forEach((locale) => {
            const messages = JSON.parse(readRepoFile(`shared/i18n/messages/${locale}.json`));
            RELATION_TYPE_CODES.forEach((code) => expect(messages[`relation_type.${code}`]).toEqual(expect.any(String)));
            RELATION_TYPE_CATEGORIES.forEach((category) => expect(messages[`relation_type.category.${category}`]).toEqual(expect.any(String)));
        });
    });
});
