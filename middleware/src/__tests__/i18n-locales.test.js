'use strict';

const {
    DEFAULT_LOCALE,
    getCatalog,
    normalizeLocale,
    resolveLocaleFromHeader,
    translate,
} = require('../../../shared/i18n/locales');

test('normalizes legacy and browser locales to canonical values', () => {
    expect(normalizeLocale('cz')).toBe('cs');
    expect(normalizeLocale('cze')).toBe('cs');
    expect(normalizeLocale('cs-CZ')).toBe('cs');
    expect(normalizeLocale('en-US')).toBe('en');
    expect(normalizeLocale('weird')).toBe(DEFAULT_LOCALE);
});

test('resolves locale from accept-language header using canonical locales', () => {
    expect(resolveLocaleFromHeader('en-US,en;q=0.9,cs;q=0.8')).toBe('en');
    expect(resolveLocaleFromHeader('cz;q=0.9,fr;q=0.8')).toBe('cs');
    expect(resolveLocaleFromHeader('en;q=0,cs;q=0')).toBe(DEFAULT_LOCALE);
    expect(resolveLocaleFromHeader('')).toBe(DEFAULT_LOCALE);
});

test('returns canonical catalogs and translates fallback keys', () => {
    expect(getCatalog('cz')['auth.login.submit']).toBe('Přihlásit se');
    expect(getCatalog('en')['common.loading']).toBe('Loading…');
    expect(translate('en', 'auth.login.submit')).toBe('Sign in');
    expect(translate('weird', 'common.loading')).toBe('Načítám…');
    expect(translate('en', 'missing.key')).toBe('missing.key');
});

test('interpolates translated values with params', () => {
    expect(translate('en', 'common.welcome_user', { name: 'Ada' })).toBe('Welcome, Ada!');
    expect(translate('cs', 'common.welcome_user', { name: 'Ada' })).toBe('Vítej, Ada!');
});

test('falls back to cs when selected locale is missing a key', () => {
    const enCatalog = getCatalog('en');
    const original = enCatalog['common.only_cs'];

    delete enCatalog['common.only_cs'];
    try {
        expect(translate('en', 'common.only_cs')).toBe('Jen česky');
    } finally {
        enCatalog['common.only_cs'] = original;
    }
});
