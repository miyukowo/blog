# Upstream Catch-up and Maintainability Implementation Plan

> **For agentic workers:** REQUIRED execution workflow: dsh-handoff, as explicitly selected by the user. Codex orchestrates Git operations and independently reviews/verifies each DeepSeek result. Do not substitute Codex implementation or another worker workflow. Steps use checkbox syntax.

**Goal:** Adopt the verified current Chirping starter while preserving public/editorial compatibility, then demonstrate a repeatable reviewed upstream-update workflow.

**Architecture:** Keep the existing Astro application as a maintained derivative of the generated starter. Introduce small site modules for actual identity, locale, URL, media and hosting differences; retain upstream filenames/interfaces elsewhere. Recover the historical merge base without rewriting published history and preserve upstream merge ancestry thereafter.

**Tech Stack:** Astro, MDX, Sätteri, Tailwind/daisyUI, Pagefind, Giscus, Sveltia/Cloudinary, static Cloudflare Pages. Candidate execution pins: Node 26.12.1 and Bun 1.3.14, tested against the final lock before acceptance.

**Spec:** [Upstream maintainability design](../specs/2026-11-02-upstream-maintainability-design.md).
**Evidence:** [Upstream research](../../research/2026-11-02-chirping-upstream.md) and [measured staging baseline](../../research/2026-11-02-blog-baseline.json).

## Global constraints

- Work on staging; merge into main only after independent validation and approval.
- Preserve existing URLs, EN/VI content, images, pathname-based comment associations, essential SEO, and usable publishing/media workflows.
- Required major framework/dependency upgrades are allowed.
- Avatars beside posts, reading progress, and other optional presentation may be deferred; document omissions and restoration work.
- Provide isolated staging preview and nonproduction CMS write tests.
- Publishing on main can continue during implementation; reconcile content before final validation/cutover.
- Prepare future updates mechanically, check them automatically, and require human review before production.
- Favor long-term upstream compatibility without unnecessary rewrites or architectural complexity.
- Preserve all existing content/draft body bytes unless a documented mechanical compatibility edit is reviewed. Do not import demos, restore FR content, or remove personal posts during upstream resolution.
- No history rewrite, force push, blanket conflict strategy, automatic production deployment from an update preparer, or credentials in worker material.
- DeepSeek cannot inspect .git, commit, merge or push. Those are orchestrator operations.

## Review focus

1. A folder-based or translated post must retain its URL, real sibling links and Giscus pathname identity, including different EN/VI slugs — Tasks 1/2/5.
2. A new CMS-created image must survive save/reload, Markdown/MDX compilation and hero/OG rendering without duplicate transforms or a bare filename — Tasks 4/6.
3. Draft/unlisted content must not leak through search, XML, navigation or sitemap, while an unlisted direct URL remains usable — Tasks 1/5.
4. A staging/manual deployment or CMS test must not target production/main or qualify using skipped OG/content checks — Tasks 6/7.
5. Posts published on main during the refactor must survive synchronization, migration, rollback and later upstream merges — Tasks 0/8/9.

## Execution contract and file responsibilities

Read the spec before each task. Map current code with graph tools first; fetch current library documentation through Context7 before API-specific changes. Version ranges in package.json are not resolved versions: the researched target lock resolves Astro 7.1.6, MDX 7.0.5, markdown-satteri 0.3.5 and satteri 0.9.5. Preserve the upstream manifest/lock relationship; review any local dependency additions/removals separately.

