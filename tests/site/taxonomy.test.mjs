/**
 * Unit tests for the pure translated-taxonomy destination policy (Task 2).
 *
 * Missing counterparts must fall back to the destination locale's taxonomy
 * index, never a fabricated 404, while the current locale always links to
 * its own concrete page.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { decideTaxonomyDestinations, pickBestCounterpart } from '../../src/site/taxonomy-core.ts';

const paths = {
  index: (locale) => (locale === 'en' ? '/categories/' : `/${locale}/categories/`),
  entry: (locale, name) =>
    locale === 'en' ? `/categories/${name}/` : `/${locale}/categories/${name}/`,
};

test('current locale always links to its own concrete taxonomy page', () => {
  const out = decideTaxonomyDestinations(
    {
      kind: 'categories',
      currentLocale: 'vi',
      currentName: 'huong-dan',
      exactSlug: {},
      translatedCounts: {},
    },
    paths,
  );
  assert.equal(out.vi, '/vi/categories/huong-dan/');
});

test('an identical slug in the target locale wins', () => {
  const out = decideTaxonomyDestinations(
    {
      kind: 'categories',
      currentLocale: 'en',
      currentName: 'guide',
      exactSlug: { vi: 'guide' },
      translatedCounts: { vi: [['huong-dan', 5]] },
    },
    paths,
  );
  assert.equal(out.en, '/categories/guide/');
  assert.equal(out.vi, '/vi/categories/guide/');
});

test('translated sibling posts supply the counterpart when slugs differ', () => {
  const out = decideTaxonomyDestinations(
    {
      kind: 'categories',
      currentLocale: 'en',
      currentName: 'guide',
      exactSlug: {},
      translatedCounts: { vi: [['huong-dan', 3]] },
    },
    paths,
  );
  assert.equal(out.vi, '/vi/categories/huong-dan/');
});

test('missing counterpart falls back to the destination locale index', () => {
  const out = decideTaxonomyDestinations(
    {
      kind: 'categories',
      currentLocale: 'en',
      currentName: 'untranslated',
      exactSlug: {},
      translatedCounts: { vi: [] },
    },
    paths,
  );
  assert.equal(out.vi, '/vi/categories/');
});

test('a locale absent from the candidates also falls back to its index', () => {
  const out = decideTaxonomyDestinations(
    {
      kind: 'tags',
      currentLocale: 'en',
      currentName: 'astro',
      exactSlug: {},
      translatedCounts: {},
    },
    paths,
  );
  assert.equal(out.vi, '/vi/categories/');
});

test('most frequent translated counterpart wins; ties break alphabetically', () => {
  assert.equal(
    pickBestCounterpart([
      ['b', 2],
      ['a', 2],
      ['c', 1],
    ]),
    'a',
  );
  assert.equal(pickBestCounterpart([]), undefined);
});
