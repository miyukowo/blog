#!/usr/bin/env node
/**
 * Site compatibility contract: deterministic capture and assertion.
 *
 * The measured reference lives in
 * `docs/research/2026-11-02-dsh-preflight-baseline.json`. This module turns a
 * production-shaped `dist/` build plus the content source tree into the same
 * schemaVersion 1 shape so migrations can be checked mechanically.
 *
 * ## Capture (`captureSite`)
 *
 * `captureSite({ distDir, sourceDir, sourceRevision, baseline, sourceBranch, scope, toolchain })`
 * returns a `SiteContract` with the same fields as the checked-in baseline:
 *
 * - `sourceContent`: `{ path, sha256, bodySha256 }` for the protected content
 *   paths recorded in `baseline.sourceContent` (the protected list is taken
 *   from the baseline, never from Git state). Any additional `.md`/`.mdx`/
 *   `.json`/`.yaml` file discovered under `<sourceDir>/src/content` is also
 *   captured so omissions/additions can be classified explicitly. File
 *   `sha256` hashes the exact UTF-8 bytes. `bodySha256` hashes everything
 *   after the closing front-matter `---` delimiter (the delimiter itself and
 *   the newline that follows it are NOT part of the body). This reproduces
 *   the recorded baseline values exactly.
 * - `htmlRoutes`: Astro page routes only. `index.html` resolves to its public
 *   directory path (`/about/`, `/`) and `404.html` keeps `/404.html`. HTML
 *   copied verbatim from `<sourceDir>/public/` (for example
 *   `public/cms/index.html`, the Sveltia admin shell) is a static asset, not
 *   an Astro route, and is excluded. Each route records `canonical`, `lang`,
 *   `robots`, `ogImage` and the `hreflangs` destination map, parsed with
 *   parse5 (never with HTML regexes).
 * - `feeds`: RSS output discovered as `rss.xml` files, keyed by public path
 *   (`/rss.xml`, `/vi/rss.xml`), with `language` and ordered `items` link
 *   URLs, parsed namespace-aware with fast-xml-parser.
 * - `sitemapUrls`: every `<loc>` reachable from the root sitemap index or
 *   urlset files, namespace-aware. Path percent-encoding is decoded
 *   deliberately (`decodeURI`) so sitemap and HTML route identities compare
 *   directly.
 * - `generatedOgPaths`: generated PNGs under `dist/og/`.
 * - `search`: deterministic Pagefind evidence from
 *   `dist/_pagefind/pagefind-entry.json` (`indexedPages` summed across
 *   languages, sorted `languages`, `engine` version string).
 * - `recordedDate`, `sourceBranch`, `sourceRevision`, `scope`, `toolchain`:
 *   provenance/evidence metadata. These are not compared byte-for-byte.
 *
 * ## Assertion (`assertSiteContract`)
 *
 * `assertSiteContract(actual, baseline, { allowedChanges })` throws a
 * `SiteContractError` listing every violation as
 * `field: expected ..., got ...` (for example
 * `htmlRoutes[/about/].canonical: expected "...", got "..."`). It rejects:
 * missing protected routes/content, changed canonical/lang/robots/OG values,
 * changed or lost reciprocal hreflang destinations, changed body hashes,
 * duplicate routes/URLs, added `/index` suffixes, renamed protected taxonomy
 * routes, extra/unclassified output, and missing or changed feed/search
 * evidence. Additions pass only when explicitly classified below.
 *
 * `allowedChanges` schema (all keys optional; unknown keys are rejected so a
 * typo cannot silently weaken the check):
 *
 * ```json
 * {
 *   "addedHtmlRoutes": ["/posts/new-post/", "/vi/posts/bai-moi/"],
 *   "addedSourceContent": ["src/content/posts/en/new-post/index.mdx"],
 *   "addedFeedItems": { "/rss.xml": ["https://example.com/posts/new-post/"] },
 *   "addedSitemapUrls": ["https://example.com/posts/new-post/"],
 *   "addedOgPaths": ["/og/new-post.png"],
 *   "searchIndexedPagesDelta": 2,
 *   "fieldChanges": [
 *     {
 *       "path": "/vi/rss.xml",
 *       "field": "language",
 *       "from": "en-us",
 *       "to": "vi-vn",
 *       "reason": "Known baseline defect: VI feed must report vi-vn."
 *     }
 *   ]
 * }
 * ```
 *
 * `fieldChanges` is the only way to accept a changed protected value and is
 * deliberately narrow: `path` must be a protected baseline route or feed,
 * `field` must be `canonical`, `lang`, `robots`, `ogImage`,
 * `hreflangs.<key>` (route) or `language` (feed), `from` must equal the
 * baseline value exactly, `to` must equal the actual value exactly, and a
 * non-empty `reason` is required. Unrelated changes still fail. The only
 * allowance used by the offline verification profile is the documented VI
 * RSS language correction plus the two pre-existing broken taxonomy
 * hreflang values that Task 2 intentionally repairs.
 *
 * Feed `items` are compared as an ordered protected sequence: baseline items
 * must remain in order; extra items must be listed under
 * `addedFeedItems[feedPath]`. `search.engine` is evidence only (a Pagefind
 * upgrade is not a public contract change) while `search.languages` and the
 * indexed page count are enforced.
 *
 * ## CLI
 *
 * ```
 * node scripts/site-contract.mjs capture \
 *   --dist <dist> --source <source> --baseline <baseline.json> \
 *   --source-revision <rev> [--source-branch <branch>] --output <out.json>
 *
 * node scripts/site-contract.mjs assert \
 *   --actual <actual.json> --baseline <baseline.json> [--allowed <allowedChanges.json>]
 * ```
 *
 * `capture` exits 0 after writing the contract; `assert` exits 0 when the
 * contract matches and 1 with the violation list on stderr otherwise.
 */
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { parse as parseHtmlDocument } from 'parse5';
import { XMLParser } from 'fast-xml-parser';

