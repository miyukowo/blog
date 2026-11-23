/**
 * Site-owned translated taxonomy destinations (Task 2).
 *
 * Category/tag routes used to resolve translated links inside
 * `src/utils/posts.ts`. They now live here so the upstream post helper can
 * stay close to upstream while this blog keeps its translated taxonomy
 * behavior. The decision itself is pure (`taxonomy-core.ts`); this module
 * only gathers the content data and wires the real Astro path builders.
 */

import { withBase } from '../i18n/utils';
import {
  categoryPath,
  getCategoriesWithCount,
  getPosts,
  getTagsWithCount,
  getTranslations,
  tagPath,
  type Post,
} from '../utils/posts';
import { siteLocales, type SiteLocale } from './locales';
import {
  decideTaxonomyDestinations,
  type TaxonomyCandidates,
  type TaxonomyKind,
} from './taxonomy-core';
import { legacyTaxonomySlug } from './urls';

type LocaleMap = Record<SiteLocale, string>;

/** Build the Astro path builders for a taxonomy kind. */
function pathsFor(kind: TaxonomyKind) {
  return {
    index: (locale: SiteLocale): string => {
      const path = locale === 'en' ? `/${kind}/` : `/${locale}/${kind}/`;
      return withBase(path);
    },
    entry: (locale: SiteLocale, name: string): string =>
      kind === 'categories' ? categoryPath(locale, name) : tagPath(locale, name),
  };
}

/** Counterpart contributions of translated sibling posts for a taxonomy entry. */
async function translatedCounts(
  kind: TaxonomyKind,
  currentPosts: readonly Post[],
  targetLocale: SiteLocale,
): Promise<Array<[string, number]>> {
  const counts = new Map<string, number>();
  for (const post of currentPosts) {
    const translations = await getTranslations(post);
    const translated = translations[targetLocale];
    if (!translated) continue;
    const names = kind === 'categories' ? translated.data.categories : translated.data.tags;
    for (const name of names ?? []) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts.entries()];
}

/** Posts in a locale whose taxonomy entries slugify to the current slug. */
async function filterPostsByTaxonomy(
  kind: TaxonomyKind,
  locale: SiteLocale,
  slug: string,
): Promise<Post[]> {
  const posts = await getPosts(locale);
  return posts.filter((post) => {
    const names = kind === 'categories' ? (post.data.categories ?? []) : (post.data.tags ?? []);
    return names.some((name) => legacyTaxonomySlug(name) === slug);
  });
}

async function resolve(
  kind: TaxonomyKind,
  currentLocale: SiteLocale,
  currentName: string,
): Promise<LocaleMap> {
  const currentSlug = legacyTaxonomySlug(currentName);

  const candidates: TaxonomyCandidates = {
    kind,
    currentLocale,
    currentName,
    exactSlug: {},
    translatedCounts: {},
  };

  const currentPosts = await filterPostsByTaxonomy(kind, currentLocale, currentSlug);

  for (const targetLocale of siteLocales) {
    if (targetLocale === currentLocale) continue;

    // 1. Identical slug in the target locale.
    const entries =
      kind === 'categories'
        ? await getCategoriesWithCount(targetLocale)
        : await getTagsWithCount(targetLocale);
    const exact = entries.find((entry) => legacyTaxonomySlug(entry.name) === currentSlug);
    if (exact) candidates.exactSlug[targetLocale] = exact.name;

    // 2. Translated sibling posts.
    candidates.translatedCounts[targetLocale] = await translatedCounts(
      kind,
      currentPosts,
      targetLocale,
    );
  }

  return decideTaxonomyDestinations(candidates, pathsFor(kind));
}

/** Resolve translated destinations for a category page. */
export function getCategoryTranslations(
  currentLocale: SiteLocale,
  currentCategory: string,
): Promise<LocaleMap> {
  return resolve('categories', currentLocale, currentCategory);
}

/** Resolve translated destinations for a tag page. */
export function getTagTranslations(
  currentLocale: SiteLocale,
  currentTag: string,
): Promise<LocaleMap> {
  return resolve('tags', currentLocale, currentTag);
}
