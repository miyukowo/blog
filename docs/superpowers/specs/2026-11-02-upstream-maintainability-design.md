# Upstream catch-up and maintainability design

Status: proposed for user review; implementation is not authorized by this document.
Date: 2026-11-02. Execution method: DeepSeek through dsh-handoff, followed by independent Codex review.

## Outcome and agreed constraints

Bring the blog to the verified current Chirping starter while preserving its public and editorial contracts. Then make subsequent upstream updates normal, reviewable Git merges with a small, explicit local delta. Prefer upstream implementations; temporarily defer optional presentation rather than build a generic theme framework.

The user approved these requirements during the interview:

- Work on staging; merge into main only after independent validation and approval.
- Preserve existing URLs, EN/VI content, images, pathname-based comment associations, essential SEO, and usable publishing/media workflows.
- Required major framework/dependency upgrades are allowed.
- Avatars beside posts, reading progress, and other optional presentation may be deferred; document omissions and restoration work.
- Provide isolated staging preview and nonproduction CMS write tests.
- Publishing on main can continue during implementation; reconcile content before final validation/cutover.
- Prepare future updates mechanically, check them automatically, and require human review before production.
- Favor long-term upstream compatibility without unnecessary rewrites or architectural complexity.

The architecture and file choices below are engineering recommendations for review, rather than additional user-selected requirements.

## Evidence and current state

Read [the upstream research](../../research/2026-11-02-chirping-upstream.md) and [the measured baseline](../../research/2026-11-02-blog-baseline.json) alongside this design. Research establishes exact Git objects, provenance, upstream changes, source citations, and an isolated ancestry experiment.

| Reference                                      | Verified value                           |
| ---------------------------------------------- | ---------------------------------------- |
| Current local and live staging                 | ec2f2541b907a2717fccabff55fc55ebfecae453 |
| Cached local main                              | 053c711e5966089c2ef7de6ecbfe9416d0d79c96 |
| Live main, checked without changing local refs | b278874e33b121a0629de06e9f94bdba7a45bdd0 |
| Original local import                          | d927dd2e70f1de9a1997e518633d95ea8648033a |
| Identified historical starter import           | 5e8552f3922b623c04b5d0ffae4d7a9e255ccb20 |
| Canonical source for historical starter        | 551ffe811906f6fe2813da4ea271c2d5f638b721 |
| Target starter main                            | 821bc6171f2ed0f74d920cc5ab70794c3f779971 |
| Canonical source for target starter            | 4585c2d78f1c429e5c3092ed79e68cc839413964 |

The original import has exactly the historical starter's 87 paths; 85 blobs match. Only package.json and src/config.ts had already been personalized. This is an imported near-copy, without shared Git ancestry. The local history contains 75 commits. Initial import to staging changes 57 files (+3238/-957 with Git rename detection), including content/assets; the theme has not become a separate application requiring a rewrite.

The starter is generated from the canonical source, with 76 shared src/public files byte-identical at the target. Its filtering removes upstream demos and maintainer machinery. Track that starter for Git updates and the full theme for release rationale, source provenance, and issues. Check source/starter correspondence on every update; do not copy the canonical theme's cleaner into this blog.

The target manifest declares Astro ^7.0.5 and MDX ^7.0.1, while its actual lock resolves Astro 7.1.6, MDX 7.0.5, markdown-satteri 0.3.5 and satteri 0.9.5. The migration adopts the reviewed package/lock pair, not merely those minimum ranges or an unrelated latest-registry upgrade.

**Live-main correction:** staging and live main diverge 2/2 commits from cached main, but their trees differ only in deploy-cf.yml. Live main already adds staging triggers, per-branch concurrency/deployment identity, a staging-blog.tvphus.dev site URL, and an OG-generation skip on staging. Reconcile that workflow first and build on it. The staging domain's actual DNS/custom-domain attachment and current Pages settings were not verified. Earlier observations of a main-only workflow describe local staging, not the newer live main.

### Baseline checks actually run

| Check                                            | Observed result                                      | Interpretation                                                                                                        |
| ------------------------------------------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Explicit Node Astro check, installed Astro 6.3.3 | PASS: 57 files, zero errors/warnings/hints           | Source types currently check under Node 26.12.1                                                                       |
| Explicit Node Astro full build                   | PASS: 33 HTML pages, six OG images, sitemap produced | Existing cache supplied remote GitHub avatar images after fetch warnings; not a clean-network/cache-independent proof |
| Pagefind command, separately after that build    | PASS: 33 indexed pages, EN/VI                        | Existing installed dependencies; no fresh frozen install was performed                                                |
| bun run typecheck / bun run build                | Stalled before normal Astro output; interrupted      | bunfig.toml forces Node shebangs to Bun; Node execution worked. Exact underlying Bun failure remains unproven         |
| bun run lint, confirmed with JSON ESLint results | FAIL: 921 errors, three warnings                     | 918 errors/two warnings in ignored local Obsidian plugins; three errors/one warning in tracked VideoEmbed/OG code     |

