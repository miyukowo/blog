# Chirping upstream research — 2026-11-02

## Decision

Use **`kannansuresh/chirping-astro-starter` as the practical update stream**, and record the canonical `chirping-astro` source commit alongside every starter commit. Maintain a Git-based derivative with a narrow, documented local delta. Catch up on staging to the verified starter main below, preserving content, URLs, pathname-based comment associations, essential SEO, and usable Sveltia/Cloudinary publishing. Defer optional avatar, progress, and back-to-top UI work if necessary.

This is an engineering recommendation; the historical ancestry bridge and conflict shape were subsequently rehearsed in an isolated `/tmp` Git clone, without resolving or building the result. This research agent changed only this report in the project and performed no project builds, dependency installs, deployments, production CMS operations, or DSH/model executions. Parent-agent baseline checks are attributed separately below. Public Git downloads were read-only network research.

## Evidence and scope

Inspected complete public Git histories and source trees in `/tmp/chirping-source-20261102` and `/tmp/chirping-starter-20261102`, local tracked history rooted at `d927dd2`, core content/routing helpers, configuration, starter filtering, workflow, README, and changelog. Codebase graph first confirmed local `postSlug`; its source matched the file inspection. Local comparison target was staging commit `ec2f254` (the HEAD observed during research).

The default sandbox could not resolve `github.com`. Escalated public `git clone` and `git ls-remote` succeeded. Both repository landing pages and official Astro migration pages were also opened through the browser research tool. Some hash-specific GitHub pages returned browser cache misses; the exact hashes and file contents below were independently verified from Git objects, not inferred from cached HTML. No private environment contents or credentials were needed.

### Verified live refs

`git ls-remote <public-url> HEAD refs/heads/main` returned the same value for HEAD and main in each repository on 2026-11-02:

