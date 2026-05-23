---
title: 'Post Authoring Cheatsheet'
description: 'Quick reference for writing posts in this theme.'
pubDate: 2026-04-27
tags: [code, syntax-highlighting, expressive-code, shiki, markdown]
categories: [Authoring]
translationKey: post-authoring-cheatsheet
toc: true
draft: true
---

## 1) Frontmatter for posts

| Field | Required | Use | Notes |
|---|---:|---|---|
| `title` | Yes | Post title, H1, meta title, OG title | 1–140 chars |
| `description` | Yes | Meta description, OG, RSS | 1–280 chars |
| `pubDate` | Yes | Publish date | Required for posts |
| `updatedDate` | No | Update date shown in UI, RSS, sitemap, OG | Use when content changed meaningfully |
| `tags` | No | Tag pages, trending tags | Defaults to `[]` |
| `categories` | No | Category pages | Defaults to `[]` |
| `draft` | No | Hide from production build, RSS, sitemap | Visible in dev |
| `unlisted` | No | Keep page live by direct URL, hide from listings | Still deploys |
| `unlistedHideFromSeo` | No | Add `noindex, nofollow` | Defaults to `true` when `unlisted: true` |
| `heroImage` | No | Hero image, card thumbnail, OG preview | Local asset, public path, or remote URL |
| `heroImageAlt` | No | Alt text for hero image | Always set if possible |
| `showFeaturedImage` | No | Show/hide hero per post | Overrides site default |
| `dynamicPostCardHeight` | No | Card height behavior | Overrides site default |
| `canonicalURL` | No | Custom canonical link | Useful for republished content |
| `comments` | No | Enable/disable Giscus per post | Overrides site-wide setting |
| `toc` | No | Show/hide right-hand TOC | Defaults to `true` |
| `pinned` | No | Pin post to top of listings | Defaults to `false` |
| `math` | No | Enable KaTeX rendering | Defaults to `false` |
| `lang` | No | Override locale | Usually inferred from path |
| `translationKey` | No | Pair translated posts | Same key across locales |

## 2) Frontmatter for pages

Pages use the same fields as posts, but `pubDate` is optional.

Extra page-only field:

```yaml
showInNav: true
```

Note: navigation is currently driven by `src/config.ts`, so this is mostly reserved.

## 3) Common post setup

```yaml
---
title: My post
description: Short summary for search and sharing.
pubDate: 2026-05-24
tags: [astro, markdown]
categories: [Tutorials]
translationKey: my-post
toc: true
---
```

## 4) Useful content syntax

- Markdown basics: headings, lists, tables, blockquotes, links, images, code fences.
- Use `.md` when you only need plain Markdown and want the file to stay portable.
- Use `.mdx` when you need to import Astro components, use `{...}` expressions, or compose richer UI.
- GFM extras: task lists, footnotes, definition lists.
- MDX only: import Astro components, use JSX-style expressions, pass slots/children.
- Math: use `$...$` for inline and `$$...$$` for display math, with `math: true`.
- Callouts: `<Callout type="info|success|warning|error" title="...">`.
- Alert component: `<Alert type="info|success|warning|error" style="soft|outline|dash" direction="vertical|horizontal|responsive" icon="..." title="...">`.
- Video: `<VideoEmbed platform="youtube" id="..." title="..." />` or `src="..."`.
- Images: prefer `astro:assets` imports for optimized local images.

## 5) Code fences

- Standard code block: use a language tag like `ts`, `bash`, or `diff`.
- Frame titles: add `title="..."`.
- Terminal style: add `frame="terminal"`.
- Highlight lines: use `{3-5}` or `ins={4-6}` or `del={2}`.
- Collapse long snippets: use `collapse={1-6}`.
- Word wrap: add `wrap`.
- Alerts: use the custom `alert` fence.

Example:
````
```ts frame="terminal" title="src/utils/example.ts" {2}
export function greet(name: string) {
  return `Hello, ${name}!`;
}
```
````
and the results:

```ts title="src/utils/example.ts" {2}
export function greet(name: string) {
  return `Hello, ${name}!`;
}
```

## 6) Image rules at a glance

- Best default: local asset under `src/assets/images/posts/<post-id>/`.
- For image-heavy posts, keep the article at `src/content/posts/en/<post-slug>/index.mdx` and put related images in `src/assets/images/posts/<post-slug>/`.
- Public path: `/images/...` works, but is not optimized.
- Remote URL: works if allowed in `astro.config.mjs`.
- Write `heroImageAlt` for meaningful images.
- Use `showFeaturedImage: false` for text-heavy posts.

## 7) i18n and translations

- English lives at root, Vietnamese under `/vi`.
- Put posts in locale folders like `src/content/posts/en/...` and `src/content/posts/vi/...`.
- Use the same `translationKey` to connect translated versions.
- `lang` is usually inferred from the path.

## 8) Quick references

- `toc: false` for posts that do not need a table of contents.
- `math: true` to load KaTeX only on math pages.
- `comments: false` to silence comments on one post.
- `unlisted: true` to hide a post from listings but keep the URL live.
- `draft: true` to keep a post out of production entirely.
