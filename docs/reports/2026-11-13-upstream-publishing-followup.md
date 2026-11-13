# Upstream publishing follow-up — implementation report

**Date:** 2026-11-13
**Checkout:** `/home/tvp/.codex/worktrees/upstream-preflight/blog`
**Branch:** `codex/upstream-refactor`
**Starting HEAD:** `9d7c5412bee7433f613d25c66a3bd1bd12f44138` (reviewed repair HEAD)
**Verified implementation HEAD:** `2194c0da22ad6f379b51d358ed9d3905d58c3fc3`
**Handback HEAD:** the docs/evidence commit immediately following the verified
implementation HEAD; the exact branch tip is reported in the handback message.
The branch is clean and ready for independent Codex review.

This pass continued the existing repair branch. It did not redo the migration, merge
`main`, rewrite history, force-push, deploy, invoke the agent controller, or write to a
CMS/production discussion. `/home/tvp/blog` was only read for the two follow-up
artifacts; it remains on `staging` with its branches, two stashes and the controller
worktree intact.

## Scope and commits

| Commit    | Task | Summary                                                                                                           |
| --------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| `c34ac9f` | 1, 4 | Shared loader/content identity for sitemap + fixtures; generated OG images for published unlisted hero-less posts |
| `e35af62` | 3    | Effective catch-all noindex scope shared by the marker and validator                                              |
| `2194c0d` | 2    | Routine artifact validation from current source with build-manifest staleness rejection; historical mode retained |
| see tip   | 5    | This report and the evidence tree                                                                                 |

Tasks 1 and 4 share one commit because the rendered fixture/OG acceptance tests are the
same real-build suite; the functional changes remain separate modules (`content-identity`,
`getPostsForOg`).

## Task 1 — loader route identity shared with sitemap exclusion

- **Finding (red):** `astro.config.mjs` scanned unlisted posts with the raw filename while
  the Astro 7 glob loader normalizes each segment. A real `en/Review Hidden.md` build emitted
  `/posts/review-hidden/` and a sitemap entry while the exclusion set held the raw identity
  (independent review, `docs/reports/2026-11-13-independent-upstream-repair-review.md`).
- **Fix:** `src/site/content-identity.ts` is the single segment/index/explicit-slug policy. The
  configured glob loader installs it as `generateId`; the sitemap scanner, publishing
  expectations and existing `contentSlug()` helper use the same policy. Segment normalization
  mirrors the locked loader (Unicode letters/numbers, `_`/`-` kept, spaces → `-`, punctuation
  removed, terminal `index` removed once) and an explicit frontmatter `slug` wins verbatim.
- **Fixtures (real build):** committed unlisted `src/content/posts/en/Review Hidden.md`; rendered
  fixtures for nested terminal `index`, internal `index`, non-ASCII `Non-ASCII Ünïcode`,
  explicit `slug: explicit-identity`, and explicit-slug + unlisted `hidden-identity`, alongside
  the existing prefix/other-locale collision cases.
- **Green:** `tests/site/seo.test.mjs` and `tests/site/sitemap.test.mjs` assert one normalized
  identity for loader route, sitemap exclusion and OG path; the review's mixed-case leak is gone.

## Task 2 — routine validation follows current source, rejects stale artifacts

- **Finding (red):** the pre-upload validator compared every artifact against the fixed
  November 2 baseline, so a normal post correction, new post, feed/sitemap item, OG image and
  Pagefind count change all failed deployment validation.
- **Fix:** `scripts/site-source-expectations.mjs` derives current expectations from source only:
  post/page/taxonomy/pagination routes, per-route canonical/lang/robots/OG/hreflang, feeds,
  sitemap identities, generated OG paths and the Pagefind count. It reuses the shared identity,
  taxonomy-decision, media and page-size policies.
- **Staleness:** the Astro build writes `.astro/site-build-manifest.json` (never inside `dist/`)
  with a hash of `src/`, `public/` and build/config inputs. Routine validation recomputes that
  fingerprint and rejects a source edit that was not rebuilt, without reading expectations from
  the output it is checking.
- **Historical mode retained:** `--mode historical --baseline …` (and `verify-site.mjs`) still
  enforces the measured snapshot with the four exact field corrections. The permanent unlisted
  regression fixture is classified additively (source/route/OG) and changes no protected value.
- **Lifecycle test:** `tests/site/publishing-validation.test.mjs` builds a disposable real project
  and covers: unchanged pass; editorial correction + EN/VI additions; stale rejection before
  rebuild; corrected rebuild pass; draft publish; draft unpublish; synthetic fixture deletion;
  missing route/OG/feed/sitemap/search; corrupted canonical/origin; production CMS/comments in
  preview; scoped-only noindex; restore passes; explicit historical mode rejects the unapproved
  content correction.

## Task 3 — effective noindex header scope

- **Finding (red):** marker and validator matched `X-Robots-Tag: noindex` anywhere in `_headers`,
  so a `/cms/*` rule (or a comment) passed as global preview protection and suppressed injection.
