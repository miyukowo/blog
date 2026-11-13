/**
 * Build-time source manifest for routine artifact validation
 * (review follow-up Task 2).
 *
 * The pre-upload validator must follow the *current* source tree instead of a
 * frozen November snapshot, but it must still reject a stale artifact when
 * the source changed without a rebuild. The Astro build writes this manifest
 * from the source inputs before/independently of inspecting built output; the
 * validator recomputes the same fingerprint and refuses to certify the
 * artifact when they differ.
 *
 * The manifest lives under `.astro/`, is never part of `dist/`, and contains
 * only paths/hashes/toolchain provenance — no draft titles, bodies or other
 * unpublished metadata.
 */

import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix } from 'node:path';
import process from 'node:process';

export const BUILD_MANIFEST_SCHEMA_VERSION = 1;
export const BUILD_MANIFEST_RELATIVE_PATH = '.astro/site-build-manifest.json';

/** Directories whose bytes can affect the built artifact. */
const INPUT_ROOTS = ['src', 'public'];

/** Root-level build/config inputs (a change requires a rebuild). */
const INPUT_FILES = [
  'astro.config.mjs',
  'package.json',
  'tsconfig.json',
  'bunfig.toml',
  '.node-version',
];

export interface BuildManifest {
  schemaVersion: number;
  sourceFingerprint: string;
  sourceRevision: string;
  builtAt: string;
  inputCount: number;
}

interface FingerprintEntry {
  path: string;
  sha256: string;
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex');
}

function listFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string, prefix: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = prefix ? posix.join(prefix, entry.name) : entry.name;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full, relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  };
  visit(root, '');
  return files.sort();
}

/**
 * Hash every source input into a deterministic manifest.
 */
export function computeSourceFingerprint(sourceDir: string): {
  fingerprint: string;
  files: FingerprintEntry[];
} {
  const entries: FingerprintEntry[] = [];

  for (const root of INPUT_ROOTS) {
    const absoluteRoot = join(sourceDir, root);
    let files: string[];
    try {
      files = listFiles(absoluteRoot);
    } catch {
      continue;
    }
    for (const relativePath of files) {
      const absolutePath = join(absoluteRoot, relativePath);
      entries.push({
        path: posix.join(root, relativePath),
        sha256: sha256(readFileSync(absolutePath)),
      });
    }
  }

  for (const file of INPUT_FILES) {
    const absolutePath = join(sourceDir, file);
    try {
      if (!statSync(absolutePath).isFile()) continue;
    } catch {
      continue;
    }
    entries.push({ path: file, sha256: sha256(readFileSync(absolutePath)) });
  }

  entries.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const fingerprint = sha256(JSON.stringify(entries));
  return { fingerprint, files: entries };
}

/** Write the build manifest after a successful build (never into `dist/`). */
export function writeBuildManifest({
  sourceDir,
  sourceRevision,
}: { sourceDir?: string; sourceRevision?: string } = {}): {
  manifest: BuildManifest;
  outputPath: string;
} {
  const resolvedSource = sourceDir ?? process.cwd();
  const { fingerprint, files } = computeSourceFingerprint(resolvedSource);
  const manifest: BuildManifest = {
    schemaVersion: BUILD_MANIFEST_SCHEMA_VERSION,
    sourceFingerprint: fingerprint,
    sourceRevision: sourceRevision ?? process.env.GITHUB_SHA ?? 'local',
    builtAt: new Date().toISOString(),
    inputCount: files.length,
  };
  const outputPath = join(resolvedSource, BUILD_MANIFEST_RELATIVE_PATH);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return { manifest, outputPath };
}