The local Obsidian directory is ignored by Git but not by ESLint. Leave that user-owned directory intact and exclude it from code checks. Repair actual tracked-code diagnostics rather than weakening lint rules. Formatting and clean-install checks remain implementation gates, not claimed passes.

The JSON baseline records all 12 tracked content files and body hashes, 33 HTML routes/canonicals/language metadata, feeds, 32 sitemap URLs, six OG paths, and search languages. It is a measured staging reference, not a mandate to freeze existing defects or optional presentation. One existing defect to correct is VI RSS reporting en-us. External CMS authentication, Cloudinary uploads, live discussions, and live hosting were not exercised.

### Why updates currently hurt

1. Missing upstream ancestry prevents a useful ordinary three-way merge.
2. Branding, VI locale assumptions, CDN policy, navigation fixes, presentation, and hosting share upstream files.
3. File-based post identity changed to folder/index.mdx, while upstream still includes index in its slug.
4. Shared media behavior is duplicated between a remark plugin and hero-image helpers.
5. There is no automated preservation suite or update procedure; upstream fast checks omit required outputs.
6. Deployment and CMS configuration do not share a tested preview isolation contract.

The graph confirms getPosts has 16 direct callers. Keep its interface and existing Astro routes rather than introducing parallel content repositories, service locators, or replacement routing layers.

### Customization disposition

This covers the changed code/config/assets as well as authored content; paths are relative to the repository root.

