/**
 * Unit tests for the site-owned URL identity policy (Task 2).
 * Pure functions only — no Astro, no build output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  contentSlug,
  legacyTaxonomySlug,
  localeFromContentId,
  resolvePostIdentity,
  stripLocalePrefix,
} from '../../src/site/urls.ts';

test('contentSlug strips a terminal /index from folder-based EN/VI posts', () => {
  assert.equal(contentSlug('en/getting-started/index.mdx'), 'getting-started');
  assert.equal(contentSlug('vi/getting-started/index.mdx'), 'getting-started');
  // .md works the same as .mdx
  assert.equal(contentSlug('en/getting-started/index.md'), 'getting-started');
});

test('contentSlug keeps nested identity and internal index segments', () => {
  assert.equal(contentSlug('en/nested/deep/index.mdx'), 'nested/deep');
  assert.equal(contentSlug('en/guides/index/basics.mdx'), 'guides/index/basics');
  // A top-level file with no index suffix keeps its slug unchanged.
  assert.equal(contentSlug('en/plain.md'), 'plain');
  // No locale prefix at all is still normalized.
  assert.equal(contentSlug('plain/index.mdx'), 'plain');
});

test('contentSlug only strips recognized locale prefixes', () => {
  // `fr` is not a configured locale for this blog: preserve it instead of
  // silently relocating content from an unknown locale folder.
  assert.equal(contentSlug('fr/foo/index.mdx', ['en', 'vi']), 'fr/foo');
  // Windows separators are normalized.
  assert.equal(contentSlug('en\\folder\\index.mdx', ['en', 'vi']), 'folder');
});

test('stripLocalePrefix reports the normalized relative id', () => {
  assert.equal(stripLocalePrefix('vi/posts/x/index.mdx'), 'posts/x/index.mdx');
  assert.equal(stripLocalePrefix('fr/posts/x/index.mdx', ['en', 'vi']), 'fr/posts/x/index.mdx');
});

test('legacyTaxonomySlug preserves the published ASCII taxonomy URLs', () => {
  // /vi/categories/huong-dan/ must never become /vi/categories/hướng-dẫn/.
  assert.equal(legacyTaxonomySlug('Hướng dẫn'), 'huong-dan');
  assert.equal(legacyTaxonomySlug('Hướng Dẫn'), 'huong-dan');
  assert.equal(legacyTaxonomySlug('Lập Trình'), 'lap-trinh');
  assert.equal(legacyTaxonomySlug('Web Development'), 'web-development');
  assert.equal(legacyTaxonomySlug('  Hello, World!  '), 'hello-world');
});

test('resolvePostIdentity: filesystem identity wins over a mismatched saved postSlug', () => {
  const identity = resolvePostIdentity({
    id: 'en/new-post/index.mdx',
    postSlug: 'old-post',
  });
  assert.equal(identity.slug, 'new-post');
  assert.equal(identity.translationKey, 'new-post');
  assert.equal(identity.postSlugMismatch, true);
  assert.equal(identity.savedPostSlug, 'old-post');
});

test('resolvePostIdentity: a matching saved postSlug is not reported', () => {
  const identity = resolvePostIdentity({
    id: 'vi/new-post/index.mdx',
    postSlug: 'new-post',
  });
  assert.equal(identity.slug, 'new-post');
  assert.equal(identity.postSlugMismatch, false);
  assert.equal(identity.savedPostSlug, undefined);
});

test('resolvePostIdentity preserves an explicit translationKey', () => {
  const identity = resolvePostIdentity({
    id: 'en/renamed-en/index.mdx',
    translationKey: 'shared-topic',
  });
  assert.equal(identity.slug, 'renamed-en');
  assert.equal(identity.translationKey, 'shared-topic');
  assert.equal(identity.postSlugMismatch, false);
});

test('different EN/VI file slugs still pair via translationKey', () => {
  const en = resolvePostIdentity({ id: 'en/english-slug/index.mdx' });
  const vi = resolvePostIdentity({ id: 'vi/vietnamese-slug/index.mdx' });
  assert.equal(en.slug, 'english-slug');
  assert.equal(vi.slug, 'vietnamese-slug');
  assert.notEqual(en.slug, vi.slug);

  const pairedEn = resolvePostIdentity({
    id: 'en/english-slug/index.mdx',
    translationKey: 'same-topic',
  });
  const pairedVi = resolvePostIdentity({
    id: 'vi/vietnamese-slug/index.mdx',
    translationKey: 'same-topic',
  });
  assert.equal(pairedEn.translationKey, pairedVi.translationKey);
});

test('localeFromContentId recognizes only configured locales', () => {
  assert.equal(localeFromContentId('en/post/index.mdx'), 'en');
  assert.equal(localeFromContentId('vi/post/index.mdx'), 'vi');
  assert.equal(localeFromContentId('fr/post/index.mdx'), undefined);
  assert.equal(localeFromContentId('post/index.mdx'), undefined);
});
