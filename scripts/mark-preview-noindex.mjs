/**
 * Mark a preview build as non-indexable (Task 7).
 *
 * Cloudflare Pages serves the same tracked `public/_headers` file for every
 * branch deployment. Production must stay indexable, so the noindex response
 * header is injected into the *built* output of non-production branches only
 * (after the build, before upload). Production/main is rejected explicitly so
 * this script can never downgrade the production site.
 *
 * Usage:
 *   node scripts/mark-preview-noindex.mjs --dist dist --branch staging
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

import { hasGlobalNoindex } from './header-policy.mjs';

const PRODUCTION_BRANCHES = new Set(['main']);

/** Inject `X-Robots-Tag: noindex` into the built headers file. */
export function markPreviewNoindex({ distDir, branch }) {
  if (!branch) throw new Error('mark-preview-noindex: a deployment branch is required');
  if (PRODUCTION_BRANCHES.has(branch)) {
    throw new Error(`mark-preview-noindex: refusing to mark production branch "${branch}" noindex`);
  }

  const headersPath = join(distDir, '_headers');
  if (!existsSync(headersPath)) throw new Error(`mark-preview-noindex: missing ${headersPath}`);

  const current = readFileSync(headersPath, 'utf8');
  // Scope-aware: a `/cms/*` noindex rule is not global preview protection.
  // Only an effective catch-all `/*` rule keeps a repeated run idempotent.
  if (hasGlobalNoindex(current)) {
    return { changed: false, headersPath };
  }

  // Append a catch-all rule. Duplicate header blocks for the same path are
  // merged by Cloudflare Pages, so the existing cache/security rules stay.
  appendFileSync(
    headersPath,
    [
      '',
      '# Preview deployments must never be indexed (injected for non-main branches).',
      '/*',
      '  X-Robots-Tag: noindex, nofollow',
      '',
    ].join('\n'),
  );
  return { changed: true, headersPath };
}

function parseArgs(argv) {
  const options = { distDir: 'dist', branch: process.env.GITHUB_REF_NAME ?? '' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dist') options.distDir = argv[++i];
    else if (arg === '--branch') options.branch = argv[++i];
  }
  return options;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { distDir, branch } = parseArgs(process.argv.slice(2));
    const result = markPreviewNoindex({ distDir, branch });
    console.log(
      `preview noindex: ${result.changed ? 'injected' : 'already present'} (${result.headersPath})`,
    );
  } catch (error) {
    console.error(`preview noindex: FAIL - ${error.message}`);
    process.exitCode = 1;
  }
}
