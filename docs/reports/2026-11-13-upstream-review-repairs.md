# Upstream review repairs — 2026-11-13

**Status:** implementation complete for independent Codex review. This self-review is **not**
integration approval. No main merge, force-push, production deploy or authenticated CMS write was
performed.

**Scope:** repair the six findings in
[the independent review](2026-11-13-independent-upstream-review.md) without redoing the upstream
migration or replacing its real merge ancestry. The adopted starter/source pins, protected content,
public URLs, translation pairs and merge commit remain unchanged.

## Handback

| Item                    | Value                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Implementation checkout | `/home/tvp/.codex/worktrees/upstream-preflight/blog`                                                                             |
| Branch                  | `codex/upstream-refactor`                                                                                                        |
| Starting HEAD           | `470090ad10f1d3f3f7db27399c24943442ea465e` (clean, verified before editing)                                                      |
| Last code HEAD          | `fd3171ff58aa205daa775234bb5166e5a0e28e1f` (Task 6)                                                                              |
| Handback commit         | adds this report and `docs/reports/evidence/2026-11-13-repairs/`; exact HEAD in the return                                       |
| Runtime used            | Node **26.12.1** (official tarball), Bun **1.3.14**, Astro **7.1.6**, MDX 7.0.5                                                  |
| Remote re-fetch         | `origin/main` `b278874e33b121a0629de06e9f94bdba7a45bdd0` (ancestor), `origin/staging` `ec2f2541b907a2717fccabff55fc55ebfecae453` |

`/home/tvp/blog` was left on staging; its branches, stashes, the standalone implementation `.git` and
the controller worktree were preserved. No staging or production deployment was attempted.

## Per-task commits

| Task | Commit    | Repair                                                                               |
| ---- | --------- | ------------------------------------------------------------------------------------ |
| 1    | `b4e3af9` | Format the final evidence JSON without changing parsed values                        |
| 2    | `2a93042` | Render MDX math/Mermaid/alert/ashtml as real elements through a compatibility seam   |
| 3    | `e95048a` | Match complete unlisted sitemap path identities instead of substrings                |
| 4    | `281858f` | Make base-path link/image rewriting idempotent and segment-aware                     |
| 5    | `8ca66e0` | Disable production Giscus on every non-main deployment build                         |
| 6    | `fd3171f` | Add credential-free PR checks and validate the exact upload artifact before wrangler |
| 7    | handback  | Final evidence, report, maintenance-register update and clean-branch recheck         |

## Task 1 — final-tree formatting gate

- Reproduced on the untouched starting tree: `bun run format:site:check` exited **1** and named only
  `docs/reports/evidence/final/full-contract.json`.
- Reformatting used the installed Prettier and changed only line wrapping of `search.languages`
  (`1 insertion, 4 deletions`). Parsed JSON canonical SHA-256 was identical before and after:
  `d3c40a324f33113861b45153621598de9b14a5d51daf566e7825ba8573140526`.
- Re-ran the scoped check: exit **0**.
- Evidence: `task1-format-before.txt`, `task1-format-after.txt`, `task1-semantic-equality.txt`.

## Task 2 — MDX generated HTML renders as elements

**Root cause.** Sätteri emits MDAST `html` nodes for KaTeX, the Mermaid wrapper, `alert` fences and
`ashtml` fences. Plain Markdown accepts raw HTML, but MDX has no raw-HTML syntax, so the MDX compiler
serialized that markup as an escaped text child. CMS posts are `.mdx`.

**Repair.** `src/site/mdx-html.ts` adds a shared MDAST plugin that, for `ctx.sourceFormat === 'mdx'`
only, replaces each `html` node with `<Fragment set:html="…" />` as an `mdxJsxTextElement` in
phrasing content or an `mdxJsxFlowElement` at block level. Astro's MDX renderer always provides
`Fragment` and its JSX runtime honours `set:html` (the same mechanism as Astro's MDX
`optimizeStatic`). The plugin is registered last so it sees output from `katex()`,
`satteriMermaid()`, `satteriAlert()` and `satteriAsHTML()`. Plain `.md` behavior and authored JSX
are untouched.

