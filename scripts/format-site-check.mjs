#!/usr/bin/env node
/**
 * Scoped formatting check/write for the maintained (non-upstream) delta.
 *
 * The imported Chirping theme and authored post bodies are intentionally not
 * mass-reformatted: doing so would create a large unreviewable diff against
 * upstream and rewrite content bytes protected by the site contract. This
 * helper formats only the project-owned surfaces below:
 *
 *   - scripts/            (contract + verification harness)
 *   - tests/site/         (Node test-runner tests; fixtures are git-ignored
 *                          test data and excluded via .prettierignore)
 *   - docs/               (maintenance/handoff documentation)
 *   - src/site/           (local site policy modules; added by Task 2, so its
 *                          absence must not fail the check)
 *   - explicit local/shared files changed by the maintainability work
 *
 * CMS config/admin assets are currently recorded as deferred debt below (see
 * DEFERRED_FORMATTING_DEBT); add `public/cms` to SCOPED_PATHS when Task 6
 * reformats them. `bunfig.toml` is intentionally not listed because Prettier
 * has no TOML parser.
 *
 * Pre-existing imported formatting debt is recorded, not reformatted:
 * `public/cms/config.yml` and `public/cms/index.html` are still upstream CMS
 * files slated for the Task 6 CMS rewrite. Reformatting them now would create
 * an out-of-scope `public/` diff, so they are reported as deferred and are
 * expected to be removed from DEFERRED_FORMATTING_DEBT once Task 6 adopts
 * them. Unchanged upstream theme source and authored content are never
 * touched.
 *
 * Usage: node scripts/format-site-check.mjs [--check|--write]
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PRETTIER_BIN = join(REPO_ROOT, 'node_modules', 'prettier', 'bin', 'prettier.cjs');

/** Project-owned paths that must be formatted cleanly. */
const SCOPED_PATHS = [
  'scripts',
  'tests/site',
  'docs',
  'src/site',
  'src/components/VideoEmbed.astro',
  'src/utils/og-image.ts',
  'package.json',
  'eslint.config.js',
  '.prettierrc.json',
];

/**
 * Recorded imported formatting debt: reported here, not reformatted, and not
 * part of the failing check until the owning task adopts the file.
 */
const DEFERRED_FORMATTING_DEBT = [
  {
    path: 'public/cms/config.yml',
    reason: 'imported CMS config slated for the Task 6 rewrite (public/ is out of Task 1 scope)',
  },
  {
    path: 'public/cms/index.html',
    reason:
      'imported CMS admin shell slated for the Task 6 rewrite (public/ is out of Task 1 scope)',
  },
];

const mode = process.argv.includes('--write') ? '--write' : '--check';

function collectMatchedPaths() {
  const matched = [];
  for (const scopedPath of SCOPED_PATHS) {
    const absolutePath = join(REPO_ROOT, scopedPath);
    if (!existsSync(absolutePath)) continue;
    matched.push(scopedPath);
  }
  return matched;
}

const matchedPaths = collectMatchedPaths();
if (matchedPaths.length === 0) {
  console.error('format-site-check: no scoped paths exist; nothing to format');
  process.exit(1);
}

console.log(`format-site-check (${mode}): ${matchedPaths.join(', ')}`);
for (const entry of DEFERRED_FORMATTING_DEBT) {
  console.log(`  deferred formatting debt: ${entry.path} - ${entry.reason}`);
}

const child = spawn(
  process.execPath,
  [PRETTIER_BIN, mode, '--ignore-path', '.prettierignore', ...matchedPaths],
  { cwd: REPO_ROOT, stdio: 'inherit' },
);
child.on('error', (error) => {
  console.error(`format-site-check: failed to run Prettier: ${error.message}`);
  process.exitCode = 1;
});
child.on('close', (code) => {
  process.exitCode = code ?? 1;
});
