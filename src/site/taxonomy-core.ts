/**
 * Pure taxonomy destination policy (Task 2).
 *
 * `src/site/taxonomy.ts` gathers Astro content; this module decides which
 * destination each locale should link to. Keeping the decision pure makes
 * the fallback behavior unit-testable with plain `node --test`.
 *
 * Resolution order per target locale:
 * 1. The same slug already exists in that locale (exact counterpart).
 * 2. The counterpart of the translated sibling post(s), picked by the most
 *    shared posts, ties broken alphabetically.
 * 3. The target locale's taxonomy index page — never a fabricated 404.
 */

import { siteLocales, type SiteLocale } from './locales.ts';

export type TaxonomyKind = 'categories' | 'tags';

/** Path builders injected by the Astro-side wrapper. */
export interface TaxonomyPaths {
  /** Destination locale's taxonomy index (e.g. `/categories/`). */
  // eslint-disable-next-line no-unused-vars -- declaration parameter names
  index: (locale: SiteLocale) => string;
  /** Destination locale's concrete taxonomy page (e.g. `/categories/guide/`). */
  // eslint-disable-next-line no-unused-vars -- declaration parameter names
  entry: (locale: SiteLocale, name: string) => string;
}

/** Candidate data gathered from the content collections. */
export interface TaxonomyCandidates {
  kind: TaxonomyKind;
  currentLocale: SiteLocale;
  /** Display name of the current taxonomy entry. */
  currentName: string;
  /** Display name of an identical-slug entry per locale, when one exists. */
  exactSlug: Partial<Record<SiteLocale, string>>;
  /**
   * Counterpart names contributed by translated sibling posts, as
   * `[name, weight]` pairs per locale.
   */
  translatedCounts: Partial<Record<SiteLocale, Array<[string, number]>>>;
}

/**
 * Pick the most frequent counterpart, ties broken alphabetically (stable,
 * deterministic output for fixtures and builds).
 */
export function pickBestCounterpart(pairs: ReadonlyArray<[string, number]>): string | undefined {
  if (pairs.length === 0) return undefined;
  return [...pairs].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
}

/**
 * Resolve a server-renderable destination URL for every configured locale.
 * The current locale always links to its own concrete page.
 */
export function decideTaxonomyDestinations(
  candidates: TaxonomyCandidates,
  paths: TaxonomyPaths,
  locales: readonly SiteLocale[] = siteLocales,
): Record<SiteLocale, string> {
  const out = {} as Record<SiteLocale, string>;

  for (const locale of locales) {
    if (locale === candidates.currentLocale) {
      out[locale] = paths.entry(locale, candidates.currentName);
      continue;
    }
    const exact = candidates.exactSlug[locale];
    if (exact) {
      out[locale] = paths.entry(locale, exact);
      continue;
    }
    const best = pickBestCounterpart(candidates.translatedCounts[locale] ?? []);
    out[locale] = best ? paths.entry(locale, best) : paths.index(locale);
  }

  return out;
}