**Fixtures and assertions.** Added MDX fixtures for inline/display math, Mermaid with and without
`mermaid: true`, alert, `ashtml` and ordinary authored JSX; kept the `.md` math/Mermaid fixtures.
The real Astro fixture build is parsed with parse5 and asserts `.katex`/`.katex-display`/MathML
elements, `.chirpy-mermaid-wrapper[data-mermaid-src]`, alert `[role=alert]`, authored
`section#authored-html`, authored JSX children, absence of the same markup in text nodes, and
Mermaid island hydration only when opted in.

- Before: `MDX inline and display math must render as .katex elements` failed.
- After: `node --test tests/site/seo.test.mjs` **5/5**, `tests/site/markdown.test.mjs` **11/11**,
  `bun run typecheck` exit **0**.
- Removed the two now-false MDX deferrals from `theme-upstream.json` and the maintenance register.
- Evidence: `task2-mdx-before.txt`, `task2-mdx-after.txt`, `task2-seo-after.txt`,
  `task2-markdown-after.txt`, `task2-typecheck.txt`.

## Task 3 — exact unlisted sitemap identities

**Root cause.** The filter used `page.includes(seg)`. An unlisted `/posts/review-unlisted/` also
matched the listed `/posts/review-unlisted-extra/` and the listed `/vi/posts/review-unlisted/`.

**Repair.** `src/site/sitemap.ts` normalizes a sitemap URL to an origin-less, query/hash-free,
decoded, trailing-slash-free pathname that includes the configured base, and excludes only complete
locale-qualified identities. The config-time scan builds each exact pathname with
`sitemapPostPathname()`; EN/VI remain distinct and nested segment boundaries are preserved.

**Fixtures.** Added unlisted `/posts/review-unlisted/`, listed `/posts/review-unlisted-extra/` and
listed `/vi/posts/review-unlisted/`; all three pages are emitted and only the first is absent from
the sitemap. Added pure helper tests for origin/query/hash/trailing-slash/base and percent-encoded
non-ASCII identities.

- Before: `a listed route sharing the unlisted prefix must stay in the sitemap` failed.
- After: SEO test **5/5**, sitemap helper tests **4/4**, root `verify-site --profile full` PASS.
- Evidence: `task3-sitemap-before.txt`, `task3-sitemap-after.txt`, `task3-unit-tests.txt`,
  `task3-verify-full.txt`.

## Task 4 — idempotent base-path rewriting

**Root cause.** `satteriBaseLinks` prefixed every root-relative `href`/`src` unconditionally, so
`/blog/posts/a/` became `/blog/blog/posts/a/` and repeated application kept growing the URL.

**Repair.** `withBaseOnce()` preserves the base identity itself and any path inside it at a segment
boundary (`/blog`, `/blog/...`), while `/blogger/...` is still prefixed. Query/hash suffixes survive
and the same rule applies to images. Root base `/` stays a no-op; external, protocol-relative,
relative and fragment-only URLs are untouched. Node updates still use the supported visitor
context.

**Fixtures/tests.** Real-plugin tests cover links and images for `/blog`, `/blog/`, `/blog?x=1`,
`/blog#x`, `/blogger/`, an already-based resource, query/hash suffixes, root base and a second
application. The base-configured fixture build at `BASE_PATH=/blog` renders authored links/images
with one base and an imported Astro image as `/blog/_astro/...` (not `/blog/blog/_astro/...`).

- Before: `/blog/blog/posts/a/` and `/blog/blog/pixel.png` failures, plus a triple-prefixed
  double-application result.
- After: `tests/site/markdown.test.mjs` **11/11**, including the real base build.
- Registered `src/plugins/satteri-base-links.ts` as a shared exception.
- Evidence: `task4-base-before.txt`, `task4-base-after.txt`.

## Task 5 — production comments disabled on non-main

**Root cause.** `deploy-cf.yml` supplied the same `PUBLIC_GISCUS_ENABLED` repository variable to
main and staging; an enabled production value would mount the production repository/category with
pathname mapping on the staging origin.

**Repair.** The build env now uses
`${{ github.ref_name == 'main' && vars.PUBLIC_GISCUS_ENABLED || 'false' }}`: only `main` reads the
production setting; every other ref receives literal `false`. Repository/category/pathname
bindings are unchanged.

