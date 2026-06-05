# Source Report — tvp/blog

## 1. Cấu trúc thư mục

```
/home/tvp/blog
├── .astro/                   # Cache tự động của Astro (generated)
│   ├── collections/
│   ├── fonts/
│   ├── content-assets.mjs
│   ├── content.d.ts
│   ├── content-modules.mjs
│   ├── data-store.json
│   ├── fonts.d.ts
│   ├── settings.json
│   └── types.d.ts
├── .vscode/
│   └── settings.json
├── public/
│   ├── rss/
│   ├── sitemap/
│   ├── avatar.png
│   ├── favicon.ico
│   ├── og-default.png
│   └── robots.txt
├── src/
│   ├── assets/
│   ├── components/
│   ├── content/
│   ├── i18n/
│   ├── layouts/
│   ├── pages/
│   ├── plugins/
│   ├── styles/
│   ├── types/
│   ├── utils/
│   ├── config.ts
│   ├── content.config.ts
│   └── env.d.ts
├── .env
├── .env.example
├── .prettierignore
├── .prettierrc.json
├── astro.config.mjs
├── bun.lock
├── bunfig.toml
├── eslint.config.js
├── LICENSE
├── package.json
├── README.md
└── tsconfig.json
```

---

## 2. Layout chính

**File:** `src/layouts/BaseLayout.astro`

Toàn bộ phần `<head>`:

```astro
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="generator" content={Astro.generator} />
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f7f8" />
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#1b1b1e" />
  <link rel="icon" type="image/x-icon" href={withBase('/favicon.ico')} />
  <link
    rel="alternate"
    type="application/rss+xml"
    title={`${SITE.title} (EN)`}
    href={withBase('/rss.xml')}
  />
  <link
    rel="alternate"
    type="application/rss+xml"
    title={`${SITE.title} (VI)`}
    href={withBase('/vi/rss.xml')}
  />
  <SEO meta={meta} />

  <ClientRouter />
  {/* Apply persisted theme as early as possible to avoid FOUC. */}
  <script is:inline>
    (function () {
      function applyTheme() {
        try {
          var stored = localStorage.getItem('theme');
          var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          var valid = stored === 'chirpy-dark' || stored === 'chirpy-light';
          var theme = valid ? stored : prefersDark ? 'chirpy-dark' : 'chirpy-light';
          if (!valid && stored) localStorage.setItem('theme', theme);
          document.documentElement.setAttribute('data-theme', theme);
        } catch {
          /* ignore */
        }
      }
      applyTheme();
      // Re-apply after view transitions swap in a fresh <html data-theme>.
      document.addEventListener('astro:after-swap', function () {
        applyTheme();
      });
    })();
  </script>
</head>
```

---

## 3. Font loading

### Google Fonts
**Không sử dụng.** Không có link `fonts.googleapis.com` nào trong project.

### @fontsource imports

**File:** `src/styles/global.css`

```css
@import '@fontsource/inter/300.css';
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '@fontsource/inter/800.css';
@import '@fontsource/inter/900.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/600.css';
```

Các package `@fontsource` trong `devDependencies` (`package.json`):
- `@fontsource/inter` ^5.2.8
- `@fontsource/jetbrains-mono` 5.2.8
- `@fontsource/lato` 5.2.7 _(cài nhưng không được import trong CSS)_
- `@fontsource/source-sans-3` 5.2.9 _(cài nhưng không được import trong CSS)_

### @font-face trong CSS
**Không có.** Không tìm thấy block `@font-face` nào trong toàn bộ thư mục `src/`.
Các file font được bundle bởi `@fontsource` thông qua Vite, không cần khai báo thủ công.

### Font files trong public/ hoặc src/
**Không có.** Không tìm thấy file `.woff`, `.woff2`, `.ttf`, `.otf`, hay `.eot` nào trong `public/` hoặc `src/`.
Tất cả font đến từ `node_modules/@fontsource/...` và được xử lý bởi Vite lúc build.

---

## 4. ClientRouter / ViewTransitions

**Tìm thấy** — `<ClientRouter />` được dùng trong:

**File:** `src/layouts/BaseLayout.astro` (dòng 104)

```astro
    <SEO meta={meta} />

    <ClientRouter />
    {/* Apply persisted theme as early as possible to avoid FOUC. */}
    <script is:inline>
      (function () {
        function applyTheme() {
```

