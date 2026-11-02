/**
 * Post helpers.
 *
 * Wraps the `astro:content` collection API to:
 *  - filter drafts in production
 *  - infer locale from filesystem path (posts/en/foo -> 'en')
 *  - sort by pubDate desc, with pinned posts first
 *  - group posts by tag / category / month
 *  - resolve translation siblings via `translationKey`
 */

/* global console */
import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

import { SITE, type Locale } from '../config';
import { withBase } from '../i18n/utils';
import { localePresentation } from '../site/locales';
import { resolveMediaUrl } from '../site/media';
import {
  contentSlug,
  legacyTaxonomySlug,
  localeFromContentId,
  resolvePostIdentity,
} from '../site/urls';

export type Post = CollectionEntry<'posts'> & {
  data: CollectionEntry<'posts'>['data'] & { lang: Locale; translationKey: string };
};

const isProd = import.meta.env.PROD;
const skipPostCollections = import.meta.env.CI_SKIP_CONTENT_COLLECTIONS === 'true';

/** Derive the locale from `posts/<locale>/foo` slug-ish ID. */
function localeFromId(id: string): Locale {
  return localeFromContentId(id, SITE.locales) ?? SITE.defaultLocale;
}

/**
 * Report (once) a saved CMS `postSlug` that disagrees with the file-system
 * location. The file wins; the mismatch is surfaced rather than silently
 * moving a published post.
 */
const reportedPostSlugMismatches = new Set<string>();
function reportPostSlugMismatch(id: string, saved: string | undefined, slug: string): void {
  const key = `${id}:${saved}`;
  if (reportedPostSlugMismatches.has(key)) return;
  reportedPostSlugMismatches.add(key);
  console.warn(
    `[posts] postSlug mismatch in "${id}": saved "${saved}" does not match the file-system slug "${slug}". The file location defines the URL; update the CMS field to match.`,
  );
}

/** Normalize a post entry: ensure `lang` and `translationKey` are set. */
function normalize(entry: CollectionEntry<'posts'>): Post {
  const lang = entry.data.lang ?? localeFromId(entry.id);
  const identity = resolvePostIdentity({
    id: entry.id,
    postSlug: entry.data.postSlug,
    translationKey: entry.data.translationKey,
    locales: SITE.locales,
  });
  if (identity.postSlugMismatch) {
    reportPostSlugMismatch(entry.id, identity.savedPostSlug, identity.slug);
  }
  return {
    ...entry,
    data: { ...entry.data, lang, translationKey: identity.translationKey },
  } as Post;
}

/** Public slug used for the URL: file-system identity, never `/index`. */
export function postSlug(entry: Post): string {
  return contentSlug(entry.id, SITE.locales);
}

/** Full localized URL path for a post. */
export function postPath(entry: Post): string {
  const slug = postSlug(entry);
  const path =
    entry.data.lang === SITE.defaultLocale
      ? `/posts/${slug}/`
      : `/${entry.data.lang}/posts/${slug}/`;
  return withBase(path);
}

/** Sort posts: pinned first, then by pubDate desc. */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    if (a.data.pinned !== b.data.pinned) return a.data.pinned ? -1 : 1;
    const at = a.data.pubDate?.valueOf?.() ?? 0;
    const bt = b.data.pubDate?.valueOf?.() ?? 0;
    return bt - at;
  });
}

/**
 * Sort posts strictly by `pubDate` (newest first), ignoring `pinned`.
 *
 * Used for prev/next post navigation: pinned posts shouldn't yank the
 * latest entry to position 0 and break the chronological chain (which
 * would label a newer post as "Previous" of an older pinned post).
 */
export function sortPostsByDate(posts: Post[]): Post[] {
  return [...posts].sort((a, b) => {
    const at = a.data.pubDate?.valueOf?.() ?? 0;
    const bt = b.data.pubDate?.valueOf?.() ?? 0;
    return bt - at;
  });
}

/** Get all posts for a locale (drafts + unlisted hidden in prod, sorted). */
export async function getPosts(locale: Locale): Promise<Post[]> {
  if (skipPostCollections) return [];
  const all = await getCollection('posts', (entry) => {
    if (isProd && entry.data.draft) return false;
    if (entry.data.unlisted) return false;
    const lang = entry.data.lang ?? localeFromId(entry.id);
    return lang === locale;
  });
  return sortPosts(all.map(normalize));
}

/**
 * Get unlisted posts for a locale (used only in `getStaticPaths` so
 * their URLs are still generated and accessible by direct link).
 * Drafts are still excluded in production.
 */
export async function getUnlistedPosts(locale: Locale): Promise<Post[]> {
  if (skipPostCollections) return [];
  const all = await getCollection('posts', (entry) => {
    if (isProd && entry.data.draft) return false;
    if (!entry.data.unlisted) return false;
    const lang = entry.data.lang ?? localeFromId(entry.id);
    return lang === locale;
  });
  return sortPosts(all.map(normalize));
}

/** Find a single post by locale + slug (path-relative). */
export async function getPostBySlug(locale: Locale, slug: string): Promise<Post | undefined> {
  const posts = await getPosts(locale);
  return posts.find((p) => postSlug(p) === slug);
}