**Tests.** A workflow-selection test asserts the branch condition and literal false fallback. A real
non-main build supplied with valid production identifiers (`miyukowo/blog`, `R_kgDOtest`,
`DIC_kwDOtest`) is parsed with parse5 and contains no `[data-giscus-mount]` and none of those
identifiers on EN or VI posts. The main build still asserts pathname mapping and per-locale
`data-locale` values.

- Before: `non-main Cloudflare builds force production comments off` failed on the branch
  condition.
- After: preview workflow tests **12/12**, SEO test **5/5**.
- Evidence: `task5-comments-before.txt`, `task5-comments-workflow-after.txt`, `task5-seo-after.txt`.

## Task 6 — PR checks and actual-artifact validation

**PR checks.** Added `.github/workflows/checks.yml` on `pull_request`/`workflow_dispatch` with
`contents: read`, pinned Node/Bun, frozen install, typecheck, lint, scoped formatting, site tests,
upstream slug tests, a deterministic full build and artifact validation. It references no
Cloudflare/Pages secret; deployment credentials remain confined to the push-only deployment
workflow.

**Artifact validator.** Added `scripts/validate-built-site.mjs`, a read-only CLI that captures the
supplied `dist/` with the existing `captureSite()` and asserts it against the baseline using the
shared allowances in `scripts/site-allowed-changes.mjs` (now shared with `verify-site.mjs`). It
checks protected content hashes, routes/canonical/lang/hreflang/robots, feeds, sitemap, referenced
and generated OG files, Pagefind output, and requires every HTML/feed/sitemap URL origin to equal
the explicit expected origin. It never normalizes arbitrary origins into a placeholder.

Preview mode additionally requires noindex headers, a `codex/cms-validation-*` built CMS branch
with the expected site URL, the tracked production CMS still on `main`, and no production comment
mount. Production mode forbids a global noindex rule and requires the built CMS on `main`.

**Deployment gate.** `deploy-cf.yml` now runs the validator after `prepare-preview.mjs` and
`mark-preview-noindex.mjs` and immediately before the wrangler upload. It validates `dist` in place
and does not rebuild. `astro.config.mjs` now derives `site` from `SITE_URL`, so preview
sitemap/feed origins match canonical/OG metadata (previously they kept the production origin and
were hidden by origin normalization in `verify-site`).

**Tests.** Added workflow-order tests (no PR credential path; validation after preview transforms
and before upload; no rebuild), artifact mutation tests (OG, feed, sitemap, Pagefind, protected
route, wrong origin, production CMS target, wrong preview CMS URL, production comment mount,
missing noindex) and a CLI test proving a broken artifact exits nonzero and a restored one passes
without rebuilding. `verify-site` preview now rebases the recorded baseline origin explicitly and
requires actual origins to match.

- Before: PR-workflow and artifact-gate tests failed because neither existed.
- After: preview workflow **12/12**, validator **13/13**, full site suite **138/138**, real
  production and preview artifacts both PASS.
- Evidence: `task6-workflow-before.txt`, `task6-workflow-tests.txt`, `task6-validator-tests.txt`,
  `task6-production-validate-local.txt`, `task6-preview-validate-local.txt`, `task6-test-site.txt`.

## Fresh clean-archive verification (Node 26.12.1)

A clean `git archive HEAD` of `fd3171f` was installed with `bun install --frozen-lockfile` (839
packages) using the official Node 26.12.1 tarball and Bun 1.3.14. All commands ran in that clean
tree, not in the working checkout.

| Command                                                                                                    | Result                                                                                 |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `bun install --frozen-lockfile`                                                                            | PASS, 839 packages                                                                     |
| `bun run typecheck`                                                                                        | PASS, 94 files, 0 errors, 0 warnings, 1 hint                                           |
| `bun run lint`                                                                                             | PASS                                                                                   |
| `bun run format:site:check`                                                                                | PASS                                                                                   |
| `bun run test:site`                                                                                        | PASS, **138/138** (previous suite count 114; new regression tests are included)        |
| `bun test src/utils/posts.test.ts`                                                                         | PASS, 10/10                                                                            |
| `node scripts/verify-site.mjs --profile full`                                                              | PASS, 33 routes, 2 feeds, 32 sitemap URLs, 6 OG paths, 33 Pagefind pages, 4 allowances |
| `node scripts/validate-built-site.mjs --dist dist --profile production --site-url https://blog.tvphus.dev` | PASS, contract/origin/OG checks                                                        |
| preview build + `prepare-preview` + `mark-preview-noindex` + preview validation                            | PASS, origin consistency and preview isolation checks                                  |
| `BASE_PATH=/blog … astro build --root tests/site/fixtures/markdown-site`                                   | PASS, 3 pages                                                                          |