| Current change group                                                    | First-migration disposition                                                                                                                         |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| README.md                                                               | Keep blog introduction; add maintenance links, retain theme attribution/license                                                                     |
| .github/workflows/deploy-cf.yml, deploy.yml, public/\_headers           | Reconcile live-main staging improvements; preserve hosting/cache behavior and validate both active endpoints                                        |
| .gitignore, empty .pages.yml                                            | Keep editor ignores; exclude local caches from checks. Remove empty CMS experiment only after confirming no consumer                                |
| package.json, bun.lock, bunfig.toml, astro.config.mjs                   | Adopt upstream compatible dependency/processor set; retain needed WASM/media requirements, tested Node execution and site allowlist                 |
| src/config.ts, src/i18n/ui.ts, src/i18n/utils.ts                        | Extract site identity and VI dictionary/metadata with small explicit upstream imports                                                               |
| src/utils/posts.ts, src/content.config.ts                               | Keep index-slug/translation/CMS compatibility; adopt new upstream schema fields, Unicode utility and tests without changing existing taxonomy paths |
| src/utils/image.ts, remark-cdn-images.mjs                               | Consolidate conversion into the shared local helper and supported Sätteri image hook                                                                |
| src/utils/og-image.ts                                                   | Retain WASM and VI font support until host evidence permits simplification                                                                          |
| src/components/SEO.astro, Giscus.astro                                  | Keep VI metadata/comment locale, mapping and necessary client-navigation fixes                                                                      |
| LanguageSwitcher.astro, Topbar.astro, BaseLayout.astro, taxonomy routes | Retain actual translated destinations through small props/local resolver; optional mobile-avatar changes may be deferred                            |
| PostLayout.astro, ReadingProgress.astro, BackToTop.astro                | Prefer upstream layout and defer optional adornments if necessary; retain content/SEO/translation behavior                                          |
| src/styles/global.css, Panel.astro, Sidebar.astro                       | Adopt upstream style/layout defaults; preserve necessary asset wiring and readable VI text; no broad visual rewrite                                 |
| Alert.astro, VideoEmbed.astro                                           | Retain authored interfaces; fancy direct-video controls may simplify without dropping playable content                                              |
| public/cms/config.yml, index.html                                       | Retain CMS, correct media/config/publishing contracts, pin verified bundle and generate isolated preview config                                     |
| public and src/assets/images/site branding files                        | Retain branding/media; remove only confirmed duplicates/unused assets                                                                               |
| src/content/pages/** and posts/**                                       | Preserve all current EN/VI pages/posts/drafts and body hashes; keep FR demo deletion, never resurrect upstream sample content over personal files   |

## Alternatives and selected approach

| Approach                                                                      | Assessment                                                                                                                                        |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Maintained starter derivative with restored ancestry and small site modules   | Recommended: ordinary Git understands additions/deletions and preserves release history; real import identity makes the initial bridge defensible |
| Three-way file synchronization with protected-path/hash manifest              | Viable fallback if ancestry must remain untouched, but requires custom synchronization/conflict tooling and separate deletion handling            |
| Vendor copy, submodule, installable theme package, or generic override loader | Not justified by this source starter; introduces another integration mechanism across routes/config/content                                       |
| Rebuild from scratch or cherry-pick isolated upstream fixes forever           | Discards useful shared structure or leaves catch-up incomplete                                                                                    |

Retain public repository history. Establish one synthetic ancestry bridge to the historical imported starter only, then merge current starter normally. The isolated rehearsal preserved staging's tree exactly and found eight conflict paths: README.md, astro.config.mjs, bun.lock, package.json, src/config.ts, EN about content, deleted FR about content, and src/utils/posts.ts. Auto-merged files still require semantic review.

Never use an ours merge for a new upstream tip, never suppress conflicts with blanket ours/theirs resolutions, and never force-push or rewrite existing history. Git operations belong to the orchestrator; DeepSeek cannot access .git.

## Target structure and ownership

Keep normal Astro folders and upstream filenames. Add a small site directory for behavior that demonstrably differs. Existing imports continue through the theme's public helpers; local modules do not impersonate an upstream package.

```text
src/
  site/
    config.ts           site identity, image choices and overrides
    locales.ts          EN/VI tuple and locale presentation metadata
    vi.ts               Vietnamese UI dictionary
    urls.ts             folder-index identity and legacy taxonomy slugs
    taxonomy.ts         translated category/tag destination resolution
    media.ts            one Cloudinary-to-CDN URL policy
    markdown.ts         image hook for selected Markdown processor
    og-image.ts         build-time WASM renderer and Vietnamese fonts
  components/
    Alert.astro         preserve published MDX import path
    VideoEmbed.astro    preserve authored-content interface
  content/              blog-owned content, kept at existing paths
  config.ts             upstream config with small explicit site imports
  utils/posts.ts        upstream helper with narrow compatibility calls
scripts/
  site-contract.mjs     capture/assert generated-site contracts
  check-upstream.mjs    read-only drift/ownership/provenance report
tests/site/             contract, locale/media and rendering fixtures
theme-upstream.json     adopted source/starter SHAs and exception inventory
docs/                   audit, plan, decisions and update/cutover runbook
```

Do not create one-line forwarding files simply to move names. Keep src/utils/og-image.ts as a documented site-owned exception if moving the actual renderer would only add a wrapper. The required outcome is explicit ownership and small upstream call-site changes.

| Owner                          | Paths and policy                                                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Blog data                      | src/content/\*\*; retain current posts/pages/drafts, translation keys, dates and body bytes unless a reviewed mechanical compatibility edit is required                              |
| Blog integrations              | src/site/**, public/cms/**, public/\_headers, Cloudflare workflow, scripts, tests, docs and upstream manifest                                                                        |
| Blog branding                  | Existing avatar/favicon/default OG assets in public and src/assets/images/site; choose one authoritative copy per consumer and remove duplicates only after reference verification   |
| Upstream by default            | Other components/layouts, src/plugins upstream plugins, styles, content schema/types, image wrapper, pure slugify utility and its upstream tests                                     |
| Shared, explicit exceptions    | astro.config.mjs, package.json/lock, bunfig, src/config.ts, i18n export/formatting seams, posts helpers, locale metadata in SEO/RSS/Giscus, taxonomy routes/layout translation props |
| Existing GitHub Pages workflow | Preserve until read-only account/repository evidence establishes whether used; do not silently retire a second public endpoint                                                       |

theme-upstream.json is provenance/documentation, not an engine for overlaying files. Store schema version, source/starter URLs and full adopted SHAs, historical import pair, tested Node/Bun versions, local-owned path patterns, and shared-file exceptions with reason and validation command. Never store credentials or a fake latest-version claim.

## Compatibility modules and exact behavior

### Identity and locale

- src/site/locales.ts owns ['en', 'vi']; EN remains unprefixed and VI remains /vi. It supplies date/HTML/OG/RSS/Giscus locale values. Current mappings are en-US/en_US/en-us/en and vi-VN/vi_VN/vi-vn/vi.
- Preserve upstream English/French dictionary definitions; export configured messages plus a local VI dictionary. Check VI keys against upstream EN keys at compile time so new upstream text requires translation.
- src/site/urls.ts strips only a recognized locale prefix, optional .md/.mdx suffix, and terminal /index. Preserve explicit translationKey; fallback uses that same normalized content identity. postSlug frontmatter remains accepted for CMS, but filesystem identity continues to determine the URL. A mismatched saved field is rejected by validation rather than silently moving a published post.
- Keep legacy ASCII taxonomy slugs for this blog, including /vi/categories/huong-dan/. Delegate post helper export/call sites to the local slug policy; leave upstream src/utils/slugify.ts and its Unicode tests intact. A future switch to Unicode URLs is a separately reviewed migration.
- Move the existing translated tag/category destination logic into src/site/taxonomy.ts and keep server-rendered translation destinations. Missing counterparts fall back to the appropriate locale index, never a fabricated 404.
- Preserve post sibling links when translated slugs differ. Essential hreflang output must use the actual sibling URL, not assume matching slugs.

### Media and authored components

- resolveMediaUrl(src: string): string is the single URL conversion policy. Normalize only this site's known Cloudinary upload URLs to its existing CDN optimized path; avoid duplicate transforms, preserve version/public-id paths/query semantics, and make existing CDN URLs idempotent.
- Preserve unrelated HTTPS, public-root, and local asset references. Do not guess that a bare filename is a Cloudinary public ID. Current tracked content has no heroImage values requiring such a conversion; new CMS output must contain full URLs.
- Reuse this function for hero/SEO resolution and the selected processor's Markdown-image hook. Keep the CDN and Cloudinary image allowlists.
- Preferred processor is upstream Sätteri. Exact locked MDX 7.0.5 package inspection verified inheritance of processor MDAST/HAST plugins, so one image hook covers Markdown-image syntax in both .md and .mdx. Use defineMdastPlugin with ctx.setProperty on readonly image nodes before Astro image collection. Reference-image definitions and JSX/component props are separate cases; rendered fixtures must exercise them and hero images independently. See the research report's exact package-source evidence.
- Preserve Alert and VideoEmbed interfaces used by existing posts or drafts. Optional Plyr controls can be simplified to working native video if necessary; never drop the element or import needed to render authored content.
- Retain WASM OG generation and Vietnamese glyph coverage until a clean build in the actual Pages build environment proves upstream native rendering is sufficient. This is build-time work, not a Cloudflare Worker runtime requirement.

### Configuration and optional UI

Use upstream defaults with typed site overrides and locale metadata. Avoid duplicating the entire theme config in a second file. Keep public environment bindings and existing Giscus repository/category/mapping values; credentials stay in existing secret stores.

Adopt upstream layouts/styles/font behavior first where it meets content and VI rendering requirements. Remove hashed font preloads rather than carrying build-output filenames across releases. Defer post/mobile avatar placement, progress bar, animated back-to-top variant, custom typography/spacing polish, and fancy direct-video controls only when needed. Record each actual omission in the update runbook with affected files, a minimal restoration seam, and acceptance criteria.

If later restored, optional post adornments belong in one site-owned Astro module inserted at one layout seam, with its styles colocated. Do not build a slot registry, runtime hook bus, CSS override hierarchy, or an unrequested design system.

## Preview, CMS and ongoing publishing

Build on live main's branch-aware Cloudflare workflow rather than recreate it. Verify the Pages production branch and staging custom domain before deploying. main stays production; staging is a separate branch deployment at the root path, not a /staging prefix that changes comment path identity.

Use distinct validation and deployment modes:

- Production-shape validation: production canonical origin, root base, full content/OG/RSS/sitemap/Pagefind, no CI_SKIP flags.
- Deployed preview: verified staging origin, root base, noindex response header, production comments disabled or replaced with a dedicated nonproduction discussion configuration, CMS backend isolated from main.
- CMS write test: short-lived nonproduction branch, distinct from the implementation branch; create/edit translated draft, select/upload media, save/reload, and delete the test content there. Assert that main and implementation branch content did not change.

Generate dist/cms/config.yml from the tracked production config for preview, setting its backend branch to an explicit test branch. Fail closed for preview if that branch is absent or main. The preview CMS entry must not fetch the production config. Production config remains main. A local test-repo backend can support offline checks but cannot substitute for the final authenticated round-trip.

The current CMS configuration mixes global full URLs with field-level filename-only overrides and inconsistent indentation. Align field/global output to full URLs, validate YAML semantics, keep EN/VI multiple folders and postSlug/index.mdx conventions, and verify custom Alert editing actually emits renderable MDX. Current Sveltia documentation confirms field media options override global options; changing only the global value is insufficient. Pin the Sveltia bundle to a verified compatible version when implementing; do not invent a version from this audit. [Sveltia integration option precedence](https://github.com/sveltia/sveltia-cms/blob/main/_autodocs/api-reference/integrations.md)

CMS currently sets skip_ci: true and historical CMS commits include [skip ci]. GitHub skips push/pull_request workflows for that marker. Set skip_ci: false for the normal publishing path and verify a CMS save causes the expected rebuild; avoid custom skip-bearing commit messages. This is necessary for usable publishing with Actions deployment, not a wholesale CMS replacement. [GitHub skip behavior](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs), [Sveltia backend configuration](https://github.com/sveltia/sveltia-cms/blob/main/_autodocs/configuration.md)

Merge main into staging with ordinary merges during development; inventory all changed content/media paths since the last sync. Protect newly authored content from upstream demo deletions. Before final validation, freeze publishing briefly if needed, fetch main again, reconcile, refresh the baseline for intentional new posts, and re-run full checks.

## Acceptance and future-update workflow

The implementation plan defines commands and fixtures. Minimum evidence:

1. All protected baseline URLs still resolve at the same paths; content/drafts/translation pairs preserved. Added valid routes are allowed; route collisions fail.
2. EN/VI metadata, actual sibling hreflangs, feeds, sitemap and comments mapping are correct. VI RSS language is corrected to vi-vn as an explicit baseline defect fix.
3. Drafts are absent from public artifacts/search; unlisted posts remain reachable and excluded from listings, feeds, sitemap and search, with the configured robots policy.
4. Markdown/MDX alerts, code, math, raw HTML, heading IDs/TOC, media and authored components render. Mermaid opt-in/off follows upstream without forcing it on existing posts.
5. Frozen dependency installation, types, lint, targeted tests, full build and search all pass under documented Node/Bun versions. No cache-only or skipped-output claim qualifies as the final build proof.
6. Cold-load/client-navigation/theme/language/search behavior works on desktop/mobile, including comments mounting after navigation. Mock external frames offline; production comment read-check remains separate.
7. Preview deploy identity/noindex/CMS branch isolation and an authenticated nonproduction CMS/media round-trip are evidenced.
8. Genuine functional and dependency upstream updates are rehearsed, protected files remain intact, and rollback is demonstrated in a disposable checkout.

Future updates: fetch starter/source refs, verify their correspondence and ancestry, create an update branch from staging, merge the pinned starter normally, inspect additions/deletions/shared exceptions, install from reviewed manifest/lock, run all gates, review the PR, then merge preserving history. Never auto-merge/deploy on checks alone.

Use a small check-upstream script for evidence: compare adopted versus fetched Git objects, enumerate local-only/changed/deleted paths, report protected content changes and shared exceptions, and fail on a missing/mismatched pin. It reports drift; it does not copy/delete files or decide conflicts. An optional workflow_dispatch update-PR preparer can perform Git steps with minimum permissions; scheduled updates are outside this initial scope.

Use ordinary merge commits when integrating upstream updates and the final staging branch into main. Squash/rebase would discard the second-parent ancestry being introduced; confirm the adopted starter commit is an ancestor of both branches after cutover.

## Independent review, rollback and open facts

Codex reviews actual diffs and controller artifacts, reruns verification independently, checks unexpected/untracked files, and compares the result with this design. DeepSeek success is not approval. No credentials, .env contents, unrelated private files, or local editor caches belong in worker prompts/bootstrap.

Before migration, record exact staging/main refs and the last healthy Pages deployment. If a phase fails, keep its artifacts and main publishing intact; repair or abandon the isolated task without rewriting production. For a failed cutover, restore the prior Pages deployment and revert the reviewed migration changes on main with new commits while preserving posts published since cutover. Keep the upstream pin/ancestry consistent with any revert and document a re-adoption procedure.

Facts still requiring implementation-time evidence: active Pages settings/custom domain and GitHub Pages usage; CMS authentication/permissions; CDN worker behavior/upload transforms; cold-cache remote assets; exact target dependency engine/runtime requirements. These are explicit preflight or release gates, not unresolved architectural decisions.

The current session exposes no agent-controller delegation tools. Implementation preflight must discover/connect the existing controller; no substitute direct DeepSeek script is authorized by this plan. If unavailable, finish preparatory documentation/verification and report the tooling blocker without starting model turns.

Additional operational documentation was resolved and queried through Context7: [Bun runtime alias behavior](https://bun.sh/docs/runtime/bunfig) confirms run.bun=true overrides Node shebangs and false disables that alias; [Cloudflare direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/) documents branch deployment selection; [Cloudflare preview deployments](https://developers.cloudflare.com/pages/configuration/preview-deployments/) documents aliases and default noindex headers. Those documented capabilities still require verification against the actual configured project.
