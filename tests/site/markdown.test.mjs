/**
 * Task 4: Markdown/MDX media hook tests.
 *
 * Level 1 — compile behavior through the real Sätteri API used by Astro.
 * Level 2 — rendered fixture build (`.md`, `.mdx`, `SmartImage`) asserting
 * rendered `src`/`alt`/`srcset` and resource existence, not just transformed
 * strings.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { markdownToHtml, mdxToJs } from 'satteri';

import { siteMediaPlugin } from '../../src/site/markdown.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const FIXTURE_DIR = join(HERE, 'fixtures', 'markdown-site');
const ASTRO_BIN = join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

const CDN = 'https://cdn.tvphus.dev/image/optimized/';

function compileMarkdown(source) {
  return markdownToHtml(source, { mdastPlugins: [siteMediaPlugin()] }).html;
}

test('Markdown image nodes are rewritten before Astro image collection', () => {
  const html = compileMarkdown(
    '![alt](https://res.cloudinary.com/tvphus/image/upload/f_auto/hero.jpg)',
  );
  assert.ok(html.includes(`src="${CDN}hero.jpg"`), html);
  assert.ok(html.includes('alt="alt"'), html);
});

test('reference-style image definitions used by images are rewritten', () => {
  const html = compileMarkdown(
    [
      '![ref][img]',
      '',
      '[img]: https://res.cloudinary.com/tvphus/image/upload/f_auto/ref.jpg',
    ].join('\n'),
  );
  assert.ok(html.includes(`src="${CDN}ref.jpg"`), html);
});

test('link-only reference definitions keep their original URL', () => {
  const html = compileMarkdown(
    ['[a link][link]', '', '[link]: https://res.cloudinary.com/tvphus/image/upload/link.jpg'].join(
      '\n',
    ),
  );
  assert.ok(
    html.includes('https://res.cloudinary.com/tvphus/image/upload/link.jpg'),
    'link target must stay unchanged',
  );
  assert.ok(!html.includes('cdn.tvphus.dev'), 'link target must not be rewritten');
});

test('a definition before its image reference keeps its original valid URL', () => {
  const html = compileMarkdown(
    ['[img]: https://res.cloudinary.com/tvphus/image/upload/early.jpg', '', '![ref][img]'].join(
      '\n',
    ),
  );
  // Documented limitation: classification happens in document order.
  assert.ok(html.includes('https://res.cloudinary.com/tvphus/image/upload/early.jpg'), html);
});

test('unrelated hosts, already-CDN URLs and bare filenames are preserved', () => {
  const html = compileMarkdown(
    [
      '![external](https://example.com/x.png)',
      '',
      `![cdn](${CDN}already.jpg)`,
      '',
      '![bare](hero.jpg)',
    ].join('\n'),
  );
  assert.ok(html.includes('src="https://example.com/x.png"'), html);
  assert.ok(html.includes(`src="${CDN}already.jpg"`), html);
  assert.ok(html.includes('src="hero.jpg"'), html);
});

test('MDX inherits the same Sätteri processor for Markdown image syntax', () => {
  const { code } = mdxToJs('![alt](https://res.cloudinary.com/tvphus/image/upload/mdx.jpg)\n', {
    mdastPlugins: [siteMediaPlugin()],
  });
  assert.ok(String(code).includes(`${CDN}mdx.jpg`), String(code).slice(0, 400));
});

test('rendered fixture: md, mdx and SmartImage produce real src/alt/srcset output', () => {
  const distDir = join(FIXTURE_DIR, 'dist');
  const build = spawnSync(process.execPath, [ASTRO_BIN, 'build', '--root', FIXTURE_DIR], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SITE_URL: 'https://markdown-fixture.invalid',
      PUBLIC_GISCUS_ENABLED: 'false',
    },
    timeout: 180_000,
  });
  assert.equal(build.status, 0, `fixture build failed:\n${build.stdout}\n${build.stderr}`);

  const mdHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
  // Local public image renders as a plain <img> pointing at the copied asset.
  assert.match(mdHtml, /<img[^>]+src="\/pixel\.png"[^>]*alt="local"/);
  assert.ok(existsSync(join(distDir, 'pixel.png')), 'public image must be copied to dist');

  // Converted Cloudinary URLs appear in rendered output.
  assert.ok(mdHtml.includes(`src="${CDN}hero.jpg"`), mdHtml);
  assert.ok(mdHtml.includes(`src="${CDN}ref.jpg"`), mdHtml);
  // Non-target URLs are not rewritten.
  assert.ok(mdHtml.includes('src="https://example.com/x.png"'), mdHtml);
  assert.ok(mdHtml.includes(`src="${CDN}already.jpg"`), mdHtml);

  const mdxHtml = readFileSync(join(distDir, 'mdx-page', 'index.html'), 'utf8');
  assert.ok(mdxHtml.includes(`src="${CDN}mdx.jpg"`), mdxHtml);

  // SmartImage boundary: imported asset gets optimized srcset; public path is
  // passed through unchanged.
  const imageHtml = readFileSync(join(distDir, 'image', 'index.html'), 'utf8');
  const importedImg = (imageHtml.match(/<img[^>]*alt="imported asset"[^>]*>/) ?? [''])[0];
  assert.ok(importedImg.includes('srcset='), `imported asset needs a srcset: ${importedImg}`);
  const publicImg = (imageHtml.match(/<img[^>]*alt="public path"[^>]*>/) ?? [''])[0];
  assert.ok(publicImg.includes('src="/pixel.png"'), `public path must pass through: ${publicImg}`);
  // Every srcset candidate must exist as a built resource.
  const srcsets = [...imageHtml.matchAll(/srcset="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(srcsets.length > 0, 'expected an optimized srcset for the imported asset');
  const built = new Set(readdirSync(join(distDir, '_astro')));
  for (const srcset of srcsets) {
    for (const entry of srcset.split(',')) {
      const url = entry.trim().split(/\s+/)[0];
      if (!url || !url.startsWith('/_astro/')) continue;
      const file = url.slice('/_astro/'.length);
      assert.ok(built.has(file), `missing built image resource ${file}`);
    }
  }
});
