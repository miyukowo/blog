#!/usr/bin/env node
/**
 * Generate an isolated CMS preview configuration in the BUILT output only.
 *
 * The tracked production CMS config (`public/cms/config.yml`) always points at
 * `main`. Astro copies it verbatim into `dist/cms/config.yml` during a build.
 * This script rewrites that generated copy, and only that copy, for a
 * short-lived validation branch:
 *
 *   dist/cms/config.yml  backend.branch: codex/cms-validation-<run>
 *   dist/cms/config.yml  site_url: <preview site URL>
 *
 * Fail-closed rules (all reject before anything is written):
 *
 * 1. `distDir` must exist, must not be the repository root, and must not be
 *    inside `public/` (writing there would contaminate the tracked config and
 *    the next production build).
 * 2. `<distDir>/cms/config.yml` must already exist (run the build first).
 * 3. The parsed built config must be the untouched production config:
 *    `backend.name: github`, `backend.repo: miyukowo/blog`,
 *    `backend.branch: main`. A config that is already preview-modified (or
 *    otherwise tampered with) is rejected rather than double-applied.
 * 4. `branch` must be an explicit non-production branch matching
 *    `codex/cms-validation-<run>`, where `<run>` is 1-64 characters of
 *    `A-Za-z0-9._-` and must not contain `..`. `main`, `staging`, empty and
 *    every other branch are rejected.
 * 5. `siteUrl` must be an absolute http(s) origin with no path, query, hash or
 *    embedded credentials.
 * 6. The generated YAML is re-parsed and compared with the expected result
 *    (only `backend.branch` and `site_url` differ) before the atomic rename.
 *
 * The tracked `public/cms/config.yml` is never modified, and a later production
 * build always recreates `dist/cms/config.yml` from it, so a preview write
 * cannot leak into production output.
 *
 * CLI:
 *   node scripts/prepare-preview.mjs \
 *     --dist dist \
 *     --branch codex/cms-validation-20261102-2315 \
 *     --site-url https://staging-blog.tvphus.dev
 *
 * Exit code 0 on success, 1 with a diagnostic on any rejection. No credentials
 * are written to the generated file.
 */
import { existsSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isMap, parseDocument } from 'yaml';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const PRODUCTION_BRANCH = 'main';
export const PRODUCTION_REPO = 'miyukowo/blog';
export const PREVIEW_BRANCH_PREFIX = 'codex/cms-validation-';

/** `<run>`: safe Git ref path component, 1-64 characters, no `..` traversal. */
const RUN_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** Keys that must never appear in a generated public config. */
const CREDENTIAL_KEY_PATTERN =
  /(?:^|[_-])(?:secret|token|password|passwd|private[_-]?key)(?:$|[_-])/i;

/**
 * Invalid preview request or unsafe built config. Thrown before any write.
 */
export class PreviewConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PreviewConfigError';
  }
}

function fail(message) {
  throw new PreviewConfigError(message);
}

/** Validate the requested preview branch and return its normalized name. */
export function validatePreviewBranch(branch) {
  if (typeof branch !== 'string' || branch.trim() === '') {
    fail('preview branch is required (expected codex/cms-validation-<run>)');
  }

  const value = branch.trim();

  if (value === 'main') {
    fail(`refusing to write preview config on the production branch '${value}'`);
  }

  if (value === 'staging') {
    fail(`refusing to write preview config on the staging deployment branch '${value}'`);
  }

  if (!value.startsWith(PREVIEW_BRANCH_PREFIX)) {
    fail(
      `preview branch must match ${PREVIEW_BRANCH_PREFIX}<run> (got '${value}'); production and implementation branches are not write targets`,
    );
  }

  const run = value.slice(PREVIEW_BRANCH_PREFIX.length);

  if (!RUN_PATTERN.test(run) || run.includes('..')) {
    fail(
      `invalid preview run id '${run}' in '${value}': use 1-64 characters of A-Za-z0-9._- without '..'`,
    );
  }

  return value;
}

