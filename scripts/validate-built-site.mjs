#!/usr/bin/env node
/**
 * Read-only validation of an already-built site directory (review repair Task 6).
 *
 * This is the gate that runs immediately before the Cloudflare upload. It never
 * rebuilds and never writes: it captures the supplied `dist/` with the existing
 * `captureSite()` contract and asserts it against the measured baseline with
 * the shared exact allowances in `scripts/site-allowed-changes.mjs`. In
 * particular, it validates the directory *after* `prepare-preview.mjs` and
 * `mark-preview-noindex.mjs`, so a separate rebuild cannot conceal a broken
 * deployment directory.
 *
 * Checks:
 *  - source content identities and body hashes (protected content),
 *  - HTML routes/canonical/lang/hreflang and robots metadata,
 *  - feed language/items, sitemap URLs, generated OG files and Pagefind output,
 *  - configured-origin consistency across HTML, feeds and sitemap (every URL
 *    origin must equal the explicit expected origin; origins are never
 *    normalized into a placeholder),
 *  - every referenced OG image and every captured generated OG PNG exists,
 *  - preview only: noindex headers, isolated CMS branch/site URL, tracked
 *    production CMS still on main, and no production Giscus mount,
 *  - production: no global noindex rule and built CMS still targeting main.
 *
 * Usage:
 *   node scripts/validate-built-site.mjs --dist dist \
 *     --profile production|preview --site-url <origin> \
 *     [--source <dir>] [--baseline <baseline.json>] [--allowed <allowed.json>] \
 *     [--cms-branch codex/cms-validation-<run>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { assertSiteContract, captureSite, SiteContractError } from './site-contract.mjs';
import { ALLOWED_CHANGES } from './site-allowed-changes.mjs';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPTS_DIR, '..');
export const DEFAULT_BASELINE_PATH = join(
  REPO_ROOT,
  'docs',
  'research',
  '2026-11-02-dsh-preflight-baseline.json',
);

export const PROFILES = ['production', 'preview'];
const PREVIEW_BRANCH_PATTERN = /^codex\/cms-validation-[A-Za-z0-9._-]{1,64}$/;
const PRODUCTION_REPO = 'miyukowo/blog';
const PRODUCTION_BRANCH = 'main';

/** A validation failure with one or more concrete violations. */
export class BuiltSiteValidationError extends Error {
  constructor(violations) {
    const list = Array.isArray(violations) ? violations : [String(violations)];
    super(list.join('\n'));
    this.name = 'BuiltSiteValidationError';
    this.violations = list;
  }
}

/**
 * Rebase strings that start with `fromOrigin` onto `toOrigin`.
 *
 * Only the explicit origin is rewritten (never an arbitrary origin), so a
 * preview expectation is an exact, reviewable substitution rather than a
 * placeholder that could hide a cross-origin mistake.
 */
export function rebaseOrigins(value, fromOrigin, toOrigin) {
  if (fromOrigin === toOrigin) return value;
  if (typeof value === 'string') {
    if (value === fromOrigin) return toOrigin;
    if (value.startsWith(`${fromOrigin}/`)) return `${toOrigin}${value.slice(fromOrigin.length)}`;
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => rebaseOrigins(item, fromOrigin, toOrigin));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, rebaseOrigins(item, fromOrigin, toOrigin)]),
    );
  }
  return value;
}

/** Infer the origin recorded in a baseline contract. */
export function inferBaselineOrigin(baseline) {
  const sample =
    baseline?.htmlRoutes?.find((route) => typeof route?.canonical === 'string')?.canonical ??
    baseline?.sitemapUrls?.[0];
  if (typeof sample === 'string') {
    try {
      return new URL(sample).origin;
    } catch {
      // Fall through to the production default.
    }
  }
  return 'https://blog.tvphus.dev';
}

function normalizeExpectedOrigin(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new BuiltSiteValidationError(['--site-url is required (expected an absolute origin)']);
  }
  let url;
  try {
    url = new URL(value.trim());
  } catch {
    throw new BuiltSiteValidationError([`invalid --site-url: ${value}`]);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new BuiltSiteValidationError([`--site-url must use http(s): ${value}`]);
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new BuiltSiteValidationError([`--site-url must be a bare origin: ${value}`]);
  }
  return url.origin;
}

function walkFiles(root, predicate, out = []) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) walkFiles(full, predicate, out);
    else if (predicate(full)) out.push(full);
  }
  return out;
}

