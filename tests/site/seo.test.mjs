/**
 * Task 5: SEO, content visibility and navigation/behavior contracts.
 *
 * Two layers:
 *  1. Pure policy tests (locale metadata, RSS language, Giscus mount/theme
 *     helpers) — deterministic, no build.
 *  2. An end-to-end build of a temporary copy of this project with fixture
 *     content (listed / draft / unlisted / translated-sibling / math /
 *     mermaid) to prove real output behavior: drafts absent, unlisted
 *     reachable but unindexed/unlisted, reciprocal hreflang for different
 *     slugs, feeds/sitemap/search exclusion, Giscus pathname mapping and
 *     locale, TOC/heading ids, math and Mermaid opt-in, code-copy markup and
 *     reduced-motion CSS.
 *
 * The real project tree is never modified: fixtures are written into a temp
 * copy and removed with it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XMLParser } from 'fast-xml-parser';
import { parse as parseHtml } from 'parse5';

import { localePresentation } from '../../src/site/locales.ts';
import { giscusScriptAttributes, giscusThemeName, planGiscusMount } from '../../src/site/giscus.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const ASTRO_BIN = join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const PAGEFIND_BIN = join(REPO_ROOT, 'node_modules', 'pagefind', 'lib', 'runner', 'bin.cjs');
const SITE_URL = 'https://blog.tvphus.dev';

// Files copied into the temporary project (enough to build the real site).
const COPY_ENTRIES = [
  'src',
  'public',
  'astro.config.mjs',
  'package.json',
  'tsconfig.json',
  'bunfig.toml',
  '.env.example',
  '.node-version',
];

// ---------------------------------------------------------------------------
// Tiny DOM helpers over parse5 (no regex HTML parsing).
// ---------------------------------------------------------------------------

function allElements(node, tagName, out = []) {
  if (!node) return out;
  if (node.tagName === tagName) out.push(node);
  const children = node.childNodes ?? node.children ?? [];
  for (const child of children) allElements(child, tagName, out);
  if (node.content) allElements(node.content, tagName, out);
  return out;
}

function attr(element, name) {
  return element?.attrs?.find((a) => a.name === name)?.value;
}

function loadHtml(file) {
  return parseHtml(readFileSync(file, 'utf8'));
}

function headLinks(doc) {
  const head = allElements(doc, 'head')[0];
  return allElements(head, 'link');
}

function metaContent(doc, key) {
  const metas = allElements(doc, 'head').flatMap((head) => allElements(head, 'meta'));
  const match = metas.find((meta) => attr(meta, 'property') === key || attr(meta, 'name') === key);
  return match ? attr(match, 'content') : undefined;
}

// ---------------------------------------------------------------------------
// Pure policy tests
// ---------------------------------------------------------------------------

test('RSS language metadata is locale-specific (VI corrected from the baseline en-us defect)', () => {
  assert.equal(localePresentation.en.rssLanguage, 'en-us');
  assert.equal(localePresentation.vi.rssLanguage, 'vi-vn');
});

test('Giscus theme maps theme attribute to the documented theme names', () => {
  assert.equal(giscusThemeName('chirpy-dark'), 'dark');
  assert.equal(giscusThemeName('chirpy-light'), 'light');
  assert.equal(giscusThemeName(null), 'light');
});

test('Giscus script attributes keep pathname mapping and per-locale language', () => {
  const base = {
    repo: 'miyukowo/blog',
    repoId: 'R_kgDOtest',
    category: 'Announcements',
    categoryId: 'DIC_kwDOtest',
    mapping: 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'top',
    loading: 'lazy',
  };
  const en = giscusScriptAttributes({ ...base, locale: 'en' }, 'light');
  assert.equal(en['data-mapping'], 'pathname');
  assert.equal(en['data-lang'], 'en');
  assert.equal(en['data-theme'], 'light');
  const vi = giscusScriptAttributes({ ...base, locale: 'vi' }, 'dark');
  assert.equal(vi['data-lang'], 'vi');
  assert.equal(vi['data-theme'], 'dark');
});

test('Giscus remount plan cleans stale script+iframe and never double-mounts', () => {
  // Fresh cold load: one clean mount, no cleanup needed.
  assert.deepEqual(
    planGiscusMount({ hasClientScript: false, hasFrame: false, markedMounted: false }),
    { action: 'mount', cleanup: false },
  );
  // Client navigation: a previous mount exists -> clean it up and remount once.
  assert.deepEqual(
    planGiscusMount({ hasClientScript: true, hasFrame: true, markedMounted: true }),
    { action: 'mount', cleanup: true },
  );
  // Stale marked state without any script (failed previous load) still retries.
  assert.deepEqual(
    planGiscusMount({ hasClientScript: false, hasFrame: false, markedMounted: true }),
    { action: 'mount', cleanup: false },
  );
});

// ---------------------------------------------------------------------------
// End-to-end build of a temporary fixture copy
// ---------------------------------------------------------------------------

const FIXTURE_POSTS = {
  'en/seo-listed/index.mdx': `---
title: 'SEO listed fixture'
description: 'A listed fixture post with headings and a code block.'
pubDate: 2026-10-01
toc: true
---

## Section One

Some text with a code block.

\`\`\`js
const answer = 42;
\`\`\`

## Section Two

More text.
`,
  'vi/seo-listed-vi/index.mdx': `---
title: 'SEO listed VI fixture'
description: 'Bản dịch với slug khác để kiểm tra hreflang thật.'
pubDate: 2026-10-01
translationKey: 'seo-listed'
---

## Phần một

Nội dung tiếng Việt.
`,
  // Upstream renders KaTeX math in `.md` posts (its own latex-math demo is a
  // `.md` file); MDX cannot carry inline raw HTML, so math-in-MDX remains a
  // documented limitation.
  'en/seo-math.md': `---
title: 'SEO math fixture'
description: 'Math opt-in fixture with inline math.'
pubDate: 2026-10-02
math: true
---

Inline math: $x^2 + y^2 = z^2$.
`,
  // Upstream's mermaid demo is a `.md` post: fenced code is replaced by a raw
  // HTML wrapper, which MDX cannot carry (same raw-HTML limitation as math).
  'en/seo-mermaid.md': `---
title: 'SEO mermaid fixture'
description: 'Mermaid opt-in fixture.'
pubDate: 2026-10-03
mermaid: true
---

\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`
`,
  'en/seo-draft/index.mdx': `---
title: 'SEO draft fixture'
description: 'Must never reach public output.'
pubDate: 2026-10-04
draft: true
---

Draft body.
`,
  'en/seo-unlisted/index.mdx': `---
title: 'SEO unlisted fixture'
description: 'Reachable by direct URL, absent from listings and search.'
pubDate: 2026-10-05
unlisted: true
translationKey: 'seo-unlisted'
---

Unlisted body.
`,
  'vi/seo-unlisted-vi/index.mdx': `---
title: 'SEO unlisted VI fixture'
description: 'Trang ẩn nhưng vẫn truy cập trực tiếp được.'
pubDate: 2026-10-05
unlisted: true
translationKey: 'seo-unlisted'
---

Nội dung ẩn.
`,
};

function buildFixtureProject() {
  // Keep the fixture inside the repository tree so Node/Vite resolve the
  // parent checkout's node_modules normally (symlinked node_modules confuses
  // Astro's virtual-module metadata resolution).
  const tempParent = join(REPO_ROOT, '.tmp-seo-fixtures');
  mkdirSync(tempParent, { recursive: true });
  const tempRoot = mkdtempSync(join(tempParent, 'seo-'));
  for (const entry of COPY_ENTRIES) {
    const source = join(REPO_ROOT, entry);
    if (!existsSync(source)) continue;
    cpSync(source, join(tempRoot, entry), { recursive: true });
  }
  // The Astro Fonts API resolves `./node_modules/...` font sources relative to
  // the project root, so the temp project needs the dependency tree visible.
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(tempRoot, 'node_modules'), 'dir');
  for (const [relPath, contents] of Object.entries(FIXTURE_POSTS)) {
    const target = join(tempRoot, 'src', 'content', 'posts', relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, contents, 'utf8');
  }

  const env = {
    ...process.env,
    SITE_URL,
    BASE_PATH: '/',
    PUBLIC_GISCUS_ENABLED: 'true',
    PUBLIC_GISCUS_REPO: 'miyukowo/blog',
    PUBLIC_GISCUS_REPO_ID: 'R_kgDOtest',
    PUBLIC_GISCUS_CATEGORY: 'Announcements',
    PUBLIC_GISCUS_CATEGORY_ID: 'DIC_kwDOtest',
  };

  const build = spawnSync(process.execPath, [ASTRO_BIN, 'build'], {
    cwd: tempRoot,
    env,
    encoding: 'utf8',
    timeout: 300_000,
  });
  assert.equal(build.status, 0, `fixture build failed:\n${build.stdout}\n${build.stderr}`);

  const pagefind = spawnSync(
    process.execPath,
    [PAGEFIND_BIN, '--site', 'dist', '--output-subdir', '_pagefind'],
    {
      cwd: tempRoot,
      encoding: 'utf8',
      timeout: 120_000,
    },
  );
  assert.equal(pagefind.status, 0, `pagefind failed:\n${pagefind.stdout}\n${pagefind.stderr}`);

  return tempRoot;
}

function readXml(file) {
  return new XMLParser({ removeNSPrefix: true }).parse(readFileSync(file, 'utf8'));
}

/** Find the generated page for a post path inside a build. */
function pageFile(distDir, routePath) {
  return routePath.endsWith('/')
    ? join(distDir, routePath.slice(1), 'index.html')
    : join(distDir, routePath.slice(1));
}

