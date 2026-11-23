/**
 * Task 6: CMS publishing configuration and isolated preview-write tests.
 *
 * These tests are deterministic and offline. They never write to the real
 * `public/`, `src/content/`, or `dist/`; generated entries and preview configs
 * live in OS temp directories only.
 *
 * The authenticated Sveltia + Cloudinary round-trip (sign in, create/edit a
 * translated draft, select/upload media, save, reload, delete on a
 * `codex/cms-validation-<run>` branch) requires external credentials and is
 * therefore NOT exercised here. See docs/maintenance/upstream.md for the
 * remaining manual gate.
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import vm from 'node:vm';

import { mdxToJs } from 'satteri';
import { parse, parseDocument, stringify } from 'yaml';

import { preparePreviewCms, PreviewConfigError } from '../../scripts/prepare-preview.mjs';
import { resolveMediaUrl } from '../../src/site/media.ts';

const execFileAsync = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CONFIG_PATH = join(REPO_ROOT, 'public', 'cms', 'config.yml');
const INDEX_PATH = join(REPO_ROOT, 'public', 'cms', 'index.html');
const PREVIEW_CLI = join(REPO_ROOT, 'scripts', 'prepare-preview.mjs');
const FIXTURE_DIR = join(HERE, 'fixtures', 'cms');
const CONTENT_SCHEMA_PATH = join(REPO_ROOT, 'src', 'content.config.ts');

const CONFIG_SOURCE = readFileSync(CONFIG_PATH, 'utf8');
const CONFIG = parse(CONFIG_SOURCE);
const BUNDLE = JSON.parse(readFileSync(join(FIXTURE_DIR, 'sveltia-bundle.json'), 'utf8'));
const MEDIA_CASES = JSON.parse(readFileSync(join(FIXTURE_DIR, 'media-url-cases.json'), 'utf8'));
const SAVED_ENTRY = JSON.parse(readFileSync(join(FIXTURE_DIR, 'saved-entry-fields.json'), 'utf8'));

const PREVIEW_BRANCH = 'codex/cms-validation-20261102-2315';
const PREVIEW_SITE_URL = 'https://staging-blog.tvphus.dev';
const CMS_PREVIEW_FAIL = /prepare-preview: FAIL/;

/** Locate a collection in the tracked production CMS config. */
function collectionByName(name) {
  const collection = CONFIG.collections.find((entry) => entry.name === name);
  assert.ok(collection, `CMS collection '${name}' must exist`);
  return collection;
}

/** Locate a field in a collection. */
function fieldByName(collectionName, fieldName) {
  const collection = collectionByName(collectionName);
  const field = collection.fields.find((entry) => entry.name === fieldName);
  assert.ok(field, `CMS field '${fieldName}' must exist in '${collectionName}'`);
  return field;
}

/** Every widget='image' field in the config (these can store media). */
function imageFields() {
  return CONFIG.collections.flatMap((collection) =>
    collection.fields
      .filter((field) => field.widget === 'image')
      .map((field) => ({ collection: collection.name, field })),
  );
}

/**
 * Resolve the on-disk path the CMS writes for an entry, using the tracked
 * collection options (`folder`, locale folder, `path` template, extension).
 */
function cmsEntryPath(collectionName, locale, slug) {
  const collection = collectionByName(collectionName);
  const folder = collection.folder.replace(/^\//, '');
  const path = collection.path.replace('{{fields.postSlug}}', slug).replace('{{slug}}', slug);
  return join(REPO_ROOT, folder, locale, `${path}.${collection.extension}`);
}

function readIndexHtml() {
  return readFileSync(INDEX_PATH, 'utf8');
}

/** Extract the inline Sveltia editor-component registration script. */
function inlineScripts() {
  return [...readIndexHtml().matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
    (match) => match[1],
  );
}

/** Run the inline CMS configuration script and capture registered components. */
function loadEditorComponents() {
  const scripts = inlineScripts();
  assert.equal(scripts.length, 1, 'exactly one inline CMS setup script is expected');

  const registered = [];
  const context = vm.createContext({
    CMS: { registerEditorComponent: (definition) => registered.push(definition) },
  });

  vm.runInContext(scripts[0], context);
  assert.equal(registered.length, 1, 'exactly one editor component is registered');
  return registered;
}

/** Parse YAML frontmatter out of a saved MDX file. */
function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source);
  assert.ok(match, 'saved entry must start with a YAML frontmatter block');
  return parse(match[1]);
}

