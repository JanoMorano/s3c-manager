'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { getPool } = require('../db/pool');
const config = require('../config');

const SEED_VERSION = 'c3_poster_v2_html';
const SEED_SOURCE = 'shared/c3/capability-map-spiral7.json';
const SEED_FILE_PATH = path.resolve(__dirname, '../../../shared/c3/capability-map-spiral7.json');
const INSERT_CHUNK_SIZE = 125;

let cachedSeedItems = null;

function resultRows(result) {
    if (!result) return [];
    return Array.isArray(result.rows) ? result.rows : [];
}

function loadSeedItems() {
    if (!cachedSeedItems) {
        if (!fs.existsSync(SEED_FILE_PATH)) {
            throw new Error(`Capability builder seed is missing: ${SEED_FILE_PATH}`);
        }
        const raw = fs.readFileSync(SEED_FILE_PATH, 'utf8');
        cachedSeedItems = JSON.parse(raw);
    }
    return cachedSeedItems;
}

async function insertSeedChunk(items) {
    if (items.length === 0) return;

    const values = [];
    const valuesSql = items.map((item, index) => {
        const base = index * 7;
        values.push(
            item.pageId,
            item.uuid,
            item.title,
            item.parentId ?? null,
            Number(item.level),
            item.state ?? null,
            item.domain
        );

        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`;
    }).join(',\n');

    await getPool().query(`
        INSERT INTO data.c3_capability_builder (
            page_id,
            uuid,
            title,
            parent_id,
            level,
            state,
            domain_code
        )
        VALUES ${valuesSql}
    `, values);
}

async function ensureCapabilityBuilderSeeded() {
    if (!config.init.seedCapabilityMap) return;

    const stateResult = await getPool().query(`
        SELECT seed_version
        FROM data.c3_capability_builder_seed_state
        WHERE seed_version = $1
    `, [SEED_VERSION]);
    if (resultRows(stateResult)[0]) return;

    const countResult = await getPool().query(`
        SELECT COUNT(1) AS row_count
        FROM data.c3_capability_builder
    `);
    const rowCount = Number(resultRows(countResult)[0]?.row_count ?? 0);
    if (rowCount > 0) {
        await getPool().query('DELETE FROM data.c3_capability_builder');
    }

    const items = loadSeedItems();
    for (let index = 0; index < items.length; index += INSERT_CHUNK_SIZE) {
        const chunk = items.slice(index, index + INSERT_CHUNK_SIZE);
        await insertSeedChunk(chunk);
    }

    await getPool().query(`
        INSERT INTO data.c3_capability_builder_seed_state (seed_version, seed_source)
        VALUES ($1, $2)
    `, [SEED_VERSION, SEED_SOURCE]);
}

module.exports = {
    ensureCapabilityBuilderSeeded,
};
