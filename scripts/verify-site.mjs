#!/usr/bin/env node
/**
 * Deterministic site verification profiles.
 *
 * The build harness must prove the public contract without depending on the
 * network or on a developer's `.env`. Profiles:
 *
 * - `offline` (default): production-shaped build with local assets only.
 *   `SITE_URL=https://blog.tvphus.dev`, `BASE_PATH=/`, no
 *   `PUBLIC_GITHUB_HANDLE` (local avatar), `PUBLIC_GISCUS_ENABLED=false`, all
 *   `CI_SKIP_*` flags false. Runs Astro under Node, runs Pagefind, captures
 *   the contract with `scripts/site-contract.mjs` and asserts it against
 *   `docs/research/2026-11-02-dsh-preflight-baseline.json`. This profile
 *   never requires network access and never copies a `.env` file.
 * - `full`: the same production-shaped build, but refuses to start when any
 *   disabling environment flag (`CI_SKIP_CONTENT_COLLECTIONS`,
 *   `CI_SKIP_AUTO_OG_IMAGE`, `CI_SKIP_RSS_SITEMAP`, or any other truthy
 *   `CI_SKIP_*` variable) is set, and fails if any required output (content
 *   pages, feeds, sitemap, OG images, Pagefind index) is missing or skipped.
 *   Live remote-asset checks are deliberately NOT part of this command: they
 *   are network-dependent and should run separately as an explicitly
 *   documented staging check (see docs/maintenance/upstream.md, later task).
 * - `preview`: preview-shaped build with `SITE_URL` set to
 *   `https://preview.blog.tvphus.dev` (override with `--site-url`) and root
 *   `BASE_PATH=/`. URL origins are normalized before comparison (Astro page
 *   metadata follows `SITE_URL`, while `@astrojs/sitemap`/`@astrojs/rss` use
 *   the `site` value evaluated in `astro.config.mjs` before Vite env is
 *   available), so the protected route paths, metadata shape, feed/sitemap
 *   paths, OG paths and Pagefind evidence are still checked. It also reports
 *   the CMS preview assets that require the manual/authenticated Task 6
 *   checks. It never deploys anything.
 *
 * The only accepted contract deviations are the entries in
 * `ALLOWED_CHANGES` below. They are deliberately narrow, exact
 * `from` -> `to` classifications with a reason:
 *
 * 1. `/vi/rss.xml` language `en-us` -> `vi-vn`: the known baseline defect
 *    this refactor fixes.
 * 2. `/categories/guide/` `hreflangs.vi`: the baseline recorded
 *    `/vi/categories/guide/`, which does not exist; the real translated
 *    destination is `/vi/categories/huong-dan/`.
 * 3. `/vi/categories/huong-dan/` `hreflangs.en` (and `hreflangs.x-default`,
 *    which follows the default-locale sibling): the baseline recorded
 *    `/categories/huong-dan/`, which does not exist; the real EN counterpart
 *    is `/categories/guide/`.
 *
 * Entries 2 and 3 are pre-Task-2 baseline defects: they are inert in a
 * checkout where Task 2 has not landed, and become active once the taxonomy
 * fix is integrated. Nothing else is allowed to drift.
 *
 * Usage:
 *   node scripts/verify-site.mjs [--profile offline|full|preview]
 *                                [--site-url <url>] [--base-path /]
 *                                [--output <capture.json>]
 *
 * Environment flags are set explicitly for every profile; the command exits
 * nonzero on any build, Pagefind or contract failure and prints a concise
 * PASS/FAIL summary.
 */
import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { assertSiteContract, captureSite, SiteContractError } from './site-contract.mjs';

const execFileAsync = promisify(execFile);

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPTS_DIR, '..');
const BASELINE_PATH = join(REPO_ROOT, 'docs', 'research', '2026-11-02-dsh-preflight-baseline.json');
const ASTRO_BIN = join(REPO_ROOT, 'node_modules', 'astro', 'bin', 'astro.mjs');
const PAGEFIND_BIN = join(REPO_ROOT, 'node_modules', 'pagefind', 'lib', 'runner', 'bin.cjs');
const DIST_DIR = join(REPO_ROOT, 'dist');

/** Origin recorded in the measured baseline. */
const BASELINE_ORIGIN = 'https://blog.tvphus.dev';
const DEFAULT_PREVIEW_ORIGIN = 'https://preview.blog.tvphus.dev';

