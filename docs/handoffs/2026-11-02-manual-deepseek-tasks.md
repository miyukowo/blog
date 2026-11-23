# Manual DeepSeek implementation handoff

This is the current execution brief. The user approved the refactoring design and requested manual DeepSeek implementation after controller failures. It supersedes controller-specific execution instructions in earlier handoff documents and the implementation plan. Do not troubleshoot or invoke dsh-handoff/agent-controller.

## Copyable instruction for DeepSeek

Implement the tasks below in order, preserving the agreed compatibility requirements. Use normal tools available in your environment, make reviewable commits, and continue through the implementation without requesting approval after every task. Stop for a genuine blocker or a decision that changes the approved scope. Report blocked external checks honestly and continue independent work.

Return your implementation report and commits to the user for independent Codex review. Do not merge into main or publish a production deployment. A successful self-review is not independent approval.

### Workspace and existing progress

- Prepared checkout: /home/tvp/.codex/worktrees/upstream-preflight/blog
- Branch: codex/upstream-refactor, an isolated branch derived from staging. Use this checkout if it exists; verify status before changing anything. Do not change branches in /home/tvp/blog while another checkout owns them.
- Prepared implementation base: c64c19a, followed by the documentation-only commit containing this manual handoff. Record the actual full starting HEAD in your report.
- Original /home/tvp/blog checkout remains on staging at b593170; preserve it and the two existing main stashes. Final integration into staging/main will be reviewed separately.
- Current main b278874 was already merged normally into the prepared branch by 1e98ad2. That merge brings the newer branch-aware Cloudflare workflow. Recheck remote main for subsequent publishing changes; merge normally and preserve them.
- No DSH implementation exists. Cancelled task task-20261102153518-196db98a produced no changes or tests. Do not reuse its branch or spend time fixing the controller.
- Existing dependencies are a regular node_modules directory in this checkout. Node 26.12.1 and Bun 1.3.14 were verified. Git, dependency installation and normal shell/file tools are available subject to your actual environment; the old worker's artificial no-Git/no-install/controller restrictions do not apply to this manual workflow.
- Do not copy credentials into prompts, commits, reports or test fixtures. If an action is blocked by your environment, report it; do not bypass its protections.
- If the prepared checkout does not exist in your environment, obtain the committed branch/documents from the user and establish an isolated staging-derived branch. Do not silently start from stale main or an unrelated directory.

Read these repository documents:

1. [Design and compatibility decisions](../superpowers/specs/2026-11-02-upstream-maintainability-design.md).
2. [Detailed implementation plan](../superpowers/plans/2026-11-02-upstream-maintainability.md). Use its technical requirements, file responsibilities and fixtures; replace its controller/host-worker ceremony with this manual workflow.
3. [Verified upstream research](../research/2026-11-02-chirping-upstream.md).
4. [Fresh preflight baseline](../research/2026-11-02-dsh-preflight-baseline.json), [original baseline](../research/2026-11-02-blog-baseline.json), and [preflight execution record](../maintenance/upstream.md).

Prefer graph discovery and Context7 documentation when available; otherwise inspect the actual source and official documentation. Research already checked exact locked MDX/Sätteri package sources. Do not assume current online documentation for a later major version applies to the pinned dependencies.

### Non-negotiable behavior

- Prioritize catching up with upstream and minimizing future conflicts. Optional post avatars, reading progress, animation and typography polish may be deferred. Record any actual removal and a practical restoration path.
- Preserve all existing public URLs, EN/VI content, images, actual translation links, Giscus pathname associations, essential SEO, and usable CMS/media publishing.
- Keep EN unprefixed and VI under /vi. Keep folder-based posts at /posts/name/ and /vi/posts/name/, without an extra /index/.
- Preserve existing taxonomy URLs, especially /vi/categories/huong-dan/. Upstream's new Unicode slug utility must not silently rename existing routes.
- Preserve all 12 tracked content files and their body hashes, including drafts. Keep deletion of the old FR demos. Do not replace authored pages with upstream samples.
- Existing content remains protected while main receives new posts. Reconcile main again before final validation.
- Production CMS remains on main. Preview write tests use a separate nonproduction branch; never create test posts/discussions on production.
- No force pushes, history rewriting, blanket ours/theirs conflict resolutions or unrelated rewrites. Preserve normal merge ancestry.
- No main merge or production deployment. Staging preview is allowed only after confirming the actual staging target.

### Upstream pins and measured evidence

| Purpose                              | Full SHA                                 |
| ------------------------------------ | ---------------------------------------- |
| Historical imported starter          | 5e8552f3922b623c04b5d0ffae4d7a9e255ccb20 |
| Source corresponding to that starter | 551ffe811906f6fe2813da4ea271c2d5f638b721 |
| Approved target starter              | 821bc6171f2ed0f74d920cc5ab70794c3f779971 |
| Source corresponding to target       | 4585c2d78f1c429e5c3092ed79e68cc839413964 |

