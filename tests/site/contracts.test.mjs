/**
 * Compatibility-contract tests for scripts/site-contract.mjs.
 *
 * These tests intentionally run against a small synthetic fixture site under
 * tests/site/fixtures/contracts/site-basic/ and copy it to an OS temp dir
 * before mutating anything. They never write to the real `dist/`,
 * `src/content/` or the checked-in fixtures.
 *
 * Written before the implementation so the first run is a recorded red
 * failure (the module under test does not exist yet).
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rename, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { test } from 'node:test';

import { assertSiteContract, captureSite } from '../../scripts/site-contract.mjs';
import { computeSourceFingerprint } from '../../src/site/build-manifest.ts';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures', 'contracts', 'site-basic');
const CONTRACT_CLI = join(HERE, '..', '..', 'scripts', 'site-contract.mjs');

const FIXTURE_ORIGIN = 'https://fixture.example.dev';

/** Copy the fixture into a fresh temp dir so a test may mutate it safely. */
async function makeFixtureCopy(t) {
  const dir = await mkdtemp(join(tmpdir(), 'site-contract-test-'));
  await cp(FIXTURE_DIR, dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));
  return {
    dir,
    distDir: join(dir, 'dist'),
    sourceDir: join(dir, 'source'),
    baselinePath: join(dir, 'baseline.json'),
  };
}

async function readBaseline(fixture) {
  return JSON.parse(await readFile(fixture.baselinePath, 'utf8'));
}

async function capture(fixture, overrides = {}) {
  const baseline = overrides.baseline ?? (await readBaseline(fixture));
  return captureSite({
    distDir: fixture.distDir,
    sourceDir: fixture.sourceDir,
    sourceRevision: overrides.sourceRevision ?? baseline.sourceRevision,
    baseline,
    ...overrides,
  });
}

function pageHtml({ lang = 'en-US', canonical, ogImage, hrefs = {} }) {
  return `<!DOCTYPE html>
<html lang="${lang}">
  <head>
    <meta charset="utf-8" />
    <title>Fixture page</title>
    <link rel="canonical" href="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
${Object.entries(hrefs)
  .map(([hreflang, href]) => `    <link rel="alternate" hreflang="${hreflang}" href="${href}" />`)
  .join('\n')}
  </head>
  <body><main data-pagefind-body>fixture</main></body>
</html>
`;
}

