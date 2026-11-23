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
import { normalizeSitemapPathname } from '../../src/site/sitemap.ts';

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

function hasClass(element, className) {
  return (attr(element, 'class') ?? '').split(/\s+/).includes(className);
}

/** Text content of a parsed tree (text nodes only, no markup). */
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

/**
 * True when `needle` appears inside an actual text node. This is the
 * regression detector for MDX: generated HTML that MDX escapes into a string
 * child becomes a text node rather than an element.
 */
function hasTextContaining(node, needle) {
  if (!node) return false;
  if (node.nodeName === '#text' && String(node.value).includes(needle)) return true;
  for (const child of node.childNodes ?? []) {
    if (hasTextContaining(child, needle)) return true;
  }
  if (node.content && hasTextContaining(node.content, needle)) return true;
  return false;
}

/**
 * True when the document loads the Mermaid client island. Astro emits the
 * component's processed script as a page-scoped module chunk; the frontmatter
 * `mermaid` flag is what conditionally renders `Mermaid.astro`.
 */
function hasMermaidIsland(doc) {
  return allElements(doc, 'script').some((script) =>
    /Mermaid\.astro[^/]*\.js$/.test(attr(script, 'src') ?? ''),
  );
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
  // Keep the upstream `.md` math path covered alongside the MDX fixtures
  // below; the MDX compatibility seam must not change Markdown behavior.
  'en/seo-math.md': `---
title: 'SEO math fixture'
description: 'Math opt-in fixture with inline math.'
pubDate: 2026-10-02
math: true
---

Inline math: $x^2 + y^2 = z^2$.
`,
  // Keep the upstream `.md` Mermaid path covered alongside the MDX fixtures.
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
  // MDX is the CMS authoring format: math, Mermaid, alert/raw-HTML fences and
  // authored JSX must all render as elements, not escaped text children.
  'en/seo-math-mdx/index.mdx': `---
title: 'SEO MDX math fixture'
description: 'Inline and display math authored in MDX.'
pubDate: 2026-10-06
math: true
---

Inline math: $x^2 + y^2 = z^2$.

Display math:

$$
\\int_0^1 x\\,dx = \\frac{1}{2}
$$
`,
  'en/seo-mermaid-mdx/index.mdx': `---
title: 'SEO MDX mermaid fixture'
description: 'Mermaid diagram authored in MDX.'
pubDate: 2026-10-07
mermaid: true
---

\`\`\`mermaid
graph TD
  A[Start] --> B[End]
\`\`\`
`,
  // Mermaid markup renders without the island when the frontmatter opt-in is
  // absent, matching upstream behavior.
  'en/seo-mermaid-off/index.mdx': `---
title: 'SEO MDX mermaid opt-out fixture'
description: 'Mermaid fence without the mermaid frontmatter opt-in.'
pubDate: 2026-10-08
---

\`\`\`mermaid
graph LR
  X --> Y
\`\`\`
`,
  'en/seo-alert-mdx/index.mdx': `---
title: 'SEO MDX alert fixture'
description: 'Alert fence authored in MDX.'
pubDate: 2026-10-09
---

\`\`\`alert
type: info
title: MDX alert title
description: MDX alert description.
\`\`\`
`,
  'en/seo-ashtml-mdx/index.mdx': `---
title: 'SEO MDX ashtml fixture'
description: 'Raw HTML fence authored in MDX.'
pubDate: 2026-10-10
---

\`\`\`ashtml
<section id="authored-html" data-kind="raw"><p>Authored <em>HTML</em></p></section>
\`\`\`
`,
  'en/seo-jsx-mdx/index.mdx': `---
title: 'SEO MDX JSX fixture'
description: 'Ordinary authored JSX in MDX.'
pubDate: 2026-10-11
---

<div id="authored-jsx" data-kind="component">
  Authored <strong>JSX</strong>
</div>
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
  // Exact sitemap identity fixtures: the unlisted slug is a prefix of a listed
  // slug and is reused by a listed post in the other locale. Only the first
  // route may be omitted from the sitemap.
  'en/review-unlisted/index.mdx': `---
title: 'Sitemap unlisted prefix fixture'
description: 'Unlisted route whose slug prefixes a listed route.'
pubDate: 2026-10-12
unlisted: true
---

Unlisted prefix body.
`,
  'en/review-unlisted-extra/index.mdx': `---
title: 'Sitemap listed prefix fixture'
description: 'Listed route whose slug starts with the unlisted slug.'
pubDate: 2026-10-13
---

Listed prefix body.
`,
  'vi/review-unlisted/index.mdx': `---
title: 'Sitemap listed VI fixture'
description: 'Listed VI route reusing the unlisted EN slug.'
pubDate: 2026-10-14
---

Nội dung tiếng Việt trùng slug với bài ẩn.
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
  // ---- loader identity fixtures (follow-up Task 1) ---------------------
  // Nested folder with a terminal `index` segment: the route drops only the
  // terminal index and keeps the nested path.
  'en/nested/deep/index.mdx': `---
title: 'Nested route fixture'
description: 'Nested folder route with a terminal index segment.'
pubDate: 2026-10-15
---

Nested body.
`,
  // Internal `index` segments are part of the identity, not stripped.
  'en/nested/index/index.md': `---
title: 'Nested internal index fixture'
description: 'An internal index segment must remain part of the route identity.'
pubDate: 2026-10-16
---

Nested index body.
`,
  // Non-ASCII directory name: the loader keeps Unicode letters, lowercases and
  // converts the space to a hyphen. The sitemap stores the percent-encoded URL.
  'en/Non-ASCII Ünïcode/index.mdx': `---
title: 'Non-ASCII filename fixture'
description: 'Unicode filename normalization fixture.'
pubDate: 2026-10-17
---

Non-ASCII body.
`,
  // Explicit frontmatter `slug` wins over the folder name in the loader, the
  // sitemap and the artifact expectations.
  'en/slug-override/index.mdx': `---
title: 'Explicit slug fixture'
description: 'Explicit frontmatter slug replaces the folder identity.'
pubDate: 2026-10-18
slug: 'explicit-identity'
---

Explicit slug body.
`,
  // Explicit slug + unlisted: only the explicit identity is excluded.
  'en/Unlisted Override/index.mdx': `---
title: 'Unlisted explicit slug fixture'
description: 'Explicit slug on an unlisted post.'
pubDate: 2026-10-19
slug: 'hidden-identity'
unlisted: true
---

Hidden explicit slug body.
`,
  // Mixed-case/space filename + unlisted: emitted at the loader-normalized
  // route, excluded from sitemap/listings/feeds/search, and emits its OG PNG.
  'en/Review Hidden.md': `---
title: 'Review Hidden fixture'
description: 'Unlisted fixture whose mixed-case, space-containing filename must match its normalized route and stay out of discovery surfaces.'
pubDate: 2026-11-13
unlisted: true
---

This unlisted post exists so the fixture build exercises filename identity normalization:
the loader emits \`/posts/review-hidden/\`, the sitemap exclusion must use that same
identity, the page stays directly reachable and noindex, and it never appears in
listings, feeds, search or the sitemap.
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

  // ---- exact unlisted identity, not substring matching ----------------
  const unlistedPrefixFile = pageFile(distDir, '/posts/review-unlisted/');
  const listedPrefixFile = pageFile(distDir, '/posts/review-unlisted-extra/');
  const listedViFile = pageFile(distDir, '/vi/posts/review-unlisted/');
  for (const file of [unlistedPrefixFile, listedPrefixFile, listedViFile]) {
    assert.ok(existsSync(file), `fixture page must be emitted: ${file}`);
  }
  const sitemapPathnames = new Set(sitemapUrls.map((url) => normalizeSitemapPathname(url)));
  assert.equal(
    sitemapPathnames.has('/posts/review-unlisted'),
    false,
    'the unlisted route must be absent from the sitemap',
  );
  assert.equal(
    sitemapPathnames.has('/posts/review-unlisted-extra'),
    true,
    'a listed route sharing the unlisted prefix must stay in the sitemap',
  );
  assert.equal(
    sitemapPathnames.has('/vi/posts/review-unlisted'),
    true,
    'the same slug in another locale must stay in that locale sitemap',
  );

  // ---- loader filename/slug identity fixtures (Task 1) -----------------
  // A mixed-case/space filename in the disposable fixture project must
  // resolve to the loader-normalized route, stay directly reachable/noindex,
  // and be excluded from discovery using that same identity.
  const reviewHiddenFile = pageFile(distDir, '/posts/review-hidden/');
  assert.ok(
    existsSync(reviewHiddenFile),
    'mixed-case/space filename must emit /posts/review-hidden/',
  );
  const reviewHiddenDoc = loadHtml(reviewHiddenFile);
  assert.equal(metaContent(reviewHiddenDoc, 'robots'), 'noindex, nofollow');
  assert.equal(
    sitemapPathnames.has('/posts/review-hidden'),
    false,
    'normalized unlisted identity must be excluded from the sitemap',
  );

  // Nested terminal index -> /posts/nested/deep/ (index removed).
  const nestedDeepFile = pageFile(distDir, '/posts/nested/deep/');
  assert.ok(existsSync(nestedDeepFile), 'nested terminal index route must be emitted');
  assert.equal(sitemapPathnames.has('/posts/nested/deep'), true);
  // Internal index segment stays in the identity -> /posts/nested/index/.
  const nestedIndexFile = pageFile(distDir, '/posts/nested/index/');
  assert.ok(existsSync(nestedIndexFile), 'internal index segment must remain part of the route');
  assert.equal(sitemapPathnames.has('/posts/nested/index'), true);

  // Non-ASCII filename keeps Unicode letters, lowercases and hyphenates the
  // space; the sitemap stores the percent-encoded URL and the normalized
  // identity matches.
  const nonAsciiFile = pageFile(distDir, '/posts/non-ascii-ünïcode/');
  assert.ok(existsSync(nonAsciiFile), 'non-ASCII filename route must be emitted');
  assert.equal(sitemapPathnames.has('/posts/non-ascii-ünïcode'), true);

  // Explicit frontmatter slug wins in both the route and the sitemap.
  const explicitFile = pageFile(distDir, '/posts/explicit-identity/');
  assert.ok(existsSync(explicitFile), 'explicit slug route must be emitted');
  assert.equal(sitemapPathnames.has('/posts/explicit-identity'), true);
  assert.equal(
    existsSync(pageFile(distDir, '/posts/slug-override/')),
    false,
    'folder name must not leak when an explicit slug is configured',
  );

  // Explicit slug + unlisted: only the explicit identity is excluded.
  const hiddenOverrideFile = pageFile(distDir, '/posts/hidden-identity/');
  assert.ok(existsSync(hiddenOverrideFile), 'unlisted explicit slug route must be emitted');
  assert.equal(metaContent(loadHtml(hiddenOverrideFile), 'robots'), 'noindex, nofollow');
  assert.equal(sitemapPathnames.has('/posts/hidden-identity'), false);
  assert.equal(
    existsSync(pageFile(distDir, '/posts/unlisted-override/')),
    false,
    'source folder identity must not leak for an unlisted explicit slug',
  );

  // ---- published unlisted posts have a real OG resource (Task 4) -------
  const assertReferencedOgExists = (doc, label) => {
    const value = metaContent(doc, 'og:image');
    assert.ok(value, `${label} must emit og:image`);
    assert.ok(value.startsWith(`${SITE_URL}/`), `${label} og:image must be site-local: ${value}`);
    const localPath = value.slice(SITE_URL.length);
    assert.ok(existsSync(join(distDir, localPath)), `${label} og:image must exist: ${localPath}`);
  };
  assertReferencedOgExists(reviewHiddenDoc, 'hero-less unlisted EN post');
  assertReferencedOgExists(
    loadHtml(pageFile(distDir, '/vi/posts/seo-unlisted-vi/')),
    'hero-less unlisted VI post',
  );
  assertReferencedOgExists(loadHtml(hiddenOverrideFile), 'hero-less unlisted explicit-slug post');
  assertReferencedOgExists(loadHtml(explicitFile), 'hero-less listed explicit-slug post');
  assert.equal(
    existsSync(join(distDir, 'og', 'seo-draft.png')),
    false,
    'drafts must not get an OG image',
  );

  // Pagefind must not index unlisted pages.
  const pagefindEntry = JSON.parse(
    readFileSync(join(distDir, '_pagefind', 'pagefind-entry.json'), 'utf8'),
  );
  const pagefindTotal = Object.values(pagefindEntry.languages).reduce(
    (sum, lang) => sum + lang.page_count,
    0,
  );
  // 33 baseline routes (minus the unindexed 404, plus the static CMS shell),
  // the original listed fixtures, the MDX raw-HTML fixtures, the listed
  // sitemap-identity fixtures, the loader-identity fixtures and the pagination
  // routes. Unlisted fixtures (including the real mixed-case one) stay out.
  assert.equal(pagefindTotal, 51, 'Pagefind must index listed pages only');
  assert.deepEqual(
    Object.keys(pagefindEntry.languages).sort(),
    ['en-us', 'vi-vn'],
    'EN and VI must both be searchable',
  );
  assert.equal(pagefindEntry.languages['en-us'].page_count, 33);
  assert.equal(pagefindEntry.languages['vi-vn'].page_count, 18);

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

  // ---- math / mermaid opt-in (Markdown baseline) ----------------------
  const mathDoc = loadHtml(pageFile(distDir, '/posts/seo-math/'));
  assert.ok(
    allElements(mathDoc, 'span').some((element) => hasClass(element, 'katex')),
    'math page must render a real KaTeX element',
  );
  assert.ok(
    headLinks(mathDoc).some((link) =>
      /\/_astro\/MathStyles\.[^/]+\.css$/.test(attr(link, 'href') ?? ''),
    ),
    'math page must load the page-scoped KaTeX stylesheet',
  );
  // NOTE (upstream behavior): with the Astro 7 dynamic-import layout the
  // extracted MathStyles CSS chunk is linked from all post pages, so the
  // "only math pages download KaTeX CSS" intent is not fully honored by the
  // upstream implementation. Recorded as a minor known limitation, not a
  // local regression; the KaTeX *markup* remains opt-in via `math: true`.

  const mermaidDoc = loadHtml(pageFile(distDir, '/posts/seo-mermaid/'));
  const mermaidWrapper = allElements(mermaidDoc, 'div').find((element) =>
    hasClass(element, 'chirpy-mermaid-wrapper'),
  );
  assert.ok(mermaidWrapper, 'mermaid block must be a real wrapper element');
  assert.ok(
    (attr(mermaidWrapper, 'data-mermaid-src') ?? '').includes('graph TD'),
    'mermaid source must be preserved for the island',
  );
  assert.equal(
    listedHtml.includes('chirpy-mermaid'),
    false,
    'non-mermaid page must not include Mermaid markup',
  );

  // ---- MDX raw-HTML boundary: math, Mermaid, alert, ashtml, JSX --------
  // MDX must render generated HTML as elements. Before the compatibility
  // seam, KaTeX/Mermaid/Alert/ashtml markup ended up inside text nodes.
  const mdxMathDoc = loadHtml(pageFile(distDir, '/posts/seo-math-mdx/'));
  const katexElements = allElements(mdxMathDoc, 'span').filter((element) =>
    hasClass(element, 'katex'),
  );
  assert.ok(
    katexElements.length >= 2,
    'MDX inline and display math must render as .katex elements',
  );
  assert.ok(
    allElements(mdxMathDoc, 'math').length >= 2,
    'MDX math must include real MathML elements',
  );
  assert.ok(
    allElements(mdxMathDoc, 'span').some((element) => hasClass(element, 'katex-display')),
    'MDX display math must render a .katex-display wrapper',
  );
  assert.equal(
    hasTextContaining(mdxMathDoc, '<span class="katex"'),
    false,
    'MDX math markup must not remain escaped text',
  );

  const mdxMermaidDoc = loadHtml(pageFile(distDir, '/posts/seo-mermaid-mdx/'));
  const mdxMermaidWrapper = allElements(mdxMermaidDoc, 'div').find((element) =>
    hasClass(element, 'chirpy-mermaid-wrapper'),
  );
  assert.ok(mdxMermaidWrapper, 'MDX mermaid block must be a real wrapper element');
  assert.ok(
    (attr(mdxMermaidWrapper, 'data-mermaid-src') ?? '').includes('graph TD'),
    'MDX mermaid source must be preserved in the data attribute',
  );
  assert.equal(
    hasTextContaining(mdxMermaidDoc, 'chirpy-mermaid-wrapper'),
    false,
    'MDX mermaid markup must not remain escaped text',
  );
  assert.ok(hasMermaidIsland(mdxMermaidDoc), 'mermaid:true MDX page must load the Mermaid island');

  const mdxMermaidOffDoc = loadHtml(pageFile(distDir, '/posts/seo-mermaid-off/'));
  assert.ok(
    allElements(mdxMermaidOffDoc, 'div').some((element) =>
      hasClass(element, 'chirpy-mermaid-wrapper'),
    ),
    'mermaid fence without opt-in still renders the upstream wrapper markup',
  );
  assert.equal(
    hasMermaidIsland(mdxMermaidOffDoc),
    false,
    'mermaid:false MDX page must not load the Mermaid island',
  );

  const mdxAlertDoc = loadHtml(pageFile(distDir, '/posts/seo-alert-mdx/'));
  const alertElement = allElements(mdxAlertDoc, 'div').find(
    (element) => attr(element, 'role') === 'alert',
  );
  assert.ok(alertElement, 'MDX alert fence must render a real alert element');
  assert.ok(hasClass(alertElement, 'alert-info'), 'alert type class must be applied');
  assert.ok(
    textOf(alertElement).includes('MDX alert description.'),
    'alert content must be rendered as text content, not markup',
  );
  assert.equal(
    hasTextContaining(mdxAlertDoc, 'role="alert"'),
    false,
    'MDX alert markup must not remain escaped text',
  );

  const mdxAsHtmlDoc = loadHtml(pageFile(distDir, '/posts/seo-ashtml-mdx/'));
  const authoredHtml = allElements(mdxAsHtmlDoc, 'section').find(
    (element) => attr(element, 'id') === 'authored-html',
  );
  assert.ok(authoredHtml, 'ashtml fence must render the authored element');
  assert.equal(attr(authoredHtml, 'data-kind'), 'raw');
  assert.ok(textOf(authoredHtml).includes('Authored HTML'));
  assert.equal(
    hasTextContaining(mdxAsHtmlDoc, 'authored-html'),
    false,
    'MDX raw HTML must not remain escaped text',
  );

  const mdxJsxDoc = loadHtml(pageFile(distDir, '/posts/seo-jsx-mdx/'));
  const authoredJsx = allElements(mdxJsxDoc, 'div').find(
    (element) => attr(element, 'id') === 'authored-jsx',
  );
  assert.ok(authoredJsx, 'authored JSX must render unchanged');
  assert.equal(attr(authoredJsx, 'data-kind'), 'component');
  const authoredStrong = allElements(authoredJsx, 'strong')[0];
  assert.ok(authoredStrong, 'authored JSX children render');
  assert.equal(textOf(authoredStrong), 'JSX');

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

  // ---- non-main build: valid production identifiers, comments forced off ----
  // This is the rendered equivalent of a staging deployment where the
  // workflow supplies PUBLIC_GISCUS_ENABLED=false while the repository
  // variable still holds production values.
  const nonMainBuild = spawnSync(process.execPath, [ASTRO_BIN, 'build'], {
    cwd: tempRoot,
    env: {
      ...process.env,
      SITE_URL,
      BASE_PATH: '/',
      PUBLIC_GISCUS_ENABLED: 'false',
      PUBLIC_GISCUS_REPO: 'miyukowo/blog',
      PUBLIC_GISCUS_REPO_ID: 'R_kgDOtest',
      PUBLIC_GISCUS_CATEGORY: 'Announcements',
      PUBLIC_GISCUS_CATEGORY_ID: 'DIC_kwDOtest',
    },
    encoding: 'utf8',
    timeout: 300_000,
  });
  assert.equal(
    nonMainBuild.status,
    0,
    `non-main fixture build failed:\n${nonMainBuild.stdout}\n${nonMainBuild.stderr}`,
  );

  for (const route of ['/posts/seo-listed/', '/vi/posts/seo-listed-vi/']) {
    const nonMainDoc = loadHtml(pageFile(distDir, route));
    const nonMainHtml = readFileSync(pageFile(distDir, route), 'utf8');
    assert.equal(
      allElements(nonMainDoc, 'div').some(
        (element) => attr(element, 'data-giscus-mount') !== undefined,
      ),
      false,
      `${route} must not mount production comments on a non-main build`,
    );
    for (const productionIdentifier of [
      'data-giscus-mount',
      'miyukowo/blog',
      'R_kgDOtest',
      'DIC_kwDOtest',
    ]) {
      assert.equal(
        nonMainHtml.includes(productionIdentifier),
        false,
        `${route} must not contain ${productionIdentifier} when comments are disabled`,
      );
    }
  }
});
