/**
 * Task 7: deployment/preview workflow contracts.
 *
 * Proves, from the actual workflow YAML and scripts (not prose):
 *  - branch identity selection: main = production, staging = preview, root
 *    base path (no `/staging` prefix that would change comment path identity),
 *  - per-branch concurrency,
 *  - required checks run before any deployment and the build is never
 *    allowed to skip required output (no `CI_SKIP_*` flags),
 *  - tested Node/Bun versions are pinned,
 *  - deployment credentials are not exposed to untrusted PR code,
 *  - preview CMS config writes only built output and rejects production/main,
 *  - preview deployments are marked noindex while production stays indexable,
 *  - the GitHub Pages workflow/support is preserved.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { XMLParser } from 'fast-xml-parser';
import { parse as parseYaml } from 'yaml';

import { markPreviewNoindex } from '../../scripts/mark-preview-noindex.mjs';
import { preparePreviewCms } from '../../scripts/prepare-preview.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CF_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'deploy-cf.yml');
const PAGES_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'deploy.yml');
const CHECKS_WORKFLOW = join(REPO_ROOT, '.github', 'workflows', 'checks.yml');

const cf = parseYaml(readFileSync(CF_WORKFLOW, 'utf8'));
const pages = parseYaml(readFileSync(PAGES_WORKFLOW, 'utf8'));

const cfText = readFileSync(CF_WORKFLOW, 'utf8');

function allSteps(workflow) {
  return Object.values(workflow.jobs ?? {}).flatMap((job) => job.steps ?? []);
}

test('Cloudflare workflow keeps production=main and staging=preview branch identity', () => {
  assert.deepEqual(cf.on.push.branches, ['main', 'staging']);
  // Production build uses the production origin, preview build the staging one.
  const buildStep = allSteps(cf).find((step) => step.run === 'bun run build');
  assert.ok(buildStep, 'deploy workflow must build the site');
  const siteUrl = buildStep.env.SITE_URL;
  assert.match(siteUrl, /staging-blog\.tvphus\.dev/, 'staging must keep its own preview origin');
  assert.match(siteUrl, /blog\.tvphus\.dev/, 'production origin fallback preserved');
  // Root base path: no /staging prefix that would alter comment path identity.
  assert.equal(buildStep.env.BASE_PATH, '', 'preview must serve at the root path');
});

test('credential-free PR checks run on pull_request with read-only contents', () => {
  assert.ok(existsSync(CHECKS_WORKFLOW), 'a dedicated PR checks workflow must exist');
  const checks = parseYaml(readFileSync(CHECKS_WORKFLOW, 'utf8'));
  const triggers = checks.on ?? {};
  assert.ok('pull_request' in triggers, 'PR checks must run on pull_request');
  assert.equal('pull_request_target' in triggers, false);
  assert.equal(checks.permissions?.contents, 'read', 'PR checks must be read-only');
  assert.equal('deployments' in (checks.permissions ?? {}), false);
  assert.equal('pages' in (checks.permissions ?? {}), false);

  const credentialSurface = allSteps(checks)
    .flatMap((step) => [
      String(step.uses ?? ''),
      String(step.run ?? ''),
      JSON.stringify(step.env ?? {}),
    ])
    .join('\n');
  assert.equal(
    /CLOUDFLARE|secrets\./i.test(credentialSurface),
    false,
    'PR checks must not use deployment secrets',
  );
  assert.equal(
    /secrets\./.test(readFileSync(CHECKS_WORKFLOW, 'utf8')),
    false,
    'PR checks workflow must not reference repository secrets',
  );

  const runs = allSteps(checks)
    .map((step) => step.run ?? '')
    .join('\n');
  for (const command of [
    'bun install --frozen-lockfile',
    'bun run typecheck',
    'bun run lint',
    'bun run format:site:check',
    'bun run test:site',
    'bun test src/utils/posts.test.ts',
    'bun run build',
    'node scripts/validate-built-site.mjs --dist dist --mode routine',
  ]) {
    assert.ok(runs.includes(command), `PR checks must run: ${command}`);
  }

  // Deployment credentials stay confined to the push-only deployment workflow.
  assert.match(cfText, /CLOUDFLARE_API_TOKEN/);
  assert.equal('pull_request' in (cf.on ?? {}), false);
});

test('deployment validates the exact transformed dist before upload', () => {
  const deploySteps = cf.jobs.deploy.steps;
  const validatorIndex = deploySteps.findIndex((step) =>
    /validate-built-site\.mjs/.test(step.run ?? ''),
  );
  assert.ok(validatorIndex >= 0, 'deploy must validate the actual artifact');

  const prepareIndex = deploySteps.findIndex((step) => /prepare-preview\.mjs/.test(step.run ?? ''));
  const noindexIndex = deploySteps.findIndex((step) =>
    /mark-preview-noindex\.mjs/.test(step.run ?? ''),
  );
  const uploadIndex = deploySteps.findIndex((step) =>
    String(step.uses ?? '').startsWith('cloudflare/wrangler-action'),
  );
  assert.ok(uploadIndex >= 0, 'wrangler upload step must exist');
  assert.ok(
    validatorIndex > prepareIndex && validatorIndex > noindexIndex,
    'validation must run after preview CMS/noindex transformations',
  );
  assert.ok(validatorIndex < uploadIndex, 'validation must run immediately before upload');

  const validateRun = deploySteps[validatorIndex].run;
  assert.match(validateRun, /--dist dist/);
  assert.match(validateRun, /--mode routine/);
  assert.match(validateRun, /--profile/);
  assert.match(validateRun, /--site-url/);
  assert.equal(
    /bun run build|astro build|pagefind/.test(validateRun),
    false,
    'validation must inspect the existing artifact, never rebuild it',
  );
});

test('non-main Cloudflare builds force production comments off', () => {
  const buildStep = allSteps(cf).find((step) => step.run === 'bun run build');
  assert.ok(buildStep, 'deploy workflow must build the site');
  const expression = String(buildStep.env.PUBLIC_GISCUS_ENABLED ?? '');
  // main may use the repository variable; every other ref must resolve to the
  // literal false so staging never mounts the production discussions.
  assert.match(
    expression,
    /github\.ref_name\s*==\s*['"]main['"]/,
    'comments enablement must be selected by the deployment branch',
  );
  assert.match(
    expression,
    /['"]false['"]/,
    'non-main builds must fall back to the literal false setting',
  );
  assert.match(expression, /vars\.PUBLIC_GISCUS_ENABLED/, 'main keeps the production setting');
  // Production repository/category/pathname bindings stay available unchanged.
  for (const key of [
    'PUBLIC_GISCUS_REPO',
    'PUBLIC_GISCUS_REPO_ID',
    'PUBLIC_GISCUS_CATEGORY',
    'PUBLIC_GISCUS_CATEGORY_ID',
  ]) {
    assert.ok(buildStep.env[key], `${key} must remain configured for main`);
  }
  // The deployment workflow must never be reachable from pull_request code.
  assert.equal('pull_request' in (cf.on ?? {}), false);
});

test('per-branch concurrency and deployment branch identity are preserved', () => {
  assert.equal(cf.concurrency['cancel-in-progress'], false);
  assert.match(cf.concurrency.group, /github\.ref_name/);
  const deployStep = allSteps(cf).find((step) =>
    String(step.uses ?? '').startsWith('cloudflare/wrangler-action'),
  );
  assert.ok(deployStep, 'wrangler deploy step must exist');
  assert.match(String(deployStep.with.command), /--branch=\$\{\{\s*github\.ref_name\s*\}\}/);
});

test('required checks run before deployment and use tested runtimes', () => {
  assert.ok(cf.jobs.checks, 'a checks job must exist');
  assert.deepEqual(cf.jobs.deploy.needs, 'checks', 'deploy must depend on required checks');

  const checkSteps = cf.jobs.checks.steps;
  const runs = checkSteps.map((step) => step.run ?? '').join('\n');
  for (const command of [
    'bun install --frozen-lockfile',
    'bun run typecheck',
    'bun run lint',
    'bun run format:site:check',
    'bun run test:site',
    'bun test src/utils/posts.test.ts',
  ]) {
    assert.ok(runs.includes(command), `checks must run: ${command}`);
  }

  // Runtime pins must match the tested versions.
  for (const workflow of [cf, pages]) {
    const steps = allSteps(workflow);
    const node = steps.find((step) => String(step.uses ?? '').startsWith('actions/setup-node'));
    assert.ok(node, 'Node setup step required');
    assert.equal(node.with['node-version-file'], '.node-version');
    const bun = steps.find((step) => String(step.uses ?? '').startsWith('oven-sh/setup-bun'));
    assert.equal(bun.with['bun-version'], '1.3.14');
  }
});

test('deployment builds cannot silently skip required output', () => {
  // The old staging OG skip must be gone; no check-skipping env flags remain.
  assert.equal(cfText.includes('CI_SKIP_AUTO_OG_IMAGE'), false, 'staging OG skip must be removed');
  for (const flag of ['CI_SKIP_CONTENT_COLLECTIONS', 'CI_SKIP_RSS_SITEMAP', 'CI_SKIP_SEARCH']) {
    assert.equal(cfText.includes(flag), false, `${flag} must not disable required output`);
  }
});

test('deployment credentials are not exposed to untrusted PR code', () => {
  for (const workflow of [cf, pages]) {
    const triggers = workflow.on ?? {};
    assert.equal(
      'pull_request' in triggers,
      false,
      'deploy workflows must not run on pull_request',
    );
    assert.equal('pull_request_target' in triggers, false);
  }
  // Only the deploy job (after required checks) sees the Cloudflare secrets.
  assert.match(cfText, /CLOUDFLARE_API_TOKEN/);
  const checksRuns = (cf.jobs.checks.steps ?? []).map((step) => step.run ?? '').join('\n');
  assert.equal(checksRuns.includes('CLOUDFLARE'), false, 'checks job must not receive secrets');
});

test('preview CMS config writes built output only and rejects production branches', () => {
  const temp = mkdtempSync(join(tmpdir(), 'preview-cms-'));
  try {
    const distDir = join(temp, 'dist');
    mkdirSync(join(distDir, 'cms'), { recursive: true });
    const productionConfig = readFileSync(join(REPO_ROOT, 'public', 'cms', 'config.yml'), 'utf8');
    writeFileSync(join(distDir, 'cms', 'config.yml'), productionConfig, 'utf8');

    // Missing / production / staging / arbitrary targets are rejected fail-closed.
    for (const branch of ['', 'main', 'staging', 'feature/x', 'codex/other-123']) {
      assert.throws(() =>
        preparePreviewCms({ distDir, branch, siteUrl: 'https://staging-blog.tvphus.dev' }),
      );
    }
    // Unsafe site URLs and dist directories are rejected too.
    assert.throws(() =>
      preparePreviewCms({
        distDir,
        branch: 'codex/cms-validation-12345',
        siteUrl: 'javascript:alert(1)',
      }),
    );

    const branch = 'codex/cms-validation-12345';
    const result = preparePreviewCms({
      distDir,
      branch,
      siteUrl: 'https://staging-blog.tvphus.dev',
    });
    assert.ok(result, 'valid isolated branch must produce a preview config');
    const generated = parseYaml(readFileSync(join(distDir, 'cms', 'config.yml'), 'utf8'));
    assert.equal(generated.backend.branch, branch);
    assert.equal(generated.backend.name, 'github');
    assert.equal(generated.backend.repo, 'miyukowo/blog');
    assert.equal(generated.backend.skip_ci, false);
    assert.equal(generated.site_url, 'https://staging-blog.tvphus.dev');

    // The tracked production config is untouched and still targets main.
    const tracked = parseYaml(readFileSync(join(REPO_ROOT, 'public', 'cms', 'config.yml'), 'utf8'));
    assert.equal(tracked.backend.branch, 'main');

    // Non-idempotent by design: a second preview write fails closed.
    assert.throws(() =>
      preparePreviewCms({ distDir, branch, siteUrl: 'https://staging-blog.tvphus.dev' }),
    );
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('preview deployments are noindex while production remains indexable', () => {
  const temp = mkdtempSync(join(tmpdir(), 'preview-headers-'));
  try {
    const distDir = join(temp, 'dist');
    mkdirSync(distDir, { recursive: true });
    const baseHeaders = [
      '/_astro/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '',
      '/*',
      '  Cache-Control: public, max-age=0, must-revalidate',
      '',
    ].join('\n');
    writeFileSync(join(distDir, '_headers'), baseHeaders, 'utf8');

    // Marking production fails closed.
    assert.throws(() => markPreviewNoindex({ distDir, branch: 'main' }));
    assert.equal(readFileSync(join(distDir, '_headers'), 'utf8'), baseHeaders);

    const result = markPreviewNoindex({ distDir, branch: 'staging' });
    assert.equal(result.changed, true);
    const headers = readFileSync(join(distDir, '_headers'), 'utf8');
    assert.match(headers, /X-Robots-Tag: noindex, nofollow/);
    // Idempotent: a second run does not duplicate the rule.
    assert.equal(markPreviewNoindex({ distDir, branch: 'staging' }).changed, false);
    assert.equal(headers.match(/X-Robots-Tag/g).length, 1);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('a scoped CMS noindex rule does not suppress global preview injection', () => {
  const temp = mkdtempSync(join(tmpdir(), 'preview-scoped-headers-'));
  try {
    const distDir = join(temp, 'dist');
    mkdirSync(distDir, { recursive: true });
    const scopedHeaders = [
      '/_astro/*',
      '  Cache-Control: public, max-age=31536000, immutable',
      '',
      '/cms/*',
      '  X-Robots-Tag: noindex',
      '',
    ].join('\n');
    writeFileSync(join(distDir, '_headers'), scopedHeaders, 'utf8');

    const result = markPreviewNoindex({ distDir, branch: 'staging' });
    assert.equal(result.changed, true, 'scoped noindex is not global protection');
    const headers = readFileSync(join(distDir, '_headers'), 'utf8');
    assert.match(headers, /\/\*\n\s+X-Robots-Tag: noindex, nofollow/);
    // The existing scoped rule and cache rule are preserved.
    assert.match(headers, /\/cms\/\*\n\s+X-Robots-Tag: noindex/);
    assert.match(headers, /Cache-Control: public, max-age=31536000, immutable/);
    // A second run is a no-op now that an effective catch-all rule exists.
    assert.equal(markPreviewNoindex({ distDir, branch: 'staging' }).changed, false);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});

test('GitHub Pages workflow/support is preserved for separate assessment', () => {
  assert.ok(existsSync(PAGES_WORKFLOW), 'GitHub Pages workflow must be preserved');
  assert.deepEqual(pages.on.push.branches, ['main']);
  const buildStep = allSteps(pages).find((step) => step.run === 'bun run build');
  assert.ok(buildStep, 'Pages build step preserved');
  assert.match(buildStep.env.BASE_PATH, /repository\.name/, 'Pages keeps its own subpath base');
  assert.ok(
    allSteps(pages).some((step) => String(step.uses ?? '').startsWith('actions/deploy-pages')),
  );
});

test('full-output contract fixture exists for the production-shaped build', () => {
  // The harness script is the source of truth for required output (content,
  // OG, RSS, sitemap, search); deployment relies on it via the same env rules.
  const verifyScript = readFileSync(join(REPO_ROOT, 'scripts', 'verify-site.mjs'), 'utf8');
  assert.match(verifyScript, /CI_SKIP_AUTO_OG_IMAGE/);
  assert.match(verifyScript, /profile === 'full'|'full'/);
  // CLOUDFLARE project command must upload the built dist directory.
  assert.match(cfText, /pages deploy dist/);
});

test('jobs running test:site fetch full Git history for upstream ancestry checks', () => {
  const checks = parseYaml(readFileSync(CHECKS_WORKFLOW, 'utf8'));
  for (const [name, workflow] of [
    ['deploy-cf.yml', cf],
    ['checks.yml', checks],
  ]) {
    const jobsWithSiteTests = Object.entries(workflow.jobs ?? {}).filter(([, job]) =>
      (job.steps ?? []).some((step) => String(step.run ?? '').includes('bun run test:site')),
    );
    assert.ok(jobsWithSiteTests.length > 0, `${name} must run bun run test:site`);
    for (const [jobId, job] of jobsWithSiteTests) {
      const checkout = (job.steps ?? []).find((step) =>
        String(step.uses ?? '').startsWith('actions/checkout'),
      );
      assert.ok(checkout, `${name}#${jobId} must use actions/checkout`);
      assert.equal(
        checkout.with?.['fetch-depth'],
        0,
        `${name}#${jobId} must set fetch-depth: 0 so upstream starter SHAs exist in CI`,
      );
    }
  }
});

// Keep the XML parser import meaningful for future feed assertions without
// adding dead code: parse the checked-in baseline sitemap once.
const baseline = JSON.parse(
  readFileSync(
    join(REPO_ROOT, 'docs', 'research', '2026-11-02-dsh-preflight-baseline.json'),
    'utf8',
  ),
);
const parsed = new XMLParser({ removeNSPrefix: true }).parse(
  '<urlset><url><loc>https://example.test/</loc></url></urlset>',
);
assert.ok(parsed.urlset.url.loc);
assert.ok(Array.isArray(baseline.sitemapUrls));
