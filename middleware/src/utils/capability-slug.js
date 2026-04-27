'use strict';

const SLUG_PATTERN = /^cap-[a-z0-9]+-[a-z0-9-]+$/;

function slugFragment(value) {
    return String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function abbreviationFromTitle(title) {
    const cleaned = String(title ?? '')
        .replace(/\bCapabilities?\b/gi, '')
        .replace(/\bCommunication and Information System\b/gi, 'CIS')
        .replace(/\bCommand and Control\b/gi, 'C2')
        .trim();
    const words = cleaned.split(/[^A-Za-z0-9]+/).filter(Boolean);
    if (words.length <= 2) return words.join('-') || null;
    return words
        .filter((word) => !['and', 'of', 'the'].includes(word.toLowerCase()))
        .slice(0, 3)
        .join('-') || null;
}

function resolveAbbreviation(node) {
    return node?.abbreviation || abbreviationFromTitle(node?.title);
}

function buildSlug(node, parent) {
    const parentAbbr = resolveAbbreviation(parent);
    const nodeAbbr = resolveAbbreviation(node);
    if (!parentAbbr || !nodeAbbr) return null;
    return `cap-${slugFragment(parentAbbr)}-${slugFragment(nodeAbbr)}`;
}

function parseSlug(slug) {
    const normalized = String(slug ?? '').trim().toLowerCase();
    if (!SLUG_PATTERN.test(normalized)) return null;
    const [, lvl2Abbr, lvl3Abbr] = normalized.match(/^cap-([a-z0-9]+)-(.+)$/) ?? [];
    if (!lvl2Abbr || !lvl3Abbr) return null;
    return { lvl2_abbr: lvl2Abbr, lvl3_abbr: lvl3Abbr };
}

async function listLevel3Capabilities(pool) {
    const result = await pool.query(`
        SELECT
            child.uuid,
            child.external_id AS page_id,
            child.title,
            child.description,
            child.abbreviation,
            child.level_num,
            parent.uuid AS parent_uuid,
            parent.external_id AS parent_page_id,
            parent.title AS parent_title,
            parent.abbreviation AS parent_abbreviation,
            COALESCE(array_remove(array_agg(DISTINCT m.spiral_code ORDER BY m.spiral_code), NULL), ARRAY[]::varchar[]) AS available_spirals
        FROM data.c3_taxonomy child
        LEFT JOIN data.c3_taxonomy parent ON parent.uuid = child.parent_uuid
        LEFT JOIN data.c3_entity_spiral_membership m
          ON m.entity_uuid = child.uuid
         AND m.entity_kind = 'taxonomy'
         AND m.status_in_spiral IS DISTINCT FROM 'removed'
        WHERE child.item_type = 'CP'
          AND child.level_num = 3
        GROUP BY child.uuid, child.external_id, child.title, child.description, child.abbreviation, child.level_num,
                 parent.uuid, parent.external_id, parent.title, parent.abbreviation
        ORDER BY child.external_id, child.title
    `);

    return result.rows
        .map((row) => {
            const parent = {
                uuid: row.parent_uuid,
                page_id: row.parent_page_id,
                title: row.parent_title,
                abbreviation: row.parent_abbreviation,
            };
            const slug = buildSlug(row, parent);
            return {
                uuid: row.uuid,
                page_id: row.page_id,
                title: row.title,
                description: row.description,
                abbreviation: resolveAbbreviation(row),
                slug,
                parent,
                available_spirals: row.available_spirals ?? [],
            };
        })
        .filter((row) => row.slug);
}

async function resolveSlug(pool, slug) {
    const normalized = String(slug ?? '').trim().toLowerCase();
    const capabilities = await listLevel3Capabilities(pool);
    return capabilities.find((capability) => capability.slug === normalized) ?? null;
}

module.exports = {
    SLUG_PATTERN,
    slugFragment,
    abbreviationFromTitle,
    buildSlug,
    parseSlug,
    listLevel3Capabilities,
    resolveSlug,
};
