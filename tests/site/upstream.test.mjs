/**
 * Task 8: provenance/drift reporter tests.
 *
 * Level 1 — pure `analyzeUpstreamChange` fixtures (no .git): protected content,
 * renames, declared local exceptions, local-owned overlap, source/starter pin
 * coherence, package/lock pairing, missing pins.
 * Level 2 — the real CLI against actual Git objects in this repository.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  analyzeUpstreamChange,
  matchesPattern,
  parseNameStatus,
} from '../../scripts/check-upstream.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const CLI = join(REPO_ROOT, 'scripts', 'check-upstream.mjs');

const ownership = {
  protectedContent: ['src/content/'],
  localOwned: ['src/site/', 'scripts/', 'public/cms/'],
  sharedExceptions: [
    {
      path: 'astro.config.mjs',
      reason: 'site config seam',
      validation: 'node scripts/verify-site.mjs --profile offline',
    },
    {
      path: 'src/utils/posts.ts',
      reason: 'URL identity seam',
      validation: 'node scripts/verify-site.mjs --profile offline',
    },
  ],
  packageManifest: 'package.json',
  packageLock: 'bun.lock',
};

const pins = {
  adoptedStarter: 'a'.repeat(40),
  candidateStarter: 'b'.repeat(40),
  adoptedSource: 'c'.repeat(40),
  candidateSource: 'd'.repeat(40),
  candidateMessage: `sync: update from chirping-astro@${'d'.repeat(40)} [skip ci]`,
};

function analyze(changes, overrides = {}) {
  return analyzeUpstreamChange({
    changes,
    ownership: { ...ownership, ...(overrides.ownership ?? {}) },
    pins: { ...pins, ...(overrides.pins ?? {}) },
  });
}

test('ownership patterns match directories, prefixes and exact files', () => {
  assert.equal(matchesPattern('src/site/media.ts', 'src/site/'), true);
  assert.equal(matchesPattern('src/content/posts/en/x/index.mdx', 'src/content/'), true);
  assert.equal(matchesPattern('src/content.config.ts', 'src/content/'), false);
  assert.equal(matchesPattern('package.json', 'package.json'), true);
  assert.equal(matchesPattern('src/other/thing.ts', 'src/site/'), false);
  assert.equal(matchesPattern('src/config.ts', 'src/site/'), false);
});

test('name-status parsing handles add/modify/delete/rename', () => {
  const parsed = parseNameStatus(
    ['A\tnew.md', 'M\tastro.config.mjs', 'D\told.md', 'R091\ta.md\tb.md'].join('\n'),
  );
  assert.deepEqual(parsed[0], { status: 'A', path: 'new.md' });
  assert.deepEqual(parsed[1], { status: 'M', path: 'astro.config.mjs' });
  assert.deepEqual(parsed[2], { status: 'D', path: 'old.md' });
  assert.deepEqual(parsed[3], { status: 'R091', oldPath: 'a.md', path: 'b.md' });
});

test('a normal dependency update (manifest+lock) with declared exceptions is OK', () => {
  const report = analyze([
    { status: 'M', path: 'package.json' },
    { status: 'M', path: 'bun.lock' },
    { status: 'M', path: 'astro.config.mjs' },
    { status: 'A', path: 'src/plugins/satteri-new-plugin.ts' },
  ]);
  assert.equal(report.ok, true, JSON.stringify(report.errors));
  assert.deepEqual(report.additions, ['src/plugins/satteri-new-plugin.ts']);
  assert.equal(report.sharedExceptionChanges.length, 1);
  assert.equal(report.sharedExceptionChanges[0].reason, 'site config seam');
  assert.equal(report.packageLock.coherent, true);
});

test('deleting protected authored content is a blocking error', () => {
  const report = analyze([{ status: 'D', path: 'src/content/posts/en/welcome/index.mdx' }]);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'protected-content-deleted'));
});

test('modifying protected authored content is a blocking error', () => {
  const report = analyze([{ status: 'M', path: 'src/content/pages/en/about.md' }]);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'protected-content-changed'));
});

test('upstream deleting a declared shared exception is a blocking error', () => {
  const report = analyze([{ status: 'D', path: 'src/utils/posts.ts' }]);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'shared-exception-deleted'));
});

test('undeclared shared-file rename is a blocking error', () => {
  const report = analyze([
    { status: 'R100', oldPath: 'src/utils/seo.ts', path: 'src/utils/seo-new.ts' },
  ]);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'undeclared-rename'));
});

test('new upstream files are reported, not silently ignored', () => {
  const report = analyze([{ status: 'A', path: 'src/plugins/brand-new.ts' }]);
  assert.deepEqual(report.additions, ['src/plugins/brand-new.ts']);
  assert.equal(report.ok, true);
});

test('package manifest change without a lockfile update fails coherence', () => {
  const report = analyze([{ status: 'M', path: 'package.json' }]);
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'package-lock-mismatch'));
});

test('stale source/starter pair is rejected using the starter commit message', () => {
  const report = analyze(
    [
      { status: 'M', path: 'package.json' },
      { status: 'M', path: 'bun.lock' },
    ],
    {
      pins: { candidateMessage: `sync: update from chirping-astro@${'e'.repeat(40)} [skip ci]` },
    },
  );
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'stale-source-pair'));
});

test('missing pins produce useful diagnostics', () => {
  const report = analyze([], { pins: { adoptedStarter: '', candidateSource: '' } });
  assert.equal(report.ok, false);
  assert.ok(report.errors.some((error) => error.code === 'missing-pin'));
  assert.ok(report.errors.some((error) => error.code === 'missing-source-pin'));
});

test('upstream changes inside a locally owned area are warnings for review', () => {
  const report = analyze([{ status: 'M', path: 'src/site/media.ts' }]);
  assert.equal(report.ok, true);
  assert.equal(report.localOwnedChanges.length, 1);
  assert.ok(report.warnings.some((warning) => warning.code === 'local-owned-overlap'));
});

// ---------------------------------------------------------------------------
// Real CLI runs against this repository's Git objects
// ---------------------------------------------------------------------------

function runCli(args) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    timeout: 120_000,
  });
}

test('CLI: adopted == candidate has no drift and exits 0', () => {
  const adopted = '821bc6171f2ed0f74d920cc5ab70794c3f779971';
  const result = runCli(['--adopted', adopted, '--candidate', adopted]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /RESULT: OK/);
  assert.match(result.stdout, /\+0 ~0 -0 renamed 0/);
});

test('CLI: real dependency-update pair reports coherent manifest/lock and exits 0', () => {
  // Researched dependency/lock pair: starter f63a255 -> 821bc61 (package.json + bun.lock only).
  const result = runCli([
    '--adopted',
    'f63a255317c8851d0f354de2fc7580d57873af3e',
    '--candidate',
    '821bc6171f2ed0f74d920cc5ab70794c3f779971',
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /package\/lock:\s+manifest=true lock=true coherent=true/);
  assert.match(result.stdout, /RESULT: OK/);
});

test('CLI: functional update checkpoint reports the intended upstream additions', () => {
  // Researched functional update pair: starter a5cda97 -> a2b22df adds the
  // base-links plugin and its config wiring.
  const result = runCli([
    '--adopted',
    'a5cda9782b93f241f22ef38d9ff7b328a354a0b3',
    '--candidate',
    'a2b22df2c0619c7d157324c9de458f38585d8e50',
  ]);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /satteri-base-links|base-links/, result.stdout);
  assert.match(result.stdout, /RESULT: OK/);
});

test('CLI: missing Git objects and non-ancestor pins fail with useful diagnostics', () => {
  const missing = runCli([
    '--adopted',
    '0'.repeat(40),
    '--candidate',
    '821bc6171f2ed0f74d920cc5ab70794c3f779971',
  ]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /missing Git object/);

  const notAncestor = runCli([
    '--adopted',
    '821bc6171f2ed0f74d920cc5ab70794c3f779971',
    '--candidate',
    'f63a255317c8851d0f354de2fc7580d57873af3e',
  ]);
  assert.equal(notAncestor.status, 1);
  assert.match(notAncestor.stderr, /does not descend/);
});

test('CLI: JSON mode returns the structured drift report', () => {
  const adopted = '821bc6171f2ed0f74d920cc5ab70794c3f779971';
  const result = runCli(['--adopted', adopted, '--candidate', adopted, '--json']);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.ok('protectedContentChanges' in report);
  assert.ok('packageLock' in report);
  assert.equal(report.meta.adopted, adopted);
});
