/**
 * Content-entry identity policy shared by the Astro glob loader, the sitemap
 * scanner and the publishing expectations (review follow-up Task 1).
 *
 * The locked Astro 7.1.6 glob loader derives an entry id from the relative
 * filename: it strips the extension, normalizes every path segment through
 * `github-slugger` (lowercase, punctuation removed, spaces -> `-`) and drops
 * a terminal `/index`. The 2026-11-13 review found the sitemap scanner using
 * the raw filename instead, so an unlisted `en/Review Hidden.md` emitted a
 * `/posts/review-hidden/` route while the exclusion set held the raw mixed-case
 * identity.
 *
 * Rather than approximate that normalization in two places, the content
 * configuration installs `contentEntryId()` as the loader's `generateId` and
 * every other consumer (sitemap scan, expectations) imports the same function.
 * The implementation mirrors `github-slugger`'s published behavior for the
 * characters used in filenames: Unicode letters/numbers, `_` and `-` are kept,
 * runs of spaces become `-`, everything else is removed. It is deliberately
 * dependency-free so the Astro config and plain Node scripts can both use it.
 */

const MARKDOWN_EXTENSION = /\.(?:md|mdx)$/i;

/**
 * Normalize one filename/path segment to its public identity.
 *
 *   'Review Hidden' -> 'review-hidden'
 *   'hướng-dẫn'     -> 'hướng-dẫn'
 *   'a.b_c'         -> 'ab_c'
 *   '100% real'     -> '100-real'
 */
export function normalizeIdentitySegment(segment: string): string {
  return segment
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_\- ]/gu, '')
    .replace(/ /g, '-');
}

/** Remove a terminal `index` segment (case-insensitive) from an entry id. */
export function stripTerminalIndex(id: string): string {
  return id.replace(/(^|\/)index$/i, '');
}

/**
 * Derive the entry id for a content file relative to its collection base.
 *
 * Astro calls this with paths such as `en/Review Hidden.md` (relative to
 * `src/content/posts`). The returned id keeps the locale directory so page
 * helpers can derive the locale, exactly as the loader does.
 */
export function loaderEntryId(relativePath: string): string {
  const withoutExtension = relativePath.replace(MARKDOWN_EXTENSION, '');
  const normalized = withoutExtension
    .split(/[\\/]+/)
    .filter((segment) => segment.length > 0)
    .map((segment) => normalizeIdentitySegment(segment))
    .join('/');
  return stripTerminalIndex(normalized);
}

export interface ContentEntryIdentityOptions {
  /** Filename relative to the collection base, e.g. `en/Review Hidden.md`. */
  relativePath: string;
  /**
   * Explicit frontmatter `slug`, when present. Astro's loader uses it
   * verbatim (the file location no longer defines the id), so we do too.
   */
  slug?: string | undefined;
}

/**
 * Resolve the final content-entry id using the loader's precedence:
 * an explicit frontmatter `slug` wins verbatim, otherwise the normalized
 * relative filename is used.
 */
export function contentEntryIdentity({ relativePath, slug }: ContentEntryIdentityOptions): {
  id: string;
} {
  const explicit = typeof slug === 'string' ? slug : '';
  return { id: explicit.length > 0 ? explicit : loaderEntryId(relativePath) };
}