export const SCHEMA_VERSION = 1;

const CONTENT_FILE_PATTERN = /\.(?:md|mdx|json|ya?ml)$/i;
const FEED_FILE_NAME = 'rss.xml';
const INDEX_FILE_NAME = 'index.html';
const HTML_EXTENSION = '.html';
const OG_DIRECTORY = 'og';
const PAGEFIND_ENTRY = posix.join('_pagefind', 'pagefind-entry.json');

const ROUTE_FIELDS = ['canonical', 'lang', 'robots', 'ogImage'];
const IGNORED_EDITOR_ENTRIES = new Set(['.obsidian', '.idea', '.DS_Store', 'Thumbs.db']);

/** Raised when the build/source tree cannot be captured as a contract. */
export class SiteContractCaptureError extends Error {
  constructor(message) {
    super(`site-contract capture: ${message}`);
    this.name = 'SiteContractCaptureError';
  }
}

/** Raised when a captured contract violates the protected baseline. */
export class SiteContractError extends Error {
  constructor(violations) {
    const lines = violations.map((violation) => `  - ${violation}`).join('\n');
    super(`site contract violated (${violations.length} issue(s)):\n${lines}`);
    this.name = 'SiteContractError';
    this.violations = violations;
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function ensureArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function textOf(value) {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (isPlainObject(value)) {
    if (typeof value['#text'] === 'string') return value['#text'];
    if (typeof value['#text'] === 'number') return String(value['#text']);
  }
  return '';
}

function sortObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * List files below `root` as POSIX-style paths relative to `root`, sorted.
 * Sorting makes captures deterministic across filesystems.
 */
async function listFiles(root) {
  const files = [];
  async function visit(directory, prefix) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      if (IGNORED_EDITOR_ENTRIES.has(entry.name)) continue;
      const relativePath = prefix ? posix.join(prefix, entry.name) : entry.name;
      if (entry.isDirectory()) {
        await visit(join(directory, entry.name), relativePath);
      } else if (entry.isFile()) {
        files.push(relativePath);
      }
    }
  }
  await visit(root, '');
  return files;
}

