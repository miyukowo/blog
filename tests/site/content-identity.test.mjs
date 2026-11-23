/**
 * Unit tests for the shared content-entry identity policy (follow-up Task 1).
 *
 * These pin the exact normalization the Astro 7 glob loader applies, so the
 * sitemap scanner, the expectations helper and the route generator cannot
 * drift apart again.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contentEntryIdentity,
  loaderEntryId,
  normalizeIdentitySegment,
  stripTerminalIndex,
} from '../../src/site/content-identity.ts';
import { contentSlug } from '../../src/site/urls.ts';

test('normalizeIdentitySegment mirrors the locked loader for mixed case and spaces', () => {
  assert.equal(normalizeIdentitySegment('Review Hidden'), 'review-hidden');
  assert.equal(normalizeIdentitySegment('Über Café'), 'über-café');
  assert.equal(normalizeIdentitySegment('hướng-dẫn'), 'hướng-dẫn');
  assert.equal(normalizeIdentitySegment('a.b_c'), 'ab_c');
  assert.equal(normalizeIdentitySegment('100% real'), '100-real');
});

test('loaderEntryId strips the extension, normalizes every segment and drops terminal index', () => {
  assert.equal(loaderEntryId('en/Review Hidden.md'), 'en/review-hidden');
  assert.equal(loaderEntryId('vi/Über Café/index.mdx'), 'vi/über-café');
  assert.equal(loaderEntryId('en/nested/index/index.md'), 'en/nested/index');
  assert.equal(loaderEntryId('en/nested/deep/index.mdx'), 'en/nested/deep');
  assert.equal(loaderEntryId('en/Nested/Deep/'), 'en/nested/deep');
});

test('contentSlug composes loader identity with the locale/folder policy', () => {
  const id = loaderEntryId('en/Review Hidden.md');
  assert.equal(contentSlug(id), 'review-hidden');
  assert.equal(contentSlug(loaderEntryId('vi/Über Café/index.mdx')), 'über-café');
  // The loader removed the terminal index; the surviving `index` segment is
  // internal and must stay in the identity.
  assert.equal(contentSlug(loaderEntryId('en/nested/index/index.md')), 'nested/index');
  assert.equal(contentSlug('en/nested/index'), 'nested/index');
});

test('explicit frontmatter slug wins verbatim, as in the loader', () => {
  assert.deepEqual(
    contentEntryIdentity({ relativePath: 'en/ignored-name.md', slug: 'custom-identity' }),
    { id: 'custom-identity' },
  );
  assert.equal(contentSlug('custom-identity'), 'custom-identity');
  assert.deepEqual(contentEntryIdentity({ relativePath: 'en/ignored-name.md', slug: '' }), {
    id: 'en/ignored-name',
  });
});

test('stripTerminalIndex only removes a terminal segment', () => {
  assert.equal(stripTerminalIndex('en/index'), 'en');
  assert.equal(stripTerminalIndex('en/Index'), 'en');
  assert.equal(stripTerminalIndex('en/index/deep'), 'en/index/deep');
});
