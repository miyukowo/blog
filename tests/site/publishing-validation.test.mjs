/**
 * Routine publishing validation integration test (follow-up Task 2).
 *
 * Builds a disposable copy of the real project, then proves:
 *  - unchanged current source validates against a rebuilt artifact,
 *  - an editorial correction and new EN/VI posts pass after a rebuild without
 *    editing the historical baseline,
 *  - publishing/unpublishing a draft and deleting a synthetic fixture pass
 *    after a rebuild,
 *  - a source edit without a rebuild is rejected as stale (build manifest),
 *  - broken/stale artifacts (missing route/OG/feed/sitemap/search, wrong
 *    origin, production CMS/comments in preview, scoped-only noindex) fail
 *    without rebuilding, and restoring them passes,
 *  - the explicit historical mode still rejects an unapproved content change.
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
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { preparePreviewCms } from '../../scripts/prepare-preview.mjs';
import { markPreviewNoindex } from '../../scripts/mark-preview-noindex.mjs';
import { validateBuiltSite, BuiltSiteValidationError } from '../../scripts/validate-built-site.mjs';
import { ALLOWED_CHANGES } from '../../scripts/site-allowed-changes.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const ASTRO_BIN = join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const PAGEFIND_BIN = join(REPO_ROOT, 'node_modules', 'pagefind', 'lib', 'runner', 'bin.cjs');
const BASELINE_PATH = join(REPO_ROOT, 'docs', 'research', '2026-11-02-dsh-preflight-baseline.json');
const SITE_URL = 'https://blog.tvphus.dev';
const PREVIEW_BRANCH = 'codex/cms-validation-publishing-test';

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

function makeProject() {
  const tempParent = join(REPO_ROOT, '.tmp-publishing-fixtures');
  mkdirSync(tempParent, { recursive: true });
  const root = mkdtempSync(join(tempParent, 'publishing-'));
  for (const entry of COPY_ENTRIES) {
    const source = join(REPO_ROOT, entry);
    if (existsSync(source)) cpSync(source, join(root, entry), { recursive: true });
  }
  symlinkSync(join(REPO_ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  return root;
}

function buildProject(root, siteUrl = SITE_URL) {
  const env = {
    ...process.env,
    SITE_URL: siteUrl,
    BASE_PATH: '',
    PUBLIC_GISCUS_ENABLED: 'false',
  };
  const build = spawnSync(process.execPath, [ASTRO_BIN, 'build'], {
    cwd: root,
    env,
    encoding: 'utf8',
    timeout: 300_000,
  });
  assert.equal(build.status, 0, `fixture build failed:\n${build.stdout}\n${build.stderr}`);

  const pagefind = spawnSync(
    process.execPath,
    [PAGEFIND_BIN, '--site', 'dist', '--output-subdir', '_pagefind'],
    { cwd: root, encoding: 'utf8', timeout: 120_000 },
  );
  assert.equal(pagefind.status, 0, `pagefind failed:\n${pagefind.stdout}\n${pagefind.stderr}`);
}

function writePost(root, relativePath, frontmatter, body = 'Fixture body.') {
  const target = join(root, 'src', 'content', 'posts', relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');
}

function validate(root, overrides = {}) {
  return validateBuiltSite({
    distDir: join(root, 'dist'),
    sourceDir: root,
    profile: 'production',
    siteUrl: SITE_URL,
    ...overrides,
  });
}

async function expectFailure(promise, pattern) {
  await assert.rejects(
    promise,
    (error) =>
      error instanceof BuiltSiteValidationError &&
      error.violations.length > 0 &&
      (!pattern || pattern.test(error.message)),
  );
}

test('routine validation follows current source and rejects stale/broken artifacts', async (t) => {
  const root = makeProject();
  t.after(() => rmSync(root, { recursive: true, force: true }));

  const listingPost = 'src/content/posts/en/getting-started/index.mdx';
  const enFixture = 'en/publishing-en/index.mdx';
  const viFixture = 'vi/publishing-vi/index.mdx';
  const draftFixture = 'en/publishing-draft/index.mdx';

  // ---- 1. a rebuilt artifact of the unchanged source passes -------------
  buildProject(root);
  const initial = await validate(root);
  assert.equal(initial.mode, 'routine');
  assert.match(initial.summary, /routes/);

  // ---- 2. editorial correction + new EN/VI posts + draft fixture --------
  const originalListing = readFileSync(join(root, listingPost), 'utf8');
  writeFileSync(
    join(root, listingPost),
    `${originalListing}\n\nA routine editorial correction.\n`,
    'utf8',
  );
  writePost(
    root,
    enFixture,
    [
      "title: 'Publishing EN fixture'",
      "description: 'Routine EN addition.'",
      'pubDate: 2026-11-10',
    ].join('\n'),
  );
  writePost(
    root,
    viFixture,
    [
      "title: 'Publishing VI fixture'",
      "description: 'Routine VI addition.'",
      'pubDate: 2026-11-10',
      "translationKey: 'publishing-en'",
    ].join('\n'),
  );
  writePost(
    root,
    draftFixture,
    [
      "title: 'Publishing draft fixture'",
      "description: 'Not published yet.'",
      'pubDate: 2026-11-11',
      'draft: true',
    ].join('\n'),
  );

  // Editing source without rebuilding must be rejected, not certified.
  await expectFailure(validate(root), /stale artifact|changed since the last build/);

  buildProject(root);
  await validate(root);
  assert.ok(existsSync(join(root, 'dist', 'posts', 'publishing-en', 'index.html')));
  assert.ok(existsSync(join(root, 'dist', 'vi', 'posts', 'publishing-vi', 'index.html')));
  assert.equal(
    existsSync(join(root, 'dist', 'posts', 'publishing-draft', 'index.html')),
    false,
    'draft must stay out of the artifact',
  );

  // ---- 3. publishing the draft passes after a rebuild ------------------
  writePost(
    root,
    draftFixture,
    [
      "title: 'Publishing draft fixture'",
      "description: 'Now published.'",
      'pubDate: 2026-11-11',
      'draft: false',
    ].join('\n'),
  );
  await expectFailure(validate(root), /stale artifact|changed since the last build/);
  buildProject(root);
  await validate(root);
  assert.ok(
    existsSync(join(root, 'dist', 'posts', 'publishing-draft', 'index.html')),
    'published draft must reach the artifact after rebuild',
  );

  // ---- 4. unpublish the draft and delete synthetic fixtures ------------
  writePost(
    root,
    draftFixture,
    [
      "title: 'Publishing draft fixture'",
      "description: 'Unpublished again.'",
      'pubDate: 2026-11-11',
      'draft: true',
    ].join('\n'),
  );
  rmSync(join(root, 'src', 'content', 'posts', enFixture), { force: true });
  rmSync(join(root, 'src', 'content', 'posts', viFixture), { force: true });
  buildProject(root);
  await validate(root);
  assert.equal(existsSync(join(root, 'dist', 'posts', 'publishing-draft', 'index.html')), false);
  assert.equal(existsSync(join(root, 'dist', 'posts', 'publishing-en', 'index.html')), false);
  assert.equal(existsSync(join(root, 'dist', 'vi', 'posts', 'publishing-vi', 'index.html')), false);

  // ---- 5. mutation failures without rebuilding, then restore ----------
  const distDir = join(root, 'dist');

  const routePath = join(distDir, 'posts', 'getting-started', 'index.html');
  const routeBytes = readFileSync(routePath);
  rmSync(routePath);
  await expectFailure(validate(root), /missing route expected from current source/);
  writeFileSync(routePath, routeBytes);
  await validate(root);

  const ogPath = join(distDir, 'og', 'review-hidden.png');
  const ogBytes = readFileSync(ogPath);
  rmSync(ogPath);
  await expectFailure(validate(root), /missing generated OG image/);
  writeFileSync(ogPath, ogBytes);
  await validate(root);

  const feedPath = join(distDir, 'rss.xml');
  const feedText = readFileSync(feedPath, 'utf8');
  writeFileSync(
    feedPath,
    feedText.replace(
      `<link>${SITE_URL}/posts/getting-started/</link>`,
      `<link>${SITE_URL}/posts/removed-from-feed/</link>`,
    ),
    'utf8',
  );
  await expectFailure(validate(root), /feeds\[\/rss\.xml\]\.items/);
  writeFileSync(feedPath, feedText, 'utf8');
  await validate(root);

  const sitemapPath = join(distDir, 'sitemap-0.xml');
  const sitemapText = readFileSync(sitemapPath, 'utf8');
  writeFileSync(
    sitemapPath,
    sitemapText.replace(
      `<loc>${SITE_URL}/posts/getting-started/</loc>`,
      `<loc>${SITE_URL}/posts/removed-from-sitemap/</loc>`,
    ),
    'utf8',
  );
  await expectFailure(validate(root), /sitemapUrls: (missing|unexpected) URL/);
  writeFileSync(sitemapPath, sitemapText, 'utf8');
  await validate(root);

  const pagefindPath = join(distDir, '_pagefind', 'pagefind-entry.json');
  const pagefindText = readFileSync(pagefindPath, 'utf8');
  const pagefindEntry = JSON.parse(pagefindText);
  pagefindEntry.languages['en-us'].page_count += 1;
  writeFileSync(pagefindPath, JSON.stringify(pagefindEntry), 'utf8');
  await expectFailure(validate(root), /search\.indexedPages/);
  writeFileSync(pagefindPath, pagefindText, 'utf8');
  await validate(root);

  const aboutPath = join(distDir, 'about', 'index.html');
  const aboutText = readFileSync(aboutPath, 'utf8');
  writeFileSync(
    aboutPath,
    aboutText.replace(`${SITE_URL}/about/`, 'https://wrong-origin.example/about/'),
    'utf8',
  );
  await expectFailure(validate(root), /canonical|origin/);
  writeFileSync(aboutPath, aboutText, 'utf8');
  await validate(root);

  // ---- 7. explicit historical mode still rejects unapproved content ----
  // The editorial correction to a protected baseline post was rebuilt into
  // the artifact, but it is not classified in the historical allowances.
  await expectFailure(
    validate(root, {
      profile: 'production',
      mode: 'historical',
      siteUrl: SITE_URL,
      baselinePath: BASELINE_PATH,
      allowedChanges: ALLOWED_CHANGES,
    }),
    /sourceContent.*(sha256|bodySha256)/,
  );

  // ---- 6. preview transformations: global noindex + isolated CMS -------
  // A real preview deployment is built with the preview origin.
  buildProject(root, 'https://staging-blog.tvphus.dev');
  preparePreviewCms({
    distDir,
    branch: PREVIEW_BRANCH,
    siteUrl: 'https://staging-blog.tvphus.dev',
  });
  markPreviewNoindex({ distDir, branch: 'staging' });
  const previewOptions = {
    profile: 'preview',
    siteUrl: 'https://staging-blog.tvphus.dev',
    cmsBranch: PREVIEW_BRANCH,
  };
  await validate(root, previewOptions);

  const headersPath = join(distDir, '_headers');
  const globalHeaders = readFileSync(headersPath, 'utf8');
  writeFileSync(
    headersPath,
    ['/cms/*', '  X-Robots-Tag: noindex', '', '/*', '  Cache-Control: no-store', ''].join('\n'),
    'utf8',
  );
  await expectFailure(validate(root, previewOptions), /catch-all/);
  writeFileSync(headersPath, globalHeaders, 'utf8');
  await validate(root, previewOptions);

  const cmsPath = join(distDir, 'cms', 'config.yml');
  const previewCms = readFileSync(cmsPath, 'utf8');
  writeFileSync(cmsPath, readFileSync(join(root, 'public', 'cms', 'config.yml'), 'utf8'), 'utf8');
  await expectFailure(validate(root, previewOptions), /preview CMS/);
  writeFileSync(cmsPath, previewCms, 'utf8');
  await validate(root, previewOptions);

  const commentTarget = join(distDir, 'about', 'index.html');
  const commentText = readFileSync(commentTarget, 'utf8');
  writeFileSync(
    commentTarget,
    commentText.replace(
      '</body>',
      '  <div data-giscus-mount data-repo="miyukowo/blog" data-mapping="pathname"></div>\n</body>',
    ),
    'utf8',
  );
  await expectFailure(validate(root, previewOptions), /comment mount/);
  writeFileSync(commentTarget, commentText, 'utf8');
  await validate(root, previewOptions);
});
