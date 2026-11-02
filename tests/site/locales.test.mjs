/**
 * Unit tests for the site-owned locale policy (Task 2).
 * Locks the exact presentation values that make up the public contract.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { isSiteLocale, localePresentation, siteLocales } from '../../src/site/locales.ts';

test('siteLocale tuple is exactly EN/VI with EN as the default', () => {
  assert.deepEqual([...siteLocales], ['en', 'vi']);
  // EN stays unprefixed, so it must remain the first/default locale.
  assert.equal(siteLocales[0], 'en');
});

test('every locale has complete presentation metadata', () => {
  for (const locale of siteLocales) {
    const presentation = localePresentation[locale];
    assert.ok(presentation, `missing presentation for ${locale}`);
    for (const field of [
      'label',
      'dateLocale',
      'htmlLang',
      'ogLocale',
      'rssLanguage',
      'giscusLang',
    ]) {
      assert.equal(typeof presentation[field], 'string', `${locale}.${field} must be a string`);
      assert.ok(presentation[field].length > 0, `${locale}.${field} must not be empty`);
    }
  }
});

test('EN presentation matches the measured baseline contract', () => {
  assert.deepEqual(localePresentation.en, {
    label: 'English',
    dateLocale: 'en-US',
    htmlLang: 'en-US',
    ogLocale: 'en_US',
    rssLanguage: 'en-us',
    giscusLang: 'en',
  });
});

test('VI presentation matches the measured baseline contract (including vi-vn RSS)', () => {
  assert.deepEqual(localePresentation.vi, {
    label: 'Tiếng Việt',
    dateLocale: 'vi-VN',
    htmlLang: 'vi-VN',
    ogLocale: 'vi_VN',
    rssLanguage: 'vi-vn',
    giscusLang: 'vi',
  });
});

test('isSiteLocale accepts configured locales only', () => {
  assert.equal(isSiteLocale('en'), true);
  assert.equal(isSiteLocale('vi'), true);
  assert.equal(isSiteLocale('fr'), false);
  assert.equal(isSiteLocale(''), false);
});

test('the locale tuple stays a stable two-locale contract', () => {
  assert.equal(siteLocales.length, 2);
});
