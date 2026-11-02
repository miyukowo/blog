# Task 3 merge resolution record — adopt starter 821bc6171f2ed0f74d920cc5ab70794c3f779971

Base: historical starter `5e8552f3922b623c04b5d0ffae4d7a9e255ccb20` (recorded by the
one-time ancestry bridge `af80346`).
Merged tip: `821bc6171f2ed0f74d920cc5ab70794c3f779971` (starter main), source
`4585c2d78f1c429e5c3092ed79e68cc839413964`.

## Conflicts and resolutions (8 paths, as predicted by preflight)

| Path | Resolution |
| --- | --- |
| `README.md` | Combined: personal blog introduction (ours) + current Astro v7 stack, maintenance links, commands and attribution/license (theirs), EN/VI content paths. |
| `astro.config.mjs` | Adopted upstream Astro 7 / Sätteri processor config; re-applied the site-owned `cdn.tvphus.dev` image allowlist and added Vietnamese `unicodeRange` subsets for Source Sans 3 so VI diacritics keep the interface font. |
| `package.json` | Adopted the reviewed upstream manifest (Astro 7.1.6 / MDX 7.0.5 / Sätteri lock pair) + local direct deps still required: `@resvg/resvg-wasm` (WASM OG renderer), `parse5`, `fast-xml-parser`, `yaml` (contract harness), `unist-util-visit` (retained remark CDN plugin until Task 4 port). |
| `bun.lock` | Adopted upstream lock, regenerated with Bun 1.3.14 for the reviewed manifest; `bun install --frozen-lockfile --dry-run` passes. |
| `src/config.ts` | Kept the reviewed site-owned config seam (identity, EN/VI tuple, local avatar/OG, Giscus `pathname` mapping); upstream changes to this file are value-only (branding/locales/fr). |
| `src/content/pages/en/about.md` | Kept the authored personal page (ours). |
| `src/content/pages/fr/about.md` | Kept the local FR demo deletion; upstream's restored sample page removed again (modify/delete conflict). |
| `src/utils/posts.ts` | Kept the site compatibility seams: filesystem identity without `/index`, normalised translation fallback, duplicate taxonomy helpers removed (moved to `src/site/taxonomy.ts`), hero CDN conversion retained until Task 4. Upstream `slugify` is still imported/exported and its `src/utils/posts.test.ts` passes unchanged. |

## Reviewed auto-merges (post-merge inspection)

- `src/layouts/PostLayout.astro` / `PageLayout.astro`: upstream conditional
  `math`/`mermaid` dynamic imports applied; local `ReadingProgress`, Giscus,
  translation links, hero/OG behavior preserved.
- `src/styles/global.css`: upstream view-transition radius tweak applied; local
  brand/typography customizations preserved. Font setup switched to the upstream
  Astro Fonts API (see below).
- `src/components/SmartImage.astro`, `ThemeToggle.astro`: upstream Astro 7
  responsive-image comment and theme-radius safety margin applied.
- `src/content.config.ts`: gained upstream `mermaid` field; local `postSlug`
  CMS field retained.
- `src/pages/og/[...slug].png.ts`: upstream "skip posts with heroImage" behavior
  applied; local WASM/VI OG renderer still used (content currently has no hero
  images, so the six generated OG images are unchanged).
- `bunfig.toml`: upstream `minimumReleaseAge` kept together with the local
  `[run] bun = false` (Astro must execute under Node).
- Plugins: upstream Sätteri plugin set added; historical `remark-alert` renamed
  to `satteri-alert`; obsolete `remark-ashtml` removed by upstream; local
  `remark-cdn-images.mjs` retained for the Task 4 Sätteri port.

## Fonts decision

Upstream moved to the Astro Fonts API (Source Sans 3 / Lato / JetBrains Mono)
and removed hashed font-preload filenames. Adopted that behavior: `BaseLayout`
now renders `<Font>` components, `global.css` uses the upstream `--font-*`
variables, and the old hardcoded `_astro/inter-*.woff2` preloads are gone.
A site-owned addition supplies the Vietnamese `unicodeRange` subset files for
Source Sans 3 because upstream's font config ships Latin files only.

## Post-merge evidence (see adjacent logs)

- Astro 7 build: 33 pages, 6 OG images, sitemap, Pagefind 33 pages.
- `node scripts/verify-site.mjs --profile offline` → PASS (contract matches the
  measured baseline with the four documented exact field allowances).
- `bun test src/utils/posts.test.ts` → 10/10 pass.
- `node node_modules/astro/bin/astro.mjs check` → 0 errors.
