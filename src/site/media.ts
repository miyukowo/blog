/**
 * Site-owned media URL policy (Task 4).
 *
 * This blog publishes Cloudinary uploads through its own optimized CDN path.
 * The transition is:
 *
 *   https://res.cloudinary.com/tvphus/image/upload/<optional transforms>/<public-id>
 *     -> https://cdn.tvphus.dev/image/optimized/<public-id>
 *
 * `resolveMediaUrl` is the single, pure, idempotent implementation shared by
 * the Markdown/Sätteri image hook and the hero/card/OG/component call sites.
 *
 * Deliberately NOT normalized:
 *  - unrelated HTTPS hosts (preserved verbatim),
 *  - already-optimized CDN URLs (idempotent / no double transform),
 *  - root-relative public paths and local/imported assets,
 *  - bare filenames (a bare filename is not assumed to be a Cloudinary id).
 */

export const CDN_BASE = 'https://cdn.tvphus.dev';
export const CLOUDINARY_UPLOAD_BASE = 'https://res.cloudinary.com/tvphus/image/upload/';

/** Prefix applied to the public id on the optimized CDN path. */
const CDN_OPTIMIZED_PREFIX = `${CDN_BASE}/image/optimized/`;

/**
 * Strip a leading Cloudinary transformation prefix (e.g. `f_auto,q_auto/`).
 *
 * The CDN worker re-applies its own transformations, so leaving the original
 * prefix in place would produce duplicated segments like
 * `f_auto,q_auto/f_auto,q_auto/...`. Only complete leading segments that look
 * like `name_value` pairs are removed; version segments (`v123...`) and
 * folders are preserved.
 */
function stripTransformPrefix(pathAfterUpload: string): string {
  return pathAfterUpload.replace(/^(?:[a-z]+_[^/,]+(?:,[a-z]+_[^/,]+)*\/)+/, '');
}

/** Split a URL into its path and its query/hash suffix (both preserved). */
function splitSuffix(src: string): { path: string; suffix: string } {
  const match = /([?#].*)$/.exec(src);
  if (!match) return { path: src, suffix: '' };
  return { path: src.slice(0, match.index), suffix: match[1] as string };
}

/**
 * Normalize a Cloudinary upload URL to this site's optimized CDN path.
 *
 * Pure and idempotent: calling it twice returns the same value, and it never
 * rewrites unrelated URLs, root paths, relative assets or bare filenames.
 */
export function resolveMediaUrl(src: string): string {
  if (typeof src !== 'string' || src.length === 0) return src;

  // Already our CDN path: never double-transform.
  if (src === CDN_BASE || src.startsWith(`${CDN_BASE}/`)) return src;

  if (!src.startsWith(CLOUDINARY_UPLOAD_BASE)) {
    // http(s) URLs on other hosts, root paths and relative assets are
    // preserved verbatim. A bare filename is intentionally left alone.
    return src;
  }

  const { path, suffix } = splitSuffix(src);
  const pathAfterUpload = path.slice(CLOUDINARY_UPLOAD_BASE.length);
  if (!pathAfterUpload) return src;

  const publicId = stripTransformPrefix(pathAfterUpload);
  if (!publicId) return src;

  return `${CDN_OPTIMIZED_PREFIX}${publicId}${suffix}`;
}

/**
 * Backwards-compatible alias for call sites that used the old helper name.
 * New code should import `resolveMediaUrl`.
 */
export const cdnUrl = resolveMediaUrl;
