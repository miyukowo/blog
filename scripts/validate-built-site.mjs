#!/usr/bin/env node
/**
 * Read-only validation of an already-built site directory (review repair Task 6,
 * extended by follow-up Task 2).
 *
 * This is the gate that runs immediately before the Cloudflare upload. It never
 * rebuilds and never writes.
 *
 * Two modes:
 *  - `routine` (default): derive expected routes, feeds, sitemap identities,
 *    generated OG files, Pagefind count and per-route metadata from the
 *    CURRENT checked-out source. A build manifest under `.astro/` binds the
 *    artifact to the source fingerprint, so a source edit without a rebuild is
 *    rejected as stale. Normal CMS publishing therefore needs no baseline edit.
 *  - `historical` (explicit `--baseline` / `--mode historical`): compare the
 *    artifact against the measured November migration snapshot with the shared
 *    exact allowances. Used only for migration preflight/regression checks.
 *
 * In both modes it validates the directory *after* `prepare-preview.mjs` and
 * `mark-preview-noindex.mjs`, so a separate rebuild cannot conceal a broken
 * deployment directory, and it checks:
 *  - configured-origin consistency across HTML, feeds and sitemap,
 *  - every referenced OG image and every captured generated OG PNG exists,
 *  - preview only: effective catch-all noindex headers (scope-aware), isolated
 *    CMS branch/site URL, tracked production CMS still on main, and no
 *    production Giscus mount,
 *  - production: no effective site-wide noindex rule and built CMS still
 *    targeting main.
 *
 * Usage:
 *   node scripts/validate-built-site.mjs --dist dist \
 *     --profile production|preview --site-url <origin> \
 *     [--source <dir>] [--mode routine|historical] \
 *     [--manifest .astro/site-build-manifest.json] \
 *     [--baseline <baseline.json>] [--allowed <allowed.json>] \
 *     [--cms-branch codex/cms-validation-<run>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { assertSiteContract, captureSite, SiteContractError } from './site-contract.mjs';
import { hasGlobalNoindex } from './header-policy.mjs';
import {
  BUILD_MANIFEST_RELATIVE_PATH,
  computeSourceFingerprint,
} from '../src/site/build-manifest.ts';
import { buildSourceExpectations, expectedRouteMetadata } from './site-source-expectations.mjs';
import { normalizeSitemapPathname } from '../src/site/sitemap.ts';

const SCRIPTS_DIR = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(SCRIPTS_DIR, '..');

export const PROFILES = ['production', 'preview'];
export const MODES = ['routine', 'historical'];
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

/**
 * Return the explicit `og:image` origin expected for `routePath` when deriving
 * expectations from current source. External origins (e.g. the optimized media
 * CDN for a remote `heroImage`) are permitted only for routes whose source
 * expectations explicitly resolve to that origin.
 */
function expectedOgOriginForRoute(expectations, routePath) {
  const expectedRoute = expectations?.routeByPath?.get(routePath);
  if (!expectedRoute) return undefined;
  const expectedOgImage = expectedRouteMetadata(expectations, expectedRoute).ogImage;
  if (typeof expectedOgImage !== 'string' || !/^https?:\/\//i.test(expectedOgImage)) {
    return undefined;
  }
  try {
    return new URL(expectedOgImage).origin;
  } catch {
    return undefined;
  }
}

