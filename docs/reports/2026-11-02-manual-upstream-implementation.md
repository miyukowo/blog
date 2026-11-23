# Manual upstream implementation report

Date: 2026-11-02
Agent/environment: DeepSeek Harness agent (manual workflow per
`docs/handoffs/2026-11-02-manual-deepseek-tasks.md`); workspace checkout
`/home/tvp/.codex/worktrees/upstream-preflight/blog`; Node 26.12.1, Bun 1.3.14.
Implementation status: **complete for Tasks 1–8 offline/repository scope; external gates blocked/unverified** (see
[Blockers and review risks](#blockers-and-review-risks)). No main merge, no staging/production deployment,
no controller interaction.

## Git and scope

- Starting branch and full commit: `codex/upstream-refactor` at
  `82a64bea2517fe476a8de762848a0e780f9d1f46` (prepared base: staging-derived branch with
  documentation-only handoff commit).
- Final branch: `codex/upstream-refactor`. Final implementation commit:
  `1a8ace97100c71bb0a207f354a97dd3411e9f9f1` (provenance/runbook). The final commit is the one that adds
  this report plus `docs/reports/evidence/final/`; its exact SHA is returned in the handback.
- Working tree status: clean (only ignored build/tool artifacts). Original `/home/tvp/blog` checkout,
  its branches/stashes and the cancelled controller worktree were not modified.
- Latest main reconciled: fetched `origin` before final validation; `origin/main` was still
  `b278874e33b121a0629de06e9f94bdba7a45bdd0` (already an ancestor of the branch). No intervening
  published content needed reconciliation.
- Adopted starter SHA: `821bc6171f2ed0f74d920cc5ab70794c3f779971`
- Corresponding canonical source SHA: `4585c2d78f1c429e5c3092ed79e68cc839413964`
- Historical ancestry: bridge commit `af8034605b6c04873f9a51cdc2433a15255aa1dc`
  (`--allow-unrelated-histories --no-ff -s ours` to starter `5e8552f3922b623c04b5d0ffae4d7a9e255ccb20`).
  Pre-bridge tree `71e98e29c275fe487d79194021c8a2dad958cd84` equals post-bridge tree exactly; the
  target merge-base is the historical starter `5e8552f…`. Then a normal `--no-ff` merge of
  `821bc617…` was committed as `7da7e21d3a7467725f1b538e627140e1dd77c653` with both real parents
  (`af80346…`, `821bc61…`); no ours/theirs strategy was used for the new tip.
  `git merge-base --is-ancestor 821bc617… HEAD` passes.
- Per-task commits (oldest → newest, after `82a64be`):

  | Phase                      | Commit(s)                                                                       |
  | -------------------------- | ------------------------------------------------------------------------------- |
  | Task 1 harness/runtime     | `e99310b`, `181f8a3`                                                            |
  | Task 2 site policies       | `3d55103`                                                                       |
  | Task 3 ancestry + adoption | `af80346` (bridge), `7da7e21` (upstream merge), `f755439` (acceptance evidence) |
  | Task 4 media/rendering     | `d938599`                                                                       |
  | Task 5 SEO/visibility      | `8c59b10`                                                                       |
  | Task 6 CMS isolation       | `b676e55` (developed in an isolated worktree, rebased cleanly)                  |
  | Task 7 checks/deploy       | `7b21e7e`                                                                       |
  | Task 8 provenance/runbook  | `1a8ace9` (+ this report commit)                                                |

- Diff/stat: `git diff --stat 82a64be..HEAD` → **114 files changed, +9579/−1139**; versus the adopted
  starter `git diff --stat 821bc61..HEAD` → 141 files, +13611/−1061 (mostly authored content, local
  site modules, tests/docs and preserved CMS/branding).
- Environment note (important for reproduction): the prepared checkout's Git metadata under
  `/home/tvp/blog/.git` is outside the writable workspace sandbox (writes fail with EROFS). The
  workspace was therefore made self-contained by importing that small `.git` directory into the
  workspace as a standalone repository (backup refs, stashes, branches and objects preserved);
  commits/merges were created there. The original repository remains untouched. All evidence paths in
  this report are relative to the workspace checkout.

## Task results

| Task                      | Status         | Commit(s)                       | Changed files / outcome                                                                                                                                                                                                                                                                                                                                                                                                                                                | Remaining work                                                                                                                              |
| ------------------------- | -------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Harness/runtime        | DONE           | `e99310b`, `181f8a3`            | `scripts/site-contract.mjs` (capture/assert, real parse5 + fast-xml-parser, body hashes match 12/12 baseline), `scripts/verify-site.mjs` (offline/full/preview), `tests/site/contracts.test.mjs` + fixtures (18 tests), `bunfig run.bun=false`, `.node-version`, scoped formatting helper, lint fixes, parser devDeps.                                                                                                                                                 | —                                                                                                                                           |
| 2. Site policies          | DONE           | `3d55103`                       | `src/site/{locales,urls,config,vi,taxonomy-core,taxonomy}.ts`; EN/VI tuple + presentation metadata; filesystem URL identity without `/index`; legacy taxonomy slugs (`/vi/categories/huong-dan/`); CMS `postSlug` mismatch reporting; translated taxonomy destinations with index fallback; explicit translated sibling hreflang; 22 unit tests.                                                                                                                       | —                                                                                                                                           |
| 3. Upstream adoption      | DONE           | `af80346`, `7da7e21`, `f755439` | Historical bridge + normal Astro 7.1.6/MDX 7.0.5/Sätteri merge; 8 conflict paths resolved deliberately; all auto-merges reviewed; upstream fonts/math/mermaid adopted; upstream Unicode slug tests unchanged and passing; lock adopted + local deps.                                                                                                                                                                                                                   | Deferred MDX math/mermaid limitations documented below.                                                                                     |
| 4. Media/rendering        | DONE           | `d938599`                       | Single idempotent `resolveMediaUrl` (`src/site/media.ts`), Sätteri `defineMdastPlugin` image hook (`src/site/markdown.ts`) with reference-image handling, `SmartImage` boundary normalization, duplicate remark/image helpers deleted, rendered `.md`/`.mdx`/reference/JSX/srcset fixture tests (16 tests).                                                                                                                                                            | —                                                                                                                                           |
| 5. SEO/visibility/browser | DONE (offline) | `8c59b10`                       | VI RSS language corrected to `vi-vn`; actual reciprocal hreflang for different EN/VI slugs; unlisted pages reachable + noindex + excluded from sitemap/RSS/listing/search (fixed an upstream Astro 7 `astro:content` build-hook failure that silently leaked unlisted posts into the sitemap); draft output exclusion; Giscus pathname/locale/remount policy; TOC/math/mermaid/code-copy/reduced-motion/accessibility assertions (5 tests incl. a real fixture build). | Browser interaction evidence not run (no browser automation/credentials); manual steps documented.                                          |
| 6. CMS isolation          | DONE (offline) | `b676e55`                       | `public/cms/config.yml` YAML/media/field fixes, full-URL media, `skip_ci: false`, no skip templates, pinned `@sveltia/cms@0.256.1` + SRI, explicit local config link, safe Alert editor; `scripts/prepare-preview.mjs` fail-closed preview generator; 27 CMS tests incl. production-config byte integrity, save/reload simulation.                                                                                                                                     | Authenticated Sveltia/Cloudinary round-trip blocked (no credentials).                                                                       |
| 7. Checks/staging         | DONE (repo)    | `7b21e7e`                       | Cloudflare workflow: required-checks job before deploy, pinned Node/Bun, full-output builds (staging OG skip removed), per-branch concurrency/branch identity preserved, no secrets on PR code; preview CMS generation + noindex header injection; GitHub Pages workflow preserved with its own base; 10 preview/workflow tests; clean-room frozen install + cold-cache full build.                                                                                    | Actual staging deploy/HTTP/browser/CMS checks blocked (no account/credentials); production Pages settings/rollback deployment not verified. |
| 8. Maintenance/rehearsals | DONE           | `1a8ace9` (+ report)            | `theme-upstream.json` (pins, runtimes, ownership, 30 shared exceptions, deferred register), read-only `scripts/check-upstream.mjs` (pure analyzer + real Git CLI), 17 upstream tests incl. real drift runs, full runbook + CMS/preview/deployment/rollback sections; real functional + dependency update rehearsals and rollback in disposable clones.                                                                                                                 | —                                                                                                                                           |

## Validation evidence

All commands were run in this workspace unless marked “clean room” (a `git archive HEAD` extraction
with `bun install --frozen-lockfile`, cold caches). Logs are in
[`docs/reports/evidence/final/`](evidence/final/).

| Check                                        | Status            | Command/environment                                                                                                                  | Exit code / counts                                                                                                                                                                                                                                               | Evidence path / limitation                                                                                                                                                                                             |
| -------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh frozen install                         | PASS              | clean room `bun install --frozen-lockfile` (Bun 1.3.14)                                                                              | 0 — 839 packages, 19.43 s                                                                                                                                                                                                                                        | `evidence/final/01-clean-install-checks-build.txt`                                                                                                                                                                     |
| Types                                        | PASS              | `bun run typecheck` (`astro check`)                                                                                                  | 0 — 88 files, 0 errors/0 warnings/1 hint                                                                                                                                                                                                                         | same                                                                                                                                                                                                                   |
| Lint                                         | PASS              | `bun run lint` (`eslint . --max-warnings=0`)                                                                                         | 0 — 0 warnings                                                                                                                                                                                                                                                   | same                                                                                                                                                                                                                   |
| Scoped formatting                            | PASS              | `bun run format:site:check`                                                                                                          | 0 — all matched files Prettier-clean                                                                                                                                                                                                                             | same                                                                                                                                                                                                                   |
| Local tests                                  | PASS              | `bun run test:site` (= `node --test tests/site/`)                                                                                    | 0 — **114/114**                                                                                                                                                                                                                                                  | same + `02-main-workspace-validation.txt`                                                                                                                                                                              |
| Upstream tests                               | PASS              | `bun test src/utils/posts.test.ts`                                                                                                   | 0 — 10/10 (Unicode slug utility unchanged)                                                                                                                                                                                                                       | same                                                                                                                                                                                                                   |
| Full build + Pagefind                        | PASS              | `node scripts/verify-site.mjs --profile full` (clean room cold cache and workspace)                                                  | 0 — 33 HTML routes, 6 OG images, 32 sitemap URLs, Pagefind 33 pages (en-us 17 / vi-vn 16)                                                                                                                                                                        | `evidence/final/03-verify-full.txt`, `full-contract.json`                                                                                                                                                              |
| Offline contract                             | PASS              | `node scripts/verify-site.mjs --profile offline` (clean room)                                                                        | 0 — matches baseline with 4 exact documented field allowances                                                                                                                                                                                                    | `01-clean-install-checks-build.txt`                                                                                                                                                                                    |
| Baseline content hashes                      | PASS              | contract capture/assert against `docs/research/2026-11-02-dsh-preflight-baseline.json`                                               | 12/12 file SHA-256 and 12/12 body SHA-256 reproduced; canonical/lang/robots/OG/hreflang/feeds/sitemap/OG/search unchanged apart from allowances                                                                                                                  | test `tests/site/contracts.test.mjs`, verify logs                                                                                                                                                                      |
| Ancestry                                     | PASS              | `git merge-base --is-ancestor 821bc617… HEAD`; bridge tree equality; `git rev-list --parents -n1 7da7e21`                            | all PASS; merge has both real parents                                                                                                                                                                                                                            | `02-main-workspace-validation.txt`                                                                                                                                                                                     |
| Drift reporter (real objects)                | PASS              | `node scripts/check-upstream.mjs` for adopted==candidate, dependency pair `f63a255→821bc61`, functional checkpoint `a5cda97→a2b22df` | 0/0/0 — coherent package/lock, intended additions reported                                                                                                                                                                                                       | same + `tests/site/upstream.test.mjs`                                                                                                                                                                                  |
| Cold-cache/live assets                       | PARTIAL           | clean-room cold-cache full build passed; remote media/avatar network fetch not exercised separately                                  | build PASS; live remote-asset smoke NOT RUN                                                                                                                                                                                                                      | no live network check was required for fixtures; report as separate gate                                                                                                                                               |
| Browser/mobile/navigation                    | BLOCKED / NOT RUN | —                                                                                                                                    | no browser automation or credentials in this environment                                                                                                                                                                                                         | Static/unit evidence: skip link, labelled landmarks, mobile toggle, TOC ids, code-copy markup, reduced-motion CSS, Giscus remount/theme plan. Manual steps documented in runbook; real browser session still required. |
| Staging headers/assets                       | BLOCKED / NOT RUN | —                                                                                                                                    | no Cloudflare/deploy access; no deployment attempted                                                                                                                                                                                                             | Preview noindex/root-base/full-output logic is unit-tested and wired in the workflow; actual staging HTTP/browser confirmation remains required.                                                                       |
| Authenticated isolated CMS/media round-trip  | BLOCKED / NOT RUN | —                                                                                                                                    | no Sveltia/Cloudinary/GitHub credentials; no round-trip attempted (no mocks claimed)                                                                                                                                                                             | Offline: 27 CMS tests + production-config integrity; exact remaining steps in runbook.                                                                                                                                 |
| Production comments read-only identity check | NOT RUN           | —                                                                                                                                    | no external access used; no writes made                                                                                                                                                                                                                          | Giscus repo/category/pathname mapping and mount/locale plan are unit/static-tested.                                                                                                                                    |
| Functional upstream update rehearsal         | PASS              | `a5cda978… → a2b22df2…` in a disposable clone with reconstructed local adapters; real `--no-ff` merge                                | merge conflict in `astro.config.mjs` resolved deliberately; upstream base-links plugin/wiring present exactly once; local adapter entry/import preserved exactly once; 12/12 protected content hashes and 8/8 post identities unchanged; merge kept both parents | `evidence/task8-rehearsal-functional.txt`                                                                                                                                                                              |
| Dependency update rehearsal                  | PASS              | `f63a2553… → 821bc617…` (only `package.json` + `bun.lock`, +6/−4)                                                                    | `bun install --frozen-lockfile --dry-run` exit 0 before and after; file hashes restored exactly on rollback                                                                                                                                                      | `evidence/task8-rehearsal-dependency.txt`                                                                                                                                                                              |
| Rollback rehearsal                           | PASS              | reset each disposable branch to its pre-merge ref after both rehearsals                                                              | pre-merge tree `8637fff66a7a93fdf9d8d1feaec2c468e897cff0` and content hashes restored; dependency file hashes restored                                                                                                                                           | same evidence files                                                                                                                                                                                                    |

## Compatibility evidence

- Baselines used: `docs/research/2026-11-02-dsh-preflight-baseline.json` (measured preflight) and
  `docs/research/2026-11-02-blog-baseline.json` (original evidence retained).
- Original protected content hashes: all 12 tracked content files preserved (file and body SHA-256),
  including drafts; EN/VI pages/posts, images and translation keys intact. No authored body was
  rewritten.
- New/edited content from main: none — `origin/main` was unchanged at `b278874` and already an
  ancestor; no intervening posts needed reconciliation.
- Existing public URLs and VI taxonomy paths: 33 routes unchanged; folder posts remain
  `/posts/<name>/` and `/vi/posts/<name>/` (no `/index/`); `/vi/categories/huong-dan/` preserved by the
  site-owned legacy slug policy while upstream's Unicode `slugify` and its tests stay unchanged.
- Actual translated sibling links and hreflang: for posts with different EN/VI slugs the build now
  emits the real sibling URLs (covered by the SEO fixture build); reciprocal links verified for the
  taxonomy routes as well. Intentional corrections recorded as exact allowances:
  - `/vi/rss.xml` language `en-us → vi-vn` (documented baseline defect);
  - `/categories/guide/` hreflang `vi` → `/vi/categories/huong-dan/`;
  - `/vi/categories/huong-dan/` hreflang `en` and `x-default` → `/categories/guide/`.
- Giscus mapping/repository/category preservation: `mapping: pathname` (unit/static-tested), existing
  env-driven repo/category bindings untouched, VI locale mounts `data-lang="vi"`; remount/cleanup plan
  prevents stale/duplicate mounts across client navigation, and theme changes only post `setConfig`.
- Markdown/MDX/component/hero/card/OG image coverage: single `resolveMediaUrl` policy shared by the
  Sätteri image hook, hero/OG helpers and `SmartImage`; rendered fixture asserts src/alt/srcset and
  resource existence for `.md`, `.mdx`, reference images, SmartImage imported/public paths; unrelated
  hosts, existing CDN URLs, root/relative paths and bare filenames preserved; query/hash preserved;
  6 generated OG images match the baseline.
- Draft/unlisted visibility: fixture build proves drafts are absent from output/sitemap/RSS/search and
  unlisted posts are reachable by direct URL, `noindex`, and absent from listings/RSS/sitemap/Pagefind
  (Pagefind page count 37 listed vs 39 public pages in the fixture).
- Fonts: adopted the upstream Astro Fonts API; removed hardcoded hashed preload filenames; added a
  site-owned Vietnamese `unicodeRange` subset for Source Sans 3 so VI diacritics keep the interface
  font.

## Upstream delta and maintenance

- Remaining shared-file exceptions: 30 enumerated entries in `theme-upstream.json`, each with a reason
  and validation command (site config/CDN allowlist/VI font subsets; reviewed manifest+lock pair and
  extra direct deps; `run.bun=false`; site config seams; i18n dictionary/presentation; posts URL
  identity; SEO hreflang; layouts math/mermaid/translations; SmartImage; Giscus; taxonomy routes;
  styles; VI feed; tooling configs; README).
- New local-owned modules and callers: `src/site/{config,locales,vi,urls,taxonomy,taxonomy-core,media,markdown,giscus}.ts`,
  `scripts/{site-contract,verify-site,check-upstream,prepare-preview,mark-preview-noindex,format-site-check}.mjs`,
  `tests/site/**`, `theme-upstream.json`, docs and CMS/branding/hosting files. Existing Astro routes,
  component import paths and `src/utils/posts.ts` interfaces are retained.
- Dependency/lock changes beyond upstream: `@resvg/resvg-wasm` (retained build-time WASM/VI OG
  renderer), `parse5` + `fast-xml-parser` + `yaml` (contract/CMS tooling), Astro 7/MDX 7/Sätteri lock
  pair adopted together and regenerated under Bun 1.3.14; `unist-util-visit` and obsolete remark/rehype
  packages removed once their replacements were verified.
- Update command/runbook: `docs/maintenance/upstream.md` documents fetch → pin/source correspondence →
  ancestry check → update branch → `check-upstream` drift report → normal `--no-ff` merge → deliberate
  conflict resolution/whole-diff review → reviewed install → compatibility gates → review →
  merge-commit integration, plus rollback and the deferred register.
- Rehearsal before/after refs, intended effects and manual conflicts: see the rehearsal rows above;
  the functional rehearsal required a genuine `astro.config.mjs` conflict exactly at the local
  adapter seam, and a first naive resolution dropped a local adapter line (recorded as the reason the
  runbook requires a whole-diff review rather than merge-exit trust).
- Rollback procedure, refs/artifacts and preservation of later posts: pre-merge refs were recorded in
  the disposable clones; the runbook documents branch reverts, prior Pages deployment restore, and
  reverting on `main` with new commits while retaining posts published since, including the caveat
  that ancestry alone will not replay a reverted upstream merge.

## Deferred features

| Feature actually removed/deferred | Why                                                                                                                                                | Restoration seam/files                                                                         | Acceptance criteria                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| KaTeX math in `.mdx` posts        | Sätteri/MDX cannot carry inline raw HTML, so KaTeX output escapes; upstream's math demo is a `.md` post.                                           | Author math in `.md` (upstream convention) or add a site Math MDX component under `src/site/`. | Rendered KaTeX markup from `tests/site/seo.test.mjs` math case (currently `.md`). |
| Mermaid fences in `.mdx` posts    | Same raw-HTML limitation; upstream mermaid demo is `.md`.                                                                                          | Author in `.md` or add a site Mermaid MDX component.                                           | Wrapper + island assertions in `tests/site/seo.test.mjs`.                         |
| Page-scoped KaTeX stylesheet      | Upstream Astro 7 dynamic-import layout links the extracted MathStyles CSS on every post page; the intended page-only load is not honored upstream. | Revisit with upstream font/style strategy.                                                     | Non-math pages omit the KaTeX CSS chunk (not achievable without layout rework).   |
| Fancy direct-video controls       | Native playable video accepted; existing Plyr wrapper retained and functional.                                                                     | `src/components/VideoEmbed.astro`.                                                             | Authored `<VideoEmbed src=…/>` renders a playable video.                          |

Local presentation kept (not deferred): post author avatar, reading progress, back-to-top, theme
transitions, VI typography. No authored content or published feature was removed.

## Blockers and review risks

- Required checks not verified (external, credential/account dependent): actual staging deployment and
  HTTP/browser checks (noindex header, assets/OG/search, CMS test branch isolation, isolated comments),
  Cloudflare production branch/custom domain/rollback deployment ID, authenticated Sveltia/Cloudinary
  round-trip, read-only production comments identity check, live remote-asset cold build. None was
  mocked as success.
- Browser interaction evidence (mobile/keyboard navigation, cold load → client navigation → theme/
  language change for Giscus) is static/unit-tested only; a real browser session remains required.
- Existing/known limitations retained: MDX math/mermaid escaping (deferred register); page-scoped
  KaTeX CSS not honored by upstream layout; multiple CMS-inserted Alert blocks in one body would emit
  duplicate imports (current content has ≤1); CI-Pagefind search excludes unlisted via a body
  attribute validated in a fixture build, not on the deployed staging site.
- Credentials/account actions still needed (without revealing credentials): Cloudflare API token /
  account ID + verified staging target; GitHub fine-grained token with Contents (and optional PR)
  write; Cloudinary media upload access; a browser session for interaction checks.
- Unexpected/untracked/generated changes: none in the committed tree; ignored `dist/`, `.astro/`,
  `node_modules/`, temporary fixture/rehearsal/clean-room directories were removed. `/.pages.yml`
  (empty legacy experiment) is retained pending a confirmed consumer.
- Specific areas for independent review: the eight-conflict resolution and all auto-merged upstream
  files (`PostLayout`, `PageLayout`, `global.css`, `SmartImage`, `ThemeToggle`, content schema, OG
  route, Sätteri plugins); the config-time unlisted-sitemap scan replacing the broken upstream build
  hook; the four exact contract allowances (VI RSS + three taxonomy hreflang corrections); the fonts
  adoption with VI unicode-range subsets; CMS config/preview generator fail-closed behavior; workflow
  secret/check ordering; and the workspace-local Git metadata relocation described above.
- Review risk: `check-upstream` validates paths against the _current_ ownership map, so historical
  checkpoint rehearsals will show paths (e.g. `astro.config.mjs`) as declared shared exceptions even
  though the historical reason differs — read the reason text and diff, not just `RESULT: OK`.

## Handback

Report path: `docs/reports/2026-11-02-manual-upstream-implementation.md`
Branch: `codex/upstream-refactor`
Final commit: the commit containing this report (returned with the handback); preceding implementation
commit `1a8ace97100c71bb0a207f354a97dd3411e9f9f1`. The branch is left on the staging-derived
implementation lineage for independent Codex review. **No merge into `main`, no push, no staging or
production deployment, and no controller repair was performed.** All external gates above are reported
as blocked/unverified rather than claimed.

Validation log index: `docs/reports/evidence/final/00-context.txt`,
`01-clean-install-checks-build.txt`, `02-main-workspace-validation.txt`, `03-verify-full.txt`,
`full-contract.json`, plus per-task evidence files in `docs/reports/evidence/`.
