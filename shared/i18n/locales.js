'use strict';

const { getCatalog, translate } = require('./catalog');
const { DEFAULT_LOCALE, normalizeLocale, normalizeSupportedLocale } = require('./core');

function resolveLocaleFromHeader(acceptLanguage) {
    if (typeof acceptLanguage !== 'string' || !acceptLanguage.trim()) {
        return DEFAULT_LOCALE;
    }

    const candidates = [];

    acceptLanguage.split(',').forEach((entry, index) => {
        const trimmedEntry = entry.trim();
        if (!trimmedEntry) {
            return;
        }

        const [rawTag, ...params] = trimmedEntry.split(';');
        if (!rawTag) {
            return;
        }

        const locale = normalizeSupportedLocale(rawTag);

        if (!locale) {
            return;
        }

        let quality = 1;
        for (const param of params) {
            const match = param.trim().match(/^q=([0-9.]+)$/i);
            if (match) {
                const parsed = Number(match[1]);
                if (!Number.isNaN(parsed)) {
                    quality = parsed;
                }
                break;
            }
        }

        if (quality <= 0) {
            return;
        }

        candidates.push({ locale, quality, index });
    });

    if (candidates.length === 0) {
        return DEFAULT_LOCALE;
    }

    candidates.sort((left, right) => {
        if (right.quality !== left.quality) {
            return right.quality - left.quality;
        }
        return left.index - right.index;
    });

    return candidates[0].locale;
}

module.exports = {
    DEFAULT_LOCALE,
    getCatalog,
    normalizeLocale,
    resolveLocaleFromHeader,
    translate,
};