/** Every URL origin in the contract must be the expected origin (or expected external OG origin). */
export function collectOriginViolations(contract, expectedOrigin, expectations) {
  const violations = [];
  const check = (value, label, allowedExternalOrigin) => {
    if (typeof value !== 'string' || value === '') return;
    let url;
    try {
      url = new URL(value);
    } catch {
      violations.push(`${label}: expected an absolute URL, got "${value}"`);
      return;
    }
    if (url.origin !== expectedOrigin && url.origin !== allowedExternalOrigin) {
      violations.push(`${label}: origin ${url.origin} != expected ${expectedOrigin} (${value})`);
    }
  };

  for (const route of contract.htmlRoutes ?? []) {
    check(route.canonical, `htmlRoutes[${route.path}].canonical`);
    if (!route.lang) violations.push(`htmlRoutes[${route.path}].lang: missing`);
    for (const [hreflang, href] of Object.entries(route.hreflangs ?? {})) {
      check(href, `htmlRoutes[${route.path}].hreflangs.${hreflang}`);
    }
    if (route.ogImage) {
      const allowedOgOrigin = expectedOgOriginForRoute(expectations, route.path);
      check(route.ogImage, `htmlRoutes[${route.path}].ogImage`, allowedOgOrigin);
    }
  }

  for (const [feedPath, feed] of Object.entries(contract.feeds ?? {})) {
    for (const item of feed.items ?? []) check(item, `feeds[${feedPath}].items`);
  }

  for (const url of contract.sitemapUrls ?? []) check(url, 'sitemapUrls');

  return violations;
}

