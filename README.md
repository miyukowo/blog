# [blog.tvphus.dev](https://blog.tvphus.dev)

My personal blog where I write about web development, networking, and things I find interesting.

Built with [Astro](https://astro.build) as a maintained derivative of the
[Chirping Astro](https://github.com/kannansuresh/chirping-astro) theme
(synced through its generated
[starter](https://github.com/kannansuresh/chirping-astro-starter)).
Deployed on [Cloudflare Pages](https://pages.cloudflare.com).

**Visit my blog → [blog.tvphus.dev](https://blog.tvphus.dev)**

## Stack

- [Astro v7](https://astro.build) — static site generator
- [Tailwind CSS v4](https://tailwindcss.com) + [daisyUI v5](https://daisyui.com) — styling
- [Sätteri](https://www.npmjs.com/package/satteri) + MDX — Markdown/MDX pipeline
- [Pagefind](https://pagefind.app) — search
- [Giscus](https://giscus.app) — comments via GitHub Discussions
- [Sveltia CMS](https://sveltia.com) + Cloudinary — publishing/media
- [Cloudflare Pages](https://pages.cloudflare.com) — hosting

## Local Development

```bash
bun install
bun dev
```

Open [http://localhost:4321](http://localhost:4321) to see the site.

## Maintenance

- **Upstream updates:** fetch `https://github.com/kannansuresh/chirping-astro-starter` (`main`), inspect drift with `node scripts/check-upstream.mjs --adopted <adopted-sha> --candidate <new-sha>`, merge with `git merge --no-ff <new-sha>`, and verify with `bun run test:site`.
- [`theme-upstream.json`](theme-upstream.json) — adopted upstream source/starter
  SHAs, local-owned paths and shared-file exceptions.
- [Compatibility contract harness](scripts/site-contract.mjs) —
  `bun run test:site` / `bun run verify:site` validate public routes, content
  hashes, metadata, feeds, sitemap, OG and search output.

## Site-specific choices

- English is served unprefixed; Vietnamese is served under `/vi/`.
- Site identity, locale metadata and the Vietnamese dictionary live in the
  small site-owned modules under `src/site/`.
- Folder-based posts keep `/posts/<name>/` URLs (no `/index/` suffix).
- The Sveltia CMS configuration in `public/cms/` is pointed at the production
  branch (`main`); preview validation uses a separate generated config.

## Commands

| Command                  | Action                                |
| ------------------------ | ------------------------------------- |
| `bun dev`                | Start dev server at `localhost:4321`  |
| `bun run build`          | Build production site to `./dist/`    |
| `bun preview`            | Preview production build locally      |
| `bun run typecheck`      | Run `astro check`                     |
| `bun run lint`           | Run ESLint                            |
| `bun run test:site`      | Run the site compatibility tests      |
| `bun run verify:site`    | Validate built `./dist/` against current source |
| `bun run format`         | Format with Prettier                  |

## Content

- Posts: `src/content/posts/{en,vi}/**/index.mdx`
- Pages: `src/content/pages/{en,vi}/**.md`
- Frontmatter reference: `src/content/posts/en/post-authoring-cheatsheet/index.mdx`

## Upstream attribution and license

Theme by [kannansuresh](https://github.com/kannansuresh). Upstream documentation
lives in the [main Chirping Astro repository](https://github.com/kannansuresh/chirping-astro#readme);
issues and contributions belong there, not in the generated starter. This
repository is a maintained derivative, so local changes are reviewed against
upstream rather than proposed upstream.

## License

MIT — see [LICENSE](LICENSE).
