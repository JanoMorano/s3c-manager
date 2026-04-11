'use strict';

const DEFAULT_LOCALE = 'cs';
const LOCALE_ALIASES = {
    cs: 'cs',
    cz: 'cs',
    cze: 'cs',
    en: 'en',
};

function normalizeLocale(value) {
    if (typeof value !== 'string') {
        return DEFAULT_LOCALE;
    }

    const trimmed = value.trim().toLowerCase().replace(/_/g, '-');
    if (!trimmed) {
        return DEFAULT_LOCALE;
    }

    const base = trimmed.split('-')[0];
    return LOCALE_ALIASES[base] || DEFAULT_LOCALE;
}

function normalizeSupportedLocale(value) {
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim().toLowerCase().replace(/_/g, '-');
    if (!trimmed) {
        return null;
    }

    const base = trimmed.split('-')[0];
    return LOCALE_ALIASES[base] || null;
}

module.exports = {
    DEFAULT_LOCALE,
    normalizeLocale,
    normalizeSupportedLocale,
};
