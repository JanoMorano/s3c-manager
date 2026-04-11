'use strict';

function parseCsvFilter(value, { maxItems = 10, allowed = null } = {}) {
    if (value == null || value === '') return [];
    const raw = Array.isArray(value) ? value.join(',') : String(value);
    const items = [...new Set(raw.split(',').map((item) => item.trim()).filter(Boolean))].slice(0, maxItems);
    if (!allowed) return items;
    return items.filter((item) => allowed.includes(item));
}

function parseTextFilter(value, { maxLength = 120 } = {}) {
    if (value == null || value === '') return '';
    return String(value).trim().slice(0, maxLength);
}

function parseIntFilter(value, { fallback = null, min = 1, max = 500 } = {}) {
    const parsed = parseInt(String(value ?? ''), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(min, Math.min(max, parsed));
}

module.exports = { parseCsvFilter, parseTextFilter, parseIntFilter };