/** Every URL origin in the contract must be the one explicit expected origin. */
export function collectOriginViolations(contract, expectedOrigin) {
  const violations = [];
  const check = (value, label) => {
    if (typeof value !== 'string' || value === '') return;
    let url;
    try {
      url = new URL(value);
    } catch {
      violations.push(`${label}: expected an absolute URL, got "${value}"`);
      return;
    }
    if (url.origin !== expectedOrigin) {
      violations.push(`${label}: origin ${url.origin} != expected ${expectedOrigin} (${value})`);
    }
  };

  for (const route of contract.htmlRoutes ?? []) {
    check(route.canonical, `htmlRoutes[${route.path}].canonical`);
    if (!route.lang) violations.push(`htmlRoutes[${route.path}].lang: missing`);
    for (const [hreflang, href] of Object.entries(route.hreflangs ?? {})) {
      check(href, `htmlRoutes[${route.path}].hreflangs.${hreflang}`);
    }
    if (route.ogImage) check(route.ogImage, `htmlRoutes[${route.path}].ogImage`);
  }

  for (const [feedPath, feed] of Object.entries(contract.feeds ?? {})) {
    for (const item of feed.items ?? []) check(item, `feeds[${feedPath}].items`);
  }

  for (const url of contract.sitemapUrls ?? []) check(url, 'sitemapUrls');

  return violations;
}

/** Every referenced/generated OG file must exist in the supplied dist. */
export function collectOgViolations(distDir, contract) {
  const violations = [];
  const seen = new Set();
  const requireFile = (pathname, label) => {
    let decoded = pathname;
    try {
      decoded = decodeURI(pathname);
    } catch {
      // Keep the original path for the existence check/diagnostic.
    }
    if (seen.has(decoded)) return;
    seen.add(decoded);
    if (!existsSync(join(distDir, decoded))) {
      violations.push(`${label}: missing generated OG file ${decoded}`);
    }
  };

  for (const route of contract.htmlRoutes ?? []) {
    if (typeof route.ogImage !== 'string' || route.ogImage === '') continue;
    let pathname = route.ogImage;
    if (/^https?:\/\//i.test(route.ogImage)) {
      pathname = new URL(route.ogImage).pathname;
    }
    if (!pathname.startsWith('/')) continue;
    requireFile(pathname, `htmlRoutes[${route.path}].ogImage`);
  }

  for (const ogPath of contract.generatedOgPaths ?? []) {
    requireFile(ogPath, 'generatedOgPaths');
  }

  return violations;
}

function collectGiscusMountViolations(distDir) {
  const violations = [];
  const htmlFiles = walkFiles(distDir, (file) => file.endsWith('.html'));
  for (const file of htmlFiles) {
    const html = readFileSync(file, 'utf8');
    if (html.includes('data-giscus-mount')) {
      violations.push(
        `${relative(distDir, file)}: production comment mount is present in a preview artifact`,
      );
    }
  }
  return violations;
}

