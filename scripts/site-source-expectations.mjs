/**
 * Current-source expectations for routine built-artifact validation
 * (review follow-up Task 2).
 *
 * The November baseline is a migration snapshot, not a perpetual publishing
 * lock. Routine validation therefore derives what the checked-out source
 * should emit — post/page routes, taxonomy and pagination routes, feeds,
 * sitemap identities, generated OG paths, per-route metadata and the
 * Pagefind count — and compares that against the supplied `dist/`.
 *
 * Expectations come from source files only. Nothing here inspects the
 * artifact being validated, so a broken or stale `dist/` cannot bless its
 * own contents.
 *
 * Identity rules are shared with the real build:
 *  - `src/site/content-identity.ts` (loader filename/slug policy),
 *  - `src/site/urls.ts` (locale/folder policy),
 *  - `src/site/taxonomy-core.ts` (translated taxonomy destinations),
 *  - `src/site/media.ts` (hero/OG media policy),
 *  - `src/site/publishing.ts` (listing page size).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { contentEntryIdentity } from '../src/site/content-identity.ts';
import { localePresentation, siteLocales } from '../src/site/locales.ts';
import { resolveMediaUrl } from '../src/site/media.ts';
import { POSTS_PER_PAGE } from '../src/site/publishing.ts';
import { decideTaxonomyDestinations } from '../src/site/taxonomy-core.ts';
import { contentSlug, legacyTaxonomySlug } from '../src/site/urls.ts';

const DEFAULT_LOCALE = siteLocales[0];
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;
const CONTENT_FILE_PATTERN = /\.(?:md|mdx)$/i;
const INDEXABLE_SKIP_PATHS = new Set(['/404.html']);
const IGNORED_EDITOR_ENTRIES = new Set(['.obsidian', '.idea', '.DS_Store', 'Thumbs.db']);

function listFiles(root) {
  const files = [];
  const visit = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (IGNORED_EDITOR_ENTRIES.has(entry.name)) continue;
      const relativePath = prefix ? posix.join(prefix, entry.name) : entry.name;
      const full = join(directory, entry.name);
      if (entry.isDirectory()) visit(full, relativePath);
      else if (entry.isFile()) files.push(relativePath);
    }
  };
  visit(root, '');
  return files.sort();
}

function parseFrontmatter(source, label) {
  const match = FRONTMATTER_PATTERN.exec(source);
  if (!match) throw new Error(`${label}: missing YAML frontmatter`);
  let data;
  try {
    data = parseYaml(match[1]);
  } catch (error) {
    throw new Error(`${label}: invalid YAML frontmatter (${error.message})`, { cause: error });
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${label}: frontmatter must be a YAML mapping`);
  }
  return data;
}

function toDate(value, label) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.valueOf())) throw new Error(`${label}: invalid pubDate`);
  return date;
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => typeof item === 'string');
}

function localizedPath(path, locale, basePrefix) {
  const cleaned = path.startsWith('/') ? path : `/${path}`;
  const localized =
    locale === DEFAULT_LOCALE ? cleaned : cleaned === '/' ? `/${locale}/` : `/${locale}${cleaned}`;
  return `${basePrefix}${localized}`;
}

/** `withBase()` equivalent for the root deployment base used here. */
function withBase(path, basePrefix) {
  return `${basePrefix}${path}`;
}

function postPath({ locale, slug, basePrefix }) {
  return localizedPath(`/posts/${slug}/`, locale, basePrefix);
}

function ogPath({ locale, slug, basePrefix }) {
  const prefix = locale === DEFAULT_LOCALE ? '' : `${locale}/`;
  return `${basePrefix}/og/${prefix}${slug}.png`;
}

function feedPath(locale) {
  return locale === DEFAULT_LOCALE ? '/rss.xml' : `/${locale}/rss.xml`;
}

function sortPosts(posts) {
  return [...posts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.pubDate.valueOf() - a.pubDate.valueOf();
  });
}

function taxonomyNames(post, kind) {
  return kind === 'categories' ? post.categories : post.tags;
}

function listedByLocale(posts) {
  const out = Object.fromEntries(siteLocales.map((locale) => [locale, []]));
  for (const post of posts) {
    if (!post.unlisted) out[post.locale].push(post);
  }
  return out;
}

function taxonomyEntries(kind, posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const name of taxonomyNames(post, kind)) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Reproduce `src/site/taxonomy.ts` for one taxonomy route from source data,
 * using the same pure decision module as the build.
 */
