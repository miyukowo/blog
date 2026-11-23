/* global URL */
import { SITE, type Locale } from '../config';
import { alternates, withBase } from '../i18n/utils';

export interface SeoMeta {
  title: string;
  description: string;
  canonical: string;
  ogImage: string;
  type: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  tags?: string[];
  locale: Locale;
  hreflangs: ReturnType<typeof alternates>;
  /**
   * When `true`, the SEO component emits
   * `<meta name="robots" content="noindex, nofollow">`.
   * Set automatically for unlisted posts/pages when
   * `unlistedHideFromSeo` is `true` (the default).
   */
  noindex?: boolean;
}

interface BuildSeoArgs {
  title?: string;
  description?: string;
  pathWithoutLocale: string;
  fullPath: string;
  locale: Locale;
  ogImage?: string;
  type?: 'website' | 'article';
  publishedTime?: Date;
  modifiedTime?: Date;
  tags?: string[];
  /**
   * Restrict hreflang alternates to a subset of locales. Used on post
   * pages where a translation may be missing.
   */
  availableLocales?: readonly Locale[];
  /** Emit `<meta name="robots" content="noindex, nofollow">`. */
  noindex?: boolean;
  /**
   * Explicit translation destination per locale (server-rendered). When
   * provided, hreflang alternates use these real sibling URLs instead of
   * assuming every locale shares the same slug.
   */
  translations?: Partial<Record<Locale, string>>;
}

/**
 * Resolve hreflang alternates.
 *
 * When explicit translations are supplied (post pages with different EN/VI
 * slugs, translated taxonomy destinations) use those actual sibling URLs.
 * Otherwise fall back to the shared-logical-path behavior.
 */
function resolveHreflangs(args: BuildSeoArgs): SeoMeta['hreflangs'] {
  if (!args.translations) {
    return alternates(args.pathWithoutLocale, args.availableLocales);
  }
  const locales = (args.availableLocales ?? SITE.locales).filter(
    (locale) => args.translations?.[locale],
  );
  const list: ReturnType<typeof alternates> = locales.map((locale) => ({
    locale,
    href: new URL(args.translations?.[locale] as string, SITE.url).toString(),
  }));
  if (locales.includes(SITE.defaultLocale)) {
    list.push({
      locale: 'x-default',
      href: new URL(args.translations[SITE.defaultLocale] as string, SITE.url).toString(),
    });
  }
  return list;
}

/** Build the SEO data block consumed by `<SEO />`. */
export function buildSeo(args: BuildSeoArgs): SeoMeta {
  return {
    title: args.title && args.title !== SITE.title ? `${args.title} — ${SITE.title}` : SITE.title,
    description: args.description ?? SITE.description,
    canonical: new URL(args.fullPath, SITE.url).toString(),
    ogImage: new URL(withBase(args.ogImage ?? SITE.defaultOgImage), SITE.url).toString(),
    type: args.type ?? 'website',
    publishedTime: args.publishedTime?.toISOString(),
    modifiedTime: args.modifiedTime?.toISOString(),
    tags: args.tags,
    locale: args.locale,
    hreflangs: resolveHreflangs(args),
    noindex: args.noindex,
  };
}
