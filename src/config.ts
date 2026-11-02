import avatarImg from './assets/images/site/avatar.png';
import type { SiteConfig, NavItem, SocialLink, GiscusConfig } from './types/config';
import {
  SITE_DEFAULT_OG_IMAGE,
  SITE_GISCUS,
  SITE_IDENTITY,
  SITE_IMAGES,
  SITE_NAV,
  SITE_URL_FALLBACK,
} from './site/config';
import { siteLocales } from './site/locales';

/**
 * Global site + theme configuration.
 *
 * Upstream-compatible shared file: the theme consumes `SITE`, `NAV`,
 * `SOCIALS`, `GISCUS` and `PAGEFIND` exactly as before. Personal values live
 * in the small site-owned modules under `src/site/` so this file stays close
 * to upstream and does not accumulate a large local diff.
 */

/** Branding images (site-owned choices). */
export { SITE_IMAGES };

const GITHUB_HANDLE = import.meta.env.PUBLIC_GITHUB_HANDLE ?? '';
const GITHUB_REPO = import.meta.env.PUBLIC_GITHUB_REPO ?? 'chirping-astro';
const TWITTER_HANDLE = import.meta.env.PUBLIC_TWITTER_HANDLE ?? '';
const CONTACT_EMAIL = import.meta.env.PUBLIC_CONTACT_EMAIL ?? '';
const THEME_REPO_URL = SITE_IDENTITY.footer.themeUrl;

/**
 * Public GitHub coordinates of the deployed source. Useful for custom links
 * and integrations that need a repository URL. When
 * `PUBLIC_GITHUB_HANDLE` is unset, `url` falls back to a safe default so
 * generated links never point at a 404.
 */
export const REPO = {
  handle: GITHUB_HANDLE,
  name: GITHUB_REPO,
  url: GITHUB_HANDLE ? `https://github.com/${GITHUB_HANDLE}/${GITHUB_REPO}` : 'https://github.com',
} as const;

/** Supported locales (site-owned EN/VI policy). */
export const locales = siteLocales;
export type Locale = (typeof locales)[number];

export const SITE: SiteConfig = {
  // ==========================================
  // ✅ SAFE TO EDIT (Content & Presentation)
  // ==========================================

  /** Default site title used as homepage <title> and meta. */
  title: SITE_IDENTITY.title,
  /** Site tagline / description. */
  description: SITE_IDENTITY.description,
  /** Author/handle shown in footer + meta. */
  author: {
    name: SITE_IDENTITY.author.name,
    url: GITHUB_HANDLE ? `https://github.com/${GITHUB_HANDLE}` : undefined,
    // A configured GitHub handle keeps the upstream behaviour of showing the
    // GitHub avatar; otherwise use the site-owned local avatar asset.
    avatar: GITHUB_HANDLE ? `https://avatars.githubusercontent.com/u/40559090?v=4` : avatarImg,
    bio: SITE_IDENTITY.author.bio,
  },
  /** Default OG image. */
  defaultOgImage: SITE_DEFAULT_OG_IMAGE,
  /** Number of posts per page on listings. */
  postsPerPage: SITE_IDENTITY.postsPerPage,
  /** Display ISO 8601 date format if true, otherwise locale-aware. */
  isoDates: SITE_IDENTITY.isoDates,
  /** Site-wide default for whether posts should display their featured image. */
  showFeaturedImages: SITE_IDENTITY.showFeaturedImages,
  /** Wrap the article body of posts and pages in a bordered, card-like container. */
  boxedArticles: SITE_IDENTITY.boxedArticles,
  /** Allow listing cards to grow when title/description content is longer. */
  dynamicPostCardHeight: SITE_IDENTITY.dynamicPostCardHeight,
  /** Automatically generate Open Graph images for posts that don't have a `heroImage`. */
  autoOgImage: SITE_IDENTITY.autoOgImage,
  /** Show a link to the Privacy Policy page in the footer. */
  showPrivacyPolicy: SITE_IDENTITY.showPrivacyPolicy,
  /** Footer text/link controls. */
  footer: {
    /**
     * Optional full override for the left footer line. Supports {year} and {author}.
     * Default when undefined: "© {year} {author}. All rights reserved." (+ Privacy Policy link if enabled).
     */
    leftText: undefined,
    /**
     * Optional custom text before the theme link on the right footer line.
     * Default when undefined: "Powered by Astro · Theme <themeName>".
     */
    rightText: undefined,
    /** Whether to show the Privacy Policy link in the footer. */
    showPrivacyPolicy: true,
    /** Whether to show theme credits in the footer right side. Theme <themeName> */
    showThemeCredits: true,
    /** Label for the theme repository link in the right footer line. */
    themeName: SITE_IDENTITY.footer.themeName,
    /** Default upstream theme repository. */
    themeUrl: THEME_REPO_URL,
  },

  // ==========================================
  // ❗ CAN BREAK THINGS (EDIT WITH CAUTION)
  // ==========================================

  /** Public URL of the deployed site, no trailing slash. Breaks SEO/RSS if incorrect. */
  // `||` (not `??`) so an explicitly empty `SITE_URL=` in `.env` also
  // falls back to the default. Astro requires `site` to be a valid URL.
  url: import.meta.env.SITE_URL || SITE_URL_FALLBACK,
  /** Supported locales. Changing this requires adding/removing locale folders, content, and i18n entries. */
  locales,
  /** Default locale. Changing this is a breaking, atomic, multi-file operation. */
  defaultLocale: 'en',
  /** Show the language switcher and link to translated pages. */
  multilingual: true,
};

