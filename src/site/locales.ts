/**
 * Site-owned locale policy (Task 2).
 *
 * The upstream theme is bilingual EN/FR by default. This blog is EN/VI, so
 * the supported locale tuple and the presentation metadata that used to be
 * scattered as `locale === 'vi'` checks live here instead.
 *
 * Keep every consumer (HTML lang, date formatting, OG locale, RSS language,
 * Giscus language) importing these values rather than hard-coding strings.
 * `siteLocales` is a `const` tuple so `SiteLocale` stays a literal union.
 */

export const siteLocales = ['en', 'vi'] as const;

export type SiteLocale = (typeof siteLocales)[number];

export interface LocalePresentation {
  /** Human label for the language switcher. */
  label: string;
  /** Locale passed to `Intl.DateTimeFormat` for date rendering. */
  dateLocale: string;
  /** BCP 47 tag for `<html lang>`. */
  htmlLang: string;
  /** Facebook/Open Graph locale (underscored form). */
  ogLocale: string;
  /** Language code advertised by the RSS feed. */
  rssLanguage: string;
  /** Giscus `data-lang` value. */
  giscusLang: string;
}

/**
 * Presentation metadata for each supported locale.
 *
 * The exact values are part of the measured public contract:
 *  - EN: en-US / en_US / en-us / en
 *  - VI: vi-VN / vi_VN / vi-vn / vi
 *
 * The VI RSS language is the one intentional baseline defect correction
 * (`vi-vn` instead of the previously emitted `en-us`).
 */
export const localePresentation: Record<SiteLocale, LocalePresentation> = {
  en: {
    label: 'English',
    dateLocale: 'en-US',
    htmlLang: 'en-US',
    ogLocale: 'en_US',
    rssLanguage: 'en-us',
    giscusLang: 'en',
  },
  vi: {
    label: 'Tiếng Việt',
    dateLocale: 'vi-VN',
    htmlLang: 'vi-VN',
    ogLocale: 'vi_VN',
    rssLanguage: 'vi-vn',
    giscusLang: 'vi',
  },
};

/** Type guard for an arbitrary string being a supported site locale. */
export function isSiteLocale(value: string): value is SiteLocale {
  return (siteLocales as readonly string[]).includes(value);
}