function readYamlFile(path, label) {
  try {
    return parseYaml(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new BuiltSiteValidationError([`${label}: invalid YAML (${error.message})`]);
  }
}

function collectPreviewViolations({ distDir, sourceDir, expectedOrigin, cmsBranch }) {
  const violations = [];

  const headersPath = join(distDir, '_headers');
  if (!existsSync(headersPath)) {
    violations.push('preview: missing built _headers file');
  } else if (!/X-Robots-Tag:\s*noindex/i.test(readFileSync(headersPath, 'utf8'))) {
    violations.push('preview: _headers must set X-Robots-Tag: noindex');
  }

  violations.push(...collectGiscusMountViolations(distDir));

  const builtConfigPath = join(distDir, 'cms', 'config.yml');
  if (!existsSync(builtConfigPath)) {
    violations.push('preview: missing built cms/config.yml');
  } else {
    const config = readYamlFile(builtConfigPath, 'preview cms/config.yml');
    const backend = config?.backend;
    if (backend?.name !== 'github') {
      violations.push(
        `preview CMS backend.name: expected "github", got "${String(backend?.name)}"`,
      );
    }
    if (backend?.repo !== PRODUCTION_REPO) {
      violations.push(
        `preview CMS backend.repo: expected "${PRODUCTION_REPO}", got "${String(backend?.repo)}"`,
      );
    }
    const branch = backend?.branch;
    if (branch === PRODUCTION_BRANCH || branch === 'staging') {
      violations.push(`preview CMS backend.branch must not be "${branch}"`);
    } else if (!PREVIEW_BRANCH_PATTERN.test(String(branch ?? ''))) {
      violations.push(
        `preview CMS backend.branch must match codex/cms-validation-<run>, got "${String(branch)}"`,
      );
    }
    if (cmsBranch && branch !== cmsBranch) {
      violations.push(
        `preview CMS backend.branch: expected "${cmsBranch}", got "${String(branch)}"`,
      );
    }
    let cmsSiteUrl;
    try {
      cmsSiteUrl = new URL(String(config?.site_url ?? '')).origin;
    } catch {
      cmsSiteUrl = undefined;
    }
    if (cmsSiteUrl !== expectedOrigin) {
      violations.push(
        `preview CMS site_url: expected ${expectedOrigin}, got "${String(config?.site_url)}"`,
      );
    }
  }

  const sourceConfigPath = join(sourceDir, 'public', 'cms', 'config.yml');
  if (!existsSync(sourceConfigPath)) {
    violations.push('preview: tracked public/cms/config.yml is missing');
  } else {
    const sourceConfig = readYamlFile(sourceConfigPath, 'tracked public/cms/config.yml');
    if (sourceConfig?.backend?.branch !== PRODUCTION_BRANCH) {
      violations.push(
        `tracked CMS backend.branch must stay "${PRODUCTION_BRANCH}", got "${String(sourceConfig?.backend?.branch)}"`,
      );
    }
  }

  return violations;
}

function collectProductionViolations({ distDir, sourceDir }) {
  const violations = [];

  const headersPath = join(distDir, '_headers');
  if (
    existsSync(headersPath) &&
    /X-Robots-Tag:\s*noindex/i.test(readFileSync(headersPath, 'utf8'))
  ) {
    violations.push('production: built _headers must not set X-Robots-Tag: noindex');
  }

  const builtConfigPath = join(distDir, 'cms', 'config.yml');
  if (!existsSync(builtConfigPath)) {
    violations.push('production: missing built cms/config.yml');
  } else {
    const config = readYamlFile(builtConfigPath, 'production cms/config.yml');
    if (config?.backend?.branch !== PRODUCTION_BRANCH) {
      violations.push(
        `production CMS backend.branch: expected "${PRODUCTION_BRANCH}", got "${String(config?.backend?.branch)}"`,
      );
    }
    if (config?.backend?.repo !== PRODUCTION_REPO) {
      violations.push(
        `production CMS backend.repo: expected "${PRODUCTION_REPO}", got "${String(config?.backend?.repo)}"`,
      );
    }
  }

  const sourceConfigPath = join(sourceDir, 'public', 'cms', 'config.yml');
  if (existsSync(sourceConfigPath)) {
    const sourceConfig = readYamlFile(sourceConfigPath, 'tracked public/cms/config.yml');
    if (sourceConfig?.backend?.branch !== PRODUCTION_BRANCH) {
      violations.push(
        `tracked CMS backend.branch must stay "${PRODUCTION_BRANCH}", got "${String(sourceConfig?.backend?.branch)}"`,
      );
    }
  }

  return violations;
}

function detectToolchain() {
  let installedAstro = 'unavailable';
  try {
    installedAstro = JSON.parse(
      readFileSync(join(REPO_ROOT, 'node_modules', 'astro', 'package.json'), 'utf8'),
    ).version;
  } catch {
    // Astro presence is only evidence; capture does not need it.
  }
  return { installedAstro };
}

/**
 * Validate an already-built directory without rebuilding or writing.
 *
 * @returns {Promise<{ contract: object, profile: string, siteUrl: string, summary: string }>}
 */
export async function validateBuiltSite({
  distDir = 'dist',
  profile = 'production',
  siteUrl,
  sourceDir = REPO_ROOT,
  baselinePath = DEFAULT_BASELINE_PATH,
  allowedChanges = ALLOWED_CHANGES,
  cmsBranch,
  sourceRevision,
} = {}) {
  if (!PROFILES.includes(profile)) {
    throw new BuiltSiteValidationError([
      `unknown profile "${profile}"; expected ${PROFILES.join('|')}`,
    ]);
  }
  const resolvedDist = resolve(distDir);
  if (!existsSync(resolvedDist)) {
    throw new BuiltSiteValidationError([`dist directory does not exist: ${resolvedDist}`]);
  }
  const resolvedSource = resolve(sourceDir);
  if (!existsSync(resolvedSource)) {
    throw new BuiltSiteValidationError([`source directory does not exist: ${resolvedSource}`]);
  }
  const resolvedBaselinePath = isAbsolute(baselinePath) ? baselinePath : resolve(baselinePath);
  if (!existsSync(resolvedBaselinePath)) {
    throw new BuiltSiteValidationError([`baseline does not exist: ${resolvedBaselinePath}`]);
  }

  const expectedOrigin = normalizeExpectedOrigin(siteUrl);
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(resolvedBaselinePath, 'utf8'));
  } catch (error) {
    throw new BuiltSiteValidationError([`baseline is not valid JSON: ${error.message}`]);
  }

  let contract;
  try {
    contract = await captureSite({
      distDir: resolvedDist,
      sourceDir: resolvedSource,
      sourceRevision:
        sourceRevision ?? process.env.GITHUB_SHA ?? process.env.GITHUB_REF_NAME ?? 'artifact',
      baseline,
      sourceBranch: process.env.GITHUB_REF_NAME ?? 'artifact',
      scope: `validate-built-site.mjs --profile ${profile}`,
      toolchain: detectToolchain(),
    });
  } catch (error) {
    throw new BuiltSiteValidationError([`capture: ${error.message}`]);
  }

  const violations = [];

  const baselineOrigin = inferBaselineOrigin(baseline);
  const comparisonBaseline =
    profile === 'preview' ? rebaseOrigins(baseline, baselineOrigin, expectedOrigin) : baseline;
  const comparisonAllowed =
    profile === 'preview'
      ? rebaseOrigins(allowedChanges, baselineOrigin, expectedOrigin)
      : allowedChanges;

  try {
    assertSiteContract(contract, comparisonBaseline, { allowedChanges: comparisonAllowed });
  } catch (error) {
    if (error instanceof SiteContractError) violations.push(...error.violations);
    else violations.push(error.message);
  }

  violations.push(...collectOriginViolations(contract, expectedOrigin));
  violations.push(...collectOgViolations(resolvedDist, contract));

  if (profile === 'preview') {
    violations.push(
      ...collectPreviewViolations({
        distDir: resolvedDist,
        sourceDir: resolvedSource,
        expectedOrigin,
        cmsBranch,
      }),
    );
  } else {
    violations.push(
      ...collectProductionViolations({ distDir: resolvedDist, sourceDir: resolvedSource }),
    );
  }

  if (violations.length > 0) throw new BuiltSiteValidationError(violations);

  return {
    contract,
    profile,
    siteUrl: expectedOrigin,
    baselinePath: resolvedBaselinePath,
    summary: `${contract.htmlRoutes.length} routes, ${Object.keys(contract.feeds).length} feeds, ${contract.sitemapUrls.length} sitemap URLs, ${contract.generatedOgPaths.length} generated OG files, ${contract.search.indexedPages} Pagefind pages`,
  };
}

