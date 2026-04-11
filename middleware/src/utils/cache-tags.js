'use strict';

const FEATURE_TAGS = {
    export: ['export'],
    routes: ['ref:routes'],
    c3: ['ref:c3'],
    graph: ['graph:service'],
    graphC3: ['graph:c3'],
    domains: ['ref:domains'],
    pricing: ['pricing:flavours', 'ref:pricing'],
    sla: ['sla:records', 'ref:sla'],
    import: ['import:audit'],
};

function resolveCacheTags(featureAreas = [], extraTags = []) {
    const mapped = featureAreas.flatMap((featureArea) => FEATURE_TAGS[featureArea] ?? []);
    const uniqueTags = [...new Set([...mapped, ...extraTags].filter(Boolean))];
    return uniqueTags;
}

function applyCacheTags(res, featureAreas = [], extraTags = []) {
    const uniqueTags = resolveCacheTags(featureAreas, extraTags);
    if (uniqueTags.length > 0) {
        res.set('X-Cache-Tags', uniqueTags.join(','));
    }
}

module.exports = {
    applyCacheTags,
    resolveCacheTags,
    FEATURE_TAGS,
};
