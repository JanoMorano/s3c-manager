'use strict';

function inferSpiralCode(input) {
    const text = String(input ?? '').toLowerCase();
    const match = text.match(/(?:spiral|sp|baseline)[-_\s]*([0-9]+)/i);
    if (!match) return null;
    return `Spiral_${Number(match[1])}`;
}

function detectTargetKey(fileName) {
    const name = String(fileName ?? '').toLowerCase();
    if (name.includes('application')) return 'c3-applications';
    if (name.includes('data-object') || name.includes('data_object') || name.includes('dataobjects')) return 'c3-data-objects';
    if (name.includes('technology') || name.includes('tin')) return 'c3-technology-interactions';
    if (name.includes('service')) return 'c3-services';
    if (name.includes('taxonomy') || name.includes('capabilit') || name.endsWith('.xml')) return 'c3-taxonomy';
    return null;
}

function sourceKindFromFile(fileName) {
    const ext = String(fileName ?? '').split('.').pop()?.toLowerCase();
    if (ext === 'json') return 'json';
    if (ext === 'csv') return 'csv';
    if (ext === 'xlsx') return 'xlsx';
    if (ext === 'xml') return 'xml-archimate';
    if (ext === 'zip') return 'zip';
    return 'unknown';
}

function validateSpiralSelection({ inferred, selected, allowOverride = false }) {
    if (!inferred && !selected) return { ok: false, issue: 'spiral_required' };
    if (inferred && selected && inferred !== selected && !allowOverride) return { ok: false, issue: 'spiral_conflict' };
    return { ok: true, spiralCode: selected || inferred };
}

module.exports = { inferSpiralCode, detectTargetKey, sourceKindFromFile, validateSpiralSelection };