function taxonomyDestinations({ kind, locale, name, listed, basePrefix }) {
  const currentSlug = legacyTaxonomySlug(name);
  const candidates = {
    kind,
    currentLocale: locale,
    currentName: name,
    exactSlug: {},
    translatedCounts: {},
  };

  const currentPosts = listed[locale].filter((post) =>
    taxonomyNames(post, kind).some((value) => legacyTaxonomySlug(value) === currentSlug),
  );

  for (const target of siteLocales) {
    if (target === locale) continue;
    const entries = taxonomyEntries(kind, listed[target]);
    const exact = entries.find((entry) => legacyTaxonomySlug(entry.name) === currentSlug);
    if (exact) candidates.exactSlug[target] = exact.name;

    const counts = new Map();
    for (const post of currentPosts) {
      const translated = listed[target].find(
        (candidate) => candidate.translationKey === post.translationKey,
      );
      if (!translated) continue;
      for (const value of taxonomyNames(translated, kind)) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    candidates.translatedCounts[target] = [...counts.entries()];
  }

  return decideTaxonomyDestinations(candidates, {
    index: (target) => localizedPath(`/${kind}/`, target, basePrefix),
    entry: (target, entryName) =>
      localizedPath(`/${kind}/${legacyTaxonomySlug(entryName)}/`, target, basePrefix),
  });
}

/** Read every post entry and normalize it with the loader/site identity policy. */
export function readPosts(sourceDir) {
  const postsRoot = join(sourceDir, 'src', 'content', 'posts');
  let files;
  try {
    files = listFiles(postsRoot);
  } catch {
    return [];
  }

  const posts = [];
  for (const relativePath of files) {
    if (!CONTENT_FILE_PATTERN.test(relativePath)) continue;
    const label = `src/content/posts/${relativePath}`;
    const data = parseFrontmatter(readFileSync(join(postsRoot, relativePath), 'utf8'), label);
    const id = contentEntryIdentity({
      relativePath,
      slug: typeof data.slug === 'string' ? data.slug : undefined,
    }).id;
    const firstSegment = id.split('/')[0];
    const explicitLang = typeof data.lang === 'string' ? data.lang : undefined;
    const locale =
      explicitLang && siteLocales.includes(explicitLang)
        ? explicitLang
        : siteLocales.includes(firstSegment)
          ? firstSegment
          : DEFAULT_LOCALE;
    const slug = contentSlug(id, siteLocales);
    const translationKey =
      typeof data.translationKey === 'string' && data.translationKey.trim().length > 0
        ? data.translationKey.trim()
        : slug;

    posts.push({
      id,
      locale,
      slug,
      translationKey,
      draft: data.draft === true,
      unlisted: data.unlisted === true,
      unlistedHideFromSeo: data.unlistedHideFromSeo,
      pinned: data.pinned === true,
      pubDate: toDate(data.pubDate, label),
      tags: asStringArray(data.tags),
      categories: asStringArray(data.categories),
      heroImage: typeof data.heroImage === 'string' ? data.heroImage : undefined,
    });
  }
  return posts;
}

/** Read content pages that have a fixed route (`about`, `privacy`). */
function readPinnedPages(sourceDir) {
  const pagesRoot = join(sourceDir, 'src', 'content', 'pages');
  let files;
  try {
    files = listFiles(pagesRoot);
  } catch {
    return [];
  }
  const pages = [];
  for (const relativePath of files) {
    if (!CONTENT_FILE_PATTERN.test(relativePath)) continue;
    const label = `src/content/pages/${relativePath}`;
    const data = parseFrontmatter(readFileSync(join(pagesRoot, relativePath), 'utf8'), label);
    const id = contentEntryIdentity({
      relativePath,
      slug: typeof data.slug === 'string' ? data.slug : undefined,
    }).id;
    const firstSegment = id.split('/')[0];
    const locale = siteLocales.includes(firstSegment) ? firstSegment : DEFAULT_LOCALE;
    const slug = contentSlug(id, siteLocales);
    if (slug !== 'about' && slug !== 'privacy') continue;
    pages.push({ locale, slug });
  }
  return pages;
}

/** Public HTML files copied verbatim (e.g. the Sveltia admin shell). */
export function readStaticPublicHtml(sourceDir) {
  const publicRoot = join(sourceDir, 'public');
  try {
    return listFiles(publicRoot).filter((file) => file.endsWith('.html'));
  } catch {
    return [];
  }
}

/**
 * Build current-source expectations. Only source files are read.
 *
 * @param {{ sourceDir: string, siteUrl: string }} options
 */
export function buildSourceExpectations({ sourceDir, siteUrl }) {
  const origin = new URL(siteUrl).origin;
  const basePrefix = '';

  const posts = readPosts(sourceDir);
  const published = posts
    .filter((post) => !post.draft)
    .map((post) => ({
      ...post,
      path: postPath({ locale: post.locale, slug: post.slug, basePrefix }),
      ogPath: ogPath({ locale: post.locale, slug: post.slug, basePrefix }),
    }));
  const listed = listedByLocale(published);

  const routes = [];
  const addRoute = (route) => routes.push(route);

  for (const locale of siteLocales) {
    addRoute({
      path: localizedPath('/', locale, basePrefix),
      pathWithoutLocale: '/',
      locale,
      kind: 'static',
    });
    addRoute({
      path: localizedPath('/archives/', locale, basePrefix),
      pathWithoutLocale: '/archives/',
      locale,
      kind: 'static',
    });
    addRoute({
      path: localizedPath('/search/', locale, basePrefix),
      pathWithoutLocale: '/search/',
      locale,
      kind: 'static',
    });
    addRoute({
      path: localizedPath('/tags/', locale, basePrefix),
      pathWithoutLocale: '/tags/',
      locale,
      kind: 'static',
    });
    addRoute({
      path: localizedPath('/categories/', locale, basePrefix),
      pathWithoutLocale: '/categories/',
      locale,
      kind: 'static',
    });

    const pages = readPinnedPages(sourceDir).filter((page) => page.locale === locale);
    for (const page of pages) {
      addRoute({
        path: localizedPath(`/${page.slug}/`, locale, basePrefix),
        pathWithoutLocale: `/${page.slug}/`,
        locale,
        kind: 'page',
      });
    }

    const localePosts = listed[locale];
    const totalPages = Math.ceil(localePosts.length / POSTS_PER_PAGE);
    for (let page = 2; page <= totalPages; page += 1) {
      addRoute({
        path: localizedPath(`/page/${page}/`, locale, basePrefix),
        pathWithoutLocale: `/page/${page}/`,
        locale,
        kind: 'pagination',
      });
    }

    for (const kind of ['tags', 'categories']) {
      const seen = new Set();
      for (const post of localePosts) {
        for (const name of taxonomyNames(post, kind)) {
          const slug = legacyTaxonomySlug(name);
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);
          addRoute({
            path: localizedPath(`/${kind}/${slug}/`, locale, basePrefix),
            pathWithoutLocale: `/${kind}/${slug}/`,
            locale,
            kind: 'taxonomy',
            taxonomy: { kind, name, slug },
          });
        }
      }
    }

    for (const post of published.filter((candidate) => candidate.locale === locale)) {
      addRoute({
        path: post.path,
        locale,
        kind: 'post',
        post,
      });
    }
  }

  addRoute({
    path: '/404.html',
    pathWithoutLocale: '/404/',
    locale: DEFAULT_LOCALE,
    kind: 'notfound',
  });

  // Duplicate identities would mean two source entries map to one public URL.
  const byPath = new Map();
  for (const route of routes) {
    if (byPath.has(route.path)) {
      throw new Error(`source expectations: duplicate public route ${route.path}`);
    }
    byPath.set(route.path, route);
  }

  const feeds = {};
  for (const locale of siteLocales) {
    feeds[feedPath(locale)] = {
      language: localePresentation[locale].rssLanguage,
      items: sortPosts(listed[locale]).map((post) => `${origin}${post.path}`),
    };
  }

  const sitemapUrls = routes
    .filter((route) => !INDEXABLE_SKIP_PATHS.has(route.path))
    .filter((route) => !(route.kind === 'post' && route.post.unlisted))
    .map((route) => `${origin}${route.path}`);

  const generatedOgPaths = published
    .filter((post) => !post.heroImage)
    .map((post) => post.ogPath)
    .sort();

  const staticPublicHtml = readStaticPublicHtml(sourceDir);
  const indexableRouteCount = routes.filter(
    (route) =>
      !INDEXABLE_SKIP_PATHS.has(route.path) && !(route.kind === 'post' && route.post.unlisted),
  ).length;
  const search = {
    indexedPages: indexableRouteCount + staticPublicHtml.length,
    languages: siteLocales
      .map((locale) => localePresentation[locale].htmlLang.toLowerCase())
      .sort(),
  };

  return {
    origin,
    basePrefix,
    posts: published,
    listed,
    routes,
    routeByPath: byPath,
    feeds,
    sitemapUrls,
    generatedOgPaths,
    staticPublicHtml,
    search,
  };
}