| Files                                            | Responsibility                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| tests/site/\*.test.mjs, tests/site/fixtures/\*\* | Meaningful behavior fixtures; Node built-in test runner, no test framework added             |
| scripts/site-contract.mjs                        | Capture/assert built-route, metadata, feed/search, content-hash contracts                    |
| scripts/verify-site.mjs                          | Select deterministic offline/full/preview verification profiles and run appropriate commands |
| scripts/prepare-preview.mjs                      | Generate isolated preview CMS config into dist only; reject main/missing test branch         |
| scripts/check-upstream.mjs                       | Read-only provenance, owned-path and drift report; no copying/conflict decisions             |
| src/site/config.ts, locales.ts, vi.ts            | Typed site choices and locale presentation/dictionary                                        |
| src/site/urls.ts, taxonomy.ts                    | Existing URL identity, taxonomy compatibility, translated destinations                       |
| src/site/media.ts, markdown.ts                   | Shared media normalization and Sätteri image hook                                            |
| src/utils/og-image.ts or src/site/og-image.ts    | Actual build-time WASM/VI renderer; keep one implementation without forwarding clutter       |
| theme-upstream.json                              | Full source/starter pins, historical import pair, runtime and ownership exceptions           |
| docs/maintenance/upstream.md                     | Exact update/rehearsal/cutover/rollback steps and deferred UI register                       |

Keep src/components/Alert.astro and VideoEmbed.astro import paths. Existing Astro routes and src/utils/posts.ts remain the theme interface. Small shared-file imports/changes are enumerated in the manifest. Do not move the whole theme into a vendor folder.

### Controller lifecycle for every worker task

- [ ] Discover the existing agent-controller tools and inspect their actual schemas. They were not exposed in the planning session. Stop delegation if unavailable; do not replace them with direct API scripts.
- [ ] Register/use one isolated task worktree based on the last reviewed snapshot. Supply only needed non-secret files, the spec, this task, and explicit dependency directories. Dependencies must exist before delegation; target Astro 7 needs its own hydrated dependency tree, not copied Astro 6 node_modules.
- [ ] Define a narrow goal, exact permitted paths and an offline verify_command from the task below. Before delegate_task or continue_task, give a fresh user notice of expected model/API turns and purpose. State an unknown/variable turn count when appropriate; include indirect script calls.
- [ ] Require sandboxed foreground bash for worker inspection/editing/checks. Native read/write/edit/glob/grep and Git are unavailable. Never weaken permissions.
- [ ] Use wait_for_task at 30 seconds, at most ten calls by default. Respect the installed five-minute timeout. If a task cannot fit, split at a reviewable output or explicitly set a supported larger budget before starting; do not silently loop new task IDs.
- [ ] Inspect status/events for permission blockers, then cancel/preserve artifacts rather than bypass. Read get_task_result AND get_task_artifacts.
- [ ] Review actual diffs, untracked files, dependency changes and independent verifier output. Rerun checks independently. At most one corrective continue_task, freshly announced; after that report remaining failure.
- [ ] Snapshot only a passing, reviewed task. Mark is_orchestrator_edit if Codex changed the task tree and rerun verification. Close after snapshot, preserve its branch/commit and artifacts, then integrate into staging with ordinary Git operations.

Task completion records include controller ID, snapshot SHA, changed paths, command results and unresolved gates. Offline passing is distinct from authenticated hosting/CMS acceptance. Record provider usage/cost only when supplied by controller/provider.

## Task 0 — Reconcile live main and establish protected inputs

**Owner:** Codex orchestrator; no model turns.
**Files:** Capture/refresh docs/research/_baseline_.json; create docs/maintenance/upstream.md with preflight evidence. No source rewrite.
**Consumes:** Existing staging, live main and public upstream refs.
**Produces:** Clean isolated migration baseline, protected-content manifest, immutable original refs and confirmed host/branch facts.