Update source: https://github.com/kannansuresh/chirping-astro-starter
Canonical source/rationale: https://github.com/kannansuresh/chirping-astro

Initial import matched 85 of 87 blobs at the historical starter; package.json and src/config.ts were personalized. Existing public history has no upstream merge base. The historical ancestry bridge described below has been rehearsed but has NOT been applied to the real implementation branch.

The target manifest ranges differ from locked versions. The researched target lock resolves Astro 7.1.6, MDX 7.0.5, markdown-satteri 0.3.5 and satteri 0.9.5. Adopt the reviewed manifest/lock pair plus necessary local dependencies. Avoid an unrelated latest-registry upgrade. If remote heads advance, inspect/document the change; do not silently change the approved target.

The fresh preflight build passed under explicit Node with a local avatar: 33 HTML pages, six OG images, 32 sitemap URLs, Pagefind indexing 33 pages in EN/VI. Protected content/routes/feed/sitemap/OG data matched the original baseline exactly. That does not establish the Astro 7 migration works.

Known baseline issues: forced Bun execution stalls Astro; lint includes ignored local Obsidian plugins plus a few actual tracked-code errors; VI RSS reports en-us. Correct these without normalizing away regressions.

## Task 1 — Compatibility harness and usable runtime checks

Deliver scripts/site-contract.mjs, scripts/verify-site.mjs, tests/site/contracts.test.mjs and focused fixtures. The earlier [Task 1a brief](2026-11-02-dsh-task-1a.md) contains the detailed capture/assert contract; its controller submission instructions are obsolete.

1. Implement captureSite({ distDir, sourceDir, sourceRevision, baseline }) and assertSiteContract(actual, baseline, { allowedChanges }). Document the allowance schema and CLI.
2. Capture actual source/file-body hashes, HTML paths/canonical/lang/robots/OG/hreflang, RSS language/items, namespace-aware sitemap URLs, OG outputs and search evidence. Use real parsers, not general HTML regex parsing or counts-only checks.
3. Tests must reject missing routes/content, added /index, renamed VI category, changed canonical/sibling/body, duplicate routes and unclassified changes. Explicitly classified new translated posts are allowed. Narrowly allow only the VI RSS en-us → vi-vn correction.
4. Add deterministic offline/full/preview verification profiles. Full verification enables all content/OG/RSS/sitemap/search; use local assets or fixtures for offline checks, keeping live-network tests separate.
5. Set bunfig run.bun=false so Astro uses Node. Keep Bun for package management/upstream tests. Repair tracked lint errors and exclude ignored editor caches without deleting them or weakening maintained-code checks.
6. Add test:site, verify:site and scoped formatting scripts. Avoid mass-formatting unchanged upstream source or authored post bodies.

Acceptance:

    node --test tests/site/contracts.test.mjs
    node scripts/verify-site.mjs --profile offline

The baseline comparison must preserve the real protected content/route contract. Record test-first evidence where adding behavior, actual commands and exit codes. Commit this working harness before migrating core dependencies.

## Task 2 — Isolate required site policies

Use a small src/site directory, not a generic override framework. Keep existing Astro routes, component import paths and post-helper interfaces.

- config.ts/locales.ts/vi.ts: typed branding, EN/VI tuple, locale presentation and VI dictionary. Preserve upstream English/French definitions where practical, add local VI, and require dictionary coverage of upstream English keys.
- urls.ts: normalize recognized locale prefixes and terminal /index for post identity/translation fallback. Preserve explicit translationKey. Filesystem identity remains the URL authority; flag mismatched CMS postSlug rather than silently moving a post.
- Keep legacy taxonomy slug behavior in a local helper. Leave upstream src/utils/slugify.ts and its Unicode tests meaningful and unchanged.
- taxonomy.ts: isolate the existing translated category/tag destination logic and server-render real target links. Missing counterparts fall back to the destination locale's index, not a fabricated 404.
- Wire small explicit imports into config/posts/i18n and the existing layout/switcher props. Avoid parallel routing or content systems.

Acceptance:

    node --test tests/site/urls.test.mjs tests/site/locales.test.mjs
    node scripts/verify-site.mjs --profile offline

Cover nested/index IDs, different EN/VI slugs, missing translations, actual taxonomy routes and unchanged content hashes. Commit.

## Task 3 — Establish ancestry and catch up with upstream

You can perform normal Git operations directly in this manual workflow. The controller-era indirect merge-tree transfer is unnecessary.

