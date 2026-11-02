/**
 * Site-owned branding and configuration choices (Task 2).
 *
 * `src/config.ts` remains the upstream-compatible shared entry point; it
 * imports the explicit personal values from this module instead of carrying
 * a large local diff. Keep this file limited to values that genuinely differ
 * from upstream (identity, media choices, locale tuple, Giscus defaults,
 * footer credits) — not a second copy of the theme config.
 */

import avatarImg from '../assets/images/site/avatar.png';
import ogDefaultImg from '../assets/images/site/og-default.png';

/** Local branding images. One authoritative copy per consumer. */
export const SITE_IMAGES = {
  avatar: avatarImg,
  ogDefault: ogDefaultImg,
} as const;

/** Public origin used when `SITE_URL` is not provided at build time. */
export const SITE_URL_FALLBACK = 'https://blog.tvphus.dev';

/** Tracked/public default OG image path (served from `public/`). */
export const SITE_DEFAULT_OG_IMAGE = '/og-default.png';

/** Personal identity and presentation defaults. */
export const SITE_IDENTITY = {
  title: "tvp's blog",
  description: "welcome to tvphus's personal blog.",
  author: {
    name: 'tvphus',
    bio: 'hi, im a tech noobie. feel free to look around my blog.',
  },
  postsPerPage: 8,
  isoDates: false,
  showFeaturedImages: true,
  boxedArticles: false,
  dynamicPostCardHeight: false,
  autoOgImage: true,
  showPrivacyPolicy: true,
  footer: {
    themeName: 'Chirping Astro',
    themeUrl: 'https://github.com/kannansuresh/chirping-astro',
  },
} as const;

/** Navigation entries (paths are locale-agnostic; renderers add the prefix). */
export const SITE_NAV = [
  { key: 'home', href: '/', icon: 'lucide:home' },
  { key: 'categories', href: '/categories', icon: 'lucide:layers' },
  { key: 'tags', href: '/tags', icon: 'lucide:tag' },
  { key: 'archives', href: '/archives', icon: 'lucide:archive' },
  { key: 'about', href: '/about', icon: 'lucide:info' },
] as const;

/**
 * Giscus defaults that belong to this site rather than upstream. The
 * repository/category identifiers stay env-driven in `src/config.ts`; the
 * production bindings must not be hard-coded here.
 */
export const SITE_GISCUS = {
  category: 'Announcements',
  mapping: 'pathname',
  strict: '0',
  reactionsEnabled: '1',
  emitMetadata: '0',
  inputPosition: 'top',
  loading: 'lazy',
} as const;