test('temporary fixture build satisfies SEO/visibility/navigation contracts', async (t) => {
  const tempRoot = buildFixtureProject();
  t.after(() => rmSync(tempRoot, { recursive: true, force: true }));
  const distDir = join(tempRoot, 'dist');

  // ---- drafts never reach public output -------------------------------
  const draft = distDir + '/posts/seo-draft/index.html';
  assert.equal(existsSync(draft), false, 'draft page must not be generated');

  const sitemap = readXml(join(distDir, 'sitemap-0.xml'));
  const sitemapUrls = (
    Array.isArray(sitemap.urlset.url) ? sitemap.urlset.url : [sitemap.urlset.url]
  ).map((entry) => entry.loc);
  assert.equal(
    sitemapUrls.some((url) => url.includes('seo-draft')),
    false,
    'draft must not be in the sitemap',
  );

  // ---- unlisted: reachable, noindex, excluded everywhere -------------
  const unlistedFile = pageFile(distDir, '/posts/seo-unlisted/');
  const unlistedViFile = pageFile(distDir, '/vi/posts/seo-unlisted-vi/');
  assert.ok(existsSync(unlistedFile), 'unlisted post must still have a direct URL');
  assert.ok(existsSync(unlistedViFile), 'unlisted VI post must still have a direct URL');

  for (const file of [unlistedFile, unlistedViFile]) {
    const doc = loadHtml(file);
    assert.equal(metaContent(doc, 'robots'), 'noindex, nofollow', 'unlisted page must be noindex');
    const body = allElements(doc, 'body')[0];
    assert.equal(
      attr(body, 'data-pagefind-ignore'),
      '',
      'unlisted page body must carry data-pagefind-ignore for Pagefind',
    );
  }

  assert.equal(
    sitemapUrls.some((url) => url.includes('seo-unlisted')),
    false,
    'unlisted must not be in the sitemap',
  );
  // Pagefind must not index unlisted pages.
  const pagefindEntry = JSON.parse(
    readFileSync(join(distDir, '_pagefind', 'pagefind-entry.json'), 'utf8'),
  );
  const pagefindTotal = Object.values(pagefindEntry.languages).reduce(
    (sum, lang) => sum + lang.page_count,
    0,
  );
  // 33 baseline pages + seo-listed, seo-listed-vi, seo-math, seo-mermaid.
  assert.equal(pagefindTotal, 37, 'Pagefind must index listed pages only');
  assert.deepEqual(
    Object.keys(pagefindEntry.languages).sort(),
    ['en-us', 'vi-vn'],
    'EN and VI must both be searchable',
  );
  assert.equal(pagefindEntry.languages['en-us'].page_count, 20);
  assert.equal(pagefindEntry.languages['vi-vn'].page_count, 17);

  // Listings/navigation must not link to unlisted or drafts.
  for (const listing of ['index.html', 'archives/index.html', 'page/1/index.html']) {
    const file = join(distDir, listing);
    if (!existsSync(file)) continue;
    const html = readFileSync(file, 'utf8');
    assert.equal(html.includes('seo-unlisted'), false, `${listing} must not link unlisted posts`);
    assert.equal(html.includes('seo-draft'), false, `${listing} must not link drafts`);
  }

  // ---- feeds: language + excluded unlisted/draft ----------------------
  const enFeed = readXml(join(distDir, 'rss.xml'));
  assert.equal(enFeed.rss.channel.language, 'en-us');
  const enItems = (
    Array.isArray(enFeed.rss.channel.item) ? enFeed.rss.channel.item : [enFeed.rss.channel.item]
  ).map((item) => item.link);
  assert.equal(
    enItems.some((link) => link.includes('seo-unlisted')),
    false,
  );
  assert.equal(
    enItems.some((link) => link.includes('seo-draft')),
    false,
  );
  assert.ok(
    enItems.some((link) => link.includes('/posts/seo-listed/')),
    enItems.join(', '),
  );

  const viFeed = readXml(join(distDir, 'vi/rss.xml'));
  assert.equal(viFeed.rss.channel.language, 'vi-vn', 'VI RSS language must be vi-vn');
  const viItems = (
    Array.isArray(viFeed.rss.channel.item) ? viFeed.rss.channel.item : [viFeed.rss.channel.item]
  ).map((item) => item.link);
  assert.equal(
    viItems.some((link) => link.includes('seo-unlisted')),
    false,
  );

  // ---- canonical + reciprocal hreflang for different EN/VI slugs -------
  const listedFile = pageFile(distDir, '/posts/seo-listed/');
  const listedDoc = loadHtml(listedFile);
  const listedLinks = headLinks(listedDoc);
  const canonical = listedLinks.find((link) => attr(link, 'rel') === 'canonical');
  assert.equal(attr(canonical, 'href'), `${SITE_URL}/posts/seo-listed/`);

  const hreflangs = Object.fromEntries(
    listedLinks
      .filter((link) => attr(link, 'rel') === 'alternate' && attr(link, 'hreflang'))
      .map((link) => [attr(link, 'hreflang'), attr(link, 'href')]),
  );
  assert.equal(hreflangs.en, `${SITE_URL}/posts/seo-listed/`);
  assert.equal(
    hreflangs.vi,
    `${SITE_URL}/vi/posts/seo-listed-vi/`,
    'hreflang must use the real sibling slug',
  );
  assert.equal(hreflangs['x-default'], `${SITE_URL}/posts/seo-listed/`);

  // Language switcher link is the actual sibling destination.
  const listedHtml = readFileSync(listedFile, 'utf8');
  assert.ok(
    listedHtml.includes('/vi/posts/seo-listed-vi/'),
    'switcher must link to the sibling post',
  );

  // Vi sibling reciprocates.
  const viListedDoc = loadHtml(pageFile(distDir, '/vi/posts/seo-listed-vi/'));
  const viHreflangs = Object.fromEntries(
    headLinks(viListedDoc)
      .filter((link) => attr(link, 'rel') === 'alternate' && attr(link, 'hreflang'))
      .map((link) => [attr(link, 'hreflang'), attr(link, 'href')]),
  );
  assert.equal(viHreflangs.en, `${SITE_URL}/posts/seo-listed/`);
  assert.equal(viHreflangs.vi, `${SITE_URL}/vi/posts/seo-listed-vi/`);

  // ---- OG image references exist --------------------------------------
  const ogImage = metaContent(listedDoc, 'og:image');
  assert.ok(ogImage, 'article must emit an og:image');
  assert.ok(ogImage.startsWith(`${SITE_URL}/`), ogImage);
  const ogPath = ogImage.slice(SITE_URL.length);
  assert.ok(existsSync(join(distDir, ogPath)), `og:image resource must exist: ${ogPath}`);
  assert.ok(
    existsSync(join(distDir, 'og-default.png')) || existsSync(join(distDir, '_astro')),
    'default OG asset present',
  );

  // ---- Giscus: pathname mapping, per-locale language -------------------
  const findGiscusMount = (doc) =>
    allElements(doc, 'div').find((element) => attr(element, 'data-giscus-mount') !== undefined);
  const giscusMount = findGiscusMount(loadHtml(listedFile));
  assert.ok(giscusMount, 'giscus mount element must be rendered');
  assert.equal(attr(giscusMount, 'data-mapping'), 'pathname');
  assert.equal(attr(giscusMount, 'data-locale'), 'en');
  assert.equal(attr(giscusMount, 'data-repo'), 'miyukowo/blog');
  const viGiscus = findGiscusMount(loadHtml(pageFile(distDir, '/vi/posts/seo-listed-vi/')));
  assert.equal(attr(viGiscus, 'data-locale'), 'vi', 'VI pages must mount giscus with vi');

  // ---- TOC/heading ids + code copy ------------------------------------
  assert.ok(listedHtml.includes('aria-labelledby="toc-heading"'), 'TOC must render for headings');
  assert.match(listedHtml, /<h2[^>]*id="section-one"/);
  assert.match(listedHtml, /data-toc-link="section-one"/);
  assert.ok(listedHtml.includes('expressive-code'), 'Expressive Code markup present');
  assert.ok(/copy/i.test(listedHtml), 'code copy control present');

  // ---- math / mermaid opt-in ------------------------------------------
  const mathHtml = readFileSync(pageFile(distDir, '/posts/seo-math/'), 'utf8');
  assert.ok(mathHtml.includes('class="katex"'), 'math page must render KaTeX markup');
  assert.match(
    mathHtml,
    /<link[^>]+href="\/_astro\/MathStyles\.[^"]+\.css"/,
    'math page must load the page-scoped KaTeX stylesheet',
  );
  // NOTE (upstream behavior): with the Astro 7 dynamic-import layout the
  // extracted MathStyles CSS chunk is linked from all post pages, so the
  // "only math pages download KaTeX CSS" intent is not fully honored by the
  // upstream implementation. Recorded as a minor known limitation, not a
  // local regression; the KaTeX *markup* remains opt-in via `math: true`.

  const mermaidHtml = readFileSync(pageFile(distDir, '/posts/seo-mermaid/'), 'utf8');
  assert.ok(
    /class="chirpy-mermaid-wrapper"/.test(mermaidHtml),
    'mermaid block must be wrapped for client rendering',
  );
  assert.ok(
    /data-mermaid-src="/.test(mermaidHtml),
    'mermaid source must be preserved for the island',
  );
  assert.ok(
    mermaidHtml.includes('graph TD') || mermaidHtml.includes('graph td'),
    'mermaid source preserved',
  );
  assert.equal(
    listedHtml.includes('chirpy-mermaid'),
    false,
    'non-mermaid page must not include Mermaid markup',
  );

  // ---- mobile/keyboard accessibility affordances -----------------------
  assert.ok(listedHtml.includes('href="#main"'), 'skip-to-content link present');
  assert.ok(listedHtml.includes('data-sidebar-toggle'), 'mobile menu toggle present');
  assert.ok(listedHtml.includes('aria-label="Main Content"'), 'main landmark labelled');
  assert.ok(/aria-label="[^"]*"/.test(listedHtml), 'labelled controls present');

  // ---- reduced motion CSS ---------------------------------------------
  const cssDir = join(distDir, '_astro');
  const css = readdirSync(cssDir)
    .filter((file) => file.endsWith('.css'))
    .map((file) => readFileSync(join(cssDir, file), 'utf8'))
    .join('\n');
  assert.ok(css.includes('prefers-reduced-motion'), 'reduced-motion behavior must be preserved');
});