const USAGE =
  'usage: node scripts/validate-built-site.mjs --dist <dir> --profile production|preview --site-url <origin> [--source <dir>] [--baseline <baseline.json>] [--allowed <allowed.json>] [--cms-branch <branch>]';

function parseArguments(argv) {
  const options = {
    dist: 'dist',
    profile: 'production',
    siteUrl: undefined,
    source: REPO_ROOT,
    baseline: DEFAULT_BASELINE_PATH,
    allowed: undefined,
    cmsBranch: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') return { help: true };
    const take = () => {
      const value = argv[++index];
      if (value === undefined)
        throw new BuiltSiteValidationError([`missing value for ${argument}`]);
      return value;
    };
    if (argument === '--dist') options.dist = take();
    else if (argument === '--profile') options.profile = take();
    else if (argument === '--site-url') options.siteUrl = take();
    else if (argument === '--source') options.source = take();
    else if (argument === '--baseline') options.baseline = take();
    else if (argument === '--allowed') options.allowed = take();
    else if (argument === '--cms-branch') options.cmsBranch = take();
    else throw new BuiltSiteValidationError([`unknown argument "${argument}"`]);
  }
  if (!options.siteUrl) throw new BuiltSiteValidationError(['missing required option --site-url']);
  return options;
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      console.log(USAGE);
      return;
    }
    const allowedChanges = options.allowed
      ? JSON.parse(readFileSync(resolve(options.allowed), 'utf8'))
      : ALLOWED_CHANGES;
    const result = await validateBuiltSite({
      distDir: options.dist,
      profile: options.profile,
      siteUrl: options.siteUrl,
      sourceDir: options.source,
      baselinePath: options.baseline,
      allowedChanges,
      cmsBranch: options.cmsBranch,
    });
    console.log(
      `validate-built-site: PASS profile=${result.profile} dist=${resolve(options.dist)} site=${result.siteUrl}`,
    );
    console.log(`  contract: ${result.summary}`);
    console.log('  origin consistency: OK');
    console.log('  generated OG existence: OK');
    if (result.profile === 'preview') {
      console.log('  preview: noindex headers OK, isolated CMS config OK, comments disabled OK');
    }
  } catch (error) {
    const violations =
      error instanceof BuiltSiteValidationError
        ? error.violations
        : [String(error.message ?? error)];
    console.error('validate-built-site: FAIL');
    for (const violation of violations) console.error(`  - ${violation}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