/** Normalize a CMS date value to YYYY-MM-DD for reload comparisons. */
function dateString(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

/** Assert saved frontmatter satisfies the real Astro post schema expectations. */
function assertValidPostFrontmatter(frontmatter, expected) {
  assert.equal(typeof frontmatter.title, 'string');
  assert.ok(frontmatter.title.length >= 1 && frontmatter.title.length <= 140);
  assert.equal(typeof frontmatter.description, 'string');
  assert.ok(frontmatter.description.length >= 1 && frontmatter.description.length <= 280);
  assert.match(dateString(frontmatter.pubDate), /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(!Number.isNaN(new Date(frontmatter.pubDate).valueOf()));
  assert.match(dateString(frontmatter.updatedDate), /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof frontmatter.heroImage, 'string');
  assert.match(frontmatter.heroImage, /^https:\/\/res\.cloudinary\.com\/tvphus\/image\/upload\//);
  assert.equal(typeof frontmatter.heroImageAlt, 'string');
  assert.ok(Array.isArray(frontmatter.tags));
  assert.ok(Array.isArray(frontmatter.categories));
  assert.equal(typeof frontmatter.translationKey, 'string');
  assert.equal(typeof frontmatter.postSlug, 'string');
  assert.equal(frontmatter.postSlug, expected.postSlug);
  assert.equal(typeof frontmatter.toc, 'boolean');
  assert.equal(typeof frontmatter.pinned, 'boolean');
  assert.equal(typeof frontmatter.draft, 'boolean');
  assert.equal(typeof frontmatter.comments, 'boolean');
  assert.equal(typeof frontmatter.math, 'boolean');
  assert.equal(typeof frontmatter.unlisted, 'boolean');
}

/** Create a temp built-output tree with the tracked config copied into cms/. */
async function makeBuiltDist(t) {
  const dir = await mkdtemp(join(tmpdir(), 'cms-preview-test-'));
  await mkdir(join(dir, 'cms'), { recursive: true });
  await writeFile(join(dir, 'cms', 'config.yml'), CONFIG_SOURCE, 'utf8');
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

/** Read and parse the generated preview config from a temp dist tree. */
function readBuiltConfig(distDir) {
  return parse(readFileSync(join(distDir, 'cms', 'config.yml'), 'utf8'));
}

// ---------------------------------------------------------------------------
// Tracked production CMS configuration
// ---------------------------------------------------------------------------

test('tracked CMS config is valid YAML with no duplicate keys or structural errors', () => {
  const doc = parseDocument(CONFIG_SOURCE);
  assert.deepEqual(
    doc.errors.map((error) => error.message),
    [],
  );
  assert.deepEqual(
    doc.warnings.map((warning) => warning.message),
    [],
  );
  assert.equal(typeof CONFIG, 'object');
  assert.ok(Array.isArray(CONFIG.collections));
});

test('production backend keeps the existing repo and branch main', () => {
  assert.deepEqual(CONFIG.backend, {
    name: 'github',
    repo: 'miyukowo/blog',
    branch: 'main',
    skip_ci: false,
  });
});

test('automatic deployments stay enabled and no skip marker is configured', () => {
  assert.equal(CONFIG.backend.skip_ci, false);
  assert.equal(CONFIG.media_folder, 'blog');
  assert.equal(CONFIG.public_folder, 'blog');

  const skipMarker = /\[(?:skip[ _-]?ci|ci[ _-]?skip|no[ _-]?ci|skip[ _-]?cd)\]/i;
  assert.doesNotMatch(CONFIG_SOURCE, skipMarker, 'tracked config must not contain a skip marker');

  const commitMessages = CONFIG.backend.commit_messages ?? {};
  for (const [kind, template] of Object.entries(commitMessages)) {
    assert.doesNotMatch(String(template), skipMarker, `commit message '${kind}' must not skip CI`);
  }
});

test('global i18n keeps EN/VI locale folders with EN as default', () => {
  assert.deepEqual(CONFIG.i18n, {
    structure: 'multiple_folders',
    locales: ['en', 'vi'],
    default_locale: 'en',
  });
});

test('posts collection keeps <postSlug>/index.mdx under EN/VI folders', () => {
  const posts = collectionByName('posts');
  assert.equal(posts.folder, '/src/content/posts');
  assert.equal(posts.i18n, true);
  assert.equal(posts.extension, 'mdx');
  assert.equal(posts.format, 'frontmatter');
  assert.equal(posts.path, '{{fields.postSlug}}/index');
  assert.equal(posts.slug, '{{fields.postSlug}}');

  for (const locale of ['en', 'vi']) {
    for (const slug of ['getting-started', 'how-i-installed-arch-linux-on-my-laptop']) {
      const entryPath = cmsEntryPath('posts', locale, slug);
      assert.ok(
        existsSync(entryPath),
        `CMS path convention must match real content at ${relative(REPO_ROOT, entryPath)}`,
      );
    }
  }
});

test('pages collection keeps EN/VI locale folders used by real pages', () => {
  const pages = collectionByName('pages');
  assert.equal(pages.folder, '/src/content/pages');
  assert.equal(pages.i18n, true);
  assert.equal(pages.extension, 'md');
  assert.equal(pages.format, 'frontmatter');
  assert.equal(pages.path, undefined, 'locale folder is inserted by the i18n structure');

  for (const locale of ['en', 'vi']) {
    for (const slug of ['about', 'privacy']) {
      const pagePath = join(
        REPO_ROOT,
        'src',
        'content',
        'pages',
        locale,
        `${slug}.${pages.extension}`,
      );
      assert.ok(existsSync(pagePath), `real page exists at ${relative(REPO_ROOT, pagePath)}`);
    }
  }

  const translationKey = fieldByName('pages', 'translationKey');
  assert.equal(translationKey.widget, 'string');
});

test('required post fields and widgets stay compatible with the Astro content schema', () => {
  const expected = {
    title: 'string',
    description: 'text',
    postSlug: 'string',
    translationKey: 'string',
    pubDate: 'datetime',
    updatedDate: 'datetime',
    heroImage: 'image',
    heroImageAlt: 'string',
    tags: 'list',
    categories: 'list',
    toc: 'boolean',
    pinned: 'boolean',
    draft: 'boolean',
    comments: 'boolean',
    math: 'boolean',
    unlisted: 'boolean',
    body: 'markdown',
  };

  for (const [name, widget] of Object.entries(expected)) {
    assert.equal(fieldByName('posts', name).widget, widget, `widget for '${name}'`);
  }

  for (const name of ['title', 'description', 'postSlug', 'translationKey', 'pubDate']) {
    assert.notEqual(fieldByName('posts', name).required, false, `'${name}' must stay required`);
  }

  const schemaSource = readFileSync(CONTENT_SCHEMA_PATH, 'utf8');
  for (const name of Object.keys(expected)) {
    if (name === 'body') continue;
    assert.ok(
      schemaSource.includes(`${name}:`),
      `src/content.config.ts must still define frontmatter field '${name}'`,
    );
  }
});

test('date, draft, unlisted, pinned and translationKey fields keep valid options', () => {
  const pubDate = fieldByName('posts', 'pubDate');
  assert.equal(pubDate.date_format, 'YYYY-MM-DD');
  assert.equal(pubDate.time_format, false);

  const updatedDate = fieldByName('posts', 'updatedDate');
  assert.equal(updatedDate.date_format, 'YYYY-MM-DD');
  assert.equal(updatedDate.time_format, false);
  assert.equal(updatedDate.required, false);

  assert.equal(fieldByName('posts', 'draft').required, false);
  assert.equal(fieldByName('posts', 'unlisted').required, false);
  assert.equal(fieldByName('posts', 'pinned').required, false);
  assert.equal(fieldByName('posts', 'translationKey').i18n, true);
  assert.equal(fieldByName('posts', 'postSlug').i18n, 'duplicate');
});

// ---------------------------------------------------------------------------
// Cloudinary media output
// ---------------------------------------------------------------------------

test('global Cloudinary media config stores full URLs', () => {
  const cloudinary = CONFIG.media_libraries.cloudinary;
  assert.equal(cloudinary.output_filename_only, false);
  assert.equal(typeof cloudinary.use_transformations, 'boolean');
  assert.equal(cloudinary.config.cloud_name, 'tvphus');
  assert.equal(typeof cloudinary.config.api_key, 'string');
  assert.ok(Array.isArray(cloudinary.config.default_transformations));
  assert.equal(CONFIG.media_libraries.cloudinary.config.api_secret, undefined);
});

test('every image-bearing field restates the full-URL media option', () => {
  const imageEntries = imageFields();
  assert.ok(imageEntries.length >= 2, 'posts and pages each have a hero image field');

  for (const { collection, field } of imageEntries) {
    assert.ok(
      field.media_libraries && typeof field.media_libraries === 'object',
      `${collection}.${field.name} needs nested media_libraries`,
    );
    assert.equal(
      field.cloudinary,
      undefined,
      `${collection}.${field.name} must not have a stray top-level cloudinary key`,
    );
    assert.equal(
      field.media_libraries.cloudinary.output_filename_only,
      false,
      `${collection}.${field.name} must store full Cloudinary URLs`,
    );
  }
});

test('Cloudinary output maps to the site CDN render path (save -> render)', () => {
  for (const mediaCase of MEDIA_CASES.cases) {
    assert.equal(
      resolveMediaUrl(mediaCase.cmsUrl),
      mediaCase.expectedRenderUrl,
      `render path for '${mediaCase.name}'`,
    );
  }

  assert.ok(
    MEDIA_CASES.cases.some((mediaCase) => mediaCase.cmsUrl.includes('/image/upload/')),
    'fixture must cover full Cloudinary URLs',
  );
});

// ---------------------------------------------------------------------------
// Pinned Sveltia bundle and local config discovery
// ---------------------------------------------------------------------------

test('Sveltia bundle is pinned to the verified published version with SRI', () => {
  const html = readIndexHtml();
  const scriptTag = /<script\b[^>]*\bsrc="([^"]+)"[^>]*>/i.exec(html);
  assert.ok(scriptTag, 'CMS bundle script tag must have src');

  const source = scriptTag[1];
  const versionMatch = /@sveltia\/cms@(\d+\.\d+\.\d+)\/dist\/sveltia-cms\.js$/.exec(source);
  assert.ok(versionMatch, `bundle URL must be an exact @sveltia/cms version: ${source}`);
  assert.equal(versionMatch[1], BUNDLE.version, 'bundle version must match the recorded pin');
  assert.equal(source, BUNDLE.cdn);
  assert.doesNotMatch(source, /@latest|@next|@beta|@canary|\^|~|\*/);

  const tag = scriptTag[0];
  assert.ok(tag.includes(`integrity="${BUNDLE.integrity}"`), 'SRI integrity must be present');
  assert.ok(tag.includes('crossorigin="anonymous"'), 'SRI requires anonymous CORS');
  assert.doesNotMatch(tag, /type="module"/, 'the CDN build is a classic script');

  assert.ok(
    CONFIG_SOURCE.includes(`@sveltia/cms@${BUNDLE.version}/schema/sveltia-cms.json`),
    'config schema reference must be pinned to the same version',
  );
});

test('CMS admin page loads only its local config file', () => {
  const html = readIndexHtml();
  const links = [...html.matchAll(/<link\b[^>]*\brel="cms-config-url"[^>]*>/gi)];
  assert.equal(links.length, 1, 'exactly one cms-config-url link is expected');
  assert.match(links[0][0], /href="\.\/config\.yml"/);
  assert.match(links[0][0], /type="application\/yaml"/);
  assert.doesNotMatch(html, /href="(?:https?:)?\/\//i, 'no cross-origin config link');
  assert.doesNotMatch(html, /href="\/[^"]*config\.ya?ml"/i, 'no root-absolute config link');
});

// ---------------------------------------------------------------------------
// Alert editor component output
// ---------------------------------------------------------------------------

test('Alert editor output omits duplicate imports and compiles cleanly across multiple blocks', () => {
  const [alert] = loadEditorComponents();
  assert.equal(alert.id, 'alert');
  assert.equal(typeof alert.pattern?.test, 'function', 'pattern must be a RegExp');
  assert.equal(typeof alert.pattern.source, 'string');

  const values = {
    type: 'warning',
    style: 'outline',
    direction: 'vertical',
    icon: 'lucide:alert-triangle',
    title: 'Quote " and & and <tag>',
    body: 'Body with **bold** text.',
  };
  const block = alert.toBlock(values);
  const secondBlock = alert.toBlock({
    type: 'success',
    style: 'soft',
    direction: 'horizontal',
    icon: 'lucide:check-circle',
    title: 'Second alert',
    body: 'Second callout body.',
  });

  assert.doesNotMatch(block, /import\s+Alert\b/, 'toBlock must not emit a per-block Alert import');
  assert.ok(
    existsSync(join(REPO_ROOT, 'src', 'components', 'Alert.astro')),
    'globally provided Alert component must exist',
  );
  assert.doesNotThrow(() => mdxToJs(block), 'generated Alert block must compile as MDX');
  assert.doesNotThrow(
    () => mdxToJs(`${block}\n\nParagraph between alerts.\n\n${secondBlock}`),
    'multiple CMS Alert blocks in one MDX body must compile without duplicate imports',
  );

  // Legacy saved blocks with an inline import still parse and normalize cleanly.
  const legacyBlock = `import Alert from '/src/components/Alert.astro';\n\n${block}`;
  const legacyMatch = legacyBlock.match(alert.pattern);
  assert.ok(legacyMatch, 'legacy import-prefixed Alert block must still match editor pattern');
  assert.deepEqual({ ...alert.fromBlock(legacyMatch) }, values);
  assert.equal(alert.toBlock(alert.fromBlock(legacyMatch)), block);

  // The component is initialized with an empty object before any edits, so
  // that call must also produce valid MDX rather than "undefined" attributes.
  const emptyBlock = alert.toBlock({});
  assert.doesNotThrow(() => mdxToJs(emptyBlock));
  assert.doesNotMatch(emptyBlock, /undefined/);
});

test('Alert editor round-trips saved MDX without losing or duplicating values', () => {
  const [alert] = loadEditorComponents();
  const values = {
    type: 'info',
    style: 'soft',
    direction: 'horizontal',
    icon: 'lucide:info',
    title: 'He said "hi" & left',
    body: 'First line\nSecond line',
  };

  const block = alert.toBlock(values);
  const match = block.match(alert.pattern);
  assert.ok(match, 'generated block must match the editor component pattern');

  const roundTripped = alert.fromBlock(match);
  assert.deepEqual({ ...roundTripped }, values);
  assert.equal(alert.toBlock(roundTripped), block, 'saving again must be byte-idempotent');
});

test('post route injects Alert globally and existing MDX posts compile cleanly', () => {
  const postRouteSource = readFileSync(
    join(REPO_ROOT, 'src', 'pages', '[...locale]', 'posts', '[...slug].astro'),
    'utf8',
  );
  assert.match(postRouteSource, /import Alert from ['"]~\/components\/Alert\.astro['"];/);
  assert.match(postRouteSource, /<Content\s+components=\{\{\s*Alert\s*\}\}\s*\/>/);

  const contentRoot = join(REPO_ROOT, 'src', 'content', 'posts');

  const findMdx = (dir) =>
    Array.from(readdirSyncRecursive(dir)).filter((file) => file.endsWith('.mdx'));
  const dirs = findMdx(contentRoot);
  assert.ok(dirs.length >= 8, 'real EN/VI posts must be present');

  for (const file of dirs) {
    const source = readFileSync(file, 'utf8');
    assert.doesNotThrow(
      () => mdxToJs(source),
      `${relative(REPO_ROOT, file)} must compile cleanly as MDX`,
    );
  }
});

/** Recursively collect files under a directory (test-local helper). */
function* readdirSyncRecursive(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) yield* readdirSyncRecursive(join(dir, entry.name));
    else yield join(dir, entry.name);
  }
}

// ---------------------------------------------------------------------------
// preparePreviewCms: fail-closed rejection cases
// ---------------------------------------------------------------------------

test('preparePreviewCms rejects a missing or empty preview branch', async (t) => {
  const dist = await makeBuiltDist(t);

  for (const branch of [undefined, '', '   ']) {
    assert.throws(
      () => preparePreviewCms({ distDir: dist, branch, siteUrl: PREVIEW_SITE_URL }),
      (error) => error instanceof PreviewConfigError && /branch is required/.test(error.message),
    );
  }
});

test('preparePreviewCms rejects main and staging write targets', async (t) => {
  const dist = await makeBuiltDist(t);

  assert.throws(
    () => preparePreviewCms({ distDir: dist, branch: 'main', siteUrl: PREVIEW_SITE_URL }),
    (error) => /production branch 'main'/.test(error.message),
  );
  assert.throws(
    () => preparePreviewCms({ distDir: dist, branch: 'staging', siteUrl: PREVIEW_SITE_URL }),
    (error) => /staging deployment branch 'staging'/.test(error.message),
  );
});

test('preparePreviewCms rejects arbitrary and malformed preview branches', async (t) => {
  const dist = await makeBuiltDist(t);

  for (const branch of [
    'codex/upstream-refactor',
    'codex/task6-cms',
    'feature/cms-preview',
    'master',
    'production',
    'codex/cms-validation',
    'codex/cms-validation-',
    'codex/cms-validation-../escape',
  ]) {
    assert.throws(
      () => preparePreviewCms({ distDir: dist, branch, siteUrl: PREVIEW_SITE_URL }),
      (error) => error instanceof PreviewConfigError,
      `branch '${branch}' must be rejected`,
    );
  }
});

test('preparePreviewCms rejects unsafe dist targets and missing built configs', async (t) => {
  const empty = await mkdtemp(join(tmpdir(), 'cms-preview-empty-'));
  t.after(() => rm(empty, { recursive: true, force: true }));

  assert.throws(
    () =>
      preparePreviewCms({
        distDir: join(REPO_ROOT, 'public'),
        branch: PREVIEW_BRANCH,
        siteUrl: PREVIEW_SITE_URL,
      }),
    (error) => /inside public\//.test(error.message),
  );

  assert.throws(
    () =>
      preparePreviewCms({
        distDir: REPO_ROOT,
        branch: PREVIEW_BRANCH,
        siteUrl: PREVIEW_SITE_URL,
      }),
    (error) => /repository root/.test(error.message),
  );

  assert.throws(
    () =>
      preparePreviewCms({
        distDir: empty,
        branch: PREVIEW_BRANCH,
        siteUrl: PREVIEW_SITE_URL,
      }),
    (error) => /built preview config not found/.test(error.message),
  );

  assert.throws(
    () =>
      preparePreviewCms({
        distDir: join(empty, 'does-not-exist'),
        branch: PREVIEW_BRANCH,
        siteUrl: PREVIEW_SITE_URL,
      }),
    (error) => /dist directory does not exist/.test(error.message),
  );
});

test('preparePreviewCms rejects invalid preview site URLs', async (t) => {
  const dist = await makeBuiltDist(t);

  for (const siteUrl of [
    undefined,
    '',
    'not-a-url',
    'ftp://preview.example.dev',
    'https://user:secret@preview.example.dev',
    'https://preview.example.dev/path',
    'https://preview.example.dev/?x=1',
  ]) {
    assert.throws(
      () => preparePreviewCms({ distDir: dist, branch: PREVIEW_BRANCH, siteUrl }),
      (error) => error instanceof PreviewConfigError,
      `site URL '${String(siteUrl)}' must be rejected`,
    );
  }
});

test('preparePreviewCms rejects an already-modified or foreign built config', async (t) => {
  const modified = await makeBuiltDist(t);
  const modifiedDoc = parseDocument(CONFIG_SOURCE);
  modifiedDoc.setIn(['backend', 'branch'], 'codex/cms-validation-already-applied');
  await writeFile(join(modified, 'cms', 'config.yml'), modifiedDoc.toString(), 'utf8');

  assert.throws(
    () =>
      preparePreviewCms({ distDir: modified, branch: PREVIEW_BRANCH, siteUrl: PREVIEW_SITE_URL }),
    (error) => /a preview config was already generated/.test(error.message),
  );

  const foreign = await makeBuiltDist(t);
  const foreignDoc = parseDocument(CONFIG_SOURCE);
  foreignDoc.setIn(['backend', 'repo'], 'someone-else/blog');
  await writeFile(join(foreign, 'cms', 'config.yml'), foreignDoc.toString(), 'utf8');

  assert.throws(
    () =>
      preparePreviewCms({ distDir: foreign, branch: PREVIEW_BRANCH, siteUrl: PREVIEW_SITE_URL }),
    (error) => /refusing to point preview at another repository/.test(error.message),
  );
});

// ---------------------------------------------------------------------------
// preparePreviewCms: isolated success + production integrity
// ---------------------------------------------------------------------------

test('preparePreviewCms writes an isolated config only into the built output', async (t) => {
  const dist = await makeBuiltDist(t);
  const result = preparePreviewCms({
    distDir: dist,
    branch: PREVIEW_BRANCH,
    siteUrl: `${PREVIEW_SITE_URL}/`,
  });

  assert.equal(result.branch, PREVIEW_BRANCH);
  assert.equal(result.siteUrl, PREVIEW_SITE_URL);
  assert.equal(result.configPath, join(dist, 'cms', 'config.yml'));

  const generated = readBuiltConfig(dist);
  assert.equal(generated.backend.name, 'github');
  assert.equal(generated.backend.repo, 'miyukowo/blog');
  assert.equal(generated.backend.branch, PREVIEW_BRANCH);
  assert.equal(generated.backend.skip_ci, false);
  assert.equal(generated.site_url, PREVIEW_SITE_URL);
  assert.equal(generated.media_libraries.cloudinary.output_filename_only, false);
  assert.equal(generated.media_libraries.cloudinary.config.cloud_name, 'tvphus');

  // Only backend.branch and site_url may change relative to the production config.
  const expected = parse(CONFIG_SOURCE);
  expected.backend.branch = PREVIEW_BRANCH;
  expected.site_url = PREVIEW_SITE_URL;
  assert.deepEqual(generated, expected);

  // Never break the tracked production config.
  assert.equal(CONFIG.backend.branch, 'main');
});

test('production config stays byte-identical and a rebuild recreates clean output', async (t) => {
  const beforeHash = createHash('sha256').update(readFileSync(CONFIG_PATH)).digest('hex');
  const dist = await makeBuiltDist(t);

  preparePreviewCms({ distDir: dist, branch: PREVIEW_BRANCH, siteUrl: PREVIEW_SITE_URL });

  const afterHash = createHash('sha256').update(readFileSync(CONFIG_PATH)).digest('hex');
  assert.equal(afterHash, beforeHash, 'public/cms/config.yml must not be modified in place');
  assert.equal(CONFIG.backend.branch, 'main');

  // A second run against the same built output fails closed instead of
  // double-applying the preview branch.
  await assert.rejects(async () => {
    preparePreviewCms({ distDir: dist, branch: PREVIEW_BRANCH, siteUrl: PREVIEW_SITE_URL });
  }, /a preview config was already generated/);

  // Simulate the next production build: Astro copies public/cms/config.yml into
  // a fresh dist verbatim, so no preview value can leak into it.
  const rebuilt = await mkdtemp(join(tmpdir(), 'cms-rebuild-'));
  t.after(() => rm(rebuilt, { recursive: true, force: true }));
  await mkdir(join(rebuilt, 'cms'), { recursive: true });
  await writeFile(join(rebuilt, 'cms', 'config.yml'), readFileSync(CONFIG_PATH));

  assert.equal(
    readFileSync(join(rebuilt, 'cms', 'config.yml'), 'utf8'),
    readFileSync(CONFIG_PATH, 'utf8'),
  );
  const rebuiltConfig = readBuiltConfig(rebuilt);
  assert.equal(rebuiltConfig.backend.branch, 'main');
  assert.equal(rebuiltConfig.site_url, undefined);
});

test('preparePreviewCms CLI succeeds and points at the generated config', async (t) => {
  const dist = await makeBuiltDist(t);
  const { stdout } = await execFileAsync(process.execPath, [
    PREVIEW_CLI,
    '--dist',
    dist,
    '--branch',
    PREVIEW_BRANCH,
    '--site-url',
    PREVIEW_SITE_URL,
  ]);

  assert.match(stdout, /prepare-preview: OK/);
  assert.match(stdout, new RegExp(`backend\\.branch: ${PREVIEW_BRANCH}`));
  assert.equal(readBuiltConfig(dist).backend.branch, PREVIEW_BRANCH);
  assert.equal(readBuiltConfig(dist).site_url, PREVIEW_SITE_URL);
});

test('preparePreviewCms CLI fails nonzero with a useful diagnostic', async (t) => {
  const dist = await makeBuiltDist(t);

  await assert.rejects(
    execFileAsync(process.execPath, [
      PREVIEW_CLI,
      '--dist',
      dist,
      '--branch',
      'main',
      '--site-url',
      PREVIEW_SITE_URL,
    ]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(String(error.stderr), CMS_PREVIEW_FAIL);
      assert.match(String(error.stderr), /production branch 'main'/);
      return true;
    },
  );

  await assert.rejects(
    execFileAsync(process.execPath, [PREVIEW_CLI, '--dist', dist, '--branch', PREVIEW_BRANCH]),
    (error) => {
      assert.equal(error.code, 1);
      assert.match(String(error.stderr), /missing required option --site-url/);
      return true;
    },
  );

  const generated = readBuiltConfig(dist);
  assert.equal(generated.backend.branch, 'main');
});

// ---------------------------------------------------------------------------
// Simulated CMS save -> reload -> render
// ---------------------------------------------------------------------------

test('simulated CMS save/reload produces schema-valid, renderable translated posts', async (t) => {
  const [alert] = loadEditorComponents();
  const workspace = await mkdtemp(join(tmpdir(), 'cms-save-reload-'));
  t.after(() => rm(workspace, { recursive: true, force: true }));

  const saved = {};

  for (const locale of ['en', 'vi']) {
    const payload = SAVED_ENTRY[locale];
    const { body, ...frontmatter } = payload;
    const alertBlock = alert.toBlock({
      type: 'info',
      style: 'soft',
      direction: 'horizontal',
      icon: 'lucide:info',
      title: 'Saved from Sveltia CMS',
      body: 'This callout was inserted by the CMS editor component.',
    });
    const secondAlertBlock = alert.toBlock({
      type: 'warning',
      style: 'outline',
      direction: 'horizontal',
      icon: 'lucide:alert-triangle',
      title: 'Second CMS alert',
      body: 'Second callout in the same post.',
    });
    const source = `---\n${stringify(frontmatter, { lineWidth: 0 })}---\n\n${alertBlock}\n\n${body}\n\n${secondAlertBlock}\n`;

    // Write through the path convention derived from the tracked CMS config.
    const relativeEntry = relative(REPO_ROOT, cmsEntryPath('posts', locale, payload.postSlug));
    const target = join(workspace, relativeEntry);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, source, 'utf8');

    // Reload it exactly like the site build would.
    const reloadedSource = await readFile(target, 'utf8');
    const reloaded = parseFrontmatter(reloadedSource);

    assertValidPostFrontmatter(reloaded, payload);
    assert.equal(dateString(reloaded.pubDate), payload.pubDate);
    assert.equal(dateString(reloaded.updatedDate), payload.updatedDate);
    assert.equal(reloaded.translationKey, payload.translationKey);
    assert.equal(reloaded.heroImage, payload.heroImage);
    assert.equal(reloaded.heroImageAlt, payload.heroImageAlt);
    assert.deepEqual(reloaded.tags, payload.tags);
    assert.deepEqual(reloaded.categories, payload.categories);
    assert.equal(reloaded.draft, true);
    assert.equal(reloaded.unlisted, true);
    assert.equal(reloaded.toc, true);
    assert.equal(reloaded.comments, false);

    // Media selected in the CMS must render through the site CDN policy.
    assert.equal(
      resolveMediaUrl(reloaded.heroImage),
      'https://cdn.tvphus.dev/image/optimized/blog/cms-validation/hero.jpg',
    );

    // The whole saved file (frontmatter + multiple Alert JSX blocks) must compile.
    const compiled = mdxToJs(reloadedSource);
    assert.ok(compiled.code.length > 0);
    assert.doesNotMatch(reloadedSource, /import\s+Alert\b/);

    // The path follows `<postSlug>/index.mdx` under the locale folder.
    assert.equal(
      relativeEntry.split('\\').join('/'),
      `src/content/posts/${locale}/${payload.postSlug}/index.mdx`,
    );

    saved[locale] = reloaded;
  }

  assert.equal(saved.en.translationKey, saved.vi.translationKey);
  assert.equal(saved.en.postSlug, saved.vi.postSlug);
});