1. Confirm clean status, saved backup refs, and the historical/source commits from research. Record the pre-bridge tree.
2. If the historical starter is not already an ancestor, perform the one-time historical-only bridge:

```bash
git merge --allow-unrelated-histories --no-ff -s ours \
  5e8552f3922b623c04b5d0ffae4d7a9e255ccb20 \
  -m "chore: record historical Chirping starter import ancestry"
```

3. Prove tree equality before/after and the intended merge base. This records an imported near-copy; do not claim the original import was a real Git merge.
4. Merge approved target starter 821bc6171f2ed0f74d920cc5ab70794c3f779971 normally, resolving conflicts deliberately. Never use ours for the new target or blanket checkout ours/theirs.
5. Adopt upstream core, Sätteri plugins, MDX, schema additions, math/Mermaid behavior and compatible dependencies. Preserve the Task 2 seams, CDN allowlist, WASM/VI OG support, necessary Alert/VideoEmbed interfaces, authored EN about page, FR deletion and Cloudflare workflow.
6. Review every automatically merged file as well as conflicts. The earlier disposable rehearsal found eight conflict paths: README, Astro config, package/lock, site config, EN about, deleted FR about, and posts helper. Current extra seam changes may alter that count.
7. Remove obsolete parser plugins/dependencies only after their replacements and references are verified. Install the selected dependencies normally, with reviewed lock changes, respecting the upstream release-age policy.

Acceptance:

    git merge-base --is-ancestor 821bc6171f2ed0f74d920cc5ab70794c3f779971 HEAD
    bun test src/utils/posts.test.ts
    node scripts/verify-site.mjs --profile offline

No lost content, demos reintroduced, conflict markers, silent required-output skips or changed public identity. Preserve this real merge commit; do not squash/rebase away its second parent.

## Task 4 — Consolidate media and preserve authored rendering

- Implement one pure/idempotent resolveMediaUrl(src) in src/site/media.ts for known Cloudinary upload URLs → the existing CDN optimized path.
- Preserve version/nested public IDs, query/hash semantics, existing CDN URLs, unrelated HTTPS, root paths and imported assets. Do not guess that a bare filename is a Cloudinary ID.
- Reuse it for hero/card/OG and relevant component inputs. Replace duplicate conversion code.
- Port Markdown image rewriting with Sätteri defineMdastPlugin and ctx.setProperty(node, 'url', value) before Astro image collection; nodes are readonly. Locked MDX 7.0.5 inherits these plugins, so do not add a redundant remark pipeline.
- Test reference images separately. JSX literal/expression props and hero metadata are outside ordinary image-node traversal; validate component/helper behavior separately.
- Keep existing Alert and VideoEmbed import paths. Native playable video is acceptable if fancy controls are deferred.

Acceptance:

    node --test tests/site/media.test.mjs tests/site/markdown.test.mjs
    node scripts/verify-site.mjs --profile offline

Inspect rendered src/srcset/alt/resource existence for .md/.mdx, reference syntax, JSX/component inputs, heroes and OG; transformed strings alone are insufficient. Commit.

## Task 5 — SEO, content visibility and browser behavior

- Preserve production canonical URLs, actual reciprocal sibling hreflang/x-default links, dates, VI language metadata, comments pathname/config and valid OG references. Correct VI RSS language explicitly.
- Drafts must be absent from public output/search. Unlisted posts remain directly reachable but absent from listings, navigation, RSS, sitemap and search, with the configured robots policy.
- Test cold load → client navigation → language/theme change for Giscus, avoiding stale/duplicate mounts. Use mocked or isolated discussions for write tests; production checks are read-only.
- Verify mobile/keyboard navigation, EN/VI search, TOC/headings, code copying, math, Mermaid opt-in and reduced motion.
- Adopt upstream optional presentation. Record exactly which avatars/progress/animation/typography/video polish was deferred and where it can be restored later.

Acceptance:

    node --test tests/site/seo.test.mjs
    node scripts/verify-site.mjs --profile offline

Add reproducible browser evidence. No unrelated redesign or content-body rewrite. Commit.

## Task 6 — CMS publishing and isolated preview writes

- Preserve Sveltia/Cloudinary publishing, EN/VI folders, postSlug/index.mdx and translation keys.
- Validate YAML semantics; align global and field-level media options to full URLs. Keep media-selection → save/reload → rendering usable.
- Pin an actual verified compatible Sveltia bundle. Set skip_ci=false and remove skip-bearing CMS commit templates so publishing triggers builds.
- Implement preparePreviewCms({ distDir, branch, siteUrl }) in scripts/prepare-preview.mjs. It writes only built preview config and rejects missing/main/staging write targets; use a dedicated codex/cms-validation-<run> branch.
- Keep tracked production CMS pointed at main. Verify that preview config cannot accidentally load production configuration or contaminate a later production build.
- Exercise translated draft creation/edit/save/reload/delete and media on the isolated branch. If authentication is unavailable, supply the exact remaining steps and report this gate as unverified; do not substitute mocks for a real round-trip.

