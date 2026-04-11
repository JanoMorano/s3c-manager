'use strict';

const cs = require('./messages/cs.json');
const en = require('./messages/en.json');

const DEFAULT_LOCALE = 'cs';

const CATALOGS = {
    cs,
    en,
};

function normalizeCatalogLocale(value) {
    if (typeof value !== 'string') {
        return DEFAULT_LOCALE;
    }

    const trimmed = value.trim().toLowerCase().replace(/_/g, '-');
    if (!trimmed) {
        return DEFAULT_LOCALE;
    }

    const base = trimmed.split('-')[0];
    if (base === 'cs' || base === 'cz' || base === 'cze') {
        return 'cs';
    }

    if (base === 'en') {
        return 'en';
    }

    return DEFAULT_LOCALE;
}

function getCatalog(locale) {
    const canonicalLocale = normalizeCatalogLocale(locale);
    return CATALOGS[canonicalLocale] || CATALOGS[DEFAULT_LOCALE];
}

function interpolate(message, params) {
    if (!params || typeof params !== 'object') {
        return message;
    }

    return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
        if (Object.prototype.hasOwnProperty.call(params, key) && params[key] != null) {
            return String(params[key]);
        }
        return match;
    });
}

function translate(locale, key, params) {
    const catalog = getCatalog(locale);
    const fallbackCatalog = CATALOGS[DEFAULT_LOCALE];
    const message = catalog[key] || fallbackCatalog[key] || key;
    return interpolate(message, params);
}

module.exports = {
    DEFAULT_LOCALE,
    getCatalog,
    translate,
};
