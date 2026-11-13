/**
 * Unit tests for the site-owned sitemap identity policy (review repair Task 3).
 * Pure functions only — no Astro, no build output.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createUnlistedSitemapMatcher,
  normalizeSitemapPathname,
  sitemapPostPathname,
} from '../../src/site/sitemap.ts';
import { loaderEntryId } from '../../src/site/content-identity.ts';
import { contentSlug } from '../../src/site/urls.ts';

test('normalizeSitemapPathname strips origin, query/hash and trailing slashes', () => {
  assert.equal(
    normalizeSitemapPathname('https://blog.tvphus.dev/posts/review-unlisted/'),
    '/posts/review-unlisted',
  );
  assert.equal(
    normalizeSitemapPathname('https://blog.tvphus.dev/posts/review-unlisted/?ref=feed#top'),
    '/posts/review-unlisted',
  );
  assert.equal(normalizeSitemapPathname('/posts//review-unlisted//'), '/posts/review-unlisted');
  assert.equal(normalizeSitemapPathname('/'), '/');
  assert.equal(normalizeSitemapPathname('https://blog.tvphus.dev'), '/');
});

test('normalizeSitemapPathname decodes percent-encoded non-ASCII slugs', () => {
  assert.equal(
    normalizeSitemapPathname('https://blog.tvphus.dev/vi/posts/h%C6%B0%E1%BB%9Bng-d%E1%BA%ABn/'),
    '/vi/posts/hướng-dẫn',
  );
  // Malformed encoding must not throw; it simply cannot match a real route.
  assert.equal(normalizeSitemapPathname('/posts/%E0%A4%A/'), '/posts/%E0%A4%A');
});

test('sitemapPostPathname includes the configured base and locale identity', () => {
  assert.equal(
    sitemapPostPathname({ locale: 'en', defaultLocale: 'en', slug: 'a/b', base: '/' }),
    '/posts/a/b',
  );
  assert.equal(
    sitemapPostPathname({ locale: 'vi', defaultLocale: 'en', slug: 'a', base: '/' }),
    '/vi/posts/a',
  );
  assert.equal(
    sitemapPostPathname({ locale: 'en', defaultLocale: 'en', slug: 'a', base: '/blog' }),
    '/blog/posts/a',
  );
  assert.equal(
    sitemapPostPathname({ locale: 'vi', defaultLocale: 'en', slug: 'a', base: '/blog/' }),
    '/blog/vi/posts/a',
  );
});

test('matcher excludes only complete path identities', () => {
  const isUnlisted = createUnlistedSitemapMatcher(['/posts/review-unlisted', '/blog/vi/posts/a']);

  assert.equal(isUnlisted('https://blog.tvphus.dev/posts/review-unlisted/'), true);
  assert.equal(isUnlisted('https://blog.tvphus.dev/posts/review-unlisted-extra/'), false);
  assert.equal(isUnlisted('https://blog.tvphus.dev/vi/posts/review-unlisted/'), false);
  assert.equal(isUnlisted('https://blog.tvphus.dev/blog/vi/posts/a/'), true);
  assert.equal(isUnlisted('https://blog.tvphus.dev/posts/review-unlisted/nested/'), false);
});

test('mixed-case/space filenames use the loader identity in the exclusion set', () => {
  const id = loaderEntryId('en/Review Hidden.md');
  const slug = contentSlug(id);
  assert.equal(id, 'en/review-hidden');
  assert.equal(slug, 'review-hidden');
  const pathname = sitemapPostPathname({
    locale: 'en',
    defaultLocale: 'en',
    slug,
    base: '/',
  });
  assert.equal(pathname, '/posts/review-hidden');
  assert.equal(
    createUnlistedSitemapMatcher([pathname])('https://blog.tvphus.dev/posts/review-hidden/'),
    true,
  );
});