/** Env flags that would silently drop required output. */
const DISABLING_ENV_FLAGS = [
  'CI_SKIP_CONTENT_COLLECTIONS',
  'CI_SKIP_AUTO_OG_IMAGE',
  'CI_SKIP_RSS_SITEMAP',
  'CI_SKIP_SEARCH',
  'CI_SKIP_SITEMAP',
  'CI_SKIP_RSS',
];

const ALLOWED_CHANGES = {
  fieldChanges: [
    {
      path: '/vi/rss.xml',
      field: 'language',
      from: 'en-us',
      to: 'vi-vn',
      reason: 'Known baseline defect: the VI feed must report the VI language.',
    },
    {
      path: '/categories/guide/',
      field: 'hreflangs.vi',
      from: 'https://blog.tvphus.dev/vi/categories/guide/',
      to: 'https://blog.tvphus.dev/vi/categories/huong-dan/',
      reason:
        'Baseline recorded a non-existent VI taxonomy destination; the real translated route is /vi/categories/huong-dan/.',
    },
    {
      path: '/vi/categories/huong-dan/',
      field: 'hreflangs.en',
      from: 'https://blog.tvphus.dev/categories/huong-dan/',
      to: 'https://blog.tvphus.dev/categories/guide/',
      reason:
        'Baseline recorded a non-existent EN taxonomy destination; the real EN counterpart is /categories/guide/.',
    },
    {
      path: '/vi/categories/huong-dan/',
      field: 'hreflangs.x-default',
      from: 'https://blog.tvphus.dev/categories/huong-dan/',
      to: 'https://blog.tvphus.dev/categories/guide/',
      reason:
        'x-default follows the default-locale sibling, so it records the same non-existent EN taxonomy destination as hreflangs.en.',
    },
  ],
};

const PROFILES = ['offline', 'full', 'preview'];

function printUsage() {
  console.log(
    'usage: node scripts/verify-site.mjs --profile offline|full|preview [--site-url <url>] [--base-path /] [--output <capture.json>]',
  );
}

function parseArguments(argv) {
  const values = { profile: 'offline', 'site-url': undefined, 'base-path': '/', output: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      printUsage();
      process.exit(0);
    }
    if (argument === '--profile') {
      values.profile = argv[++index];
    } else if (argument === '--site-url') {
      values['site-url'] = argv[++index];
    } else if (argument === '--base-path') {
      values['base-path'] = argv[++index];
    } else if (argument === '--output') {
      values.output = argv[++index];
    } else {
      throw new Error(`unknown argument "${argument}"\n`);
    }
  }
  if (!PROFILES.includes(values.profile)) {
    throw new Error(`unknown --profile "${values.profile}"; expected ${PROFILES.join('|')}`);
  }
  if (typeof values['base-path'] !== 'string' || values['base-path'] !== '/') {
    throw new Error(
      'only the root base path ("/") is comparable with the recorded baseline; pass --base-path /',
    );
  }
  return values;
}

/** Truthy detection for the disabling environment flags. */
function isTruthyFlag(value) {
  if (value === undefined) return false;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

function findDisablingFlags(env) {
  const flags = new Set(DISABLING_ENV_FLAGS.filter((name) => isTruthyFlag(env[name])));
  for (const name of Object.keys(env)) {
    if (/^CI_SKIP_/i.test(name) && isTruthyFlag(env[name])) flags.add(name);
  }
  return [...flags].sort();
}

/**
 * Build the deterministic environment for a profile. Child process env is
 * explicit so a developer's `.env`/process environment cannot disable
 * required output; explicit process env values take precedence over Astro's
 * `.env` loading.
 */
function buildEnvironment({ siteUrl }) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (/^CI_SKIP_/i.test(name)) env[name] = 'false';
  }
  for (const name of DISABLING_ENV_FLAGS) env[name] = 'false';
  delete env.PUBLIC_GITHUB_HANDLE;
  delete env.PUBLIC_GISCUS_REPO;
  delete env.PUBLIC_GISCUS_REPO_ID;
  delete env.PUBLIC_GISCUS_CATEGORY;
  delete env.PUBLIC_GISCUS_CATEGORY_ID;
  env.SITE_URL = siteUrl;
  env.BASE_PATH = '/';
  env.PUBLIC_GISCUS_ENABLED = 'false';
  return env;
}

