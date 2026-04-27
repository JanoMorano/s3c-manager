'use strict';

const cs = require('./messages/cs.json');
const en = require('./messages/en.json');
const sk = require('./messages/sk.json');
const de = require('./messages/de.json');
const { DEFAULT_LOCALE, normalizeLocale } = require('./core');

const CATALOGS = {
    cs,
    en,
    sk,
    de,
};

function getCatalog(locale) {
    const canonicalLocale = normalizeLocale(locale);
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
    const hasCatalogKey = Object.prototype.hasOwnProperty.call(catalog, key);
    const hasFallbackKey = Object.prototype.hasOwnProperty.call(fallbackCatalog, key);
    const message = hasCatalogKey ? catalog[key] : hasFallbackKey ? fallbackCatalog[key] : key;
    return interpolate(message, params);
}

module.exports = {
    DEFAULT_LOCALE,
    getCatalog,
    translate,
};