/** Add one EN/VI translated post pair to the fixture copy. */
async function addTranslatedPostPair(fixture) {
  const en = '/posts/hello-again/';
  const vi = '/vi/posts/xin-chao-again/';
  await mkdir(join(fixture.distDir, 'posts', 'hello-again'), { recursive: true });
  await mkdir(join(fixture.distDir, 'vi', 'posts', 'xin-chao-again'), { recursive: true });
  await writeFile(
    join(fixture.distDir, 'posts', 'hello-again', 'index.html'),
    pageHtml({
      canonical: `${FIXTURE_ORIGIN}${en}`,
      ogImage: `${FIXTURE_ORIGIN}/og/hello-again.png`,
      hrefs: {
        en: `${FIXTURE_ORIGIN}${en}`,
        vi: `${FIXTURE_ORIGIN}${vi}`,
        'x-default': `${FIXTURE_ORIGIN}${en}`,
      },
    }),
  );
  await writeFile(
    join(fixture.distDir, 'vi', 'posts', 'xin-chao-again', 'index.html'),
    pageHtml({
      lang: 'vi-VN',
      canonical: `${FIXTURE_ORIGIN}${vi}`,
      ogImage: `${FIXTURE_ORIGIN}/og/vi/xin-chao-again.png`,
      hrefs: {
        en: `${FIXTURE_ORIGIN}${en}`,
        vi: `${FIXTURE_ORIGIN}${vi}`,
        'x-default': `${FIXTURE_ORIGIN}${en}`,
      },
    }),
  );

  for (const [feed, items] of [
    ['rss.xml', [en]],
    ['vi/rss.xml', [vi]],
  ]) {
    const path = join(fixture.distDir, feed);
    const xml = await readFile(path, 'utf8');
    const withItem = xml.replace(
      '</channel>',
      `<item><title>New</title><link>${FIXTURE_ORIGIN}${items[0]}</link></item></channel>`,
    );
    await writeFile(path, withItem);
  }

  const sitemapPath = join(fixture.distDir, 'sitemap-0.xml');
  const sitemap = await readFile(sitemapPath, 'utf8');
  await writeFile(
    sitemapPath,
    sitemap.replace(
      '</urlset>',
      `  <url><loc>${FIXTURE_ORIGIN}${en}</loc></url>\n  <url><loc>${FIXTURE_ORIGIN}${vi}</loc></url>\n</urlset>`,
    ),
  );

  await mkdir(join(fixture.distDir, 'og', 'vi'), { recursive: true });
  await writeFile(
    join(fixture.distDir, 'og', 'hello-again.png'),
    Buffer.from('89504e470d0a1a0a', 'hex'),
  );
  await writeFile(
    join(fixture.distDir, 'og', 'vi', 'xin-chao-again.png'),
    Buffer.from('89504e470d0a1a0a', 'hex'),
  );

  const enSource = join(fixture.sourceDir, 'src', 'content', 'posts', 'en', 'hello-again');
  const viSource = join(fixture.sourceDir, 'src', 'content', 'posts', 'vi', 'xin-chao-again');
  await mkdir(enSource, { recursive: true });
  await mkdir(viSource, { recursive: true });
  await writeFile(
    join(enSource, 'index.mdx'),
    '---\ntitle: Hello again\ntranslationKey: hello-again\n---\n\nBody.\n',
  );
  await writeFile(
    join(viSource, 'index.mdx'),
    '---\ntitle: Xin chào lại\ntranslationKey: hello-again\n---\n\nThân bài.\n',
  );

  const pagefindPath = join(fixture.distDir, '_pagefind', 'pagefind-entry.json');
  const pagefind = JSON.parse(await readFile(pagefindPath, 'utf8'));
  pagefind.languages['en-us'].page_count += 1;
  pagefind.languages['vi-vn'].page_count += 1;
  await writeFile(pagefindPath, `${JSON.stringify(pagefind)}\n`);

  return {
    en,
    vi,
    sourcePaths: [
      'src/content/posts/en/hello-again/index.mdx',
      'src/content/posts/vi/xin-chao-again/index.mdx',
    ],
    sitemapUrls: [`${FIXTURE_ORIGIN}${en}`, `${FIXTURE_ORIGIN}${vi}`],
    ogPaths: ['/og/hello-again.png', '/og/vi/xin-chao-again.png'],
    feedItems: {
      '/rss.xml': [`${FIXTURE_ORIGIN}${en}`],
      '/vi/rss.xml': [`${FIXTURE_ORIGIN}${vi}`],
    },
  };
}

async function runContractCli(args) {
  try {
    const result = await execFileAsync(process.execPath, [CONTRACT_CLI, ...args], {
      encoding: 'utf8',
    });
    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    return {
      code: typeof error.code === 'number' ? error.code : 1,
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
    };
  }
}

test('capture reproduces fixture routes, metadata, feeds, sitemap, OG, search and source hashes', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const actual = await capture(fixture);

  assert.equal(actual.schemaVersion, 1);
  assert.deepEqual(
    actual.sourceContent,
    baseline.sourceContent,
    'source sha256/bodySha256 must match the recorded baseline',
  );
  assert.deepEqual(actual.htmlRoutes, baseline.htmlRoutes);
  assert.deepEqual(actual.feeds, baseline.feeds);
  assert.deepEqual(actual.sitemapUrls, baseline.sitemapUrls);
  assert.deepEqual(actual.generatedOgPaths, baseline.generatedOgPaths);
  assert.deepEqual(actual.search, baseline.search);
  assert.equal(actual.sourceRevision, baseline.sourceRevision);
  assert.equal(typeof actual.recordedDate, 'string');
  assert.equal(typeof actual.toolchain, 'object');
});

test('capture resolves directory index.html to its public path and keeps 404.html', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const actual = await capture(fixture);
  const routes = actual.htmlRoutes.map((route) => route.path);

  assert.ok(routes.includes('/'), 'root index.html must resolve to /');
  assert.ok(routes.includes('/about/'), 'about/index.html must resolve to /about/');
  assert.ok(routes.includes('/404.html'), '404.html must keep its literal public path');
  assert.ok(!routes.includes('/index.html'));
  assert.ok(!routes.includes('/about/index.html'));
});