/** Validate the preview site URL and return its normalized origin. */
export function validateSiteUrl(siteUrl) {
  if (typeof siteUrl !== 'string' || siteUrl.trim() === '') {
    fail('preview site URL is required (expected an absolute http(s) origin)');
  }

  let url;

  try {
    url = new URL(siteUrl.trim());
  } catch {
    fail(`invalid preview site URL '${siteUrl}'`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    fail(`preview site URL must use http or https (got '${url.protocol}')`);
  }

  if (url.username || url.password) {
    fail('preview site URL must not contain credentials');
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    fail(`preview site URL must be a bare origin without path, query or hash (got '${siteUrl}')`);
  }

  return url.origin;
}

/** Resolve and validate the built dist directory that may be rewritten. */
export function validateDistDir(distDir) {
  if (typeof distDir !== 'string' || distDir.trim() === '') {
    fail('dist directory is required (expected the built dist/ directory)');
  }

  const resolved = resolve(distDir);

  if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
    fail(`dist directory does not exist or is not a directory: ${resolved}`);
  }

  const publicDir = join(REPO_ROOT, 'public');

  if (resolved === REPO_ROOT) {
    fail(
      'refusing to write preview config into the repository root; pass the built dist/ directory',
    );
  }

  if (resolved === publicDir || resolved.startsWith(`${publicDir}${sep}`)) {
    fail(
      'refusing to write preview config inside public/; only built output is a preview write target',
    );
  }

  return resolved;
}

/** Reject any credential-looking key in the generated configuration. */
function assertNoCredentials(value, path = '') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoCredentials(item, `${path}[${index}]`));
    return;
  }

  if (!value || typeof value !== 'object') return;

  for (const [key, child] of Object.entries(value)) {
    const childPath = path ? `${path}.${key}` : key;

    if (key !== 'api_key' && CREDENTIAL_KEY_PATTERN.test(key)) {
      fail(`generated config contains a credential-looking key: ${childPath}`);
    }

    assertNoCredentials(child, childPath);
  }
}

/**
 * Rewrite the built preview CMS config for an isolated validation branch.
 *
 * @param {object} options
 * @param {string} options.distDir Built output directory (contains `cms/config.yml`).
 * @param {string} options.branch Preview branch, `codex/cms-validation-<run>`.
 * @param {string} options.siteUrl Preview site origin, e.g. `https://staging-blog.tvphus.dev`.
 * @returns {{ configPath: string, branch: string, siteUrl: string }}
 */
