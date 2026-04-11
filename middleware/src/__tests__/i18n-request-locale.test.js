'use strict';

const { resolveRequestLocale, tReq } = require('../utils/i18n');

test('prefers authenticated user locale, then locale cookie, then accept-language', async () => {
    expect(resolveRequestLocale({ user: { preferred_lang: 'en' } })).toBe('en');
    expect(resolveRequestLocale({ headers: { cookie: 'sc_locale=en' } })).toBe('en');
    expect(resolveRequestLocale({ headers: { 'accept-language': 'en-US,en;q=0.9' } })).toBe('en');
});

test('prefers locale cookie over accept-language when user locale is missing', () => {
    expect(resolveRequestLocale({
        headers: {
            cookie: 'sc_locale=cs',
            'accept-language': 'en-US,en;q=0.9',
        },
    })).toBe('cs');
});

test('translates request-scoped messages using the resolved locale', () => {
    expect(tReq({ headers: { 'accept-language': 'en-US,en;q=0.9' } }, 'auth.errors.invalid_token')).toBe('Invalid token');
});

test('ignores malformed locale cookies and falls back to accept-language', () => {
    expect(resolveRequestLocale({
        headers: {
            cookie: 'sc_locale=%E0%A4%A',
            'accept-language': 'en-US,en;q=0.9',
        },
    })).toBe('en');
});