export const NAV: readonly NavItem[] = SITE_NAV;

/**
 * SOCIALS is built from the env-driven handles above so users only edit
 * one place (`.env` or the constants at the top of this file). Empty
 * handles are filtered out automatically — the icon simply won't appear
 * in the sidebar. RSS is always present.
 *
 * Need a social network the theme doesn't ship with? Just append a
 * literal entry below — the type is `SocialLink`.
 */
export const SOCIALS: readonly SocialLink[] = [
  GITHUB_HANDLE && {
    label: 'GitHub',
    href: `https://github.com/${GITHUB_HANDLE}`,
    icon: 'simple-icons:github',
  },
  TWITTER_HANDLE && {
    label: 'Twitter',
    href: `https://x.com/${TWITTER_HANDLE}`,
    icon: 'simple-icons:x',
  },
  CONTACT_EMAIL && {
    label: 'Email',
    href: `mailto:${CONTACT_EMAIL}`,
    icon: 'lucide:mail',
  },
  { label: 'RSS', href: '/rss.xml', icon: 'lucide:rss' },
].filter(Boolean) as SocialLink[];

/**
 * Giscus comments. Set `enabled: false` to globally disable. Individual
 * posts may opt out via frontmatter `comments: false`.
 *
 * Generate values at https://giscus.app and either set them here or
 * (recommended) provide them via PUBLIC_GISCUS_* env vars at build time.
 * The mapping/render defaults are site-owned because discussion identity is
 * `pathname` based and must not drift.
 */
export const GISCUS: GiscusConfig = {
  ...SITE_GISCUS,
  enabled: (import.meta.env.PUBLIC_GISCUS_ENABLED ?? 'false') === 'true',
  repo: import.meta.env.PUBLIC_GISCUS_REPO ?? '',
  repoId: import.meta.env.PUBLIC_GISCUS_REPO_ID ?? '',
  category: import.meta.env.PUBLIC_GISCUS_CATEGORY ?? SITE_GISCUS.category,
  categoryId: import.meta.env.PUBLIC_GISCUS_CATEGORY_ID ?? '',
};

/**
 * Pagefind runtime settings. The index itself is generated by `bun run pagefind`
 * after `astro build` and written to `dist/_pagefind/`.
 */
export const PAGEFIND = {
  /** Public path where the Pagefind bundle is served. */
  bundlePath: '/_pagefind/',
  /** Number of posts per page on listings. */
  pageSize: 10,
} as const;
