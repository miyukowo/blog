/**
 * UI dictionaries.
 *
 * Upstream-compatible shared file: the English (and, after the upstream
 * merge, French) definitions stay here close to upstream. This blog's
 * Vietnamese dictionary lives in the site-owned `src/site/vi.ts` and is
 * merged into `messages` below.
 *
 * Adding a locale requires: a dictionary, an entry in `messages`, and the
 * locale tuple in `src/site/locales.ts`. `Record<Locale, ...>` enforces
 * coverage; `Record<UIKey, string>` in `src/site/vi.ts` enforces coverage of
 * every English key.
 */

import type { Locale } from '../config';
import { viMessages } from '../site/vi';

const en = {
  'site.skipToContent': 'Skip to content',
  'site.scrollToTop': 'Scroll to top',
  'nav.home': 'Home',
  'nav.posts': 'Posts',
  'nav.tags': 'Tags',
  'nav.categories': 'Categories',
  'nav.archives': 'Archives',
  'nav.about': 'About',
  'nav.search': 'Search',
  'nav.toggleMenu': 'Toggle menu',

  'theme.toggle': 'Toggle theme',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'theme.system': 'System',

  'lang.switcher': 'Language',
  'lang.en': 'English',
  'lang.vi': 'Vietnamese',

  'post.publishedOn': 'Published on',
  'post.updatedOn': 'Updated on',
  'post.readingTime': 'min read',
  'post.toc': 'Table of contents',
  'post.tags': 'Tags',
  'post.categories': 'Categories',
  'post.previous': 'Previous',
  'post.next': 'Next',
  'post.comments': 'Comments',
  'post.commentsDisabled': 'Comments are disabled for this post.',
  'post.commentsSetupTitle': 'Comments need configuration',
  'post.commentsSetupBody':
    'Giscus is enabled but not yet configured. Add the repository details below to start collecting comments.',
  'post.commentsSetupStep1':
    'Visit `giscus.app` and select your public GitHub repository (Discussions must be enabled).',
  'post.commentsSetupStep2':
    'Copy the generated `data-repo-id`, `data-category` and `data-category-id` values.',
  'post.commentsSetupStep3':
    'Set the `PUBLIC_GISCUS_ENABLED`, `PUBLIC_GISCUS_REPO`, `PUBLIC_GISCUS_REPO_ID`, `PUBLIC_GISCUS_CATEGORY` and `PUBLIC_GISCUS_CATEGORY_ID` env vars in your `.env` file.',
  'post.commentsSetupStep4':
    'Rebuild the site — this notice will be replaced by the live comments thread.',
  'post.commentsSetupDocs': 'Open giscus.app',
  'post.share': 'Share',
  'post.copyLink': 'Copy link',
  'post.copied': 'Copied!',
  'post.author': 'Author',

  'list.allPosts': 'All posts',
  'list.empty': 'No posts found.',
  'list.tagPosts': 'Posts tagged',
  'list.categoryPosts': 'Posts in',
  'list.totalPosts': 'posts',
  'list.totalPostsOne': 'post',

  'pagination.previous': 'Previous page',
  'pagination.next': 'Next page',
  'pagination.page': 'Page',
  'pagination.of': 'of',

  'archives.title': 'Archives',
  'archives.empty': 'No posts yet.',

  'tags.title': 'Tags',
  'tags.empty': 'No tags yet.',

  'categories.title': 'Categories',
  'categories.empty': 'No categories yet.',

  'search.title': 'Search',
  'search.placeholder': 'Search the site',
  'search.openLabel': 'Open search',
  'search.closeLabel': 'Close search',
  'search.empty': 'No results.',
  'search.loading': 'Loading search…',
  'search.typeToStart': 'Type to search…',
  'search.hintShortcut': 'Press / anywhere to open search',
  'search.searching': 'Searching…',
  'search.noResultsFor': 'No results for',
  'search.resultsCount': 'results',
  'search.resultsCountOne': 'result',
  'search.hintNavigate': 'to navigate',
  'search.hintSelect': 'to open',
  'search.clearLabel': 'Clear',

  'code.copy': 'Copy',
  'code.copied': 'Copied',

  '404.title': 'Page not found',
  '404.description': 'Whoops. The page you are looking for has flown away.',
  '404.cta': 'Back to home',

  'footer.poweredBy': 'Powered by',
  'footer.theme': 'Theme',
  'footer.privacy': 'Privacy Policy',
  'footer.copyright': 'All rights reserved.',
} as const;

/** Every UI key, derived from the authoritative English dictionary. */
export type UIKey = keyof typeof en;

export const messages = {
  en,
  vi: viMessages,
} as const satisfies Record<Locale, Record<string, string>>;