/** Every referenced local/generated OG file must exist in the supplied dist. */
export function collectOgViolations(distDir, contract, expectedOrigin) {
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
      try {
        const parsed = new URL(route.ogImage);
        // External/CDN hero images (e.g. https://cdn.tvphus.dev/...) are not
        // emitted into local dist/; only check local existence for same-origin
        // OG resources.
        if (expectedOrigin && parsed.origin !== expectedOrigin) continue;
        pathname = parsed.pathname;
      } catch {
        continue;
      }
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
  } else if (!hasGlobalNoindex(readFileSync(headersPath, 'utf8'))) {
    violations.push(
      'preview: _headers must set an effective catch-all X-Robots-Tag: noindex on /*',
    );
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
  if (existsSync(headersPath) && hasGlobalNoindex(readFileSync(headersPath, 'utf8'))) {
    violations.push('production: built _headers must not set a site-wide X-Robots-Tag: noindex');
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

/** Compare built routes and their metadata against current-source expectations. */
function collectRoutineRouteViolations(contract, expectations) {
  const violations = [];
  const actualByPath = new Map();
  for (const route of contract.htmlRoutes ?? []) {
    if (!route || typeof route.path !== 'string') continue;
    if (actualByPath.has(route.path)) {
      violations.push(`htmlRoutes[${route.path}]: duplicate route in artifact`);
      continue;
    }
    actualByPath.set(route.path, route);
  }

  for (const [path, expectedRoute] of expectations.routeByPath) {
    const actual = actualByPath.get(path);
    if (!actual) {
      violations.push(`htmlRoutes[${path}]: missing route expected from current source`);
      continue;
    }
    const expected = expectedRouteMetadata(expectations, expectedRoute);

    for (const field of ['canonical', 'lang', 'robots']) {
      if (actual[field] === expected[field]) continue;
      violations.push(
        `htmlRoutes[${path}].${field}: expected ${JSON.stringify(expected[field])}, got ${JSON.stringify(actual[field] ?? '')}`,
      );
    }

    if (expected.ogImage !== undefined) {
      if (actual.ogImage !== expected.ogImage) {
        violations.push(
          `htmlRoutes[${path}].ogImage: expected ${JSON.stringify(expected.ogImage)}, got ${JSON.stringify(actual.ogImage ?? '')}`,
        );
      }
    } else if (!actual.ogImage) {
      violations.push(`htmlRoutes[${path}].ogImage: expected a non-empty OG reference`);
    }

    const actualHreflangs = actual.hreflangs ?? {};
    const keys = [
      ...new Set([...Object.keys(expected.hreflangs), ...Object.keys(actualHreflangs)]),
    ].sort();
    for (const key of keys) {
      const expectedValue = expected.hreflangs[key];
      const actualValue = actualHreflangs[key];
      if (expectedValue === actualValue) continue;
      violations.push(
        `htmlRoutes[${path}].hreflangs.${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
      );
    }
  }

  for (const path of actualByPath.keys()) {
    if (expectations.routeByPath.has(path)) continue;
    violations.push(`htmlRoutes[${path}]: unexpected route not derivable from current source`);
  }

  return violations;
}

/** Compare RSS feeds (existence, language and ordered items) with current source. */
function collectRoutineFeedViolations(contract, expectations) {
  const violations = [];
  const actualFeeds = contract.feeds ?? {};
  for (const [path, expected] of Object.entries(expectations.feeds)) {
    const actual = actualFeeds[path];
    if (!actual) {
      violations.push(`feeds[${path}]: missing feed expected from current source`);
      continue;
    }
    if (actual.language !== expected.language) {
      violations.push(
        `feeds[${path}].language: expected ${JSON.stringify(expected.language)}, got ${JSON.stringify(actual.language ?? '')}`,
      );
    }
    const actualItems = Array.isArray(actual.items) ? actual.items : [];
    if (JSON.stringify(actualItems) !== JSON.stringify(expected.items)) {
      violations.push(
        `feeds[${path}].items: expected ${JSON.stringify(expected.items)}, got ${JSON.stringify(actualItems)}`,
      );
    }
  }
  for (const path of Object.keys(actualFeeds)) {
    if (Object.hasOwn(expectations.feeds, path)) continue;
    violations.push(`feeds[${path}]: unexpected feed not derivable from current source`);
  }
  return violations;
}

/** Compare sitemap identities against current-source routes. */
function collectRoutineSitemapViolations(contract, expectations) {
  const violations = [];
  const expectedByPath = new Map(
    expectations.sitemapUrls.map((url) => [normalizeSitemapPathname(url), url]),
  );
  const actualByPath = new Map(
    (contract.sitemapUrls ?? []).map((url) => [normalizeSitemapPathname(url), url]),
  );

  for (const [pathname, url] of expectedByPath) {
    if (!actualByPath.has(pathname)) {
      violations.push(`sitemapUrls: missing URL expected from current source ${url}`);
    }
  }
  for (const [pathname, url] of actualByPath) {
    if (!expectedByPath.has(pathname)) {
      violations.push(`sitemapUrls: unexpected URL not derivable from current source ${url}`);
    }
  }
  return violations;
}

/** Compare generated OG identities (drafts absent, published unlisted included). */
function collectRoutineOgViolations(contract, expectations) {
  const violations = [];
  const expected = new Set(expectations.generatedOgPaths);
  const actual = new Set(contract.generatedOgPaths ?? []);
  for (const path of expected) {
    if (!actual.has(path)) {
      violations.push(`generatedOgPaths: missing generated OG image ${path}`);
    }
  }
  for (const path of actual) {
    if (!expected.has(path)) {
      violations.push(`generatedOgPaths: unexpected generated OG image ${path}`);
    }
  }
  return violations;
}

/** Compare the Pagefind count/languages with current-source indexable pages. */
function collectRoutineSearchViolations(contract, expectations) {
  const violations = [];
  const actual = contract.search;
  if (!actual) {
    violations.push('search: missing search evidence (Pagefind output)');
    return violations;
  }
  if (actual.indexedPages !== expectations.search.indexedPages) {
    violations.push(
      `search.indexedPages: expected ${expectations.search.indexedPages}, got ${actual.indexedPages}`,
    );
  }
  if (JSON.stringify(actual.languages) !== JSON.stringify(expectations.search.languages)) {
    violations.push(
      `search.languages: expected ${JSON.stringify(expectations.search.languages)}, got ${JSON.stringify(actual.languages)}`,
    );
  }
  return violations;
}

function collectRoutineStaticViolations(distDir, expectations) {
  const violations = [];
  for (const relativePath of expectations.staticPublicHtml) {
    if (!existsSync(join(distDir, ...relativePath.split('/')))) {
      violations.push(`static: missing copied public HTML file ${relativePath}`);
    }
  }
  return violations;
}

/** Validate the build manifest binding and reject a stale artifact. */
function collectManifestViolations({ sourceDir, manifestPath }) {
  const resolvedPath = manifestPath
    ? isAbsolute(manifestPath)
      ? manifestPath
      : resolve(manifestPath)
    : join(sourceDir, BUILD_MANIFEST_RELATIVE_PATH);

  if (!existsSync(resolvedPath)) {
    return {
      violations: [
        `routine: build manifest missing at ${resolvedPath}; rebuild the site before validating`,
      ],
      manifestPath: resolvedPath,
      manifest: undefined,
    };
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(resolvedPath, 'utf8'));
  } catch (error) {
    return {
      violations: [`routine: build manifest is not valid JSON: ${error.message}`],
      manifestPath: resolvedPath,
      manifest: undefined,
    };
  }

  const violations = [];
  if (manifest?.schemaVersion !== 1) {
    violations.push(`routine: unsupported build manifest schemaVersion ${manifest?.schemaVersion}`);
  }

  let currentFingerprint;
  try {
    currentFingerprint = computeSourceFingerprint(sourceDir).fingerprint;
  } catch (error) {
    violations.push(`routine: cannot fingerprint current source: ${error.message}`);
  }
  if (currentFingerprint && currentFingerprint !== manifest?.sourceFingerprint) {
    violations.push(
      'routine: source changed since the last build (stale artifact); rebuild before validating. ' +
        'Expected source expectations are derived from current source, not from this output.',
    );
  }

  return { violations, manifestPath: resolvedPath, manifest };
}

/**
 * Validate an already-built directory without rebuilding or writing.
 *
 * @returns {Promise<{ contract: object, profile: string, mode: string, siteUrl: string, summary: string }>}
 */
export async function validateBuiltSite({
  distDir = 'dist',
  profile = 'production',
  mode,
  siteUrl,
  sourceDir = REPO_ROOT,
  manifestPath,
  baselinePath,
  allowedChanges = {},
  cmsBranch,
  sourceRevision,
} = {}) {
  if (!PROFILES.includes(profile)) {
    throw new BuiltSiteValidationError([
      `unknown profile "${profile}"; expected ${PROFILES.join('|')}`,
    ]);
  }
  const resolvedMode = mode ?? (baselinePath ? 'historical' : 'routine');
  if (!MODES.includes(resolvedMode)) {
    throw new BuiltSiteValidationError([
      `unknown mode "${resolvedMode}"; expected ${MODES.join('|')}`,
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

  if (resolvedMode === 'historical' && !baselinePath) {
    throw new BuiltSiteValidationError(['historical mode requires --baseline <baseline.json>']);
  }

  const expectedOrigin = normalizeExpectedOrigin(siteUrl);
  const violations = [];

  let baseline;
  let resolvedBaselinePath;
  if (resolvedMode === 'historical') {
    resolvedBaselinePath = isAbsolute(baselinePath) ? baselinePath : resolve(baselinePath);
    if (!existsSync(resolvedBaselinePath)) {
      throw new BuiltSiteValidationError([`baseline does not exist: ${resolvedBaselinePath}`]);
    }
    try {
      baseline = JSON.parse(readFileSync(resolvedBaselinePath, 'utf8'));
    } catch (error) {
      throw new BuiltSiteValidationError([`baseline is not valid JSON: ${error.message}`]);
    }
  }

  let expectations;
  let manifestInfo;
  if (resolvedMode === 'routine') {
    manifestInfo = collectManifestViolations({ sourceDir: resolvedSource, manifestPath });
    violations.push(...manifestInfo.violations);
    try {
      expectations = buildSourceExpectations({
        sourceDir: resolvedSource,
        siteUrl: expectedOrigin,
      });
    } catch (error) {
      throw new BuiltSiteValidationError([
        `routine: cannot derive current-source expectations: ${error.message}`,
      ]);
    }
  }

  let contract;
  try {
    contract = await captureSite({
      distDir: resolvedDist,
      sourceDir: resolvedSource,
      sourceRevision:
        resolvedMode === 'routine'
          ? (manifestInfo?.manifest?.sourceRevision ?? sourceRevision ?? 'artifact')
          : (sourceRevision ?? process.env.GITHUB_SHA ?? process.env.GITHUB_REF_NAME ?? 'artifact'),
      baseline,
      sourceBranch: process.env.GITHUB_REF_NAME ?? 'artifact',
      scope: `validate-built-site.mjs --mode ${resolvedMode} --profile ${profile}`,
      toolchain: detectToolchain(),
    });
  } catch (error) {
    throw new BuiltSiteValidationError([`capture: ${error.message}`]);
  }

  if (resolvedMode === 'historical') {
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
  } else {
    violations.push(...collectRoutineRouteViolations(contract, expectations));
    violations.push(...collectRoutineFeedViolations(contract, expectations));
    violations.push(...collectRoutineSitemapViolations(contract, expectations));
    violations.push(...collectRoutineOgViolations(contract, expectations));
    violations.push(...collectRoutineSearchViolations(contract, expectations));
    violations.push(...collectRoutineStaticViolations(resolvedDist, expectations));
  }

  violations.push(...collectOriginViolations(contract, expectedOrigin, expectations));
  violations.push(...collectOgViolations(resolvedDist, contract, expectedOrigin));

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
    mode: resolvedMode,
    siteUrl: expectedOrigin,
    baselinePath: resolvedBaselinePath,
    manifestPath: manifestInfo?.manifestPath,
    summary: `${contract.htmlRoutes.length} routes, ${Object.keys(contract.feeds).length} feeds, ${contract.sitemapUrls.length} sitemap URLs, ${contract.generatedOgPaths.length} generated OG files, ${contract.search.indexedPages} Pagefind pages`,
  };
}

const USAGE =
  'usage: node scripts/validate-built-site.mjs --dist <dir> --profile production|preview --site-url <origin> [--source <dir>] [--mode routine|historical] [--manifest .astro/site-build-manifest.json] [--baseline <baseline.json>] [--allowed <allowed.json>] [--cms-branch <branch>]';

function parseArguments(argv) {
  const options = {
    dist: 'dist',
    profile: 'production',
    siteUrl: undefined,
    source: REPO_ROOT,
    mode: undefined,
    manifest: undefined,
    baseline: undefined,
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
    else if (argument === '--mode') options.mode = take();
    else if (argument === '--manifest') options.manifest = take();
    else if (argument === '--baseline') options.baseline = take();
    else if (argument === '--allowed') options.allowed = take();
    else if (argument === '--cms-branch') options.cmsBranch = take();
    else throw new BuiltSiteValidationError([`unknown argument "${argument}"`]);
  }
  if (!options.siteUrl) throw new BuiltSiteValidationError(['missing required option --site-url']);

  const mode = options.mode ?? (options.baseline ? 'historical' : 'routine');
  if (!MODES.includes(mode)) {
    throw new BuiltSiteValidationError([`unknown mode "${mode}"; expected ${MODES.join('|')}`]);
  }
  if (mode === 'historical' && !options.baseline) {
    throw new BuiltSiteValidationError(['historical mode requires --baseline <baseline.json>']);
  }
  if (mode === 'routine' && options.baseline) {
    throw new BuiltSiteValidationError([
      'routine mode derives expectations from current source; do not pass --baseline',
    ]);
  }
  if (mode === 'routine' && options.allowed) {
    throw new BuiltSiteValidationError([
      'routine mode does not use --allowed; pass --mode historical for migration allowances',
    ]);
  }
  options.mode = mode;
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
      : {};
    const result = await validateBuiltSite({
      distDir: options.dist,
      profile: options.profile,
      mode: options.mode,
      siteUrl: options.siteUrl,
      sourceDir: options.source,
      manifestPath: options.manifest,
      baselinePath: options.baseline,
      allowedChanges,
      cmsBranch: options.cmsBranch,
    });
    console.log(
      `validate-built-site: PASS mode=${result.mode} profile=${result.profile} dist=${resolve(options.dist)} site=${result.siteUrl}`,
    );
    console.log(`  contract: ${result.summary}`);
    if (result.mode === 'routine') {
      console.log(`  source manifest: ${result.manifestPath ?? 'n/a'}`);
      console.log('  current-source expectations: OK');
    }
    console.log('  origin consistency: OK');
    console.log('  generated OG existence: OK');
    if (result.profile === 'preview') {
      console.log(
        '  preview: global noindex header OK, isolated CMS config OK, comments disabled OK',
      );
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