/** All translation siblings of a post (other locales sharing translationKey). */
export async function getTranslations(entry: Post): Promise<Record<Locale, Post | undefined>> {
  const out: Partial<Record<Locale, Post | undefined>> = {};
  for (const locale of SITE.locales) {
    if (locale === entry.data.lang) {
      out[locale] = entry;
      continue;
    }
    const all = await getPosts(locale);
    out[locale] = all.find((p) => p.data.translationKey === entry.data.translationKey);
  }
  return out as Record<Locale, Post | undefined>;
}

/** Tags for a locale, with counts, sorted by count desc then alpha. */
export async function getTagsWithCount(
  locale: Locale,
): Promise<Array<{ name: string; count: number }>> {
  const posts = await getPosts(locale);
  const map = new Map<string, number>();
  for (const p of posts) {
    for (const t of p.data.tags) map.set(t, (map.get(t) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Categories for a locale, with counts. */
export async function getCategoriesWithCount(
  locale: Locale,
): Promise<Array<{ name: string; count: number }>> {
  const posts = await getPosts(locale);
  const map = new Map<string, number>();
  for (const p of posts) {
    for (const c of p.data.categories) map.set(c, (map.get(c) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Group posts by year -> month for the archives page. */
export function groupByYearMonth(
  posts: Post[],
  locale: Locale,
): Array<{
  year: number;
  months: Array<{ month: number; label: string; posts: Post[] }>;
}> {
  const buckets = new Map<number, Map<number, Post[]>>();
  for (const post of posts) {
    const date = post.data.pubDate;
    if (!date) continue;
    const y = date.getFullYear();
    const m = date.getMonth();
    if (!buckets.has(y)) buckets.set(y, new Map());
    const months = buckets.get(y)!;
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(post);
  }
  const fmt = new Intl.DateTimeFormat(localePresentation[locale].dateLocale, { month: 'long' });
  return Array.from(buckets.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: Array.from(months.entries())
        .sort((a, b) => b[0] - a[0])
        .map(([month, list]) => ({
          month,
          label: fmt.format(new Date(year, month, 1)),
          posts: list,
        })),
    }));
}

/**
 * Resolve whether a post should display its featured (hero) image,
 * considering the per-post override (`showFeaturedImage`) and the
 * site-wide default (`SITE.showFeaturedImages`).
 *
 * Returns `false` when there is no `heroImage` to show.
 */
export function shouldShowHero(post: Post): boolean {
  if (!post.data.heroImage) return false;
  return post.data.showFeaturedImage ?? SITE.showFeaturedImages;
}

/** The hero image source URL/path for a post (or undefined). */
export function heroImageSrc(post: Post): string | undefined {
  const img = post.data.heroImage;
  if (!img) return undefined;
  let src: string | undefined;
  if (typeof img === 'string') src = img;
  else if (typeof img === 'object' && 'src' in (img as Record<string, unknown>)) {
    src = (img as { src: string }).src;
  }
  if (!src) return undefined;
  if (src.startsWith('/') && !src.startsWith('//')) return withBase(src);
  // Cloudinary upload URL → this site's optimized CDN path (shared policy).
  return resolveMediaUrl(src);
}

/**
 * The raw hero image, suitable for passing straight to `<SmartImage>`.
 * Preserves the `ImageMetadata` shape (so the image pipeline can use
 * intrinsic dimensions) for assets imported via the `image()` schema,
 * and prefixes `withBase()` only on plain `/public/...` strings.
 */
export function heroImage(post: Post): ImageMetadata | string | undefined {
  const img = post.data.heroImage;
  if (!img) return undefined;
  if (typeof img === 'string') {
    if (img.startsWith('/') && !img.startsWith('//')) return withBase(img);
    // Cloudinary upload URL → CDN URL so SmartImage can optimize it.
    return resolveMediaUrl(img);
  }
  return img as ImageMetadata;
}

/**
 * Slugify a tag/category for use in URLs.
 *
 * Kept as the public helper name for existing callers, but delegated to the
 * site-owned legacy taxonomy policy so published taxonomy URLs such as
 * `/vi/categories/huong-dan/` never change. Upstream's Unicode slug utility
 * remains authoritative for its own tests.
 */
// Upstream's Unicode slug utility stays exported/meaningful for its own tests;
// this blog's published taxonomy URLs use the legacy policy below.
export { slugify } from './slugify';

/** Build the URL for a tag listing page in a given locale. */
export function tagPath(locale: Locale, tag: string): string {
  const slug = legacyTaxonomySlug(tag);
  const path = locale === SITE.defaultLocale ? `/tags/${slug}/` : `/${locale}/tags/${slug}/`;
  return withBase(path);
}

/** Build the URL for a category listing page in a given locale. */
export function categoryPath(locale: Locale, category: string): string {
  const slug = legacyTaxonomySlug(category);
  const path =
    locale === SITE.defaultLocale ? `/categories/${slug}/` : `/${locale}/categories/${slug}/`;
  return withBase(path);
}