function spawnLogged({ command, args, env, cwd, logPath }) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    const collect = (chunk) => {
      output += chunk.toString();
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    child.on('error', (error) => {
      resolvePromise({ code: 1, output: `${output}\n${error.message}` });
    });
    child.on('close', async (code) => {
      await writeFile(logPath, output).catch(() => {});
      resolvePromise({ code: code ?? 1, output });
    });
  });
}

function tailOfLog(output, lineCount = 12) {
  return output.trimEnd().split('\n').slice(-lineCount).join('\n');
}

async function detectToolchain() {
  let bun = 'unavailable';
  try {
    const { stdout } = await execFileAsync('bun', ['--version']);
    bun = stdout.trim();
  } catch {
    // Bun is optional for the offline build; record its absence.
  }
  let installedAstro = 'unavailable';
  try {
    const packageJson = JSON.parse(
      await readFile(join(REPO_ROOT, 'node_modules', 'astro', 'package.json'), 'utf8'),
    );
    installedAstro = packageJson.version;
  } catch {
    // Astro must exist for the build; the build step will fail informatively.
  }
  let gitHead = 'unavailable';
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
    gitHead = stdout.trim();
  } catch {
    // Provenance is best effort; a worktree without Git still builds.
  }
  return { bun, installedAstro, gitHead };
}

const NORMALIZED_PREVIEW_ORIGIN = 'https://preview-origin.invalid';

/**
 * Replace every URL origin with one placeholder so the preview profile can
 * compare paths, canonical paths and metadata without pinning the build to
 * the production origin.
 *
 * Why this is needed: page modules read `import.meta.env.SITE_URL` during the
 * Vite build (so canonical/hreflang/OG follow the preview origin), but
 * `astro.config.mjs` evaluates `SITE.url` before Vite env is available, so
 * `@astrojs/sitemap` and `@astrojs/rss` (which receive `context.site`) still
 * emit the config-load default origin. Origin normalization keeps the
 * preview check focused on the contract (routes, paths, metadata shape,
 * counts) and documents that preview origin consistency is a deployment
 * concern. Offline/full profiles never normalize origins and therefore keep
 * the exact production canonical URLs protected.
 */
function normalizeContractOrigins(value) {
  if (typeof value === 'string') {
    return value.replace(/^https?:\/\/[^/]+/i, NORMALIZED_PREVIEW_ORIGIN);
  }
  if (Array.isArray(value)) return value.map((item) => normalizeContractOrigins(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeContractOrigins(item)]),
    );
  }
  return value;
}