function postHreflangs(post, listed, origin) {
  const destinations = {};
  for (const locale of siteLocales) {
    if (locale === post.locale) {
      destinations[locale] = post.path;
      continue;
    }
    // `getTranslations()` uses `getPosts()`, which excludes unlisted siblings.
    const sibling = listed[locale].find(
      (candidate) => candidate.translationKey === post.translationKey,
    );
    if (sibling) destinations[locale] = sibling.path;
  }

  const hreflangs = {};
  for (const [locale, path] of Object.entries(destinations)) {
    hreflangs[locale] = `${origin}${path}`;
  }
  if (destinations[DEFAULT_LOCALE]) {
    hreflangs['x-default'] = `${origin}${destinations[DEFAULT_LOCALE]}`;
  }
  return hreflangs;
}

function structuralHreflangs(route, basePrefix, origin) {
  const hreflangs = {};
  for (const locale of siteLocales) {
    hreflangs[locale] = `${origin}${localizedPath(route.pathWithoutLocale, locale, basePrefix)}`;
  }
  hreflangs['x-default'] =
    `${origin}${localizedPath(route.pathWithoutLocale, DEFAULT_LOCALE, basePrefix)}`;
  return hreflangs;
}

/** Expected canonical/lang/robots/OG/hreflang metadata for one route. */
export function expectedRouteMetadata(expectations, route) {
  const { origin, basePrefix, listed } = expectations;

  if (route.kind === 'notfound') {
    return {
      canonical: `${origin}${localizedPath('/404/', DEFAULT_LOCALE, basePrefix)}`,
      lang: localePresentation[DEFAULT_LOCALE].htmlLang,
      robots: '',
      ogImage: `${origin}${withBase('/og-default.png', basePrefix)}`,
      hreflangs: {
        en: `${origin}${localizedPath('/404/', 'en', basePrefix)}`,
        vi: `${origin}${localizedPath('/404/', 'vi', basePrefix)}`,
        'x-default': `${origin}${localizedPath('/404/', DEFAULT_LOCALE, basePrefix)}`,
      },
    };
  }

  const canonical = `${origin}${route.path}`;
  const lang = localePresentation[route.locale].htmlLang;

  if (route.kind !== 'post') {
    let hreflangs;
    if (route.taxonomy) {
      const destinations = taxonomyDestinations({
        kind: route.taxonomy.kind,
        locale: route.locale,
        name: route.taxonomy.name,
        listed,
        basePrefix,
      });
      hreflangs = Object.fromEntries(
        Object.entries(destinations).map(([locale, path]) => [locale, `${origin}${path}`]),
      );
      // `buildSeo()` adds x-default whenever the default locale has a
      // concrete translated destination.
      if (destinations[DEFAULT_LOCALE]) {
        hreflangs['x-default'] = `${origin}${destinations[DEFAULT_LOCALE]}`;
      }
    } else {
      hreflangs = structuralHreflangs(route, basePrefix, origin);
    }

    return {
      canonical,
      lang,
      robots: '',
      ogImage: `${origin}${withBase('/og-default.png', basePrefix)}`,
      hreflangs,
    };
  }

  const post = route.post;
  const robots = post.unlisted && (post.unlistedHideFromSeo ?? true) ? 'noindex, nofollow' : '';

  let ogImage;
  let ogImageKnown = true;
  if (!post.heroImage) {
    ogImage = `${origin}${post.ogPath}`;
  } else if (post.heroImage.startsWith('/')) {
    ogImage = `${origin}${withBase(post.heroImage, basePrefix)}`;
  } else if (/^https?:\/\//i.test(post.heroImage)) {
    ogImage = resolveMediaUrl(post.heroImage);
  } else {
    // Relative imported assets are resolved by the image pipeline; the exact
    // built URL is not derivable from frontmatter alone. Require a non-empty
    // reference and let the referenced-file check validate local paths.
    ogImage = undefined;
    ogImageKnown = false;
  }

  return {
    canonical,
    lang,
    robots,
    ogImage,
    ogImageKnown,
    hreflangs: postHreflangs(post, listed, origin),
  };
}