test('capture excludes static HTML copied from public/ (the CMS admin shell)', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const actual = await capture(fixture);

  assert.ok(!actual.htmlRoutes.some((route) => route.path === '/cms/'));
  assert.equal(
    actual.htmlRoutes.length,
    8,
    'only Astro page routes belong to the HTML route contract',
  );
});

test('removing an existing post route fails and names the protected path', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  await unlink(join(fixture.distDir, 'posts', 'hello', 'index.html'));
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) =>
      /missing protected route/.test(error.message) &&
      /htmlRoutes\[\/posts\/hello\/\]/.test(error.message),
  );
});

test('an added /index suffix fails even though the old route is reported missing', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const nested = join(fixture.distDir, 'posts', 'hello', 'index');
  await mkdir(nested, { recursive: true });
  await rename(join(fixture.distDir, 'posts', 'hello', 'index.html'), join(nested, 'index.html'));
  const actual = await capture(fixture);

  assert.ok(actual.htmlRoutes.some((route) => route.path === '/posts/hello/index/'));
  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) =>
      /forbidden \/index suffix/.test(error.message) &&
      /\/posts\/hello\/index\//.test(error.message),
  );
});

test('renaming the protected VI taxonomy route to a Unicode slug fails naming the route', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const categories = join(fixture.distDir, 'vi', 'categories');
  await rename(join(categories, 'huong-dan'), join(categories, 'hướng-dẫn'));
  const actual = await capture(fixture);

  assert.ok(actual.htmlRoutes.some((route) => route.path === '/vi/categories/hướng-dẫn/'));
  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) =>
      /missing protected route/.test(error.message) &&
      /htmlRoutes\[\/vi\/categories\/huong-dan\/\]/.test(error.message),
  );
});

test('a changed canonical fails and names the route field', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const path = join(fixture.distDir, 'about', 'index.html');
  const html = (await readFile(path, 'utf8')).replace(
    `${FIXTURE_ORIGIN}/about/`,
    `${FIXTURE_ORIGIN}/about-changed/`,
  );
  await writeFile(path, html);
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) => /htmlRoutes\[\/about\/\]\.canonical/.test(error.message),
  );
});

test('a changed reciprocal hreflang fails and names the hreflang field', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const path = join(fixture.distDir, 'vi', 'about', 'index.html');
  const html = (await readFile(path, 'utf8')).replace(
    `hreflang="en" href="${FIXTURE_ORIGIN}/about/"`,
    `hreflang="en" href="${FIXTURE_ORIGIN}/about-wrong/"`,
  );
  await writeFile(path, html);
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) => /htmlRoutes\[\/vi\/about\/\]\.hreflangs\.en/.test(error.message),
  );
});

test('a classified hreflang correction passes only for the exact from/to pair', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const path = join(fixture.distDir, 'vi', 'about', 'index.html');
  const html = (await readFile(path, 'utf8')).replace(
    `hreflang="en" href="${FIXTURE_ORIGIN}/about/"`,
    `hreflang="en" href="${FIXTURE_ORIGIN}/about-wrong/"`,
  );
  await writeFile(path, html);
  const actual = await capture(fixture);

  const exact = {
    fieldChanges: [
      {
        path: '/vi/about/',
        field: 'hreflangs.en',
        from: `${FIXTURE_ORIGIN}/about/`,
        to: `${FIXTURE_ORIGIN}/about-wrong/`,
        reason: 'Fixture translation correction',
      },
    ],
  };
  assert.doesNotThrow(() => assertSiteContract(actual, baseline, { allowedChanges: exact }));

  const wrongTo = {
    fieldChanges: [
      {
        path: '/vi/about/',
        field: 'hreflangs.en',
        from: `${FIXTURE_ORIGIN}/about/`,
        to: `${FIXTURE_ORIGIN}/something-else/`,
        reason: 'Wrong destination must not be allowed',
      },
    ],
  };
  assert.throws(
    () => assertSiteContract(actual, baseline, { allowedChanges: wrongTo }),
    (error) => /htmlRoutes\[\/vi\/about\/\]\.hreflangs\.en/.test(error.message),
  );
});