function readFileForCapture(filePath, label) {
  return readFile(filePath, 'utf8').catch((error) => {
    throw new SiteContractCaptureError(`cannot read ${label}: ${error.message}`);
  });
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

/** Everything after the closing front-matter delimiter; see module header. */
function contentBody(text) {
  const match = text.match(/^---\r?\n[\s\S]*?\r?\n---/);
  return match ? text.slice(match[0].length) : text;
}

/** Public path for a built HTML file (404.html stays literal). */
function htmlPublicPath(relativePath) {
  if (relativePath === '404.html') return '/404.html';
  if (relativePath === INDEX_FILE_NAME) return '/';
  if (relativePath.endsWith(`/${INDEX_FILE_NAME}`)) {
    return `/${relativePath.slice(0, -INDEX_FILE_NAME.length)}`;
  }
  return `/${relativePath}`;
}

/** Normalize a public URL by percent-decoding its pathname (documented policy). */
function normalizePublicUrl(raw) {
  const value = textOf(raw).trim();
  if (!value) return '';
  try {
    const url = new URL(value);
    let pathname = url.pathname;
    try {
      pathname = decodeURI(pathname);
    } catch {
      // Keep the original path if it is not valid percent-encoding.
    }
    return `${url.origin}${pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function hasForbiddenIndexSuffix(publicPath) {
  return publicPath === '/index/' || publicPath.endsWith('/index/');
}

function findElementByName(root, nodeName) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    if (node?.nodeName === nodeName) return node;
    for (const child of node?.childNodes ?? []) stack.push(child);
  }
  return undefined;
}

function attributeValue(node, name) {
  return node?.attrs?.find((attribute) => attribute.name === name)?.value;
}

/** Extract contract metadata from a built HTML page using parse5. */
function extractPageMetadata(html) {
  const document = parseHtmlDocument(html);
  const htmlElement = findElementByName(document, 'html');
  const head = findElementByName(document, 'head');

  const metadata = {
    lang: attributeValue(htmlElement, 'lang') ?? '',
    canonical: '',
    robots: '',
    ogImage: '',
    hreflangs: {},
  };

  let canonicalSeen = false;
  let robotsSeen = false;
  let ogImageSeen = false;

  for (const node of head?.childNodes ?? []) {
    if (node.nodeName === 'link') {
      const rel = (attributeValue(node, 'rel') ?? '').toLowerCase().split(/\s+/);
      const href = attributeValue(node, 'href') ?? '';
      if (rel.includes('canonical') && !canonicalSeen) {
        metadata.canonical = normalizePublicUrl(href);
        canonicalSeen = true;
      }
      if (rel.includes('alternate') && href) {
        const hreflang = attributeValue(node, 'hreflang');
        if (hreflang) metadata.hreflangs[hreflang] = normalizePublicUrl(href);
      }
    } else if (node.nodeName === 'meta') {
      const name = (attributeValue(node, 'name') ?? '').toLowerCase();
      const property = (attributeValue(node, 'property') ?? '').toLowerCase();
      const content = attributeValue(node, 'content') ?? '';
      if (name === 'robots' && !robotsSeen) {
        metadata.robots = content;
        robotsSeen = true;
      }
      if (property === 'og:image' && !ogImageSeen) {
        metadata.ogImage = normalizePublicUrl(content);
        ogImageSeen = true;
      }
    }
  }

  metadata.hreflangs = sortObject(metadata.hreflangs);
  return metadata;
}

async function captureStaticPublicHtml(sourceDir) {
  const publicDir = join(sourceDir, 'public');
  if (!(await pathExists(publicDir))) return new Set();
  const files = await listFiles(publicDir);
  return new Set(files.filter((file) => file.endsWith(HTML_EXTENSION)));
}

async function captureHtmlRoutes({ distDir, sourceDir }) {
  const staticPublicHtml = await captureStaticPublicHtml(sourceDir);
  const files = (await listFiles(distDir)).filter((file) => file.endsWith(HTML_EXTENSION));
  const routes = [];

  for (const relativePath of files) {
    if (staticPublicHtml.has(relativePath)) continue;
    const html = await readFileForCapture(
      join(distDir, ...relativePath.split('/')),
      `dist/${relativePath}`,
    );
    routes.push({ path: htmlPublicPath(relativePath), ...extractPageMetadata(html) });
  }

  routes.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return routes;
}

function xmlParser() {
  return new XMLParser({
    ignoreAttributes: false,
    removeNSPrefix: true,
    parseTagValue: false,
    trimValues: true,
  });
}

async function captureFeeds(distDir) {
  const files = (await listFiles(distDir)).filter(
    (file) => posix.basename(file) === FEED_FILE_NAME,
  );
  const feeds = {};

  for (const relativePath of files) {
    const publicPath = relativePath === FEED_FILE_NAME ? '/rss.xml' : `/${relativePath}`;
    const xml = await readFileForCapture(
      join(distDir, ...relativePath.split('/')),
      `dist/${relativePath}`,
    );
    const document = xmlParser().parse(xml);
    const channel = document?.rss?.channel;
    if (!isPlainObject(channel)) {
      throw new SiteContractCaptureError(`dist/${relativePath} has no RSS <channel>`);
    }
    const items = ensureArray(channel.item)
      .map((item) => normalizePublicUrl(item?.link))
      .filter((link) => link.length > 0);
    feeds[publicPath] = { language: textOf(channel.language), items };
  }

  return sortObject(feeds);
}

function sitemapFileNameFromLoc(loc) {
  const value = textOf(loc).trim();
  if (!value) return '';
  try {
    return posix.basename(decodeURI(new URL(value).pathname));
  } catch {
    return posix.basename(value);
  }
}

async function captureSitemapUrls(distDir) {
  const rootEntries = await readdir(distDir);
  const rootSitemaps = rootEntries
    .filter((name) => /^sitemap.*\.xml$/i.test(name))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  if (rootSitemaps.length === 0) {
    throw new SiteContractCaptureError('missing sitemap output (no sitemap*.xml in dist root)');
  }

  const parser = xmlParser();
  const urls = [];

  const collectUrlset = async (fileName) => {
    const xml = await readFileForCapture(join(distDir, fileName), `dist/${fileName}`);
    const document = parser.parse(xml);
    const urlset = document?.urlset;
    if (!isPlainObject(urlset)) {
      throw new SiteContractCaptureError(`dist/${fileName} is not a sitemap <urlset>`);
    }
    for (const entry of ensureArray(urlset.url)) {
      const loc = normalizePublicUrl(entry?.loc);
      if (!loc)
        throw new SiteContractCaptureError(`dist/${fileName} has a sitemap <url> without <loc>`);
      urls.push(loc);
    }
  };

  const indexName = rootSitemaps.find((name) => /^sitemap-index.*\.xml$/i.test(name));
  if (indexName) {
    const xml = await readFileForCapture(join(distDir, indexName), `dist/${indexName}`);
    const document = parser.parse(xml);
    const index = document?.sitemapindex;
    if (!isPlainObject(index)) {
      throw new SiteContractCaptureError(`dist/${indexName} is not a sitemap <sitemapindex>`);
    }
    for (const entry of ensureArray(index.sitemap)) {
      const childName = sitemapFileNameFromLoc(entry?.loc);
      if (!childName || !rootSitemaps.includes(childName)) {
        throw new SiteContractCaptureError(
          `sitemap index references a non-local sitemap: ${textOf(entry?.loc)}`,
        );
      }
      await collectUrlset(childName);
    }
  } else {
    for (const fileName of rootSitemaps.filter((name) => !/index/i.test(name))) {
      await collectUrlset(fileName);
    }
  }

  return urls;
}

async function captureGeneratedOgPaths(distDir) {
  const ogDir = join(distDir, OG_DIRECTORY);
  if (!(await pathExists(ogDir))) return [];
  const files = await listFiles(ogDir);
  return files
    .filter((file) => file.toLowerCase().endsWith('.png'))
    .map((file) => `/${OG_DIRECTORY}/${file}`)
    .sort();
}

async function captureSearch(distDir) {
  const entryPath = join(distDir, ...PAGEFIND_ENTRY.split('/'));
  if (!(await pathExists(entryPath))) {
    throw new SiteContractCaptureError(`missing Pagefind evidence at dist/${PAGEFIND_ENTRY}`);
  }
  const raw = await readFileForCapture(entryPath, `dist/${PAGEFIND_ENTRY}`);
  let entry;
  try {
    entry = JSON.parse(raw);
  } catch (error) {
    throw new SiteContractCaptureError(`invalid Pagefind evidence: ${error.message}`);
  }
  const languages = isPlainObject(entry.languages) ? entry.languages : {};
  const languageNames = Object.keys(languages).sort();
  const indexedPages = languageNames.reduce(
    (total, language) => total + (Number(languages[language]?.page_count) || 0),
    0,
  );
  return {
    indexedPages,
    languages: languageNames,
    engine: `Pagefind ${textOf(entry.version) || 'unknown'}`,
  };
}

async function captureSourceContent({ sourceDir, baseline }) {
  const protectedPaths = Array.isArray(baseline?.sourceContent)
    ? baseline.sourceContent
        .map((entry) => entry?.path)
        .filter((path) => typeof path === 'string' && path.length > 0)
    : [];

  const discoveredPaths = [];
  const contentDir = join(sourceDir, 'src', 'content');
  if (await pathExists(contentDir)) {
    for (const relativePath of await listFiles(contentDir)) {
      if (CONTENT_FILE_PATTERN.test(relativePath)) {
        discoveredPaths.push(posix.join('src/content', relativePath));
      }
    }
  }

  const paths = [...new Set([...protectedPaths, ...discoveredPaths])].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

  const entries = [];
  for (const relativePath of paths) {
    const absolutePath = join(sourceDir, ...relativePath.split('/'));
    if (!(await pathExists(absolutePath))) continue;
    const buffer = await readFile(absolutePath);
    const text = buffer.toString('utf8');
    entries.push({
      path: relativePath,
      sha256: sha256(buffer),
      bodySha256: sha256(Buffer.from(contentBody(text), 'utf8')),
    });
  }
  return entries;
}

/**
 * Capture the compatibility contract from a built site and its source tree.
 * See the module header for the returned schema.
 */
export async function captureSite({
  distDir,
  sourceDir,
  sourceRevision,
  baseline,
  sourceBranch,
  scope,
  toolchain,
} = {}) {
  if (typeof distDir !== 'string' || distDir.length === 0) {
    throw new SiteContractCaptureError('distDir is required');
  }
  if (typeof sourceDir !== 'string' || sourceDir.length === 0) {
    throw new SiteContractCaptureError('sourceDir is required');
  }
  if (baseline !== undefined && !isPlainObject(baseline)) {
    throw new SiteContractCaptureError('baseline must be a parsed baseline object when provided');
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    recordedDate: new Date().toISOString().slice(0, 10),
    sourceBranch: sourceBranch ?? baseline?.sourceBranch ?? 'unknown',
    sourceRevision: sourceRevision ?? baseline?.sourceRevision ?? 'unknown',
    scope: scope ?? 'Compatibility contract capture (schemaVersion 1).',
    toolchain: { node: process.versions.node, ...(isPlainObject(toolchain) ? toolchain : {}) },
    sourceContent: await captureSourceContent({ sourceDir, baseline }),
    htmlRoutes: await captureHtmlRoutes({ distDir, sourceDir }),
    feeds: await captureFeeds(distDir),
    sitemapUrls: await captureSitemapUrls(distDir),
    generatedOgPaths: await captureGeneratedOgPaths(distDir),
    search: await captureSearch(distDir),
  };
}

function toStringSet(value, label) {
  if (value === undefined) return new Set();
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
    throw new Error(`allowedChanges.${label} must be an array of strings`);
  }
  return new Set(value);
}

function normalizeAllowedChanges(rawAllowedChanges) {
  if (rawAllowedChanges === undefined || rawAllowedChanges === null) {
    rawAllowedChanges = {};
  }
  if (!isPlainObject(rawAllowedChanges)) {
    throw new Error('allowedChanges must be an object');
  }

  const supportedKeys = new Set([
    'addedHtmlRoutes',
    'addedSourceContent',
    'addedFeedItems',
    'addedSitemapUrls',
    'addedOgPaths',
    'searchIndexedPagesDelta',
    'fieldChanges',
  ]);
  for (const key of Object.keys(rawAllowedChanges)) {
    if (!supportedKeys.has(key)) {
      throw new Error(`allowedChanges.${key} is not a supported classification`);
    }
  }

  const addedFeedItems = new Map();
  if (rawAllowedChanges.addedFeedItems !== undefined) {
    if (!isPlainObject(rawAllowedChanges.addedFeedItems)) {
      throw new Error('allowedChanges.addedFeedItems must be an object of feedPath -> string[]');
    }
    for (const [feedPath, items] of Object.entries(rawAllowedChanges.addedFeedItems)) {
      addedFeedItems.set(feedPath, toStringSet(items, `addedFeedItems["${feedPath}"]`));
    }
  }

  const searchIndexedPagesDelta = rawAllowedChanges.searchIndexedPagesDelta ?? 0;
  if (!Number.isInteger(searchIndexedPagesDelta)) {
    throw new Error('allowedChanges.searchIndexedPagesDelta must be an integer');
  }

  const fieldChanges = rawAllowedChanges.fieldChanges ?? [];
  if (!Array.isArray(fieldChanges)) {
    throw new Error('allowedChanges.fieldChanges must be an array');
  }

  return {
    addedHtmlRoutes: toStringSet(rawAllowedChanges.addedHtmlRoutes, 'addedHtmlRoutes'),
    addedSourceContent: toStringSet(rawAllowedChanges.addedSourceContent, 'addedSourceContent'),
    addedFeedItems,
    addedSitemapUrls: toStringSet(rawAllowedChanges.addedSitemapUrls, 'addedSitemapUrls'),
    addedOgPaths: toStringSet(rawAllowedChanges.addedOgPaths, 'addedOgPaths'),
    searchIndexedPagesDelta,
    fieldChanges,
  };
}

function routeFieldValue(route, field) {
  if (field.startsWith('hreflangs.')) {
    return route?.hreflangs?.[field.slice('hreflangs.'.length)];
  }
  return route?.[field];
}

function validateAllowedFieldChanges(allowedChanges, baseline) {
  const baselineRoutes = new Map(
    (Array.isArray(baseline.htmlRoutes) ? baseline.htmlRoutes : []).map((route) => [
      route.path,
      route,
    ]),
  );
  const baselineFeeds = isPlainObject(baseline.feeds) ? baseline.feeds : {};

  return allowedChanges.fieldChanges.map((change, index) => {
    const label = `allowedChanges.fieldChanges[${index}]`;
    if (!isPlainObject(change)) throw new Error(`${label} must be an object`);
    for (const key of ['path', 'field', 'from', 'to', 'reason']) {
      if (typeof change[key] !== 'string' || change[key].length === 0) {
        throw new Error(`${label}.${key} must be a non-empty string`);
      }
    }

    const route = baselineRoutes.get(change.path);
    const feed = baselineFeeds[change.path];

    if (route) {
      const validRouteField =
        ROUTE_FIELDS.includes(change.field) ||
        (change.field.startsWith('hreflangs.') &&
          isPlainObject(route.hreflangs) &&
          Object.hasOwn(route.hreflangs, change.field.slice('hreflangs.'.length)));
      if (!validRouteField) {
        throw new Error(`${label}: unsupported route field "${change.field}" for ${change.path}`);
      }
    } else if (feed) {
      if (change.field !== 'language') {
        throw new Error(`${label}: unsupported feed field "${change.field}" for ${change.path}`);
      }
    } else {
      throw new Error(
        `${label}: "${change.path}" is not a protected baseline route or feed; only protected fields can be reclassified`,
      );
    }

    const baselineValue = route ? routeFieldValue(route, change.field) : feed.language;
    if (baselineValue !== change.from) {
      throw new Error(
        `${label}: from "${change.from}" does not match the baseline value "${baselineValue}" for ${change.path}.${change.field}`,
      );
    }
    return change;
  });
}

function findMatchingFieldChange(fieldChanges, path, field, from, to) {
  return fieldChanges.find(
    (change) =>
      change.path === path && change.field === field && change.from === from && change.to === to,
  );
}

function countDuplicates(values) {
  const seen = new Set();
  const duplicates = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    else seen.add(value);
  }
  return [...duplicates].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function compareHtmlRoutes({ violations, fieldChanges, allowedChanges, baseline, actual }) {
  const baselineRoutes = Array.isArray(baseline.htmlRoutes) ? baseline.htmlRoutes : [];
  const actualRoutes = Array.isArray(actual.htmlRoutes) ? actual.htmlRoutes : [];

  const actualByPath = new Map();
  for (const route of actualRoutes) {
    if (!isPlainObject(route) || typeof route.path !== 'string') {
      violations.push('htmlRoutes: entry without a string path');
      continue;
    }
    if (actualByPath.has(route.path)) continue;
    actualByPath.set(route.path, route);
  }
  for (const duplicatePath of countDuplicates(
    actualRoutes.map((route) => route?.path).filter((path) => typeof path === 'string'),
  )) {
    violations.push(`htmlRoutes[${duplicatePath}]: duplicate route path`);
  }

  const baselinePaths = new Set(baselineRoutes.map((route) => route.path));

  for (const expected of baselineRoutes) {
    const path = expected.path;
    const actualRoute = actualByPath.get(path);
    if (!actualRoute) {
      violations.push(`htmlRoutes[${path}]: missing protected route`);
      continue;
    }

    for (const field of ROUTE_FIELDS) {
      const expectedValue = expected[field] ?? '';
      const actualValue = actualRoute[field] ?? '';
      if (expectedValue === actualValue) continue;
      if (findMatchingFieldChange(fieldChanges, path, field, expectedValue, actualValue)) continue;
      violations.push(
        `htmlRoutes[${path}].${field}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
      );
    }

    const expectedHreflangs = isPlainObject(expected.hreflangs) ? expected.hreflangs : {};
    const actualHreflangs = isPlainObject(actualRoute.hreflangs) ? actualRoute.hreflangs : {};
    const hreflangKeys = [
      ...new Set([...Object.keys(expectedHreflangs), ...Object.keys(actualHreflangs)]),
    ].sort();

    for (const key of hreflangKeys) {
      const field = `hreflangs.${key}`;
      const expectedValue = expectedHreflangs[key];
      const actualValue = actualHreflangs[key];
      if (expectedValue === undefined) {
        violations.push(
          `htmlRoutes[${path}].${field}: added hreflang destination is not covered by allowedChanges.fieldChanges`,
        );
        continue;
      }
      if (actualValue === undefined) {
        violations.push(
          `htmlRoutes[${path}].${field}: missing protected hreflang destination (expected ${JSON.stringify(expectedValue)})`,
        );
        continue;
      }
      if (expectedValue === actualValue) continue;
      if (findMatchingFieldChange(fieldChanges, path, field, expectedValue, actualValue)) continue;
      violations.push(
        `htmlRoutes[${path}].${field}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
      );
    }
  }

  for (const route of actualRoutes) {
    if (!isPlainObject(route) || typeof route.path !== 'string') continue;
    const path = route.path;
    if (baselinePaths.has(path)) continue;
    if (hasForbiddenIndexSuffix(path)) {
      violations.push(`htmlRoutes[${path}]: added route has a forbidden /index suffix`);
      continue;
    }
    if (allowedChanges.addedHtmlRoutes.has(path)) continue;
    violations.push(
      `htmlRoutes[${path}]: added route is not classified in allowedChanges.addedHtmlRoutes`,
    );
  }
}

function compareSourceContent({ violations, allowedChanges, baseline, actual }) {
  const baselineEntries = Array.isArray(baseline.sourceContent) ? baseline.sourceContent : [];
  const actualEntries = Array.isArray(actual.sourceContent) ? actual.sourceContent : [];

  const actualByPath = new Map();
  for (const entry of actualEntries) {
    if (!isPlainObject(entry) || typeof entry.path !== 'string') {
      violations.push('sourceContent: entry without a string path');
      continue;
    }
    if (!actualByPath.has(entry.path)) actualByPath.set(entry.path, entry);
  }
  for (const duplicatePath of countDuplicates(
    actualEntries.map((entry) => entry?.path).filter((path) => typeof path === 'string'),
  )) {
    violations.push(`sourceContent[${duplicatePath}]: duplicate content entry`);
  }

  const baselinePaths = new Set(baselineEntries.map((entry) => entry.path));

  for (const expected of baselineEntries) {
    const path = expected.path;
    const actualEntry = actualByPath.get(path);
    if (!actualEntry) {
      violations.push(`sourceContent[${path}]: missing protected source file`);
      continue;
    }
    for (const field of ['sha256', 'bodySha256']) {
      const expectedValue = expected[field] ?? '';
      const actualValue = actualEntry[field] ?? '';
      if (expectedValue === actualValue) continue;
      violations.push(
        `sourceContent[${path}].${field}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`,
      );
    }
  }

  for (const entry of actualEntries) {
    if (!isPlainObject(entry) || typeof entry.path !== 'string') continue;
    if (baselinePaths.has(entry.path)) continue;
    if (allowedChanges.addedSourceContent.has(entry.path)) continue;
    violations.push(
      `sourceContent[${entry.path}]: added source file is not classified in allowedChanges.addedSourceContent`,
    );
  }
}

function compareFeeds({ violations, fieldChanges, allowedChanges, baseline, actual }) {
  const baselineFeeds = isPlainObject(baseline.feeds) ? baseline.feeds : {};
  const actualFeeds = isPlainObject(actual.feeds) ? actual.feeds : {};

  for (const feedPath of Object.keys(baselineFeeds).sort()) {
    const expected = baselineFeeds[feedPath];
    const actualFeed = actualFeeds[feedPath];
    if (!isPlainObject(actualFeed)) {
      violations.push(`feeds[${feedPath}]: missing protected feed`);
      continue;
    }

    const expectedLanguage = expected.language ?? '';
    const actualLanguage = actualFeed.language ?? '';
    if (expectedLanguage !== actualLanguage) {
      if (
        !findMatchingFieldChange(
          fieldChanges,
          feedPath,
          'language',
          expectedLanguage,
          actualLanguage,
        )
      ) {
        violations.push(
          `feeds[${feedPath}].language: expected ${JSON.stringify(expectedLanguage)}, got ${JSON.stringify(actualLanguage)}`,
        );
      }
    }

    const expectedItems = Array.isArray(expected.items) ? expected.items : [];
    const actualItems = Array.isArray(actualFeed.items) ? actualFeed.items : [];
    const classifiedAdditions = allowedChanges.addedFeedItems.get(feedPath) ?? new Set();
    const remainingItems = actualItems.filter((item) => !classifiedAdditions.has(item));

    const missingItems = expectedItems.filter((item) => !remainingItems.includes(item));
    const unexpectedItems = remainingItems.filter((item) => !expectedItems.includes(item));

    for (const item of missingItems) {
      violations.push(`feeds[${feedPath}].items: missing protected feed item ${item}`);
    }
    for (const item of unexpectedItems) {
      violations.push(
        `feeds[${feedPath}].items: added feed item ${item} is not classified in allowedChanges.addedFeedItems["${feedPath}"]`,
      );
    }
    for (const item of countDuplicates(
      actualItems.filter((item) => !classifiedAdditions.has(item)),
    )) {
      violations.push(`feeds[${feedPath}].items: duplicate feed item ${item}`);
    }

    if (missingItems.length === 0 && unexpectedItems.length === 0) {
      for (let index = 0; index < expectedItems.length; index += 1) {
        if (remainingItems[index] === expectedItems[index]) continue;
        violations.push(
          `feeds[${feedPath}].items: protected feed item order changed (expected ${expectedItems[index]} at index ${index}, got ${remainingItems[index]})`,
        );
        break;
      }
    }
  }

  for (const feedPath of Object.keys(actualFeeds).sort()) {
    if (Object.hasOwn(baselineFeeds, feedPath)) continue;
    violations.push(
      `feeds[${feedPath}]: added feed is not classified (baseline feeds are protected)`,
    );
  }
}

function compareSitemapUrls({ violations, allowedChanges, baseline, actual }) {
  const expectedUrls = Array.isArray(baseline.sitemapUrls) ? baseline.sitemapUrls : [];
  const actualUrls = Array.isArray(actual.sitemapUrls) ? actual.sitemapUrls : [];

  for (const duplicateUrl of countDuplicates(actualUrls)) {
    violations.push(`sitemapUrls: duplicate URL ${duplicateUrl}`);
  }

  const expectedSet = new Set(expectedUrls);
  const actualSet = new Set(actualUrls);

  for (const url of expectedUrls) {
    if (!actualSet.has(url)) violations.push(`sitemapUrls: missing protected URL ${url}`);
  }
  for (const url of actualUrls) {
    if (expectedSet.has(url)) continue;
    if (hasForbiddenIndexSuffix(url)) {
      violations.push(`sitemapUrls: added URL ${url} has a forbidden /index suffix`);
      continue;
    }
    if (allowedChanges.addedSitemapUrls.has(url)) continue;
    violations.push(
      `sitemapUrls: added URL ${url} is not classified in allowedChanges.addedSitemapUrls`,
    );
  }
}

function compareGeneratedOgPaths({ violations, allowedChanges, baseline, actual }) {
  const expectedPaths = Array.isArray(baseline.generatedOgPaths) ? baseline.generatedOgPaths : [];
  const actualPaths = Array.isArray(actual.generatedOgPaths) ? actual.generatedOgPaths : [];

  for (const duplicatePath of countDuplicates(actualPaths)) {
    violations.push(`generatedOgPaths: duplicate path ${duplicatePath}`);
  }

  const expectedSet = new Set(expectedPaths);
  const actualSet = new Set(actualPaths);

  for (const path of expectedPaths) {
    if (!actualSet.has(path)) violations.push(`generatedOgPaths: missing protected path ${path}`);
  }
  for (const path of actualPaths) {
    if (expectedSet.has(path)) continue;
    if (allowedChanges.addedOgPaths.has(path)) continue;
    violations.push(
      `generatedOgPaths: added path ${path} is not classified in allowedChanges.addedOgPaths`,
    );
  }
}

function compareSearch({ violations, allowedChanges, baseline, actual }) {
  const expected = isPlainObject(baseline.search) ? baseline.search : {};
  const actualSearch = isPlainObject(actual.search) ? actual.search : null;
  if (!actualSearch) {
    violations.push('search: missing search evidence (Pagefind output)');
    return;
  }

  const expectedLanguages = Array.isArray(expected.languages) ? expected.languages : [];
  const actualLanguages = Array.isArray(actualSearch.languages) ? actualSearch.languages : [];
  if (JSON.stringify(expectedLanguages) !== JSON.stringify(actualLanguages)) {
    violations.push(
      `search.languages: expected ${JSON.stringify(expectedLanguages)}, got ${JSON.stringify(actualLanguages)}`,
    );
  }

  const expectedPages = Number(expected.indexedPages) + allowedChanges.searchIndexedPagesDelta;
  if (Number(actualSearch.indexedPages) !== expectedPages) {
    const delta = allowedChanges.searchIndexedPagesDelta;
    const deltaLabel = delta === 0 ? 'no allowed delta' : `allowed delta ${delta}`;
    violations.push(
      `search.indexedPages: expected ${expectedPages} (baseline ${Number(expected.indexedPages)}, ${deltaLabel}), got ${actualSearch.indexedPages}`,
    );
  }
  // `search.engine` is toolchain evidence, not a public contract field: a
  // Pagefind upgrade must not fail the protected-route comparison.
}

/**
 * Assert a captured contract against the protected baseline.
 *
 * Throws `SiteContractError` (with `.violations`) naming the affected public
 * path and field for every mismatch. See the module header for the
 * `allowedChanges` schema.
 */
export function assertSiteContract(actual, baseline, { allowedChanges } = {}) {
  if (!isPlainObject(baseline)) {
    throw new TypeError('assertSiteContract: baseline must be an object');
  }
  if (!isPlainObject(actual)) {
    throw new TypeError('assertSiteContract: actual must be a captured contract object');
  }

  const normalizedAllowedChanges = normalizeAllowedChanges(allowedChanges);
  const fieldChanges = validateAllowedFieldChanges(normalizedAllowedChanges, baseline);
  const context = {
    violations: [],
    fieldChanges,
    allowedChanges: normalizedAllowedChanges,
    baseline,
    actual,
  };

  if (actual.schemaVersion !== baseline.schemaVersion) {
    context.violations.push(
      `schemaVersion: expected ${JSON.stringify(baseline.schemaVersion)}, got ${JSON.stringify(actual.schemaVersion)}`,
    );
  }

  compareHtmlRoutes(context);
  compareSourceContent(context);
  compareFeeds(context);
  compareSitemapUrls(context);
  compareGeneratedOgPaths(context);
  compareSearch(context);

  if (context.violations.length > 0) {
    throw new SiteContractError(context.violations);
  }
}

function parseCliArguments(args, options) {
  const { values } = parseArgs({
    args,
    options,
    strict: true,
    allowPositionals: false,
  });
  return values;
}

const CLI_OPTIONS = {
  dist: { type: 'string' },
  source: { type: 'string' },
  baseline: { type: 'string' },
  'source-revision': { type: 'string' },
  'source-branch': { type: 'string' },
  output: { type: 'string' },
  actual: { type: 'string' },
  allowed: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
};

const USAGE = `usage:
  node scripts/site-contract.mjs capture --dist <dist> --source <source> \\
    --baseline <baseline.json> --source-revision <rev> [--source-branch <branch>] --output <out.json>
  node scripts/site-contract.mjs assert --actual <actual.json> --baseline <baseline.json> [--allowed <allowedChanges.json>]`;

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    throw new Error(`cannot read ${label} JSON at ${path}: ${error.message}`, { cause: error });
  }
}

async function runCaptureCommand(values) {
  if (!values.dist || !values.source || !values.output) {
    throw new Error(`capture requires --dist, --source and --output\n${USAGE}`);
  }
  const baseline = values.baseline ? await readJson(values.baseline, 'baseline') : undefined;
  const contract = await captureSite({
    distDir: resolve(values.dist),
    sourceDir: resolve(values.source),
    sourceRevision: values['source-revision'],
    sourceBranch: values['source-branch'],
    baseline,
  });
  const outputPath = resolve(values.output);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(contract, null, 2)}\n`);
  console.log(
    `captured site contract -> ${outputPath} (${contract.htmlRoutes.length} routes, ${Object.keys(contract.feeds).length} feeds, ${contract.sitemapUrls.length} sitemap URLs, ${contract.generatedOgPaths.length} OG paths, ${contract.search.indexedPages} Pagefind pages)`,
  );
}

async function runAssertCommand(values) {
  if (!values.actual || !values.baseline) {
    throw new Error(`assert requires --actual and --baseline\n${USAGE}`);
  }
  const actual = await readJson(values.actual, 'actual');
  const baseline = await readJson(values.baseline, 'baseline');
  const allowedChanges = values.allowed
    ? await readJson(values.allowed, 'allowedChanges')
    : undefined;
  assertSiteContract(actual, baseline, { allowedChanges });
  console.log(
    `site contract OK: ${actual.htmlRoutes?.length ?? 0} routes, ${Object.keys(actual.feeds ?? {}).length} feeds, ${actual.sitemapUrls?.length ?? 0} sitemap URLs, ${actual.generatedOgPaths?.length ?? 0} OG paths, ${actual.search?.indexedPages ?? 0} Pagefind pages`,
  );
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (!command || command === '--help' || command === '-h') {
    console.log(USAGE);
    return;
  }

  let values;
  try {
    values = parseCliArguments(rest, CLI_OPTIONS);
  } catch (error) {
    throw new Error(`${error.message}\n${USAGE}`, { cause: error });
  }
  if (values.help) {
    console.log(USAGE);
    return;
  }

  if (command === 'capture') return runCaptureCommand(values);
  if (command === 'assert') return runAssertCommand(values);
  throw new Error(`unknown command "${command}"\n${USAGE}`);
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (invokedDirectly) {
  main(process.argv.slice(2)).catch((error) => {
    if (error instanceof SiteContractError) {
      console.error(error.message);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  });
}
