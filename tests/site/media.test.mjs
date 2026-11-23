/**
 * Unit tests for the site-owned media URL policy (Task 4).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveMediaUrl, CDN_BASE, CLOUDINARY_UPLOAD_BASE } from '../../src/site/media.ts';

test('Cloudinary upload URLs are mapped to the optimized CDN path', () => {
  assert.equal(
    resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}sample.jpg`),
    `${CDN_BASE}/image/optimized/sample.jpg`,
  );
});

test('existing transformation prefixes are stripped, not duplicated', () => {
  assert.equal(
    resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}f_auto,q_auto/sample.jpg`),
    `${CDN_BASE}/image/optimized/sample.jpg`,
  );
  // Even if a stale double transform is present, collapse it to one CDN path.
  assert.equal(
    resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}f_auto,q_auto/f_auto,q_auto/sample.jpg`),
    `${CDN_BASE}/image/optimized/sample.jpg`,
  );
});

test('versioned and nested public ids are preserved', () => {
  assert.equal(
    resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}v1234567890/posts/2026/hero%20image.jpg`),
    `${CDN_BASE}/image/optimized/v1234567890/posts/2026/hero%20image.jpg`,
  );
  assert.equal(
    resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}f_auto/v1234567890/nested/public-id.webp`),
    `${CDN_BASE}/image/optimized/v1234567890/nested/public-id.webp`,
  );
});

test('already-normalized CDN URLs are idempotent', () => {
  const once = resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}f_auto/hero.jpg`);
  assert.equal(once, `${CDN_BASE}/image/optimized/hero.jpg`);
  assert.equal(resolveMediaUrl(once), once);
  // A CDN URL with a different (already-final) query is untouched.
  const withQuery = `${CDN_BASE}/image/optimized/hero.jpg?width=800`;
  assert.equal(resolveMediaUrl(withQuery), withQuery);
});

test('query strings and fragments are preserved', () => {
  assert.equal(
    resolveMediaUrl(`${CLOUDINARY_UPLOAD_BASE}f_auto/hero.jpg?v=3#top`),
    `${CDN_BASE}/image/optimized/hero.jpg?v=3#top`,
  );
});

test('unrelated HTTPS URLs are never rewritten', () => {
  for (const url of [
    'https://images.unsplash.com/photo-123',
    'https://cdn.jsdelivr.net/npm/pkg/logo.png',
    'https://example.com/asset.png',
  ]) {
    assert.equal(resolveMediaUrl(url), url);
  }
});

test('root paths and local assets are preserved', () => {
  assert.equal(resolveMediaUrl('/images/local.jpg'), '/images/local.jpg');
  assert.equal(resolveMediaUrl('/_astro/asset.abc123.webp'), '/_astro/asset.abc123.webp');
  assert.equal(resolveMediaUrl('./relative.jpg'), './relative.jpg');
  assert.equal(resolveMediaUrl('../relative.jpg'), '../relative.jpg');
});

test('bare filenames are not guessed to be Cloudinary ids', () => {
  assert.equal(resolveMediaUrl('hero.jpg'), 'hero.jpg');
  assert.equal(resolveMediaUrl('my-image'), 'my-image');
});

test('empty and non-string inputs pass through defensively', () => {
  assert.equal(resolveMediaUrl(''), '');
  assert.equal(resolveMediaUrl(undefined), undefined);
});