test('an unrelated hreflang change still fails under a narrow allowance', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const path = join(fixture.distDir, 'vi', 'about', 'index.html');
  const html = (await readFile(path, 'utf8'))
    .replace(
      `hreflang="en" href="${FIXTURE_ORIGIN}/about/"`,
      `hreflang="en" href="${FIXTURE_ORIGIN}/about-wrong/"`,
    )
    .replace(
      `hreflang="x-default" href="${FIXTURE_ORIGIN}/about/"`,
      `hreflang="x-default" href="${FIXTURE_ORIGIN}/about-wrong/"`,
    );
  await writeFile(path, html);
  const actual = await capture(fixture);

  const allowed = {
    fieldChanges: [
      {
        path: '/vi/about/',
        field: 'hreflangs.en',
        from: `${FIXTURE_ORIGIN}/about/`,
        to: `${FIXTURE_ORIGIN}/about-wrong/`,
        reason: 'Only the EN destination is corrected',
      },
    ],
  };
  assert.throws(
    () => assertSiteContract(actual, baseline, { allowedChanges: allowed }),
    (error) => /htmlRoutes\[\/vi\/about\/\]\.hreflangs\.x-default/.test(error.message),
  );
});

test('a changed source body fails naming bodySha256', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const source = join(fixture.sourceDir, 'src', 'content', 'posts', 'en', 'hello', 'index.mdx');
  await writeFile(source, `${await readFile(source, 'utf8')}\nAppended body text.\n`);
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) =>
      /sourceContent\[src\/content\/posts\/en\/hello\/index\.mdx\]\.bodySha256/.test(error.message),
  );
});

test('a duplicate route fails naming the duplicated path', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const actual = await capture(fixture);
  const duplicate = actual.htmlRoutes.find((route) => route.path === '/about/');
  actual.htmlRoutes.push({ ...duplicate, hreflangs: { ...duplicate.hreflangs } });

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) =>
      /duplicate route/.test(error.message) && /htmlRoutes\[\/about\/\]/.test(error.message),
  );
});

test('an added translated post pair passes only when explicitly classified', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const added = await addTranslatedPostPair(fixture);
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) =>
      /not classified|unclassified/.test(error.message) &&
      /\/posts\/hello-again\//.test(error.message) &&
      /sourceContent\[src\/content\/posts\/en\/hello-again\/index\.mdx\]/.test(error.message),
  );

  const allowedChanges = {
    addedHtmlRoutes: [added.en, added.vi],
    addedSourceContent: added.sourcePaths,
    addedFeedItems: added.feedItems,
    addedSitemapUrls: added.sitemapUrls,
    addedOgPaths: added.ogPaths,
    searchIndexedPagesDelta: 2,
  };
  assert.doesNotThrow(() => assertSiteContract(actual, baseline, { allowedChanges }));
});

test('an added source file is reported when it is not classified', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const source = join(fixture.sourceDir, 'src', 'content', 'pages', 'en', 'staff.md');
  await writeFile(source, '---\ntitle: Staff\n---\n\nStaff page.\n');
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) => /sourceContent\[src\/content\/pages\/en\/staff\.md\]/.test(error.message),
  );
});

test('the VI RSS language correction passes only under the narrow allowance', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const path = join(fixture.distDir, 'vi', 'rss.xml');
  await writeFile(
    path,
    (await readFile(path, 'utf8')).replace(
      '<language>en-us</language>',
      '<language>vi-vn</language>',
    ),
  );
  const actual = await capture(fixture);

  assert.throws(
    () => assertSiteContract(actual, baseline),
    (error) => /feeds\[\/vi\/rss\.xml\]\.language/.test(error.message),
  );

  const allowedChanges = {
    fieldChanges: [
      {
        path: '/vi/rss.xml',
        field: 'language',
        from: 'en-us',
        to: 'vi-vn',
        reason: 'Known baseline defect: the VI feed must report vi-vn.',
      },
    ],
  };
  assert.doesNotThrow(() => assertSiteContract(actual, baseline, { allowedChanges }));
});

test('an unrelated feed item change still fails with the VI RSS language allowance', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const path = join(fixture.distDir, 'vi', 'rss.xml');
  const xml = (await readFile(path, 'utf8'))
    .replace('<language>en-us</language>', '<language>vi-vn</language>')
    .replace(
      '</channel>',
      `<item><title>Unexpected</title><link>${FIXTURE_ORIGIN}/vi/posts/unexpected/</link></item></channel>`,
    );
  await writeFile(path, xml);
  const actual = await capture(fixture);

  const allowedChanges = {
    fieldChanges: [
      {
        path: '/vi/rss.xml',
        field: 'language',
        from: 'en-us',
        to: 'vi-vn',
        reason: 'Known baseline defect: the VI feed must report vi-vn.',
      },
    ],
  };
  assert.throws(
    () => assertSiteContract(actual, baseline, { allowedChanges }),
    (error) => /feeds\[\/vi\/rss\.xml\]\.items/.test(error.message),
  );
});

