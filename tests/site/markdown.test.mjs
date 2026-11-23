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

import { parse as parseHtml } from 'parse5';
import { markdownToHtml, mdxToJs } from 'satteri';

import { siteMediaPlugin } from '../../src/site/markdown.ts';
import { satteriBaseLinks } from '../../src/plugins/satteri-base-links.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const FIXTURE_DIR = join(HERE, 'fixtures', 'markdown-site');
const ASTRO_BIN = join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');

const CDN = 'https://cdn.tvphus.dev/image/optimized/';

function compileMarkdown(source) {
  return markdownToHtml(source, { mdastPlugins: [siteMediaPlugin()] }).html;
}

/** Compile with the real base-link HAST plugin (render-time pipeline). */
function compileWithBase(source, base, extraPlugins = []) {
  return markdownToHtml(source, {
    hastPlugins: [satteriBaseLinks({ base }), ...extraPlugins],
  }).html;
}

function allElements(node, tagName, out = []) {
  if (!node) return out;
  if (node.tagName === tagName) out.push(node);
  for (const child of node.childNodes ?? []) allElements(child, tagName, out);
  if (node.content) allElements(node.content, tagName, out);
  return out;
}

function attr(element, name) {
  return element?.attrs?.find((entry) => entry.name === name)?.value;
}

function textOf(node) {
  let text = '';
  const walk = (current) => {
    if (!current) return;
    if (current.nodeName === '#text') {
      text += current.value;
      return;
    }
    for (const child of current.childNodes ?? []) walk(child);
    if (current.content) walk(current.content);
  };
  walk(node);
  return text;
}

function anchorHrefs(html) {
  const doc = parseHtml(html);
  return Object.fromEntries(allElements(doc, 'a').map((a) => [textOf(a), attr(a, 'href')]));
}

function imageSrcs(html) {
  const doc = parseHtml(html);
  return Object.fromEntries(
    allElements(doc, 'img').map((img) => [attr(img, 'alt'), attr(img, 'src')]),
  );
}

const BASE_LINK_SOURCE = [
  '[plain](/posts/a/)',
  '[already](/blog/posts/a/)',
  '[base](/blog)',
  '[base-slash](/blog/)',
  '[base-query](/blog?x=1)',
  '[base-hash](/blog#x)',
  '[blogger](/blogger/a/)',
  '[query](/posts/a/?x=1)',
  '[hash](/posts/a/#section)',
  '[external](https://example.com/x)',
  '[protocol](//cdn.example.com/x)',
  '[relative](posts/a/)',
  '[fragment](#x)',
].join('\n\n');

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

const BASE_IMAGE_SOURCE = [
  '![plain](/pixel.png)',
  '![already](/blog/pixel.png)',
  '![base](/blog)',
  '![base-slash](/blog/)',
  '![base-query](/blog?x=1)',
  '![base-hash](/blog#x)',
  '![blogger](/blogger/pixel.png)',
  '![query](/pixel.png?x=1)',
  '![hash](/pixel.png#section)',
  '![external](https://example.com/x.png)',
  '![protocol](//cdn.example.com/x.png)',
  '![relative](pixel.png)',
].join('\n\n');

test('base-path rewrite prefixes authored links once and preserves identities', () => {
  const hrefs = anchorHrefs(compileWithBase(BASE_LINK_SOURCE, '/blog'));
  assert.equal(hrefs.plain, '/blog/posts/a/');
  assert.equal(hrefs.already, '/blog/posts/a/', 'already-based link must not be prefixed twice');
  assert.equal(hrefs.base, '/blog', 'the base identity itself is already based');
  assert.equal(hrefs['base-slash'], '/blog/');
  assert.equal(hrefs['base-query'], '/blog?x=1');
  assert.equal(hrefs['base-hash'], '/blog#x');
  assert.equal(hrefs.blogger, '/blog/blogger/a/', 'a base-name prefix is a different segment');
  assert.equal(hrefs.query, '/blog/posts/a/?x=1', 'query suffix preserved');
  assert.equal(hrefs.hash, '/blog/posts/a/#section', 'hash suffix preserved');
  assert.equal(hrefs.external, 'https://example.com/x');
  assert.equal(hrefs.protocol, '//cdn.example.com/x');
  assert.equal(hrefs.relative, 'posts/a/');
  assert.equal(hrefs.fragment, '#x');
});