Import tương ứng (dòng 10):
```ts
import { ClientRouter } from 'astro:transitions';
```

---

## 5. File _headers

**Chưa có.** Không tìm thấy file `public/_headers` hay `_headers` trong thư mục gốc.

---

## 6. astro.config.mjs

```js
// @ts-check
import { defineConfig, svgoOptimizer } from 'astro/config';
import process from 'node:process';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import expressiveCode from 'astro-expressive-code';
import tailwindcss from '@tailwindcss/vite';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { remarkAsHtml } from './src/plugins/remark-ashtml.ts';
import { remarkAlert } from './src/plugins/remark-alert.ts';

import { SITE } from './src/config';

const rawBase = (process.env.BASE_PATH ?? '/').replace(/\/$/, '');
const BASE = rawBase.startsWith('/') ? rawBase : `/${rawBase}`;
const SITEMAP_XSL_HREF = `${BASE}/sitemap/styles.xsl`;
const SKIP_RSS_SITEMAP = process.env.CI_SKIP_RSS_SITEMAP === 'true';

/**
 * Set of URL path segments that belong to unlisted posts/pages.
 * Populated by `collectUnlistedUrls()` integration before the sitemap
 * integration runs, so the sitemap `filter` can exclude them.
 *
 * We use path segments (e.g. "posts/my-slug") rather than full URLs so
 * the check works regardless of `SITE_URL` or `BASE_PATH` values.
 */
const unlistedPathSegments = new Set();

/**
 * Integration that reads the content collection at build time and
 * populates `unlistedPathSegments` with the URL path segments of every
 * unlisted post. Must be listed BEFORE `@astrojs/sitemap` in the
 * integrations array.
 */
function collectUnlistedUrls() {
  return {
    name: 'chirpy:collect-unlisted-urls',
    hooks: {
      'astro:build:start': async () => {
        try {
          // Dynamically import so this only runs during builds (not in
          // the config evaluation phase where astro:content isn't ready).
          const { getCollection } = await import('astro:content');
          const entries = await getCollection('posts');
          for (const entry of entries) {
            if (!entry.data.unlisted) continue;
            // Derive locale and slug from the entry id (e.g. "en/my-post.md").
            const segs = entry.id.split(/[\/]/);
            const locale = segs[0] && /** @type {readonly string[]} */ (SITE.locales).includes(segs[0]) ? segs[0] : SITE.defaultLocale;
            const slug = segs.slice(1).join('/').replace(/\.(md|mdx)$/i, '');
            if (locale === SITE.defaultLocale) {
              unlistedPathSegments.add(`posts/${slug}`);
            } else {
              unlistedPathSegments.add(`${locale}/posts/${slug}`);
            }
          }
        } catch {
          // Content collections aren't available in all build contexts
          // (e.g. CI fast mode). Silently skip — the sitemap will include
          // unlisted posts in that case, which is acceptable for CI.
        }
      },
    },
  };
}

/**
 * Tiny inline integration: after `@astrojs/sitemap` runs, rewrite the
 * absolute XSL `href` it emits (always prefixed with `site`, e.g.
 * `https://aneejian.com/sitemap/styles.xsl`) to a root-relative path.
 */