- [ ] Inspect worktrees/status/stashes. Do not touch the two pre-existing main stashes or ignored Obsidian directory. Use an isolated implementation checkout, with staging as the eventual integration branch.
- [ ] Fetch origin and both upstream repositories into that checkout using separate descriptive remotes. Recheck live heads; planning observed staging ec2f254 and main b278874. Never assume cached local main 053c711 is current.
- [ ] Save backup refs for exact pre-refactor staging/main and record the current healthy production Pages deployment. Merge origin/main into the isolated staging-derived branch with an ordinary merge. Planning's only tree difference was the branch-aware Cloudflare workflow; new changes must be inventoried.
- [ ] Verify source/starter correspondence at the pinned target. If they advanced, report and review the new diff before moving the migration target. Initial pins are starter 821bc6171f2ed0f74d920cc5ab70794c3f779971 and source 4585c2d78f1c429e5c3092ed79e68cc839413964.
- [ ] Inspect hosting settings read-only: Pages production branch, custom-domain/preview routing, existing build method and GitHub Pages usage. Preserve existing GitHub Pages support until evidence supports removal. Reuse the staging workflow already on live main.
- [ ] Capture refreshed source/content/body hashes and production-shape output using explicit Node. Compare with the measured baseline; classify intentional changes from main. Do not erase original evidence when refreshing.

**Verify:** clean implementation tree; all original content preserved; staging/main ancestry and tree difference recorded; no production write. Node baseline build may use existing cache as clearly labeled evidence; cold-cache proof remains Task 7.

## Task 1 — Build the compatibility harness and make runtime checks usable

