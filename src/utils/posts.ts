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

import { getCollection, type CollectionEntry } from 'astro:content';
import type { ImageMetadata } from 'astro';

import { SITE, type Locale } from '../config';
import { withBase } from '../i18n/utils';

export type Post = CollectionEntry<'posts'> & {
  data: CollectionEntry<'posts'>['data'] & { lang: Locale; translationKey: string };
};

const isProd = import.meta.env.PROD;
const skipPostCollections = import.meta.env.CI_SKIP_CONTENT_COLLECTIONS === 'true';

/** Derive the locale from `posts/<locale>/foo` slug-ish ID. */
function localeFromId(id: string): Locale {
  const seg = id.split(/[\\/]/)[0];
  if (seg && (SITE.locales as readonly string[]).includes(seg)) return seg as Locale;
  return SITE.defaultLocale;
}

/** Strip locale prefix from a content ID. */
function stripLocaleFromId(id: string): string {
  const segs = id.split(/[\\/]/);
  if (segs[0] && (SITE.locales as readonly string[]).includes(segs[0])) {
    return segs.slice(1).join('/');
  }
  return id;
}

/** Normalize a post entry: ensure `lang` and `translationKey` are set. */
function normalize(entry: CollectionEntry<'posts'>): Post {
  const lang = entry.data.lang ?? localeFromId(entry.id);
  const translationKey = entry.data.translationKey ?? stripLocaleFromId(entry.id);
  return {
    ...entry,
    data: { ...entry.data, lang, translationKey },
  } as Post;
}

/** Public slug used for the URL: filename minus locale and extension. */
export function postSlug(entry: Post): string {
  return stripLocaleFromId(entry.id).replace(/\.(md|mdx)$/i, '');
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
  const lang = locale === 'vi' ? 'vi-VN' : 'en-US';
  const fmt = new Intl.DateTimeFormat(lang, { month: 'long' });
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
  // Imported asset (ImageMetadata): unwrap to its public URL.
  else if (typeof img === 'object' && 'src' in (img as Record<string, unknown>)) {
    src = (img as { src: string }).src;
  }
  if (!src) return undefined;
  // Prefix the configured base for absolute paths into /public.
  return src.startsWith('/') && !src.startsWith('//') ? withBase(src) : src;
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
    return img.startsWith('/') && !img.startsWith('//') ? withBase(img) : img;
  }
  return img as ImageMetadata;
}

/** Slugify a tag/category for use in URLs. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Build the URL for a tag listing page in a given locale. */
export function tagPath(locale: Locale, tag: string): string {
  const slug = slugify(tag);
  const path = locale === SITE.defaultLocale ? `/tags/${slug}/` : `/${locale}/tags/${slug}/`;
  return withBase(path);
}

/** Build the URL for a category listing page in a given locale. */
export function categoryPath(locale: Locale, category: string): string {
  const slug = slugify(category);
  const path =
    locale === SITE.defaultLocale ? `/categories/${slug}/` : `/${locale}/categories/${slug}/`;
  return withBase(path);
}

/** Find the corresponding category path in all locales for a category in a given locale. */
export async function getCategoryTranslations(
  currentLocale: Locale,
  currentCategory: string,
): Promise<Record<Locale, string>> {
  const out = {} as Record<Locale, string>;

  // Initialize with fallback (the category list page)
  for (const locale of SITE.locales) {
    const path = locale === SITE.defaultLocale ? '/categories/' : `/${locale}/categories/`;
    out[locale] = withBase(path);
  }

  // Current category path in the current locale is definitely correct
  out[currentLocale] = categoryPath(currentLocale, currentCategory);

  // Find all posts in the current category
  const currentSlug = slugify(currentCategory);
  const posts = (await getPosts(currentLocale)).filter(
    (p) => p.data.categories && p.data.categories.some((c) => slugify(c) === currentSlug)
  );

  for (const targetLocale of SITE.locales) {
    if (targetLocale === currentLocale) continue;

    // 1. Check if there is a category in target locale with exact same slug/name
    const targetCategories = await getCategoriesWithCount(targetLocale);
    const exactMatch = targetCategories.find((c) => slugify(c.name) === currentSlug);
    if (exactMatch) {
      out[targetLocale] = categoryPath(targetLocale, exactMatch.name);
      continue;
    }

    // 2. Try to map via post translations
    const targetCategoryCounts = new Map<string, number>();
    for (const post of posts) {
      const translations = await getTranslations(post);
      const translatedPost = translations[targetLocale];
      if (translatedPost && translatedPost.data.categories) {
        for (const cat of translatedPost.data.categories) {
          targetCategoryCounts.set(cat, (targetCategoryCounts.get(cat) ?? 0) + 1);
        }
      }
    }

    if (targetCategoryCounts.size > 0) {
      let bestCategory = '';
      let maxCount = -1;
      for (const [cat, count] of targetCategoryCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestCategory = cat;
        }
      }
      if (bestCategory) {
        out[targetLocale] = categoryPath(targetLocale, bestCategory);
      }
    }
  }

  return out;
}

/** Find the corresponding tag path in all locales for a tag in a given locale. */
export async function getTagTranslations(
  currentLocale: Locale,
  currentTag: string,
): Promise<Record<Locale, string>> {
  const out = {} as Record<Locale, string>;

  // Initialize with fallback (the tags list page)
  for (const locale of SITE.locales) {
    const path = locale === SITE.defaultLocale ? '/tags/' : `/${locale}/tags/`;
    out[locale] = withBase(path);
  }

  // Current tag path in the current locale is definitely correct
  out[currentLocale] = tagPath(currentLocale, currentTag);

  // Find all posts with the current tag
  const currentSlug = slugify(currentTag);
  const posts = (await getPosts(currentLocale)).filter(
    (p) => p.data.tags && p.data.tags.some((t) => slugify(t) === currentSlug)
  );

  for (const targetLocale of SITE.locales) {
    if (targetLocale === currentLocale) continue;

    // 1. Check if there is a tag in target locale with exact same slug/name
    const targetTags = await getTagsWithCount(targetLocale);
    const exactMatch = targetTags.find((t) => slugify(t.name) === currentSlug);
    if (exactMatch) {
      out[targetLocale] = tagPath(targetLocale, exactMatch.name);
      continue;
    }

    // 2. Try to map via post translations
    const targetTagCounts = new Map<string, number>();
    for (const post of posts) {
      const translations = await getTranslations(post);
      const translatedPost = translations[targetLocale];
      if (translatedPost && translatedPost.data.tags) {
        for (const tg of translatedPost.data.tags) {
          targetTagCounts.set(tg, (targetTagCounts.get(tg) ?? 0) + 1);
        }
      }
    }

    if (targetTagCounts.size > 0) {
      let bestTag = '';
      let maxCount = -1;
      for (const [tg, count] of targetTagCounts.entries()) {
        if (count > maxCount) {
          maxCount = count;
          bestTag = tg;
        }
      }
      if (bestTag) {
        out[targetLocale] = tagPath(targetLocale, bestTag);
      }
    }
  }

  return out;
}