test('allowedChanges cannot reclassify a non-protected path or a wrong baseline value', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const actual = await capture(fixture);

  assert.throws(
    () =>
      assertSiteContract(actual, baseline, {
        allowedChanges: {
          fieldChanges: [
            {
              path: '/not-a-protected-path/',
              field: 'canonical',
              from: 'https://wrong.example/',
              to: `${FIXTURE_ORIGIN}/not-a-protected-path/`,
              reason: 'must be rejected: the path is not protected',
            },
          ],
        },
      }),
    /not a protected baseline route or feed/,
  );

  assert.throws(
    () =>
      assertSiteContract(actual, baseline, {
        allowedChanges: {
          fieldChanges: [
            {
              path: '/about/',
              field: 'canonical',
              from: 'https://wrong.example/about/',
              to: `${FIXTURE_ORIGIN}/about/`,
              reason: 'must be rejected: from does not match the baseline',
            },
          ],
        },
      }),
    /does not match the baseline value/,
  );
});

test('the CLI captures and asserts on temporary fixtures and reports failures nonzero', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const output = join(fixture.dir, 'captured-contract.json');

  const captureResult = await runContractCli([
    'capture',
    '--dist',
    fixture.distDir,
    '--source',
    fixture.sourceDir,
    '--baseline',
    fixture.baselinePath,
    '--source-revision',
    'fixture-cli-rev',
    '--output',
    output,
  ]);
  assert.equal(captureResult.code, 0, captureResult.stderr);
  const captured = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(captured.schemaVersion, 1);
  assert.equal(captured.sourceRevision, 'fixture-cli-rev');
  assert.equal(captured.htmlRoutes.length, 8);

  const assertResult = await runContractCli([
    'assert',
    '--actual',
    output,
    '--baseline',
    fixture.baselinePath,
  ]);
  assert.equal(assertResult.code, 0, assertResult.stderr);

  await unlink(join(fixture.distDir, 'posts', 'hello', 'index.html'));
  const brokenOutput = join(fixture.dir, 'broken-contract.json');
  const brokenCapture = await runContractCli([
    'capture',
    '--dist',
    fixture.distDir,
    '--source',
    fixture.sourceDir,
    '--baseline',
    fixture.baselinePath,
    '--source-revision',
    'fixture-cli-rev',
    '--output',
    brokenOutput,
  ]);
  assert.equal(brokenCapture.code, 0, brokenCapture.stderr);
  const brokenAssert = await runContractCli([
    'assert',
    '--actual',
    brokenOutput,
    '--baseline',
    fixture.baselinePath,
  ]);
  assert.notEqual(brokenAssert.code, 0);
  assert.match(`${brokenAssert.stdout}${brokenAssert.stderr}`, /\/posts\/hello\//);
});

test('gitignored editor caches (.obsidian) do not trip source content or build fingerprint checks', async (t) => {
  const fixture = await makeFixtureCopy(t);
  const baseline = await readBaseline(fixture);
  const beforeFingerprint = computeSourceFingerprint(fixture.sourceDir).fingerprint;

  const obsidianDir = join(fixture.sourceDir, 'src', 'content', 'posts', '.obsidian');
  await mkdir(obsidianDir, { recursive: true });
  await writeFile(join(obsidianDir, 'workspace.json'), '{"left":{"collapsed":false}}');
  await writeFile(join(obsidianDir, 'app.json'), '{"alwaysUpdateLinks":true}');

  const actual = await capture(fixture);
  assert.doesNotThrow(() => assertSiteContract(actual, baseline));
  assert.equal(computeSourceFingerprint(fixture.sourceDir).fingerprint, beforeFingerprint);

  await writeFile(join(obsidianDir, 'workspace.json'), '{"left":{"collapsed":true}}');
  assert.equal(computeSourceFingerprint(fixture.sourceDir).fingerprint, beforeFingerprint);
});