function contractSummary(contract) {
  return `${contract.htmlRoutes.length} routes, ${Object.keys(contract.feeds).length} feeds, ${contract.sitemapUrls.length} sitemap URLs, ${contract.generatedOgPaths.length} OG paths, ${contract.search.indexedPages} Pagefind pages (${contract.search.languages.join(', ')})`;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const profile = options.profile;

  if (profile === 'full') {
    const disablingFlags = findDisablingFlags(process.env);
    if (disablingFlags.length > 0) {
      console.error(
        `site verify: FAIL - the "full" profile refuses to run while required-output flags are disabled: ${disablingFlags.join(
          ', ',
        )}`,
      );
      process.exitCode = 1;
      return;
    }
  }

  const siteUrl =
    options['site-url'] ?? (profile === 'preview' ? DEFAULT_PREVIEW_ORIGIN : BASELINE_ORIGIN);
  const evidenceDir = options.output
    ? dirname(resolve(options.output))
    : await mkdtemp(join(tmpdir(), `site-verify-${profile}-`));
  const outputPath = options.output
    ? resolve(options.output)
    : join(evidenceDir, `${profile}-contract.json`);
  await mkdir(evidenceDir, { recursive: true });

  const buildLog = join(evidenceDir, 'astro-build.log');
  const pagefindLog = join(evidenceDir, 'pagefind.log');
  const env = buildEnvironment({ siteUrl });

  console.log(`site verify: profile=${profile}`);
  console.log(`  project: ${REPO_ROOT}`);
  console.log(`  site url: ${siteUrl}  base: /`);

  const toolchain = await detectToolchain();

  const build = await spawnLogged({
    command: process.execPath,
    args: [ASTRO_BIN, 'build'],
    env,
    cwd: REPO_ROOT,
    logPath: buildLog,
  });
  if (build.code !== 0) {
    console.error(`site verify: FAIL - Astro build exited ${build.code}; log: ${buildLog}`);
    console.error(tailOfLog(build.output));
    process.exitCode = 1;
    return;
  }

  const pagefind = await spawnLogged({
    command: process.execPath,
    args: [PAGEFIND_BIN, '--site', DIST_DIR, '--output-subdir', '_pagefind'],
    env,
    cwd: REPO_ROOT,
    logPath: pagefindLog,
  });
  if (pagefind.code !== 0) {
    console.error(`site verify: FAIL - Pagefind exited ${pagefind.code}; log: ${pagefindLog}`);
    console.error(tailOfLog(pagefind.output));
    process.exitCode = 1;
    return;
  }

  const measuredBaseline = JSON.parse(await readFile(BASELINE_PATH, 'utf8'));
  const comparisonBaseline =
    profile === 'preview' ? normalizeContractOrigins(measuredBaseline) : measuredBaseline;
  const allowedChanges =
    profile === 'preview' ? normalizeContractOrigins(ALLOWED_CHANGES) : ALLOWED_CHANGES;

  let contract;
  try {
    contract = await captureSite({
      distDir: DIST_DIR,
      sourceDir: REPO_ROOT,
      sourceRevision: toolchain.gitHead,
      baseline: measuredBaseline,
      sourceBranch: 'worktree',
      scope: `verify-site.mjs --profile ${profile}`,
      toolchain: {
        node: process.versions.node,
        bun: toolchain.bun,
        installedAstro: toolchain.installedAstro,
      },
    });
  } catch (error) {
    console.error(`site verify: FAIL - capture failed: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`);

  const comparisonContract = profile === 'preview' ? normalizeContractOrigins(contract) : contract;

  try {
    assertSiteContract(comparisonContract, comparisonBaseline, { allowedChanges });
  } catch (error) {
    console.error(`site verify: FAIL - contract mismatch`);
    if (error instanceof SiteContractError) {
      for (const violation of error.violations) console.error(`  - ${violation}`);
    } else {
      console.error(`  ${error.message}`);
    }
    console.error(`  build log: ${buildLog}`);
    console.error(`  capture: ${outputPath}`);
    process.exitCode = 1;
    return;
  }

  if (profile === 'full') {
    const missing = [];
    if (Object.keys(contract.feeds).length < 2) missing.push('feeds');
    if (contract.sitemapUrls.length === 0) missing.push('sitemap URLs');
    if (contract.generatedOgPaths.length === 0) missing.push('generated OG images');
    if (contract.search.indexedPages === 0) missing.push('Pagefind pages');
    if (missing.length > 0) {
      console.error(
        `site verify: FAIL - full profile is missing required output: ${missing.join(', ')}`,
      );
      process.exitCode = 1;
      return;
    }
  }

  console.log(
    `  toolchain: node ${process.versions.node}, bun ${toolchain.bun}, astro ${toolchain.installedAstro}`,
  );
  console.log(`  git HEAD: ${toolchain.gitHead}`);
  console.log(`  build: OK (astro log: ${buildLog})`);
  console.log(`  pagefind: OK (log: ${pagefindLog})`);
  console.log(`  captured: ${contractSummary(contract)}`);
  console.log(
    `  contract: OK vs docs/research/2026-11-02-dsh-preflight-baseline.json (${allowedChanges.fieldChanges.length} documented exact field allowance(s))`,
  );
  console.log(`  capture: ${outputPath}`);

  if (profile === 'preview') {
    const cmsIndex = join(REPO_ROOT, 'public', 'cms', 'index.html');
    const cmsConfig = join(REPO_ROOT, 'public', 'cms', 'config.yml');
    console.log(
      `  cms preview assets: index.html=${existsSync(cmsIndex) ? 'present' : 'MISSING'}, config.yml=${existsSync(cmsConfig) ? 'present' : 'MISSING'}`,
    );
    console.log(
      '  manual checks (not run here): isolated preview CMS branch, authenticate, create/edit/delete a translated draft and one media item, then reload and verify rendering. Never write to production main.',
    );
    console.log('  deployment: not performed (preview profile only verifies the build)');
  }

  console.log('RESULT: PASS');
}

main().catch((error) => {
  console.error(`site verify: FAIL - ${error instanceof Error ? error.message : String(error)}`);
  printUsage();
  process.exitCode = 1;
});
