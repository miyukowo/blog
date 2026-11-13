/**
 * Site-owned URL identity policy (Task 2).
 *
 * Public URLs are defined by the file system layout under
 * `src/content/<collection>/<locale>/**`. This module owns the two local
 * policies that upstream does not share:
 *
 * 1. `contentSlug()` normalizes an Astro content ID into the post/translation
 *    identity used by this blog: strip an explicitly recognized locale
 *    prefix, strip a `.md`/`.mdx` suffix, and strip a *terminal* `/index`.
 *    Folder-based posts therefore stay at `/posts/name/` and
 *    `/vi/posts/name/`, never `/posts/name/index/`.
 * 2. `legacyTaxonomySlug()` keeps the ASCII taxonomy slugs that are already
 *    published (notably `/vi/categories/huong-dan/`). Upstream's newer
 *    Unicode-preserving `src/utils/slugify.ts` must stay meaningful for its
 *    own tests, but it must not silently rename existing routes.
 *
 * This module is intentionally dependency-free (no Astro, no `import.meta`)
 * so it can be unit-tested with plain `node --test tests/site/urls.test.mjs`.
 */

import { stripTerminalIndex } from './content-identity.ts';
import { siteLocales, type SiteLocale } from './locales.ts';

/** Split a content ID into non-empty path segments. */
function splitId(id: string): string[] {
  return id.split(/[\\/]+/).filter((segment) => segment.length > 0);
}

/**
 * Strip an explicitly recognized locale prefix from a content ID.
 * Unknown first segments (e.g. `fr/...` when only EN/VI are configured)
 * are preserved so a misconfigured locale folder cannot silently move a
 * published URL.
 */
export function stripLocalePrefix(id: string, locales: readonly string[] = siteLocales): string {
  const segments = splitId(id);
  if (segments.length > 0 && locales.includes(segments[0]!)) {
    segments.shift();
  }
  return segments.join('/');
}

/**
 * Normalize a content ID to this blog's post/translation identity.
 *
 *   en/foo/index.mdx        -> foo
 *   en/nested/index/index.md -> nested/index
 *   fr/foo.md               -> fr/foo        (unrecognized prefix preserved)
 *
 * The function accepts both raw filesystem-style ids (with a `.md`/`.mdx`
 * suffix) and Astro loader ids (already extensionless and loader-normalized).
 * Only a *terminal* `index` segment of a raw filesystem id is removed: the
 * configured glob loader already removed its own terminal `index`, so an
 * extensionless id such as `en/nested/index` keeps that internal segment.
 */
export function contentSlug(id: string, locales: readonly string[] = siteLocales): string {
  const stripped = stripLocalePrefix(id, locales);
  const wasFilesystemId = /\.(md|mdx)$/i.test(stripped);
  const withoutExtension = stripped.replace(/\.(md|mdx)$/i, '');
  return wasFilesystemId ? stripTerminalIndex(withoutExtension) : withoutExtension;
}

/**
 * Legacy ASCII taxonomy slug used by the currently published taxonomy URLs.
 * This deliberately mirrors the pre-migration algorithm (NFKD fold + remove
 * combining marks). It is NOT a general slugify replacement: upstream's
 * Unicode `src/utils/slugify.ts` stays untouched and its tests stay
 * meaningful.
 */
export function legacyTaxonomySlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface PostIdentityOptions {
  /** Astro content collection id, e.g. `en/my-post/index.mdx`. */
  id: string;
  /** Optional CMS-saved `postSlug` frontmatter value. */
  postSlug?: string | undefined;
  /** Optional explicit `translationKey` frontmatter value. */
  translationKey?: string | undefined;
  /** Recognized locales; defaults to the configured site locales. */
  locales?: readonly string[];
}

export interface PostIdentity {
  /** Filesystem-derived public slug — always the URL authority. */
  slug: string;
  /** Explicit translation key when present, else the normalized content id. */
  translationKey: string;
  /**
   * True when the saved CMS `postSlug` disagrees with the filesystem-derived
   * slug. Callers must report this instead of silently moving the post.
   */
  postSlugMismatch: boolean;
  /** The saved `postSlug` that disagrees, when `postSlugMismatch` is true. */
  savedPostSlug?: string;
}

/**
 * Resolve post identity from filesystem id + optional CMS fields.
 * The file location always wins; an explicit `translationKey` is preserved.
 */
export function resolvePostIdentity({
  id,
  postSlug,
  translationKey,
  locales = siteLocales,
}: PostIdentityOptions): PostIdentity {
  const slug = contentSlug(id, locales);
  const saved = postSlug?.trim();
  const mismatch = Boolean(saved) && saved !== slug;
  const identity: PostIdentity = {
    slug,
    translationKey: translationKey?.trim() || slug,
    postSlugMismatch: mismatch,
  };
  if (mismatch && saved) identity.savedPostSlug = saved;
  return identity;
}

/** The site locale that owns a content ID (defaults to the first locale). */
export function localeFromContentId(
  id: string,
  locales: readonly string[] = siteLocales,
): SiteLocale | undefined {
  const first = splitId(id)[0];
  if (!first) return undefined;
  return locales.includes(first) ? (first as SiteLocale) : undefined;
}
