/**
 * Read-only upstream drift / provenance reporter (Task 8).
 *
 * Compares the adopted Chirping starter commit with a candidate starter commit
 * using real Git objects. It reports:
 *  - additions / modifications / deletions / renames,
 *  - protected authored content changes (blocking),
 *  - declared shared-file exceptions (with their recorded reason),
 *  - undeclared local-owned overlaps and renames (blocking/review),
 *  - package.json <-> bun.lock coherence,
 *  - source/starter pin correspondence (from the starter commit message),
 *  - ancestry between adopted and candidate.
 *
 * It NEVER copies, deletes or rewrites project files, and it does not decide
 * conflicts. Merge/review decisions stay manual.
 *
 * Usage:
 *   node scripts/check-upstream.mjs --adopted <starter-sha> --candidate <starter-sha>
 *                                   [--manifest theme-upstream.json]
 *                                   [--source-adopted <sha>] [--source-candidate <sha>]
 *                                   [--json]
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// Pure analysis
// ---------------------------------------------------------------------------

/** Match a repository-relative path against a simple ownership pattern. */
export function matchesPattern(path, pattern) {
  if (pattern.endsWith('/**')) return path.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith('/')) return path.startsWith(pattern);
  if (pattern.includes('*')) {
    const escaped = pattern
      .split('*')
      .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*');
    return new RegExp(`^${escaped}$`).test(path);
  }
  return path === pattern;
}

function matchesAny(path, patterns = []) {
  return patterns.some((pattern) => matchesPattern(path, pattern));
}

function entry(errors, code, path, message) {
  errors.push({ code, path, message });
}

/**
 * Pure drift analysis. `changes` is the parsed `git diff --name-status`
 * output; `ownership` and `pins` come from theme-upstream.json / Git.
 */