function rewriteSitemapXslToRelative() {
  return {
    name: 'chirpy:rewrite-sitemap-xsl',
    hooks: {
      'astro:build:done': (/** @type {{ dir: URL }} */ { dir }) => {
        const distDir = fileURLToPath(dir);
        const files = readdirSync(distDir).filter(
          (f) => f.startsWith('sitemap') && f.endsWith('.xml'),
        );
        for (const file of files) {
          const path = join(distDir, file);
          const xml = readFileSync(path, 'utf8');
          const fixed = xml.replace(
            /<\?xml-stylesheet\b[^?]*\?>/,
            `<?xml-stylesheet type="text/xsl" href="${SITEMAP_XSL_HREF}"?>`,
          );
          if (fixed !== xml) writeFileSync(path, fixed);
        }
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: SITE.url,
  base: process.env.BASE_PATH ?? '/',
  trailingSlash: 'ignore',
  build: {
    format: 'directory',
  },

  image: {
    layout: 'constrained',
    responsiveStyles: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '**.githubusercontent.com' },
      { protocol: 'https', hostname: 'cdn.jsdelivr.net' },
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'imagedelivery.net' },
    ],
  },

  i18n: {
    locales: [...SITE.locales],
    defaultLocale: SITE.defaultLocale,
    routing: {
      prefixDefaultLocale: false,
      redirectToDefaultLocale: false,
    },
  },

  markdown: {
    remarkPlugins: [remarkAlert, remarkAsHtml, remarkGfm, remarkMath],
    rehypePlugins: [
      rehypeKatex,
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'wrap',
          properties: {
            className: ['heading-anchor'],
            ariaHidden: 'true',
            tabIndex: -1,
          },
        },
      ],
      [
        rehypeExternalLinks,
        {
          target: '_blank',
          rel: ['nofollow', 'noopener', 'noreferrer'],
        },
      ],
    ],
    gfm: true,
  },

  integrations: [
    icon({
      iconDir: 'src/icons',
    }),
    expressiveCode({
      themes: ['github-light', 'github-dark-dimmed'],
      themeCssSelector: (theme) =>
        `[data-theme='${theme.type === 'dark' ? 'chirpy-dark' : 'chirpy-light'}']`,
      useDarkModeMediaQuery: false,
      shiki: {
        langAlias: {
          env: 'dotenv',
        },
      },
      styleOverrides: {
        borderRadius: '0.5rem',
        codeFontFamily:
          "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
        codeFontSize: '0.875rem',
        frames: {
          shadowColor: 'transparent',
        },
      },
    }),
    mdx(),
    ...(SKIP_RSS_SITEMAP
      ? []
      : [
          collectUnlistedUrls(),
          sitemap({
            i18n: {
              defaultLocale: SITE.defaultLocale,
              locales: Object.fromEntries(SITE.locales.map((l) => [l, l])),
            },
            xslURL: SITEMAP_XSL_HREF,
            filter: (page) => {
              if (page.includes('/draft/') || page.endsWith('/404/')) return false;
              for (const seg of unlistedPathSegments) {
                if (page.includes(String(seg))) return false;
              }
              return true;
            },
          }),
          rewriteSitemapXslToRelative(),
        ]),
  ],

  vite: {
    plugins: [tailwindcss()],
  },

  experimental: {
    contentIntellisense: true,
    svgOptimizer: svgoOptimizer({
      multipass: true,
    }),
  },
});
```

---

## 7. package.json — dependencies

```json
"dependencies": {
  "@astrojs/mdx": "^5.0.4",
  "@astrojs/rss": "^4.0.18",
  "@astrojs/sitemap": "^3.7.2",
  "astro": "^6.3.1",
  "astro-expressive-code": "^0.42.0",
  "astro-icon": "^1.1.5"
},
"devDependencies": {
  "@astrojs/check": "^0.9.9",
  "@eslint/js": "^10.0.1",
  "@fontsource/inter": "^5.2.8",
  "@fontsource/jetbrains-mono": "5.2.8",
  "@fontsource/lato": "5.2.7",
  "@fontsource/source-sans-3": "5.2.9",
  "@iconify-json/lucide": "^1.2.106",
  "@iconify-json/simple-icons": "^1.2.81",
  "@resvg/resvg-wasm": "^2.6.2",
  "@tailwindcss/vite": "^4.3.0",
  "@types/bun": "^1.3.13",
  "@typescript-eslint/eslint-plugin": "^8.59.2",
  "@typescript-eslint/parser": "^8.59.2",
  "daisyui": "^5.5.19",
  "eslint": "^10.3.0",
  "eslint-plugin-astro": "^1.7.0",
  "eslint-plugin-jsx-a11y": "^6.10.2",
  "katex": "^0.16.45",
  "pagefind": "^1.5.2",
  "prettier": "^3.8.3",
  "prettier-plugin-astro": "^0.14.1",
  "prettier-plugin-tailwindcss": "^0.8.0",
  "rehype-autolink-headings": "^7.1.0",
  "rehype-external-links": "^3.0.0",
  "rehype-katex": "^7.0.1",
  "rehype-slug": "^6.0.0",
  "remark-gfm": "^4.0.1",
  "remark-math": "^6.0.0",
  "satori": "^0.26.0",
  "shiki": "^4.0.2",
  "tailwindcss": "^4.3.0",
  "typescript": "^6.0.3",
  "zod": "^4.4.3"
}
```