| Repository                                                                       | Main SHA                                   | Commit date | Tree SHA                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------ | ----------- | ------------------------------------------ |
| [chirping-astro](https://github.com/kannansuresh/chirping-astro)                 | `4585c2d78f1c429e5c3092ed79e68cc839413964` | 2026-08-02  | `5ae3e8dc91aac4ddac60ae3de90e7554a4684555` |
| [chirping-astro-starter](https://github.com/kannansuresh/chirping-astro-starter) | `821bc6171f2ed0f74d920cc5ab70794c3f779971` | 2026-08-02  | `2f11dd1dc407c1ed1a222c321148362dd8dc00d6` |

Starter HEAD's message is `sync: update from chirping-astro@4585c2d [skip ci]`. Thus these two tips are a verified source/generated pair. Neither main advanced after August 2 in the fetched histories. Source remote dependency branches contain later September commits; **those are not main** and are excluded from the update target. Current branch activity does not establish future maintenance cadence.

## Imported baseline identified by Git hashes

Local initial commit `d927dd2e70f1de9a1997e518633d95ea8648033a`, dated 2026-05-22, is a **personalized near-copy**, not an untouched upstream tree. The closest starter commit across all fetched starter history is:

- Starter [`5e8552f3922b623c04b5d0ffae4d7a9e255ccb20`](https://github.com/kannansuresh/chirping-astro-starter/commit/5e8552f3922b623c04b5d0ffae4d7a9e255ccb20), 2026-05-18, synchronized from source `551ffe8`.
- Source [`551ffe811906f6fe2813da4ea271c2d5f638b721`](https://github.com/kannansuresh/chirping-astro/commit/551ffe811906f6fe2813da4ea271c2d5f638b721), 2026-05-18, “feat: add unlisted posts feature with SEO control.”

`git ls-tree -r` comparison found **the same 87 paths and 85 identical Git blob hashes**. There are no extra/missing files. The only differences are `package.json` (name changed to `blog`, `private` removed, final newline) and `src/config.ts` (personal title/description/author/bio and malformed `['en', 'vi]` locale edit). Initial local tree is `504f8924c73140c37b22c16db750104d3ac1439f`; matching starter tree is `1c8567e6b0a99e22a3b15109997621da7c560bf5`. This is strong import identification; it is deliberately not called an exact tree match or Git ancestry.

Examples of identical initial-local/starter blob hashes:

| Path                           | Blob SHA                                   |
| ------------------------------ | ------------------------------------------ |
| `astro.config.mjs`             | `d685390d224988f3d59af12929f2bd19b930a873` |
| `src/utils/posts.ts`           | `00a24ab56b9f762e88f9bf23ace878cc44b905da` |
| `src/layouts/PostLayout.astro` | `76fd4e017d616d8e5287e1bb3b5d08f856f2db1a` |
| `src/content.config.ts`        | `00a68a19a6feccbc763d53d0c90a13ff1a05acf1` |

The local repository has imported history and origin only, so merely adding an upstream remote would not give Git a shared merge base.

## Source versus starter: what actually differs

The canonical [include file](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/.starter-include) includes config/tooling files, license, `.vscode`, `src`, and `public`. It is an allowlist, not a theme distribution package.

The [synchronization workflow](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/.github/workflows/sync-starter.yml) runs after successful main PR Checks or manually, cleans the generated starter, copies included paths, rewrites the package to remove Husky/lint-staged, regenerates `bun.lock`, removes CI-only example environment flags, deletes EN/FR demo posts, and substitutes `.starter` sample posts, README, and deployment workflow. It commits a source hash into its message. This describes upstream's generation process; running that cleaner against this blog would delete user-owned files.

At the verified tips, **76 shared `src`/`public` paths have identical blob hashes**. Across all shared paths the only differences are `README.md`, `.github/workflows/deploy.yml`, `package.json`, and `bun.lock`. Starter-only paths are its two getting-started posts; source-only paths total 64, including demos, project documentation, test-app, maintenance workflows, and Husky material. Neither source nor starter supplies this blog's CMS integration. The [starter README](https://github.com/kannansuresh/chirping-astro-starter/blob/821bc6171f2ed0f74d920cc5ab70794c3f779971/README.md) explicitly identifies it as automatically generated and directs changes/issues to the main source repository.

Consequently, using canonical source for research/issues and generated starter for update diffs avoids importing irrelevant demo/maintainer material while receiving the same theme core. Starter may lag if synchronization fails; check both pinned hashes and core equality on each update.

## Measured diff size

Default Git rename detection gives:

| Comparison                                             | Changed files | Added lines | Removed lines |
| ------------------------------------------------------ | ------------: | ----------: | ------------: |
| Imported starter `5e8552f` → current starter `821bc61` |            26 |         998 |           539 |
| Corresponding source `551ffe8` → source main `4585c2d` |            48 |        1432 |           508 |
| Local initial `d927dd2` → local staging `ec2f254`      |            57 |        3238 |           957 |

The source diff includes documentation/demo/maintenance differences the starter intentionally excludes. The local delta includes content and media, so file count alone overstates theme divergence.

For reproducible path categories, the following uses `git diff --no-renames --numstat`. A rename becomes separate deletion/addition, so these totals intentionally differ from the summary above. Binaries contribute a file count but no textual lines. Classification: content=`src/content/**`; core=`src/**` except `src/config.ts` and content; public=`public/**`; lock=`*.lock`; docs=`*.md` outside prior groups; remainder=config/tooling/deploy.

| Starter baseline → starter main |  Paths |   +lines |  -lines |
| ------------------------------- | -----: | -------: | ------: |
| Core code/styles/tests          |     18 |      542 |     291 |
| Config/tooling                  |      5 |       68 |      76 |
| Content                         |      2 |        2 |       2 |
| Documentation                   |      1 |       16 |      22 |
| Lockfile                        |      1 |      589 |     367 |
| **Total**                       | **27** | **1217** | **758** |

| Local baseline → staging      |  Paths |   +lines |   -lines | Binary paths |
| ----------------------------- | -----: | -------: | -------: | -----------: |
| Core code/styles/tests/assets |     28 |      832 |      209 |            3 |
| Config/tooling/deploy         |      6 |       90 |      117 |            0 |
| Content                       |     16 |     2016 |      508 |            0 |
| Public assets/CMS             |      6 |      378 |        0 |            3 |
| Documentation                 |      1 |       13 |      188 |            0 |
| Lockfile                      |      1 |        6 |       32 |            0 |
| **Total**                     | **58** | **3335** | **1054** |        **6** |

## Upstream changes that matter

Verified against actual source main history and current file diffs, rather than treating the changelog as sufficient:

| Change                               | Evidence                                                                                                                                                                                                                                                                                          | Migration consequence                                                                                                                                                                                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Markdown processor modernization     | [May 31 commit `127f8f6`](https://github.com/kannansuresh/chirping-astro/commit/127f8f65ceb0f196b8e87f758a9322b1a246397c); [current config](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/astro.config.mjs)                                        | Final main uses Sätteri, replaces old remark-ashtml/remark-alert with Sätteri plugins, adds heading IDs/autolinks/external links/base-links/math/Mermaid processing. Local CDN image remark transform must be ported or intentionally retained with a supported unified processor.         |
| Unicode taxonomy slugs               | [June 3 commit `282a656`](https://github.com/kannansuresh/chirping-astro/commit/282a656ccdc02917f9f8047a1efe56d657b8fad6), [`src/utils/slugify.ts`](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/src/utils/slugify.ts)                            | Upstream now preserves Unicode letters/marks; local old algorithm folds combining accents and removes non-ASCII. Direct adoption can change VI tag/category URLs. Preserve current published taxonomy paths or explicitly map redirects; “Unicode support” alone is not URL compatibility. |
| Astro 7 and integrations             | [July 2 commit `f62a2b1`](https://github.com/kannansuresh/chirping-astro/commit/f62a2b19c02f4eb27579869e902cda4876db7fa2), [package manifest](https://github.com/kannansuresh/chirping-astro-starter/blob/821bc6171f2ed0f74d920cc5ab70794c3f779971/package.json)                                  | Target ranges include Astro `^7.0.5`, MDX `^7.0.1`, Expressive Code `^0.44.0`, Sätteri `^0.3.3`; adopt manifest and matching lock as a pair, not Astro alone. These are upstream's pinned-state ranges, not claims about latest registry versions.                                         |
| Conditional math CSS                 | [July 8 commit `54f5696`](https://github.com/kannansuresh/chirping-astro/commit/54f56963932194c74d4bee1047bc5ba8307fef20), current post/page layouts                                                                                                                                              | Dynamic imports improve the intended per-page behavior. Reconcile layout edits while preserving local post presentation and image/SEO behavior.                                                                                                                                            |
| Theme/navigation transitions         | [July 8 radius fix](https://github.com/kannansuresh/chirping-astro/commit/f2a10719deb47270ce9659908e6bc68d31e07362), [July 17 navigation change](https://github.com/kannansuresh/chirping-astro/commit/a85e26d3d8c666f7b635c74a129e06173f787089)                                                  | Adds radius margin and adjusts root transition styles. Include upstream defaults, then inspect keyboard navigation, theme changes, and motion preferences.                                                                                                                                 |
| OG generation skips hero-image posts | [July 10 commit `7d7c763`](https://github.com/kannansuresh/chirping-astro/commit/7d7c76325a6e4b5ef79651df1c99a4173f680a60)                                                                                                                                                                        | Reduces generation; must verify no canonical/OG tags or local custom fallback still point to omitted PNGs.                                                                                                                                                                                 |
| Base-path rewriting                  | [July 10 commit `1c4c44e`](https://github.com/kannansuresh/chirping-astro/commit/1c4c44e2deee745d86373d14dc349aa0106b3628), [`satteri-base-links.ts`](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/src/plugins/satteri-base-links.ts)             | Prefixes absolute internal links/images under a base path. Test alongside CDN rewrites and existing `withBase` calls; plugin does not check if a path already contains the base. Root-host deployment makes it a no-op.                                                                    |
| Native Mermaid and schema field      | [current Mermaid island](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/src/components/islands/Mermaid.astro), [content config](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/src/content.config.ts) | Adds `mermaid: false` default and opt-in island. Existing content need not enable it; feature regression fixtures should cover enabled and disabled pages.                                                                                                                                 |
| Tooling/runtime changes              | Current `bunfig.toml`, manifest, lock, and source workflow                                                                                                                                                                                                                                        | Bun minimum release age, changed fonts/KaTeX/Satori/lint versions; source CI uses Bun 1.3.13. Do not transplant upstream GitHub Pages deployment over local Cloudflare workflow.                                                                                                           |

## Essential local compatibility seams

These are verified source differences that a future implementation must preserve or deliberately replace, not a proposal for a large generic theme framework:

1. **Content identity:** local `src/utils/posts.ts` strips trailing `/index` in both `postSlug` and translation-key fallback. Upstream [helper](https://github.com/kannansuresh/chirping-astro/blob/4585c2d78f1c429e5c3092ed79e68cc839413964/src/utils/posts.ts) does not. Existing local folder posts must keep `/posts/name/` and `/vi/posts/name/`, not gain `/index/`. Keep explicit translation keys and EN/VI sibling selection. Retain local frontmatter `postSlug` field support required by CMS, while verifying which helper actually chooses the URL.
2. **Comments:** local `src/components/islands/Giscus.astro`, `src/config.ts`, and actual paths together define discussion identity. Upstream island still maps its locale switch to FR/EN; preserve VI language handling and existing pathname mapping, repository/category configuration, and canonical path behavior. Test association read-only or in a dedicated nonproduction discussion repository, without creating production discussions.
3. **Media:** local `src/utils/image.ts`, `remark-cdn-images.mjs`, helper hero-image logic, `astro.config.mjs` allowlists, public headers, CMS upload configuration, and content URLs form one contract. Preserve already published URLs and transformation semantics, including Cloudinary URLs, CDN URLs, and MDX component/hero-image cases. A Markdown-only AST hook does not prove every MDX component image is rewritten.
4. **Site/CMS ownership:** preserve EN/VI content/pages, media assets, `public/cms/**`, `public/_headers`, `.github/workflows/deploy-cf.yml`, identity/locale/environment bindings, essential SEO changes, and necessary content components such as Alert/VideoEmbed. Protect these from starter deletions. Use narrow explicit local adapters/config where they reduce repeated conflicts; do not introduce a plugin framework solely to move code around.
5. **Optional presentation:** avatar placement, ReadingProgress, and BackToTop customization may remain deferred. Do not let them block adopting upstream behavior and proving CMS publishing works.

## Astro 6 → 7 requirements

Context7 resolution selected `/withastro/docs` (official, high reputation), followed by three focused queries: v7 breaking changes, Markdown processor migration, and Bun/runtime requirements. The imported project already used Astro `^6.3.1` and loader-based collections, so speculative v4/v5 migration work is unnecessary.

The [official v7 migration guide](https://docs.astro.build/en/guides/upgrade-to/v7/) verifies Vite 8, stricter Rust template compilation, reserved `src/fetch.ts`, stable/removal of several experimental flags, and default Sätteri. For this repo, check existing templates/MDX for invalid or unclosed markup and run the final framework checks/build; assess Tailwind/Vite integration compatibility from the adopted dependency set. No `src/fetch.ts` migration is known to be required here. Existing content loader/schema structure remains usable; merge the new Mermaid field with local fields.

Markdown is the main behavioral seam. Official docs allow either porting remark/rehype plugins to Sätteri or explicitly installing `@astrojs/markdown-remark` and selecting `unified()`. Deprecated remark/rehype config options alone require that package. Preferred target is upstream Sätteri plus a narrow local CDN-image port; unified is a documented fallback if the port cannot be validated, with that divergence recorded. Keep MDX, alerts, raw HTML blocks, code, math, headings/TOC, and image fixtures in the acceptance set. These are requirements for verification, not claims of compatibility already proven.

The same migration guide says default HTML compression changed to JSX rules; missing spaces between inline elements can affect rendered prose. Inspect representative EN/VI pages; `compressHTML: true` preserves former HTML-aware behavior if needed. Remove only flags actually promoted/removed: upstream still deliberately uses experimental SVG optimizer and content intellisense, so deleting the entire experimental block would be unjustified.

Runtime evidence has a freshness discrepancy: Context7 returned both 22.12.0 and 22.23.4 snippets. The live [Astro installation page](https://docs.astro.build/en/install-and-setup/) on this date states Node **22.23.4+**, even versions. Prefer the live requirement when running under Node, and validate the exact pinned Astro package engine when implementation selects its lockfile. The [official Bun recipe](https://docs.astro.build/en/recipes/bun/) supports Bun install/build/preview but warns of integration rough edges. Upstream's broad `bun >=1.1.0` manifest and README do not prove every modern dependency works on that oldest runtime; use a tested runtime consistent with upstream CI (Bun 1.3.13 is its current workflow pin) and verify the actual deployment environment.

## MDX/CDN follow-up — exact locked package source verified

**Yes: Astro 7's MDX integration applies inherited Sätteri MDAST/HAST plugins to `.mdx` Markdown content.** All eight current blog posts are `.mdx`; their extension does not require falling back to integration-specific unified hooks. The [official MDX processor documentation](https://docs.astro.build/en/guides/integrations-guide/mdx/#processor) says the processor defaults to `markdown.processor`, and MDX can explicitly override it. Current online documentation describes MDX 8, so the exact version-7 source was checked separately rather than assuming latest docs apply unchanged.

Source evidence was downloaded and extracted **only under `/tmp`**, without running package code, installing dependencies, or building the product. Checked both manifest-minimum MDX 7.0.1/Sätteri processor 0.3.3 and the actual versions resolved by [upstream `bun.lock`](https://github.com/kannansuresh/chirping-astro-starter/blob/821bc6171f2ed0f74d920cc5ab70794c3f779971/bun.lock): **Astro 7.1.6, MDX 7.0.5, `@astrojs/markdown-satteri` 0.3.5, and `satteri` 0.9.5**. Downloaded MDX 7.0.5, processor 0.3.5, and Sätteri 0.9.5 archives matched their lockfile SHA-512 integrity values exactly.

In the official [MDX 7.0.5 package archive](https://registry.npmjs.org/@astrojs/mdx/-/mdx-7.0.5.tgz):

- `dist/index.js` selects `partialMdxOptions.processor ?? config.markdown.processor`.
- `dist/vite-plugin-mdx.js` recognizes the Sätteri processor and passes `processor.options` to `createSatteriMdxProcessor`.
- `dist/satteri/index.js` puts `...satteriOptions.mdastPlugins` before Astro's `collectImages` plugin, forwards `...satteriOptions.hastPlugins` before Astro's image conversion/headings/metadata plugins, and sends these arrays to `mdxToJs`.
- `dist/index.d.ts` exposes `processor?: MarkdownProcessor`; integration-level `remarkPlugins`/`rehypePlugins`/`remarkRehype` are deprecated and recommend an explicit `unified({...})` processor instead. Adding `mdx({ remarkPlugins: [...] })` is not the supported way to extend an inherited Sätteri pipeline.

The [processor 0.3.5 archive](https://registry.npmjs.org/@astrojs/markdown-satteri/-/markdown-satteri-0.3.5.tgz), `dist/satteri-processor.js`, likewise runs user MDAST plugins before its Markdown collect-images pass. Its collector uses an `image(node, ctx)` visitor reading `node.url`. The [Sätteri 0.9.5 types](https://registry.npmjs.org/satteri/-/satteri-0.9.5.tgz), `dist/mdast/mdast-visitor.d.ts`, provide an `image` visitor over `Readonly<Image>` and typed `ctx.setProperty(node, key, value)`; `dist/mdx-types.d.ts` separately models JSX elements and expression attributes. Therefore the precise supported port is a `defineMdastPlugin` image visitor registered in `satteri({ mdastPlugins: [...] })` that uses **`ctx.setProperty(node, 'url', cdnUrl(node.url))`**, rather than mutating a readonly node. This is an extension recommendation inferred directly from those published types and pipeline order, not a runtime proof.

| Media shape                                                              | Supported extension and limitation                                                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.md` inline Markdown `![alt](URL)`                                      | Shared Sätteri MDAST `image` visitor; rewrite before Astro collects/marks images                                                                                                                                                                                                           |
| `.mdx` inline Markdown `![alt](URL)`                                     | The **same inherited plugin** runs through MDX's Sätteri branch; no separate remark integration needed                                                                                                                                                                                     |
| Reference-style Markdown images                                          | MDAST has separate `imageReference` and `definition` visitors. An `image`-only plugin is not sufficient evidence of coverage; implement/test explicit reference resolution if supported, avoiding rewriting unrelated link definitions                                                     |
| MDX `<img src="URL" />` and `<SmartImage src="URL" />` / `<Image ... />` | JSX element/attribute nodes, not MDAST image nodes. A deliberate JSX visitor can handle approved literal attributes, but a plain HAST `element: ['img']` or MDAST `image` visitor does not establish JSX coverage                                                                          |
| MDX `src={expression}` / spread props / imported asset objects           | Do not evaluate arbitrary expressions at compile time. Normalize at a local component/helper boundary after the string value is known; preserve `ImageMetadata`. Direct `astro:assets` imports require an explicit helper call or local wrapper if automatic CDN normalization is intended |
| Frontmatter hero images, cards, OG metadata                              | Preserve local `heroImage()` and `heroImageSrc()` calling `cdnUrl`; these values are outside Markdown image-node traversal. Current `SmartImage.astro` itself does **not** call `cdnUrl`, so its direct MDX usage does not inherit hero-helper normalization                               |

Use one idempotent URL normalizer for the Sätteri visitor and runtime helper/component boundary. Preserve non-target URLs, local paths/imported assets, already-CDN URLs, and existing Cloudinary transform stripping semantics. Confirm all consuming code uses the intended boundary; do not claim a single AST hook covers every media route. Rewriting to a CDN URL also does not prove image optimization/remote allowlist behavior: the inspected MDX collector is constructed without image options, and final `src`/`srcset` behavior requires explicit fixtures.

The later implementation acceptance set must include `.md` and `.mdx` Markdown-image fixtures, MDX literal/expression/component cases, imported `ImageMetadata`, frontmatter hero/card/OG paths, CDN idempotency and Cloudinary transformations. The implementation may choose an explicit unified processor for MDX as a documented fallback, but it would then need equivalent plugin coverage and diverge from upstream's native Sätteri behavior. No such fallback is required merely because current posts are MDX.

### Live-main and validation attribution caveat

The parent agent separately verified live blog main `b278874e33b121a0629de06e9f94bdba7a45bdd0` while staging stayed `ec2f2541b907a2717fccabff55fc55ebfecae453`; local cached main `053c711` was stale. Parent reports two commits of divergence on each side with a common `053c711`, and a tree difference confined to `.github/workflows/deploy-cf.yml` (+5/-15). Live main already configures main/staging preview dispatch, per-ref concurrency, staging site URL, and a staging OG skip flag. First reconcile live main into isolated staging before performing the historical ancestry bridge; the experiment above remains evidence specifically for the recorded `ec2f254` tree. Preserve merge ancestry during eventual integration rather than discarding it via squash/rebase. CMS preview still targets main and requires a separate nonproduction target.

Parent-reported baseline checks (not executed by this research agent): Node-driven Astro check passed with zero errors; Node-driven build produced 33 HTML pages and six OG images with cached-avatar warnings; separate Pagefind indexed 33 pages with en-us/vi-vn. Bun-driven Astro scripts stalled and were interrupted. These baseline observations do not validate the proposed Astro 7 migration, and full staging validation must enable OG generation even if the routine preview workflow skips it.

## Maintenance options

| Option                                                             | Fit                                                                                                                                | Cost/risk                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintained Git derivative of generated starter, narrow local delta | **Recommended**: preserves normal upstream diffs, tests, dependency/lock changes; canonical source remains available for rationale | Need deliberate first shared-base setup because existing import lacks ancestry; content/config conflicts remain explicit                                                                                                                        |
| Periodic three-way file synchronization with pinned manifest       | Feasible fallback, especially if preserving repository graph untouched is paramount                                                | Must record previous/new starter and source hashes, file hashes, locally owned/protected paths, additions/deletions, intentional overrides; blind recursive copying is unsafe; custom sync tooling can become more work than Git                |
| Theme package or vendor-overlay abstraction                        | Poor immediate fit                                                                                                                 | This upstream is a complete source starter with route/config/layout/content interactions, not an exported installable theme API. Building an overlay resolver/package would be our own product and increases maintenance before it proves value |

For Git maintenance, retain existing main/staging history; do not rewrite published history. Add the historical starter commit as a second parent with a one-time `ours` strategy merge, preserving the current staging tree. Then merge the new starter tip normally: the historical starter commit becomes the real three-way base. The `ours` strategy applies **only to the historical import baseline**, never to a new upstream release. This bridge records an imported near-copy as ancestry; it must be documented as synthetic because the original import was not a Git merge and included two personalization changes. A successful subsequent merge plus verification is the adoption evidence. The isolated experiment below supports a simpler and safer first merge: bridge **only the historical near-import starter commit**, then perform a normal three-way merge of current starter main. The bridge must never target latest main, which would tell Git to ignore actual upstream changes.

A small upstream manifest should record source/starter URLs, both adopted full SHAs, the near-import baseline pair, runtime/lock state, and the handful of intentional local divergence paths/behavior. It supports auditability even with normal Git maintenance. Content remains authored in main during staging work; before cutover, synchronize the newest main content/CMS changes and repeat the acceptance checks.

## Isolated historical-ancestry experiment — executed

On the parent agent's request, a separate local clone was created at `/tmp/chirping-ancestry-rehearsal-20261102` with `git clone --no-hardlinks /home/tvp/blog ...`; it fetched starter objects from the existing `/tmp` starter clone. Original project `.git`, branches, refs, and both upstream clone branches were not modified.

A scratch `git merge -s ours --no-ff --allow-unrelated-histories 5e8552f3922b623c04b5d0ffae4d7a9e255ccb20` recorded the old starter as second parent. The inherited commit signing configuration initially tried to access read-only GPG state and failed before writing a commit; the scratch commit was completed with per-command `commit.gpgsign=false`/`--no-gpg-sign`, without changing global configuration.

Verified scratch objects:

- Bridge: `dbd7d9b7e5ced0ecd28ddd329507b9bbda50a0a8`.
- First parent: original staging `ec2f2541b907a2717fccabff55fc55ebfecae453`.
- Second parent: historical starter `5e8552f3922b623c04b5d0ffae4d7a9e255ccb20`.
- Bridge and original staging tree both exactly `a4f3ed4119a600f499c42dd98d2c784e6fbcf56a`.
- `git merge-base <bridge> 821bc617...` returns `5e8552f3922b623c04b5d0ffae4d7a9e255ccb20`.

`git merge-tree --write-tree --name-only <bridge> refs/remotes/upstream/main` performed an actual three-way merge calculation (exit 1, expected for conflicts), producing unresolved tree `e00cc5eda180dd441c224334d4ff58f554deefab` with **eight conflict paths**:

| Path                            | Conflict / required review                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `README.md`                     | Content conflict; local project documentation is intentionally different                                  |
| `astro.config.mjs`              | Markdown pipeline, runtime/fonts, integrations, local CDN/image configuration                             |
| `bun.lock`                      | Reconcile selected package manifest and regenerate later under the selected runtime                       |
| `package.json`                  | Preserve local scripts/identity and direct requirements while adopting upstream compatible dependency set |
| `src/config.ts`                 | Personal identity, EN/VI, environment binding, site configuration                                         |
| `src/content/pages/en/about.md` | Keep authored personal page                                                                               |
| `src/content/pages/fr/about.md` | Modify/delete conflict; keep the local FR deletion rather than restore sample content                     |
| `src/utils/posts.ts`            | Legacy URLs/translation fallback/CDN semantics versus upstream Unicode slug helper                        |

`src/content.config.ts`, `src/layouts/PostLayout.astro`, and `src/styles/global.css` auto-merged. Inspection showed the post layout retained local ReadingProgress, image imports, translation props, and added upstream conditional math/Mermaid imports; global CSS received upstream root-transition rules. Automatic merging is textual evidence, **not** semantic acceptance. The new upstream Unicode slug tests must remain meaningful; preserve legacy public taxonomy URLs through an explicit compatibility adapter/mapping in route generation rather than silently weakening upstream behavior/tests.

The calculated tree preserved exact local blobs for `public/cms/config.yml`, `public/cms/index.html`, `public/_headers`, `.github/workflows/deploy-cf.yml`, `src/components/islands/Giscus.astro`, `src/utils/image.ts`, and `src/plugins/remark-cdn-images.mjs`. Only the two conflicted about-page paths changed under `src/content/**`; existing EN/VI posts were retained. This supports practical Git-based maintenance with a bounded initial reconciliation. It does not establish that the unresolved config invokes the preserved media plugin correctly, that the restored FR conflict is resolved, or that the resulting product passes checks.

No conflict resolution, dependency install, build, checkout of a merged product, push, deployment, or modification of project refs was performed. Actual project ancestry changes remain later implementation work after plan approval.

## Real update rehearsals

Use historical upstream commits to prove the chosen process handles a genuine subsequent change. These pairs are verified ancestors, not invented commits:

| Rehearsal                                | Before                                             | After                                              | Actual change                                                                                                                                                   |
| ---------------------------------------- | -------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Functional file addition/config conflict | starter `a5cda9782b93f241f22ef38d9ff7b328a354a0b3` | starter `a2b22df2c0619c7d157324c9de458f38585d8e50` | source `23aab5b282fd54ab49466a22617dbb6e373f4071` → `1c4c44e2deee745d86373d14dc349aa0106b3628`; adds 56-line base-links plugin and two config lines (+58 total) |
| Dependency/lock pair                     | starter `f63a255317c8851d0f354de2fc7580d57873af3e` | starter `821bc6171f2ed0f74d920cc5ab70794c3f779971` | two files: `package.json` and `bun.lock`, +6/-4 total; source `5ca66aaad72fdd70a5e098d6ddd1069f8c18dd98` → `4585c2d78f1c429e5c3092ed79e68cc839413964`           |

The first can be rehearsed as a checkpoint during staged historical catch-up, then the implementation can continue to current main. It must not be applied again to latest code, where the plugin has since been renamed to Sätteri. The second is a small rehearsal of final dependency update mechanics and lock coherence. In each disposable branch/copy: apply/reconcile the update, inspect new/deleted/protected paths, verify unchanged content/URL/comment/CMS contracts, validate the intended upstream effect, and verify rollback. Product builds/install/runtime checks belong to the later authorized implementation stage, not this research run.

## Remaining uncertainty

No live build or CMS round-trip was performed; source inspection cannot establish framework compatibility, SEO output correctness, existing discussion mappings, Cloudinary authentication/upload behavior, or production canonical/redirect behavior. Public configuration inspection cannot prove connected account permissions. Staging preview host and isolated CMS backend need to be selected and tested without writing production content. If future source/starter tips differ, re-run ref verification and compare the generated core before changing the target. The report's recommendation is supported by exact historical identity and current code equivalence; practical update/rollback success remains an implementation acceptance gate.