test('base-path rewrite applies the same idempotent rule to image sources', () => {
  const srcs = imageSrcs(compileWithBase(BASE_IMAGE_SOURCE, '/blog'));
  assert.equal(srcs.plain, '/blog/pixel.png');
  assert.equal(srcs.already, '/blog/pixel.png', 'already-based image must not be prefixed twice');
  assert.equal(srcs.base, '/blog');
  assert.equal(srcs['base-slash'], '/blog/');
  assert.equal(srcs['base-query'], '/blog?x=1');
  assert.equal(srcs['base-hash'], '/blog#x');
  assert.equal(srcs.blogger, '/blog/blogger/pixel.png');
  assert.equal(srcs.query, '/blog/pixel.png?x=1');
  assert.equal(srcs.hash, '/blog/pixel.png#section');
  assert.equal(srcs.external, 'https://example.com/x.png');
  assert.equal(srcs.protocol, '//cdn.example.com/x.png');
  assert.equal(srcs.relative, 'pixel.png');
});

test('a root base is a no-op for links and images', () => {
  const html = compileWithBase(BASE_LINK_SOURCE, '/');
  const hrefs = anchorHrefs(html);
  assert.equal(hrefs.plain, '/posts/a/');
  assert.equal(hrefs.already, '/blog/posts/a/');
  assert.equal(hrefs.blogger, '/blogger/a/');
  assert.equal(html.includes('//posts'), false, 'root base must not create a double slash');
  const srcs = imageSrcs(compileWithBase(BASE_IMAGE_SOURCE, '/'));
  assert.equal(srcs.plain, '/pixel.png');
  assert.equal(srcs.blogger, '/blogger/pixel.png');
});

test('a second application of the base rewrite is unchanged (idempotent)', () => {
  const once = compileWithBase(BASE_LINK_SOURCE, '/blog');
  const twice = compileWithBase(BASE_LINK_SOURCE, '/blog', [satteriBaseLinks({ base: '/blog' })]);
  assert.equal(twice, once);
  const imagesOnce = compileWithBase(BASE_IMAGE_SOURCE, '/blog');
  const imagesTwice = compileWithBase(BASE_IMAGE_SOURCE, '/blog', [
    satteriBaseLinks({ base: '/blog' }),
  ]);
  assert.equal(imagesTwice, imagesOnce);
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

  // ---- real base-path build (GitHub Pages / subpath deployment) --------
  const baseBuild = spawnSync(process.execPath, [ASTRO_BIN, 'build', '--root', FIXTURE_DIR], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      SITE_URL: 'https://markdown-fixture.invalid',
      BASE_PATH: '/blog',
      PUBLIC_GISCUS_ENABLED: 'false',
    },
    timeout: 180_000,
  });
  assert.equal(
    baseBuild.status,
    0,
    `base fixture build failed:\n${baseBuild.stdout}\n${baseBuild.stderr}`,
  );

  const baseMdHtml = readFileSync(join(distDir, 'index.html'), 'utf8');
  const baseHrefs = anchorHrefs(baseMdHtml);
  assert.equal(baseHrefs['posts link'], '/blog/posts/a/');
  assert.equal(baseHrefs['based link'], '/blog/posts/a/');
  assert.equal(baseHrefs['blogger link'], '/blog/blogger/a/');
  assert.equal(baseHrefs['query link'], '/blog/posts/a/?x=1');
  assert.equal(baseHrefs['hash link'], '/blog/posts/a/#section');
  const baseImages = imageSrcs(baseMdHtml);
  assert.equal(baseImages.local, '/blog/pixel.png');
  assert.ok(existsSync(join(distDir, 'pixel.png')), 'public image must exist in the base build');

  const baseImageHtml = readFileSync(join(distDir, 'image', 'index.html'), 'utf8');
  const baseImportedImg = (baseImageHtml.match(/<img[^>]*alt="imported asset"[^>]*>/) ?? [''])[0];
  assert.match(
    baseImportedImg,
    /src="\/blog\/_astro\/[^"]+"/,
    `imported Astro image must carry the base exactly once: ${baseImportedImg}`,
  );
  assert.equal(
    baseImageHtml.includes('/blog/blog/'),
    false,
    'processor ordering must not double-prefix generated image URLs',
  );
  const baseImportedSrc = /src="([^"]+)"/.exec(baseImportedImg)?.[1] ?? '';
  const baseAssetFile = baseImportedSrc.replace(/^\/blog\/_astro\//, '');
  assert.ok(
    existsSync(join(distDir, '_astro', baseAssetFile)),
    `base-built imported image resource must exist: ${baseAssetFile}`,
  );
  assert.equal(
    baseMdHtml.includes('/blog/blog/'),
    false,
    'authored links/images must not be double-prefixed',
  );
});