- **Fix:** `scripts/header-policy.mjs` parses header blocks and treats only an effective catch-all
  `/*` noindex rule as protection. Scoped rules, comments, `noindexing`, unrelated headers and a
  catch-all unset are handled explicitly. Marker injection stays idempotent and preserves existing
  cache/security rules. Production rejects a site-wide rule but accepts a harmless CMS-only rule.
- **Green:** `tests/site/header-policy.test.mjs`,
  `tests/site/preview.test.mjs` and `tests/site/validate-built-site.test.mjs`.

## Task 4 — valid OG resource for published unlisted pages

- **Finding (red):** `src/pages/og/[...slug].png.ts` iterated `getPosts()`, which excludes unlisted
  posts, while `PostLayout` still referenced `/og/<slug>.png`; a real hero-less unlisted post
  referenced a missing file.
- **Fix:** `getPostsForOg()` includes every published post (listed + unlisted) and still excludes
  drafts; the OG endpoint uses it. Discovery surfaces keep using `getPosts`. Unlisted pages remain
  noindex/unlisted in listings, RSS, sitemap and Pagefind; drafts get no page and no OG image.
- **Ownership:** `theme-upstream.json` records the changed shared files and the `PostLayout` locale
  fix (render locale now comes from normalized post data, so explicit slugs work).

## Fresh verification (verified implementation HEAD `2194c0d`)

| Check                                         | Result                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------- |
| `bun run typecheck`                           | PASS: 102 files, 0 errors, 0 warnings, 1 hint                                          |
| `bun run lint`                                | PASS                                                                                   |
| `bun run format:site:check`                   | PASS, including the report/evidence tree after final formatting                        |
| `bun run test:site`                           | PASS: **158/158** (serialized with `--test-concurrency=1`; two real-build suites)      |
| `bun test src/utils/posts.test.ts`            | PASS: 10/10                                                                            |
| `node scripts/verify-site.mjs --profile full` | PASS: 34 routes, 2 feeds, 32 sitemap URLs, 7 OG paths, 33 Pagefind pages (historical)  |
| Routine production validator                  | PASS: 34 routes, 2 feeds, 32 sitemap URLs, 7 generated OG files, 33 Pagefind pages     |
| Preview build + prepare + noindex + validator | PASS: global noindex, isolated `codex/cms-validation-…` CMS, comments disabled         |
| Adopted starter ancestry                      | PASS: `821bc6171f2ed0f74d920cc5ab70794c3f779971` is an ancestor of HEAD                |
| Historical bridge tree equality               | PASS: `git diff af80346^ af80346 --exit-code`                                          |
| True merge parents                            | PASS: `7da7e21` parents `af80346…` and `821bc61…`                                      |
| Drift reporter (adopted = candidate)          | PASS: `+0 ~0 -0 renamed 0`, package/lock coherent                                      |
| Protected content diff vs repair base         | Only the additive `src/content/posts/en/Review Hidden.md`; no existing content changed |
| Remote reconciliation                         | `origin/main` `b278874…` (ancestor), `origin/staging` `ec2f254…`; no new main content  |

Runtime available for this pass was Node **26.13.1** and Bun **1.3.14** with installed Astro
**7.1.6**. The branch pins Node **26.12.1**; this run did not independently repeat a clean frozen
install under that exact patch version. All builds used the existing locked dependency tree.

Evidence is under `docs/reports/evidence/2026-11-13-publishing-followup/`:
`static-checks.txt`, `site-tests.txt`, `historical-verify-full.txt`,
`historical-full-contract.json`, `routine-production-validate.txt`, `preview-build.txt`,
`preview-prepare.txt`, `preview-noindex.txt`, `routine-preview-validate.txt`, `lineage.txt`,
`drift-reporter.txt`, `remote-reconcile.txt`, `astro-build.log`, `pagefind.log`.

## External gates (not performed; individually classified)

These require credentials, a confirmed target, browser/host access or Actions execution. None was
attempted by this pass, and local fixture results are not evidence that they passed.

1. **Authenticated CMS/media round-trip** — blocked externally (no Sveltia/Cloudinary credentials).
   Must run on a pre-created, verified `codex/cms-validation-<run>` branch, never `main`.
2. **Actual staging deployment + HTTP checks** — blocked externally (target/authorization needed).
   No deployment was performed; local preview artifacts are not a staging result.
3. **Cloudflare production branch, custom domain and rollback deployment ID** — blocked externally
   (account access). Read-only host check only; no production deploy.
4. **Read-only production comments identity check + live remote-asset cold build** — blocked
   externally; no production discussion write or live remote fetch was attempted here.
5. **Real browser interaction checks** (mobile/keyboard, Giscus cold-load → client navigation →
   theme/language) — not executed; static/unit coverage only.
6. **Actual GitHub Actions execution** — not run here; workflow files are covered by local contract
   tests, not by a remote run.
7. **Pinned Sveltia branch lifecycle** — `prepare-preview.mjs` validates the
   `codex/cms-validation-<run>` name and isolation, but whether the pinned backend creates that
   branch on save remains unverified without credentials.

Staging remains untouched and un-deployed. Production comments were never written. No controller,
main merge, force-push or production deploy was performed.
