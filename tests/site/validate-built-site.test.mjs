/**
 * Artifact validation tests for scripts/validate-built-site.mjs (Task 6).
 *
 * These use the synthetic contract fixture copied into a temp dir, so every
 * mutation is safe. The validator must fail closed on a broken artifact and
 * pass on a restored valid one *without rebuilding*.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { BuiltSiteValidationError, validateBuiltSite } from '../../scripts/validate-built-site.mjs';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = join(HERE, 'fixtures', 'contracts', 'site-basic');
const VALIDATOR_CLI = join(HERE, '..', '..', 'scripts', 'validate-built-site.mjs');

const FIXTURE_ORIGIN = 'https://fixture.example.dev';
const PREVIEW_BRANCH = 'codex/cms-validation-12345';
const PNG_BYTES = Buffer.from('89504e470d0a1a0a', 'hex');

const PRODUCTION_CMS = [
  'backend:',
  '  name: github',
  '  repo: miyukowo/blog',
  '  branch: main',
  `site_url: ${FIXTURE_ORIGIN}`,
  '',
].join('\n');

async function makeValidFixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'validate-built-site-'));
  await cp(FIXTURE_DIR, dir, { recursive: true });
  t.after(() => rm(dir, { recursive: true, force: true }));

  const fixture = {
    dir,
    distDir: join(dir, 'dist'),
    sourceDir: join(dir, 'source'),
    baselinePath: join(dir, 'baseline.json'),
  };

  // The synthetic fixture omits the default OG image and CMS config that a
  // real build always emits; add them so the baseline artifact is valid.
  await writeFile(join(fixture.distDir, 'og-default.png'), PNG_BYTES);
  await writeFile(join(fixture.distDir, 'cms', 'config.yml'), PRODUCTION_CMS);
  await mkdir(join(fixture.sourceDir, 'public', 'cms'), { recursive: true });
  await writeFile(join(fixture.sourceDir, 'public', 'cms', 'config.yml'), PRODUCTION_CMS);
  return fixture;
}

async function validateProduction(fixture) {
  return validateBuiltSite({
    distDir: fixture.distDir,
    profile: 'production',
    siteUrl: FIXTURE_ORIGIN,
    sourceDir: fixture.sourceDir,
    baselinePath: fixture.baselinePath,
    allowedChanges: {},
  });
}

async function validatePreview(fixture) {
  return validateBuiltSite({
    distDir: fixture.distDir,
    profile: 'preview',
    siteUrl: FIXTURE_ORIGIN,
    sourceDir: fixture.sourceDir,
    baselinePath: fixture.baselinePath,
    allowedChanges: {},
    cmsBranch: PREVIEW_BRANCH,
  });
}

async function makePreviewFixture(t) {
  const fixture = await makeValidFixture(t);
  await writeFile(
    join(fixture.distDir, '_headers'),
    ['/*', '  X-Robots-Tag: noindex, nofollow', ''].join('\n'),
  );
  await writeFile(
    join(fixture.distDir, 'cms', 'config.yml'),
    PRODUCTION_CMS.replace('  branch: main', `  branch: ${PREVIEW_BRANCH}`),
  );
  return fixture;
}

async function expectInvalid(promise, pattern) {
  await assert.rejects(
    promise,
    (error) =>
      error instanceof BuiltSiteValidationError &&
      error.violations.length > 0 &&
      (!pattern || pattern.test(error.message)),
  );
}

test('a valid production artifact passes and restored artifacts stay valid', async (t) => {
  const fixture = await makeValidFixture(t);
  const result = await validateProduction(fixture);
  assert.equal(result.profile, 'production');
  assert.match(result.summary, /routes/);
});

test('a missing generated OG image fails validation', async (t) => {
  const fixture = await makeValidFixture(t);
  await unlink(join(fixture.distDir, 'og', 'hello.png'));
  await expectInvalid(validateProduction(fixture), /missing generated OG file/);
});

test('a missing feed fails validation', async (t) => {
  const fixture = await makeValidFixture(t);
  await unlink(join(fixture.distDir, 'rss.xml'));
  await expectInvalid(validateProduction(fixture), /feeds|rss/i);
});

test('a missing sitemap entry fails validation', async (t) => {
  const fixture = await makeValidFixture(t);
  await unlink(join(fixture.distDir, 'sitemap-0.xml'));
  await expectInvalid(validateProduction(fixture), /sitemap|capture/i);
});

test('a missing Pagefind entry fails validation', async (t) => {
  const fixture = await makeValidFixture(t);
  await unlink(join(fixture.distDir, '_pagefind', 'pagefind-entry.json'));
  await expectInvalid(validateProduction(fixture), /pagefind|search|capture/i);
});

test('a changed protected route fails validation', async (t) => {
  const fixture = await makeValidFixture(t);
  const about = join(fixture.distDir, 'about', 'index.html');
  const html = await readFile(about, 'utf8');
  await writeFile(
    about,
    html.replace(`${FIXTURE_ORIGIN}/about/`, `${FIXTURE_ORIGIN}/about-changed/`),
  );
  await expectInvalid(validateProduction(fixture), /canonical/);
});

test('a wrong configured origin fails validation instead of being normalized', async (t) => {
  const fixture = await makeValidFixture(t);
  const sitemap = join(fixture.distDir, 'sitemap-0.xml');
  const xml = await readFile(sitemap, 'utf8');
  await writeFile(sitemap, xml.replace(FIXTURE_ORIGIN, 'https://wrong-origin.example'));
  await expectInvalid(validateProduction(fixture), /origin/);
});

test('a valid preview artifact passes its noindex/CMS/comments checks', async (t) => {
  const fixture = await makePreviewFixture(t);
  const result = await validatePreview(fixture);
  assert.equal(result.profile, 'preview');
});

test('restoring a production CMS target fails preview validation', async (t) => {
  const fixture = await makePreviewFixture(t);
  await writeFile(join(fixture.distDir, 'cms', 'config.yml'), PRODUCTION_CMS);
  await expectInvalid(validatePreview(fixture), /CMS backend\.branch|preview CMS/);
});

test('a wrong preview CMS site URL fails validation', async (t) => {
  const fixture = await makePreviewFixture(t);
  const configPath = join(fixture.distDir, 'cms', 'config.yml');
  await writeFile(
    configPath,
    (await readFile(configPath, 'utf8')).replace(FIXTURE_ORIGIN, 'https://wrong-origin.example'),
  );
  await expectInvalid(validatePreview(fixture), /site_url/);
});

test('a production comment mount fails preview validation', async (t) => {
  const fixture = await makePreviewFixture(t);
  const about = join(fixture.distDir, 'about', 'index.html');
  const html = await readFile(about, 'utf8');
  await writeFile(
    about,
    html.replace(
      '</body>',
      '  <div data-giscus-mount data-repo="miyukowo/blog" data-mapping="pathname"></div>\n</body>',
    ),
  );
  await expectInvalid(validatePreview(fixture), /comment mount/);
});

test('a preview artifact without noindex headers fails validation', async (t) => {
  const fixture = await makePreviewFixture(t);
  await unlink(join(fixture.distDir, '_headers'));
  await expectInvalid(validatePreview(fixture), /noindex|_headers/);
});

test('the validator CLI exits nonzero on a broken artifact and zero after restore', async (t) => {
  const fixture = await makeValidFixture(t);
  const allowedPath = join(fixture.dir, 'allowed.json');
  await writeFile(allowedPath, '{}\n');
  const args = [
    '--dist',
    fixture.distDir,
    '--profile',
    'production',
    '--site-url',
    FIXTURE_ORIGIN,
    '--source',
    fixture.sourceDir,
    '--baseline',
    fixture.baselinePath,
    '--allowed',
    allowedPath,
  ];

  const ok = await execFileAsync(process.execPath, [VALIDATOR_CLI, ...args], { encoding: 'utf8' });
  assert.match(ok.stdout, /validate-built-site: PASS/);

  await unlink(join(fixture.distDir, 'og', 'hello.png'));
  await assert.rejects(
    execFileAsync(process.execPath, [VALIDATOR_CLI, ...args], { encoding: 'utf8' }),
    (error) => error.code !== 0 && /validate-built-site: FAIL/.test(error.stderr),
  );

  await writeFile(join(fixture.distDir, 'og', 'hello.png'), PNG_BYTES);
  const restored = await execFileAsync(process.execPath, [VALIDATOR_CLI, ...args], {
    encoding: 'utf8',
  });
  assert.match(restored.stdout, /validate-built-site: PASS/);
});