Acceptance:

    node --test tests/site/cms.test.mjs

Record both offline config tests and authenticated external evidence or its precise blocker. No production content/test-discussion writes. Commit.

## Task 7 — Full checks and staging deployment

- Build on the existing branch-aware Cloudflare workflow; preserve deployment branch identity and per-branch concurrency.
- CI must use tested Node/Bun versions and run required checks before deployment. Do not expose deployment credentials to untrusted PR code.
- Full acceptance builds must enable content, OG, RSS, sitemap and Pagefind. The existing staging OG skip does not qualify; fast preview must have valid fallback metadata if it remains.
- Perform a fresh frozen install and cold-cache full build in a clean directory. Separate deterministic fixture tests from live remote-media checks.
- GitHub Pages workflow was observed disabled_manually. Preserve it until actual usage is assessed; do not delete support just because a Pages API request returned 404.
- Verify Cloudflare production branch, staging domain and rollback deployment ID. Deploy only to the confirmed staging target; check noindex, assets/OG/search, CMS test-branch isolation and isolated comments.

Acceptance:

    bun install --frozen-lockfile
    bun run typecheck
    bun run lint
    bun run format:site:check
    bun run test:site
    bun test src/utils/posts.test.ts
    node scripts/verify-site.mjs --profile full

Include staging HTTP/browser evidence when access is available. If external permissions are missing, report the unverified gates and finish independent repository work. Never deploy main as a fallback.

## Task 8 — Provenance, repeatable updates and final handback

- Add theme-upstream.json with adopted full source/starter SHAs, historical import pair, tested runtimes, local-owned paths and shared-file exceptions with reasons/tests.
- Add read-only scripts/check-upstream.mjs plus tests. Report real additions/modifications/deletions, protected content, shared exceptions and package/lock coherence. Do not build an overlay engine or a script that silently copies/deletes files.
- Document exact fetch/compare/merge/check/review/rollback steps in docs/maintenance/upstream.md. Keep update merges and eventual staging→main integration as merge commits.
- Rehearse real functional update a5cda9782b93f241f22ef38d9ff7b328a354a0b3 → a2b22df2c0619c7d157324c9de458f38585d8e50 in a disposable historical checkout, and dependency update f63a255317c8851d0f354de2fc7580d57873af3e → 821bc6171f2ed0f74d920cc5ab70794c3f779971. Do not apply old patches again on latest.
- Demonstrate intended upstream effect, protected contract preservation, actual manual conflicts/steps and rollback. Clearly distinguish a rehearsal not run from a passing one.
- Reconcile latest main/new posts, then rerun all applicable checks. Preserve original evidence; refresh separate baselines only for reviewed intentional changes.
- Prepare the report below. Leave commits on the staging-derived implementation branch for Codex review. Do not merge into main, force-push, publish production or repair the controller.

Acceptance:

    node --test tests/site/upstream.test.mjs
    node scripts/check-upstream.mjs --adopted <recorded-starter-sha> --candidate <candidate-sha>
    git merge-base --is-ancestor 821bc6171f2ed0f74d920cc5ab70794c3f779971 HEAD
    node scripts/verify-site.mjs --profile full

Use actual fetched Git objects and the implemented CLI; report the concrete SHAs/commands rather than leaving angle-bracket placeholders in your final evidence.

## Required implementation report

Save docs/reports/2026-11-02-manual-upstream-implementation.md using the adjacent [report template](2026-11-02-manual-deepseek-report-template.md). Return its path, working branch and full HEAD to the user.

The report must let an independent reviewer reconstruct the result:

1. Starting/final commits, per-task commits, adopted source/starter pins and ancestry evidence.
2. Exact changed-file summary and explanation of each shared upstream exception.
3. Content-hash/URL/translation/comment/media/SEO preservation evidence, including new main content.
4. Actual test/build/lint/format/install commands, versions, exit codes, counts and log/screenshot paths.
5. Staging/CMS/external checks explicitly marked passed, failed, blocked or not run; no generic “all tests pass” statement in place of evidence.
6. Deferred features, known defects, unresolved blockers, rollback instructions and concrete review risks.
7. Real update/rollback rehearsal results and the manual work they required.

Do not claim completion if a required gate is unverified. Do not hide pre-existing failures, bless changed snapshots blindly, omit generated/untracked changes or fabricate external tests. Codex will inspect actual code and rerun validation independently.