**Worker scope:** scripts/site-contract.mjs, scripts/verify-site.mjs, tests/site/contracts.test.mjs, tests/site/fixtures/contracts/**, package.json, bunfig.toml, eslint.config.js, .prettierignore, .node-version, minimal tracked VideoEmbed/OG lint fixes.
**Consumes:** Task 0 baseline JSON and existing source.
**Produces:\*\* Repeatable offline contract commands and fixtures reused below.

Interfaces:

- captureSite({ distDir, sourceDir, sourceRevision }): SiteContract; stable schemaVersion 1 matching the recorded baseline fields.
- assertSiteContract(actual, baseline, { allowedChanges }): void; fail with missing/changed path and field. Additions allowed only when classified; collisions and lost protected content fail.
- CLI: node scripts/site-contract.mjs capture --dist dist --output <path>; assert --dist dist --baseline <path>.
- CLI: node scripts/verify-site.mjs --profile offline|full|preview. Offline is deterministic using local assets and non-secret mocked external configuration; full cannot disable content/OG/RSS/sitemap/search.

- [ ] Write failing tests for removal of an existing post URL, new /index suffix, changed /vi/categories/huong-dan/, changed body hash, duplicate route, new legitimate post, and the explicit known VI RSS language correction. Assert failures name the actual changed field.
- [ ] Run node --test tests/site/contracts.test.mjs and confirm the intended failures before implementation.
- [ ] Implement contract parsing for HTML routes/canonical/lang/robots/hreflang/OG, RSS item links/language, sitemap URLs, source/body hashes and search index presence. Use a real parser already available if needed, add a direct dependency only if required; avoid regex-only general HTML parsing.
- [ ] Set bunfig run.bun=false, pin Node 26.12.1/Bun 1.3.14 in the runbook and CI setup later, and confirm Astro commands run under Node. Keep Bun for install and upstream tests. Exclude ignored editor caches from lint/format without deleting them; fix real no-unused-vars diagnostics in tracked code.
- [ ] Add test:site, verify:site and format:site:check scripts. Scoped formatting covers changed local/shared code, scripts/tests/docs/CMS, excluding unchanged upstream files and authored content; record upstream formatting debt rather than reformatting the entire imported theme. Full lint must still cover maintained code.
- [ ] Implement deterministic offline environment with production-shaped origin/root base, local avatar, all content/OG/RSS/sitemap enabled, external comment requests mocked/disabled. Do not copy the user's .env into the worker.
- [ ] Run tests, Node Astro check, maintained-source lint, scoped formatting, build and Pagefind. Compare output with baseline; only listed baseline defects may differ.

**Offline verify_command:** node --test tests/site/contracts.test.mjs
**Host acceptance:** node scripts/verify-site.mjs --profile offline passes; no body reformatting or editor-file changes.

## Task 2 — Isolate locale, URL identity and translated taxonomy behavior

**Worker scope:** src/site/{config,locales,vi,urls,taxonomy}.ts; src/config.ts; src/i18n/{ui,utils}.ts; src/utils/posts.ts; taxonomy routes; BaseLayout/Topbar/LanguageSwitcher translation props; tests/site/{urls,locales}.test.mjs.
**Consumes:** Task 1 harness and current site config/content.
**Produces:** Pure local identity/locale policies and existing helper interfaces with unchanged public outputs.

Interfaces:

- siteLocales = ['en', 'vi'] as const; SiteLocale = typeof siteLocales[number].
- localePresentation(locale): { label, dateLocale, htmlLang, ogLocale, rssLanguage, giscusLang } with EN/VI mappings from the spec.
- contentSlug(id: string, locales: readonly string[]): string; legacyTaxonomySlug(value: string): string.
- getCategoryTranslations(locale, category) and getTagTranslations(locale, tag): Promise<Record<SiteLocale, string>>, called by taxonomy routes.

- [ ] Write failing tests: en/foo/index → foo; vi/foo/index.mdx → foo; nested paths retained; internal index segments retained; explicit translation keys not replaced; Hướng dẫn → huong-dan; recognized locale prefixes only.
- [ ] Add fixture expectations for mismatched saved postSlug/file location and translated posts with different slugs. The mismatch must be reported, not create a new URL. Missing taxonomy counterparts go to the corresponding locale index.
- [ ] Implement pure helpers and move existing taxonomy resolution out of posts.ts. Keep postSlug/postPath/getPosts callers intact. Keep filesystem slug authority and normalized fallback translation identity.
- [ ] Extract typed site overrides and VI dictionary. Preserve upstream EN/FR dictionary definitions; export configured dictionaries and require VI coverage of upstream EN keys.
- [ ] Pass actual translation URLs server-side through layouts/topbar/switcher. Use locale presentation metadata instead of scattering FR→VI replacements.
- [ ] Run pure helper tests, existing contract comparison and typecheck. Confirm source body hashes unchanged and no new routes.

**Offline verify_command:** node --test tests/site/urls.test.mjs tests/site/locales.test.mjs
**Host acceptance:** offline verification and baseline public route contract pass.

## Task 3 — Restore ancestry and adopt the pinned upstream core

**Host Git preparation:** after Tasks 1/2 snapshots, record the pre-bridge tree and bridge the historical import ONLY:

```bash
git merge --allow-unrelated-histories --no-ff -s ours \
  5e8552f3922b623c04b5d0ffae4d7a9e255ccb20 \
  -m "chore: record historical Chirping starter import ancestry"
```

Verify tree equality before/after and that merge-base with target starter is the historical import. The historical bridge is synthetic and documented. Never use this command with target/latest.

**Worker scope:** The enumerated upstream delta plus shared exceptions needed to preserve Tasks 1/2. Most importantly package.json/bun.lock, astro.config.mjs, src/config.ts, src/utils/posts.ts, content schema, upstream plugins/layouts/styles, about-page conflicts.
**Consumes:** Reviewed pre-merge snapshot; immutable base/ours/theirs and automatically merged candidate files prepared by host; target dependency directory hydrated outside worker.
**Produces:** A resolved upstream candidate that preserves the compatibility suite.

- [ ] Host calculates a normal three-way merge in a disposable integration checkout. Save path list, base/ours/theirs for conflicts, and the auto-merged tree as non-secret worker inputs. Baseline rehearsal found eight conflicts; Tasks 1/2 may alter the exact count. Do not delegate from an unresolved .git worktree or assume worker Git access.
- [ ] Before delegation, host hydrates dependencies for the selected target package/lock with Bun 1.3.14 outside the worker, using a separate directory. Existing Astro 6 node_modules cannot verify this task. Review new package changes; do not disable upstream release-age policy or run a general latest upgrade.
- [ ] Preserve upstream Unicode slug utility and upstream test file unchanged. Task 2's local taxonomy compatibility remains wired through posts helpers.
- [ ] Adopt upstream Sätteri processor, plugins, MDX integration, conditional math/Mermaid behavior, dependency changes and compatible configuration. Keep CDN allowlist, local URL/locale/site policies, build-time WASM/VI OG behavior and content-required components.
- [ ] Resolve personal EN about page by retaining it; keep FR sample deletion. Preserve all other content. Keep local README intent and Cloudflare workflow. Record auto-merged layout/style behavior that was reviewed.
- [ ] Remove obsolete remark/rehype packages/plugins only after references are gone. Adopt the manifest and matching lock together, adding only direct dependencies still required by retained local integrations and tests. Host may prepare a regenerated reviewed lock in a dependency-only staging directory; worker must not install dependencies.
- [ ] Run upstream Bun slug tests, local contracts/helper tests, types/lint and full offline build. No conflict markers, duplicate dependency entries or unintended demo routes may remain.
- [ ] Host independently reviews the candidate versus BOTH pre-merge blog and target upstream. Review every target changed path, including deletions, not merely the eight conflicts.
- [ ] After controller verification/snapshot, host uses that reviewed snapshot as the resolution tree of the pending normal upstream merge. Restore only that verified tracked tree into the isolated merge index/worktree; confirm its tree matches the reviewed snapshot exactly before committing with MERGE_HEAD intact. This preserves both real parents without an ours strategy at latest. Keep worker snapshot/artifacts for provenance.
- [ ] Confirm target starter is now an ancestor of the integration branch. Integrate the accepted merge into staging without squashing.

**Offline verify_command:** node scripts/verify-site.mjs --profile offline
**Host acceptance:** full contract pass; target starter ancestry; reviewed upstream delta accounted for; no lost content or silent required-output skips.

## Task 4 — Consolidate media conversion and preserve authored rendering

**Worker scope:** src/site/{media,markdown}.ts; hero/SEO image call sites; astro.config.mjs hook/allowlist; src/plugins/remark-cdn-images.mjs removal after replacement; src/utils/image.ts removal only if no callers; Alert/VideoEmbed fixes if required; tests/site/{media,markdown}.test.mjs and rendering fixtures.
**Consumes:** Upstream Sätteri and MDX from Task 3, existing Cloudinary/CDN URL behavior.
**Produces:** One URL policy used by the Markdown hook and component/hero resolution.

Interfaces:

- resolveMediaUrl(src: string): string, pure/idempotent.
- siteMediaPlugin(): return type of Sätteri defineMdastPlugin; visits image nodes and calls ctx.setProperty(node, 'url', normalized). Nodes are readonly; do not assign node.url.

- [ ] Write failing tests for original Cloudinary upload URL, f_auto/q_auto transform segments, versioned/nested public IDs, repeated conversion, existing CDN URL, unrelated HTTPS, public-root and relative assets, query/hash preservation, and bare filename pass-through.
- [ ] Implement shared conversion using the existing intended CDN path. Never double-transform or rewrite unrelated hosts. Keep bare-ID ambiguity explicit; CMS Task 6 eliminates new filename-only output.
- [ ] Register the MDAST image hook before Astro image collection. Exact locked MDX 7.0.5 inherits Sätteri mdast/hast plugins; no second remark pipeline is needed. Handle reference-image definitions or retain their original valid URLs, with tests.
- [ ] Use the same helper for hero/card/OG strings and relevant local image-wrapper inputs. Test JSX literal/dynamic src props through the component helper separately; an image-node visitor does not cover them. Preserve built-in Astro Image behavior for authored imports.
- [ ] Add disposable .md/.mdx fixtures for Markdown images, references, raw img, SmartImage/Image props, hero images, Alert and VideoEmbed/native video. Assert rendered src/srcset/alt and resource existence, not only transformed AST strings.
- [ ] Remove duplicated old conversion code and unused packages only after both parser and runtime tests pass. Keep actual external image fetching out of offline verification using known local fixtures/mocked responses.

**Offline verify_command:** node --test tests/site/media.test.mjs tests/site/markdown.test.mjs
**Host acceptance:** offline full build plus rendered-media assertions; later Task 7 cold-cache live media smoke.

## Task 5 — Close SEO, content-visibility and navigation compatibility

**Worker scope:** src/utils/seo.ts, SEO component, RSS route, sitemap/unlisted integration in astro.config.mjs, Giscus locale/mount code, necessary layouts/helpers, tests/site/seo.test.mjs and browser/rendering fixtures.
**Consumes:** Actual translated paths, media helpers, full output from prior tasks.
**Produces:** Correct metadata/visibility and working interactions without reintroducing deferred cosmetic work.

- [ ] Write fixtures for listed, draft, unlisted/noindex, missing translation, different translated slug, hero image, math/diagrams enabled and disabled, and VI text. Draft fixtures must never enter a deployed artifact.
- [ ] Assert actual EN/VI canonical and reciprocal hreflang destinations, x-default, article metadata, OG image existence and VI RSS vi-vn. Correct existing VI RSS en-us explicitly rather than bless the defect as baseline.
- [ ] Assert unlisted direct URL generated but absent from home/archive/taxonomy/RSS/sitemap/Pagefind/prev-next; draft absent everywhere public. Fix sitemap slug normalization and search exclusions at their real source if fixtures expose problems. No global SEO weakening.
- [ ] Assert Giscus mapping remains pathname with existing production repo/category bindings; mock client loading/theme messages offline and verify cold load → post navigation → language switch yields one current mount, no stale thread. Preview must not create production discussions.
- [ ] Verify theme persistence, keyboard/mobile navigation, language switch, search EN/VI, TOC IDs, code copying, math and Mermaid opt-in, and reduced-motion behavior. Use the available browser harness; avoid adding a permanent browser-test dependency if an existing tool suffices. Provide reproducible manual steps for authenticated/external checks.
- [ ] Adopt upstream presentation for optional UI, keeping only content/compatibility-required fixes. Record each omitted avatar/progress/back-to-top/Plyr/typography feature with restoration acceptance checks; do not claim an omission unless it actually happened.

**Offline verify_command:** node --test tests/site/seo.test.mjs && node scripts/verify-site.mjs --profile offline
**Host acceptance:** browser evidence and contract output; no unrelated design overhaul or authored body changes.

## Task 6 — Make CMS configuration and preview writes safe and usable

**Worker scope:** public/cms/{config.yml,index.html}; scripts/prepare-preview.mjs; tests/site/cms.test.mjs; tests/site/fixtures/cms/**; docs/maintenance/upstream.md.
**Consumes:** Working media/content contracts and an explicit test-branch name from host.
**Produces:\*\* Production CMS stays on main; preview config writes only to isolated CMS-test branch.

Interface:

- preparePreviewCms({ distDir, branch, siteUrl }): void; validates parsed backend branch, rejects missing/main/staging targets, modifies built preview output only.
- Production config retains miyukowo/blog + main. Test branch name uses codex/cms-validation-<run>, distinct from code/production branches.

- [ ] Write failing config tests for missing/main/staging preview branch, preview entry accidentally loading production config, global/field media overrides, missing postSlug/translationKey, and an Alert editor output that would not render.
- [ ] Validate YAML semantics/indentation, full-URL Cloudinary output at all relevant fields, EN/VI multiple-folder output, <postSlug>/index.mdx file convention, dates and duplicate/localized fields. Keep existing public identifiers; never copy private authentication tokens into generated files.
- [ ] Set skip_ci=false and ensure commit templates do not include skip markers. Pin Sveltia to an actual verified compatible bundle version and verify supported initialization/config-loading behavior through current docs.
- [ ] Implement fail-closed generated preview config and preserve production config. Ensure Astro build overwrites/recreates output cleanly so a previous preview config cannot leak into a production build.
- [ ] Test generated YAML and saved sample files offline, including create/edit translation, slug/path validation, hero image, Alert, draft/unlisted, save/reload.
- [ ] Host prepares the short-lived test branch and performs authenticated CMS create/edit/save/reload/delete plus media selection/upload against it. Verify only test-branch refs/content change and production/implementation content remain intact. Remove test entries/media only when owned by this test; retain evidence.

**Offline verify_command:** node --test tests/site/cms.test.mjs
**Host acceptance:** offline assertions AND authenticated nonproduction round-trip. A test-repo/mock pass alone is insufficient.

## Task 7 — Validate branch-aware Cloudflare deployment and clean builds

**Worker scope:** Existing deploy-cf.yml; new .github/workflows/checks.yml if needed; existing deploy.yml only for verified compatibility; package/runtime wiring; tests/site/preview.test.mjs; runbook.
**Consumes:** Live main's existing staging workflow, Task 6 generated CMS config, full site verification.
**Produces:** Protected main production deployment, staging preview and required full validation checks.

- [ ] Write tests for branch identity selection, production canonical/root base, preview canonical/root base, absent/full OG handling, preview CMS destination and noindex requirement. Manual dispatch from an arbitrary branch must not target main.
- [ ] Retain per-branch concurrency and actual deployment branch identity from live main. Pin Node/Bun setup to tested versions. Build/check before deploy; add PR/staging checks with no deployment credentials available to untrusted code.
- [ ] Do not use staging's existing CI_SKIP_AUTO_OG_IMAGE=true build as release acceptance. Provide a full-validation job with all skip flags false, generated OG existence assertions and Pagefind. Fast preview may remain only if missing OG URLs receive valid fallback metadata.
- [ ] Run a fresh frozen install from final manifest/lock in a clean directory, clear generated/image caches there, then types/lint/local formatting/tests/full build/search under the selected runtime. Network-enabled actual remote assets are a separate host check. Record lock/runtime versions and exit codes.
- [ ] Host verifies Pages production branch and staging custom-domain mapping; publish the already-verified artifact to staging under existing authorization. Confirm response noindex, root paths/assets/OG/search, preview CMS test branch and isolated comments. Record deployment SHA/URL.
- [ ] Read-only-check existing production posts/comments/media and compare baseline public path identity. Do not post test comments in production. Confirm CMS saves trigger the intended build without skip markers.
- [ ] Retain GitHub Pages workflow/support unless Task 0 established it unused; if retained, test its configured base separately and avoid double-prefixing Markdown links. Removal requires evidence and an explicitly reviewed deletion.

**Offline verify_command:** node --test tests/site/preview.test.mjs && node scripts/verify-site.mjs --profile offline
**Host acceptance:** fresh full build and staging HTTP/browser evidence; external blockers reported separately rather than mocked as success.

## Task 8 — Add provenance/drift reporting and prove real updates

**Worker scope:** theme-upstream.json; scripts/check-upstream.mjs; tests/site/upstream.test.mjs; docs/maintenance/upstream.md; optional workflow_dispatch-only update-PR workflow.
**Consumes:** Adopted upstream ancestry, ownership model, all compatibility gates.
**Produces:** Repeatable reviewed update procedure with concrete rehearsal evidence.

Interfaces:

- analyzeUpstreamChange({ adopted, candidate, changes, ownership }): DriftReport; pure function tested with fixtures.
- CLI: node scripts/check-upstream.mjs --adopted <sha> --candidate <sha>; host reads Git/source correspondence and supplies real objects. Worker tests use immutable diff/ref fixtures, not .git.
- Report classifies additions/modifications/deletions, local-owned paths, shared exceptions, package/lock pairing and source/starter pins. Missing refs/pins/ancestry or incoherent source pair fail with a useful diagnostic.

- [ ] Write failing tests for deletion of protected authored content, renamed shared file, new upstream file, stale source/starter pair, missing lock update, missing Git object and declared local exception. Ensure nothing copies/deletes source files.
- [ ] Implement the small read-only reporter and versioned manifest, listing actual remaining shared-file exceptions with rationale/test. No patch framework or magical conflict resolver.
- [ ] Write exact fetch, compare, normal merge, verify, review, branch integration and rollback commands, including required preservation of merge commits. Record all actual deferred UI work with a minimal restoration path.
- [ ] Host rehearses the functional historical update in a disposable branch: starter a5cda9782b93f241f22ef38d9ff7b328a354a0b3 → a2b22df2c0619c7d157324c9de458f38585d8e50. This is a historical checkpoint, not a patch applied on latest; reconstruct local adapters against the before version and check protected contracts before/after.
- [ ] Assert the real base-links plugin/config effect and resolve/report any genuine conflict. Also rehearse package/lock update f63a255317c8851d0f354de2fc7580d57873af3e → 821bc6171f2ed0f74d920cc5ab70794c3f779971. Use final dependency hydration appropriate to each historical checkpoint.
- [ ] Re-run protected routes/content/CMS/comment contracts and validate rollback to the before tree in disposable checkouts. Record manual steps/conflicts, not just a passing Git exit status. Never loosen URL tests to make an upstream rehearsal pass.
- [ ] If adding a manual update-PR preparer, give it minimum Git/PR permissions, preserve source pins, run gates, and leave merge/deploy for review. No schedule or automatic merge is required.

**Offline verify_command:** node --test tests/site/upstream.test.mjs
**Host acceptance:** real Git reporter run, two real upstream-update rehearsals, rollback evidence, no lost protected paths, target starter ancestry intact.

## Task 9 — Independent whole-branch review and production handoff

**Owner:** Codex orchestrator/reviewer. Any necessary code correction returns to a bounded DSH task under the lifecycle above; do not silently implement it.
**Consumes:** All controller artifacts/snapshots, full diff, runtime/build/preview/CMS/update evidence.
**Produces:** Approve/reject recommendation and an explicit cutover record.

- [ ] Fetch/reconcile latest main into staging again with normal merges. Inventory all intervening content/media/config changes. Refresh a separate final baseline for legitimate new posts; original baseline remains evidence.
- [ ] Review the actual whole-branch diff against both the starting blog and pinned upstream: requirements, semantics of auto-merges, dependencies/lock, shared-file footprint, component imports, unexpected/untracked files, generated artifacts and secrets.
- [ ] Independently rerun frozen install, typecheck, maintained-source lint, scoped formatting, upstream/local tests and full production-shaped build/search. Recheck deployed staging and authenticated CMS evidence. Label external checks that require user interaction; a missing required check blocks approval.
- [ ] Confirm upstream target is an ancestor of staging, the manifest matches actual adopted source, and every local override is explained. Check content/body hashes, all original public routes and newer main content.
- [ ] Present the review outcome, exact accepted omissions, validation evidence, remaining risks and rollback deployment/ref. Obtain user review of the concrete staging result before production integration.
- [ ] At authorized cutover, use a brief publishing pause if needed, fetch/reconcile final main again, run required checks and merge staging into main with a merge commit, not squash/rebase. Confirm the upstream target remains an ancestor of main.
- [ ] Check production URLs/images/comments read-only, EN/VI feeds/search/SEO and CMS main target; resume publishing. Retain pre-cutover artifact/ref and evidence.
- [ ] If cutover fails, restore prior Pages deployment and revert migration changes with new commits while retaining later authored posts. Document how an upstream merge re-adopts reverted changes: ancestry alone will not replay an already-merged/reverted patch.

**Completion means:** independent approval plus successful validated integration when authorized. Planning or a worker success message is not completion of the migration.

## Plan self-review and current handoff status

- Requirements map to Tasks 0–9; optional UI restoration is a documented follow-up, not a first-migration gate.
- The five review-focus conditions each have explicit owning fixtures/checks.
- Shared interfaces, script names and baseline schema are consistent across tasks.
- The design received a fresh independent builder check: “nothing important left.”
- This planning session changed documentation/evidence only. No upstream bridge/merge, dependency installation, DeepSeek execution, staging deployment or production change has been made.
- The user should review this proposed plan before implementation. The preserved execution method is dsh-handoff; controller availability is the first tooling preflight.