export function analyzeUpstreamChange({ changes = [], ownership = {}, pins = {} } = {}) {
  const errors = [];
  const warnings = [];
  const additions = [];
  const modifications = [];
  const deletions = [];
  const renames = [];
  const protectedContentChanges = [];
  const sharedExceptionChanges = [];
  const localOwnedChanges = [];

  const {
    protectedContent = ['src/content/'],
    localOwned = [],
    sharedExceptions = [],
    packageManifest = 'package.json',
    packageLock = 'bun.lock',
  } = ownership;

  // ---- pins ---------------------------------------------------------------
  if (!pins.adoptedStarter) entry(errors, 'missing-pin', '', 'missing adopted starter pin');
  if (!pins.candidateStarter) entry(errors, 'missing-pin', '', 'missing candidate starter pin');
  if (!pins.adoptedSource || !pins.candidateSource) {
    entry(errors, 'missing-source-pin', '', 'missing source/starter correspondence pin');
  }
  // Starter sync commits record a (usually abbreviated) source SHA.
  const syncedSource =
    typeof pins.candidateMessage === 'string'
      ? /chirping-astro@([0-9a-f]{7,40})\b/.exec(pins.candidateMessage)?.[1]
      : undefined;
  const sourceMatches =
    !syncedSource ||
    !pins.candidateSource ||
    pins.candidateSource === syncedSource ||
    pins.candidateSource.startsWith(syncedSource) ||
    syncedSource.startsWith(pins.candidateSource);
  if (syncedSource && pins.candidateSource && !sourceMatches) {
    entry(
      errors,
      'stale-source-pair',
      '',
      `candidate starter records source ${syncedSource} but the supplied source pin is ${pins.candidateSource}`,
    );
  } else if (pins.candidateMessage && !syncedSource && pins.candidateSource) {
    warnings.push({
      code: 'unverified-source-pair',
      path: '',
      message:
        'candidate starter commit message does not record a source SHA; correspondence unproven',
    });
  }

  const exceptionFor = (path) => sharedExceptions.find((exception) => exception.path === path);
  const exceptionPaths = new Set(sharedExceptions.map((exception) => exception.path));

  // ---- per-path classification -------------------------------------------
  for (const change of changes) {
    const status = String(change.status ?? '').toUpperCase();
    const path = change.path;
    const oldPath = change.oldPath;
    const kind = status[0];

    const protectedPaths = [path, oldPath]
      .filter(Boolean)
      .filter((p) => matchesAny(p, protectedContent));
    if (protectedPaths.length > 0) {
      protectedContentChanges.push({ status, path, oldPath });
      entry(
        errors,
        kind === 'D' || kind === 'R' ? 'protected-content-deleted' : 'protected-content-changed',
        path,
        'upstream changed protected authored content; reconcile deliberately, never let upstream overwrite it',
      );
      continue;
    }

    const exception = exceptionFor(path) ?? (oldPath ? exceptionFor(oldPath) : undefined);
    if (exception) {
      if (kind === 'D') {
        entry(
          errors,
          'shared-exception-deleted',
          path,
          `upstream deleted the shared exception "${path}"`,
        );
        continue;
      }
      if (kind === 'R') {
        entry(
          errors,
          'shared-exception-renamed',
          path,
          `upstream renamed the shared exception "${oldPath ?? path}" -> "${path}"; re-review the local seam`,
        );
        continue;
      }
      sharedExceptionChanges.push({ status, path, reason: exception.reason });
      continue;
    }

    const ownedBy = localOwned.find((pattern) => matchesAny(path, [pattern]));
    if (ownedBy) {
      localOwnedChanges.push({ status, path, pattern: ownedBy });
      warnings.push({
        code: kind === 'A' ? 'local-owned-overlap-added' : 'local-owned-overlap',
        path,
        message: `upstream ${kind === 'A' ? 'adds' : 'changes'} a path inside locally owned area "${ownedBy}"; review for overlap`,
      });
      continue;
    }

    switch (kind) {
      case 'A':
        additions.push(path);
        break;
      case 'M':
        modifications.push(path);
        break;
      case 'D':
        deletions.push(path);
        break;
      case 'R':
        renames.push({ from: oldPath, to: path, similarity: status.slice(1) });
        if (!exceptionPaths.has(path)) {
          entry(
            errors,
            'undeclared-rename',
            path,
            `undeclared upstream rename "${oldPath}" -> "${path}"; declare a shared exception or resolve manually`,
          );
        }
        break;
      default:
        modifications.push(path);
    }
  }

  // ---- package/lock coherence -------------------------------------------
  const manifestChanged = changes.some((change) => change.path === packageManifest);
  const lockChanged = changes.some((change) => change.path === packageLock);
  if (manifestChanged !== lockChanged) {
    entry(
      errors,
      'package-lock-mismatch',
      manifestChanged ? packageLock : packageManifest,
      `package manifest and lockfile must change together (${packageManifest}=${manifestChanged}, ${packageLock}=${lockChanged})`,
    );
  }

  return {
    ok: errors.length === 0,
    pins: {
      adoptedStarter: pins.adoptedStarter,
      candidateStarter: pins.candidateStarter,
      adoptedSource: pins.adoptedSource,
      candidateSource: pins.candidateSource,
    },
    additions,
    modifications,
    deletions,
    renames,
    protectedContentChanges,
    sharedExceptionChanges,
    localOwnedChanges,
    packageLock: { manifestChanged, lockChanged, coherent: manifestChanged === lockChanged },
    errors,
    warnings,
  };
}

/** Parse `git diff --name-status -M` output. */
export function parseNameStatus(output) {
  const changes = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split('\t');
    const status = parts[0];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ status, oldPath: parts[1], path: parts[2] });
    } else {
      changes.push({ status, path: parts[1] });
    }
  }
  return changes;
}

// ---------------------------------------------------------------------------
// Git plumbing (read-only)
// ---------------------------------------------------------------------------

function git(args) {
  return execFileSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return undefined;
  }
}

function objectExists(sha) {
  return tryGit(['cat-file', '-e', `${sha}^{commit}`]) !== undefined;
}

