'use strict';

const { DEFAULT_LOCALE, normalizeLocale, resolveLocaleFromHeader, translate } = require('../../../shared/i18n/locales');

const LOCALE_COOKIE_NAME = 'sc_locale';

function readCookie(req, name) {
    const cookieHeader = String(req?.headers?.cookie || '');
    if (!cookieHeader) {
        return null;
    }

    for (const part of cookieHeader.split(';')) {
        const [rawKey, ...rest] = part.split('=');
        const key = String(rawKey || '').trim();
        if (!key || key !== name) {
            continue;
        }

        const value = rest.join('=').trim();
        if (!value) {
            return '';
        }

        try {
            return decodeURIComponent(value);
        } catch {
            return null;
        }
    }

    return null;
}

function resolveRequestLocale(req) {
    const userLocale = req?.user?.preferred_lang;
    if (typeof userLocale === 'string' && userLocale.trim()) {
        return normalizeLocale(userLocale);
    }

    const cookieLocale = readCookie(req, LOCALE_COOKIE_NAME);
    if (typeof cookieLocale === 'string' && cookieLocale.trim()) {
        return normalizeLocale(cookieLocale);
    }

    const acceptLanguage = req?.headers?.['accept-language'];
    if (typeof acceptLanguage === 'string' && acceptLanguage.trim()) {
        return resolveLocaleFromHeader(acceptLanguage);
    }

    return DEFAULT_LOCALE;
}

function tReq(req, key, params) {
    return translate(resolveRequestLocale(req), key, params);
}

module.exports = {
    DEFAULT_LOCALE,
    resolveRequestLocale,
    tReq,
};