Ancestry and provenance rechecks:

- `git merge-base --is-ancestor 821bc6171f2ed0f74d920cc5ab70794c3f779971 HEAD` → PASS.
- `git diff af80346^ af80346 --exit-code` → PASS (historical bridge tree equality).
- `7da7e21` parents are `af80346…` and `821bc61…`; `af80346` parents include `5e8552f…`.
- `node scripts/check-upstream.mjs --adopted 821bc6… --candidate 821bc6…` → OK, `+0 ~0 -0`,
  package/lock coherent.

Evidence: `final-*.txt` in `docs/reports/evidence/2026-11-13-repairs/`.

## Unresolved defects and review risks

1. **Multiple CMS Alert imports remain deferred.** Two Alert blocks inserted in one CMS body each
   emit their own `import { Alert } from '/src/components/Alert.astro'`; MDX rejects the duplicate
   binding. This is unchanged by the repair pass, not fixed, and documented in
   `docs/maintenance/upstream.md`. No compilation-success-only claim is made that a multi-Alert
   generated module is executable. A follow-up should emit one import per document or use a global
   MDX component map.
2. **Page-scoped KaTeX stylesheet** is still linked from every post page under the upstream Astro 7
   layout. The KaTeX markup itself remains opt-in via `math: true`.
3. **MDX seam dependency.** The repair relies on Astro's MDX `Fragment` injection and `set:html`
   handling in the pinned Astro 7.1.6 / MDX 7.0.5 versions. The rendered-tree tests will catch a
   future change.
4. **GitHub Actions was not executed here.** The PR and deploy workflows were validated
   structurally and their commands were run locally; no GitHub Actions run or wrangler upload was
   performed.
5. **CMS validation-branch lifecycle is unproven, not a confirmed defect.** No
   `codex/cms-validation-*` ref existed on `origin` at check time. The pinned
   `@sveltia/cms@0.256.1` normal save uses GitHub's `createCommitOnBranch` against the configured
   branch and only creates refs for workflow/PR branches, so authenticated testing must pre-create
   and delete the short-lived ref. The exact procedure is documented in the maintenance runbook.
6. **No browser session.** Giscus cold-load/client-navigation/theme/language behavior, mobile and
   keyboard navigation, and Mermaid/math rendering were not exercised in a real browser; the
   rendered markup and pure mount-plan tests are the available evidence.
7. **Bun install cache.** The frozen install ran in a clean archive but the Bun package cache may
   have been warm (11 s), so it is not a cold network-download proof.

## External gates (not performed)

| Gate                                                                                   | Status       | Why / next step                                                                                                       |
| -------------------------------------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Authenticated Sveltia/Cloudinary create/edit/save/reload/delete on a validation branch | NOT RUN      | No Sveltia/GitHub/Cloudinary credentials. Pre-create a verified `codex/cms-validation-*` ref, follow the runbook.     |
| Real staging deployment and HTTP/browser checks                                        | NOT RUN      | No verified Cloudflare target/authorization in this environment; no deploy attempted.                                 |
| Cloudflare production branch/domain/rollback deployment ID                             | NOT VERIFIED | Requires account/project access; read-only console or API check remains for the owner.                                |
| Read-only production comments identity                                                 | NOT RUN      | No production GitHub/Giscus credentials; no discussion write or read was attempted.                                   |
| Live remote-asset cold build                                                           | N/A          | Current `src/content` has no remote image references; the deterministic local-assets profile is the applicable build. |
| GitHub Actions PR/deploy execution                                                     | NOT RUN      | Workflows were validated locally; no push/PR was created from this session.                                           |

## How to review

```bash
git -C /home/tvp/.codex/worktrees/upstream-preflight/blog status --short --branch
git log --oneline 470090a..HEAD
node --test tests/site/
node scripts/verify-site.mjs --profile full
node scripts/validate-built-site.mjs --dist dist --profile production --site-url https://blog.tvphus.dev
```

The branch is intended to be clean and force-free. A successful self-review is not integration
approval; an independent Codex review and the external gates above remain required.