export function preparePreviewCms({ distDir, branch, siteUrl } = {}) {
  const previewBranch = validatePreviewBranch(branch);
  const previewSiteUrl = validateSiteUrl(siteUrl);
  const resolvedDistDir = validateDistDir(distDir);

  const configPath = join(resolvedDistDir, 'cms', 'config.yml');

  if (!existsSync(configPath)) {
    fail(
      `built preview config not found: ${configPath} (build the site first; Astro copies public/cms/config.yml into dist/cms/config.yml)`,
    );
  }

  const source = readFileSync(configPath, 'utf8');
  const doc = parseDocument(source);

  if (doc.errors.length > 0) {
    fail(`built config is not valid YAML: ${doc.errors[0].message}`);
  }

  const backend = doc.get('backend');

  if (!isMap(backend)) {
    fail('built config has no backend mapping; refusing to generate a preview config');
  }

  const backendName = backend.get('name');
  const backendRepo = backend.get('repo');
  const backendBranch = backend.get('branch');

  if (backendName !== 'github') {
    fail(`built config backend.name is '${String(backendName)}'; expected 'github'`);
  }

  if (backendRepo !== PRODUCTION_REPO) {
    fail(
      `built config backend.repo is '${String(backendRepo)}'; expected '${PRODUCTION_REPO}' (refusing to point preview at another repository)`,
    );
  }

  if (backendBranch !== PRODUCTION_BRANCH) {
    fail(
      `built config backend.branch is '${String(backendBranch)}'; expected '${PRODUCTION_BRANCH}' (a preview config was already generated; rebuild from public/cms/config.yml)`,
    );
  }

  const expected = parseDocument(source);
  expected.setIn(['backend', 'branch'], previewBranch);
  expected.set('site_url', previewSiteUrl);

  doc.setIn(['backend', 'branch'], previewBranch);
  doc.set('site_url', previewSiteUrl);

  const output = doc.toString({ lineWidth: 0 });

  // Re-parse and compare against the expected document; only the branch and
  // site URL may change.
  const generated = parseDocument(output);

  if (generated.errors.length > 0) {
    fail(`generated config is not valid YAML: ${generated.errors[0].message}`);
  }

  const expectedConfig = expected.toJS();
  const generatedConfig = generated.toJS();

  if (JSON.stringify(generatedConfig) !== JSON.stringify(expectedConfig)) {
    fail('generated config does not match the expected preview config; refusing to write');
  }

  if (generatedConfig.backend?.branch !== previewBranch) {
    fail('generated config backend branch was not set correctly; refusing to write');
  }

  if (generatedConfig.site_url !== previewSiteUrl) {
    fail('generated config site URL was not set correctly; refusing to write');
  }

  if (generatedConfig.backend?.branch === PRODUCTION_BRANCH) {
    fail('generated config still targets the production branch; refusing to write');
  }

  assertNoCredentials(generatedConfig);

  // Atomic write inside the built output only.
  const tempPath = `${configPath}.${process.pid}.tmp`;

  try {
    writeFileSync(tempPath, output, 'utf8');
    renameSync(tempPath, configPath);
  } finally {
    if (existsSync(tempPath)) {
      rmSync(tempPath, { force: true });
    }
  }

  return { configPath, branch: previewBranch, siteUrl: previewSiteUrl };
}

const USAGE =
  'usage: node scripts/prepare-preview.mjs --dist <dir> --branch codex/cms-validation-<run> --site-url <url>';

function parseArgs(argv) {
  const options = { dist: undefined, branch: undefined, siteUrl: undefined };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const equals = arg.indexOf('=');
    const name = equals === -1 ? arg : arg.slice(0, equals);
    const value = equals === -1 ? argv[index + 1] : arg.slice(equals + 1);

    const takeValue = () => {
      if (value === undefined || value.startsWith('--')) {
        fail(`missing value for ${name}`);
      }

      if (equals === -1) index += 1;
      return value;
    };

    switch (name) {
      case '--dist':
        options.dist = takeValue();
        break;
      case '--branch':
        options.branch = takeValue();
        break;
      case '--site-url':
        options.siteUrl = takeValue();
        break;
      case '--help':
      case '-h':
        return { help: true };
      default:
        fail(`unknown argument '${arg}'`);
    }
  }

  if (!options.dist) fail('missing required option --dist <dir>');
  if (!options.branch) fail('missing required option --branch codex/cms-validation-<run>');
  if (!options.siteUrl) fail('missing required option --site-url <url>');

  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));

    if (options.help) {
      console.log(USAGE);
      return;
    }

    const result = preparePreviewCms({
      distDir: options.dist,
      branch: options.branch,
      siteUrl: options.siteUrl,
    });

    console.log('prepare-preview: OK');
    console.log(`  wrote: ${result.configPath}`);
    console.log(`  backend.branch: ${result.branch}`);
    console.log(`  site_url: ${result.siteUrl}`);
    console.log('  tracked production config untouched: public/cms/config.yml');
  } catch (error) {
    if (error instanceof PreviewConfigError) {
      console.error(`prepare-preview: FAIL - ${error.message}`);
      console.error(USAGE);
      process.exitCode = 1;
      return;
    }

    console.error(
      `prepare-preview: FAIL - ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

const IS_MAIN =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (IS_MAIN) {
  main();
}