function commitMessage(sha) {
  return tryGit(['log', '-1', '--format=%B', sha]) ?? '';
}

function isAncestor(ancestor, descendant) {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], {
      cwd: REPO_ROOT,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function parseArgs(argv) {
  const options = {
    adopted: undefined,
    candidate: undefined,
    sourceAdopted: undefined,
    sourceCandidate: undefined,
    manifest: join(REPO_ROOT, 'theme-upstream.json'),
    json: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--adopted') options.adopted = argv[++i];
    else if (arg === '--candidate') options.candidate = argv[++i];
    else if (arg === '--source-adopted') options.sourceAdopted = argv[++i];
    else if (arg === '--source-candidate') options.sourceCandidate = argv[++i];
    else if (arg === '--manifest') options.manifest = resolve(argv[++i]);
    else if (arg === '--json') options.json = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
  }
  return options;
}

function loadManifest(path) {
  if (!existsSync(path)) throw new Error(`manifest not found: ${path}`);
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  if (manifest.schemaVersion !== 1) {
    throw new Error(`unsupported theme-upstream.json schemaVersion: ${manifest.schemaVersion}`);
  }
  if (!manifest.adopted?.starter || !manifest.adopted?.source) {
    throw new Error('theme-upstream.json is missing adopted starter/source pins');
  }
  return manifest;
}

function printReport(report, meta) {
  const lines = [];
  lines.push('upstream drift report (read-only)');
  lines.push(
    `  adopted starter:   ${meta.adopted}${meta.adoptedSource ? ` (source ${meta.adoptedSource})` : ''}`,
  );
  lines.push(
    `  candidate starter: ${meta.candidate}${meta.candidateSource ? ` (source ${meta.candidateSource})` : ''}`,
  );
  lines.push(`  manifest adopted:  ${meta.manifestStarter}`);
  lines.push(
    `  ancestry:          ${meta.ancestry ? 'candidate descends from adopted' : 'MISSING'}`,
  );
  lines.push(
    `  changes:           +${report.additions.length} ~${report.modifications.length} -${report.deletions.length} renamed ${report.renames.length}`,
  );
  lines.push(
    `  package/lock:      manifest=${report.packageLock.manifestChanged} lock=${report.packageLock.lockChanged} coherent=${report.packageLock.coherent}`,
  );
  if (report.additions.length) lines.push(`  additions:         ${report.additions.join(', ')}`);
  if (report.modifications.length)
    lines.push(`  modifications:     ${report.modifications.join(', ')}`);
  if (report.deletions.length) lines.push(`  deletions:         ${report.deletions.join(', ')}`);
  if (report.renames.length) {
    lines.push(
      `  renames:           ${report.renames.map((r) => `${r.from} -> ${r.to}`).join(', ')}`,
    );
  }
  if (report.sharedExceptionChanges.length) {
    for (const change of report.sharedExceptionChanges) {
      lines.push(`  shared exception:  ${change.status[0]} ${change.path} — ${change.reason}`);
    }
  }
  if (report.localOwnedChanges.length) {
    for (const change of report.localOwnedChanges) {
      lines.push(
        `  local-owned:       ${change.status[0]} ${change.path} (${change.pattern}) — review overlap`,
      );
    }
  }
  if (report.protectedContentChanges.length) {
    lines.push(
      `  protected content: ${report.protectedContentChanges.map((c) => `${c.status[0]} ${c.path}`).join(', ')}`,
    );
  }
  for (const warning of report.warnings)
    lines.push(`  WARN ${warning.code}: ${warning.path || '-'} — ${warning.message}`);
  for (const error of report.errors)
    lines.push(`  ERROR ${error.code}: ${error.path || '-'} — ${error.message}`);
  lines.push(
    report.ok ? 'RESULT: OK (no blocking drift found)' : 'RESULT: FAIL (blocking drift found)',
  );
  console.log(lines.join('\n'));
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    console.log(
      'usage: node scripts/check-upstream.mjs --adopted <sha> --candidate <sha> [--json]',
    );
    return;
  }
  if (!options.adopted || !options.candidate) {
    throw new Error('both --adopted and --candidate starter SHAs are required');
  }

  const manifest = loadManifest(options.manifest);
  const preambleErrors = [];

  if (!objectExists(options.adopted))
    throw new Error(`missing Git object for adopted starter ${options.adopted}`);
  if (!objectExists(options.candidate))
    throw new Error(`missing Git object for candidate starter ${options.candidate}`);

  // Adopted pin must match the manifest, or be an ancestor of it (checkpoint
  // rehearsal such as the historical update). Anything else is stale.
  if (
    options.adopted !== manifest.adopted.starter &&
    !isAncestor(options.adopted, manifest.adopted.starter)
  ) {
    preambleErrors.push({
      code: 'stale-adopted-pin',
      message: `--adopted ${options.adopted} is neither the recorded adopted starter nor its ancestor`,
    });
  }

  if (!isAncestor(options.adopted, options.candidate)) {
    throw new Error(
      `candidate ${options.candidate} does not descend from adopted ${options.adopted}; check the pins`,
    );
  }

  const adoptedMessage = commitMessage(options.adopted);
  const candidateMessage = commitMessage(options.candidate);
  const resolveSource = (short) => {
    if (!short) return undefined;
    return tryGit(['rev-parse', '--verify', `${short}^{commit}`]) ?? short;
  };
  const derivedAdoptedSource = resolveSource(
    /chirping-astro@([0-9a-f]{7,40})\b/.exec(adoptedMessage)?.[1],
  );
  const derivedCandidateSource = resolveSource(
    /chirping-astro@([0-9a-f]{7,40})\b/.exec(candidateMessage)?.[1],
  );
  const adoptedSource = options.sourceAdopted ?? derivedAdoptedSource ?? manifest.adopted.source;
  const candidateSource =
    options.sourceCandidate ?? derivedCandidateSource ?? manifest.adopted.source;

  const diffOutput = git(['diff', '--name-status', '-M', options.adopted, options.candidate]);
  const changes = parseNameStatus(diffOutput);

  const report = analyzeUpstreamChange({
    changes,
    ownership: {
      protectedContent: manifest.protectedContent,
      localOwned: manifest.localOwned,
      sharedExceptions: manifest.sharedExceptions,
      packageManifest: manifest.packageFiles?.manifest ?? 'package.json',
      packageLock: manifest.packageFiles?.lock ?? 'bun.lock',
    },
    pins: {
      adoptedStarter: options.adopted,
      candidateStarter: options.candidate,
      adoptedSource,
      candidateSource,
      candidateMessage,
    },
  });
  for (const preamble of preambleErrors) report.errors.push({ path: '', ...preamble });
  report.ok = report.errors.length === 0;

  // Source ancestry (when the source objects are available locally).
  if (
    adoptedSource &&
    candidateSource &&
    objectExists(adoptedSource) &&
    objectExists(candidateSource)
  ) {
    if (!isAncestor(adoptedSource, candidateSource)) {
      report.errors.push({
        code: 'stale-source-pair',
        path: '',
        message: `source pin ${candidateSource} does not descend from ${adoptedSource}`,
      });
      report.ok = false;
    }
  } else if (adoptedSource && candidateSource) {
    report.warnings.push({
      code: 'source-objects-unavailable',
      path: '',
      message:
        'source commits are not present locally; correspondence verified from commit messages only',
    });
  }

  const meta = {
    adopted: options.adopted,
    candidate: options.candidate,
    adoptedSource,
    candidateSource,
    manifestStarter: manifest.adopted.starter,
    ancestry: true,
  };

  if (options.json) {
    console.log(JSON.stringify({ ...report, meta }, null, 2));
  } else {
    printReport(report, meta);
  }
  if (!report.ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    main();
  } catch (error) {
    console.error(`check-upstream: FAIL - ${error.message}`);
    process.exitCode = 1;
  }
}
