/**
 * Site-owned sitemap identity policy (review repair Task 3).
 *
 * Upstream's sitemap filter matched unlisted posts with `page.includes(seg)`,
 * which is not an identity comparison:
 *
 *   - an unlisted `/posts/review-unlisted/` also hid the listed
 *     `/posts/review-unlisted-extra/` (prefix collision), and
 *   - it hid the listed `/vi/posts/review-unlisted/` in the other locale
 *     because both paths contain `posts/review-unlisted`.
 *
 * This module normalizes a sitemap URL to a locale-qualified pathname and
 * compares complete identities instead. The configured base is part of the
 * identity (sitemap output already includes it); trailing slashes, query/hash
 * fragments and percent-encoding are normalized so sitemap output and the
 * content-derived route agree. Percent-encoded non-ASCII slugs decode to the
 * same identity as the filesystem-derived route, while nested segment
 * boundaries stay meaningful.
 *
 * Dependency-free so it can be unit-tested and imported by `astro.config.mjs`.
 */

/** Remove `/` padding so a base can be embedded in a pathname. */
function trimBase(base: string): string {
  return base.replace(/^\/+|\/+$/g, '');
}

/**
 * Normalize a sitemap URL or pathname to a comparable pathname:
 *
 *   https://example.com/blog/posts/a/?x=1  -> /blog/posts/a
 *   /blog/posts/a//                        -> /blog/posts/a
 *   /blog/posts/%C3%AA/                    -> /blog/posts/ê
 *   https://example.com/                   -> /
 *
 * Absolute origins, query strings and hash fragments are dropped. Malformed
 * percent-encoding is left as-is instead of throwing (the route simply will
 * not match, which fails closed for sitemap exclusion).
 */
export function normalizeSitemapPathname(input: string): string {
  let path = String(input).trim();
  const origin = /^[a-z][a-z\d+.-]*:\/\/[^/]+/i.exec(path);
  if (origin) path = path.slice(origin[0].length);
  path = path.split(/[?#]/, 1)[0] ?? '';
  if (!path.startsWith('/')) path = `/${path}`;
  try {
    path = decodeURI(path);
  } catch {
    // Keep the original path; an invalid encoding cannot be a real route.
  }
  path = path.replace(/\/{2,}/g, '/');
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path || '/';
}

export interface SitemapRouteOptions {
  locale: string;
  defaultLocale: string;
  slug: string;
  /** Astro `base` value: `/`, `/blog`, etc. */
  base?: string;
}

/**
 * Build the locale-qualified sitemap pathname for a post route, including the
 * configured base. EN stays unprefixed; other locales get their prefix.
 */
export function sitemapPostPathname({
  locale,
  defaultLocale,
  slug,
  base = '/',
}: SitemapRouteOptions): string {
  const basePrefix = trimBase(base);
  const localePrefix = locale === defaultLocale ? '' : `/${locale}`;
  return normalizeSitemapPathname(`${basePrefix}${localePrefix}/posts/${slug}/`);
}

/**
 * Build an exact matcher for a set of unlisted sitemap pathnames. The returned
 * predicate is true only for the complete normalized identities it was given.
 */
export function createUnlistedSitemapMatcher(pathnames: Iterable<string>) {
  const identities = new Set([...pathnames].map((pathname) => normalizeSitemapPathname(pathname)));
  return (pageUrl: string) => identities.has(normalizeSitemapPathname(pageUrl));
}
