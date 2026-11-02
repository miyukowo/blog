# Upstream update, preview and rollback runbook

This runbook describes how this repository is maintained as a Git derivative of the generated
[Chirping Astro starter](https://github.com/kannansuresh/chirping-astro-starter), with the
[canonical theme source](https://github.com/kannansuresh/chirping-astro) tracked for provenance and
release rationale. It records the adopted state after the 2026-11-02 catch-up and the exact
procedure for the next update.

Machine-readable provenance and ownership live in [`theme-upstream.json`](../../theme-upstream.json).
The compatibility contract lives in [`scripts/site-contract.mjs`](../../scripts/site-contract.mjs) /
[`scripts/verify-site.mjs`](../../scripts/verify-site.mjs), and read-only drift reporting in
[`scripts/check-upstream.mjs`](../../scripts/check-upstream.mjs).

## Adopted state

| Item                          | Value                                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| Adopted starter               | `821bc6171f2ed0f74d920cc5ab70794c3f779971`                                                            |
| Corresponding source          | `4585c2d78f1c429e5c3092ed79e68cc839413964`                                                            |
| Historical import (near-copy) | starter `5e8552f3922b623c04b5d0ffae4d7a9e255ccb20`, source `551ffe811906f6fe2813da4ea271c2d5f638b721` |
| Ancestry bridge commit        | `af8034605b6c04873f9a51cdc2433a15255aa1dc` (synthetic `-s ours` merge, history only)                  |
| Tested runtimes               | Node 26.12.1, Bun 1.3.14, Astro 7.1.6, MDX 7.0.5, markdown-satteri 0.3.5, satteri 0.9.5               |
| Production branch             | `main`; preview branch `staging`                                                                      |

The original import was a personalized near-copy without Git ancestry (85/87 blobs matched). The
bridge commit records that import as ancestry without changing the tree; it must **only** ever
target the historical starter commit, never a newer tip. The adopted starter is now a real ancestor
of the implementation branch (verify with
`git merge-base --is-ancestor 821bc6171f2ed0f74d920cc5ab70794c3f779971 HEAD`).

## Ownership model

- **Protected authored content** — `src/content/**`. Upstream must never overwrite, move or delete
  it. Any drift report touching it is a blocking error and is reconciled by hand.
- **Local-owned paths** — `src/site/**`, `scripts/**`, `tests/**`, `docs/**`, `theme-upstream.json`,
  `public/cms/**`, `public/_headers`, branded public assets, the Cloudflare workflow, and the
  retained authored components (`Alert.astro`, `ReadingProgress.astro`, `src/utils/og-image.ts`).
- **Shared explicit exceptions** — the small, enumerated set in `theme-upstream.json`
  (`astro.config.mjs`, `package.json`/`bun.lock`, `src/config.ts`, i18n/posts/SEO seams, layouts,
  `SmartImage`, `Giscus`, taxonomy routes, styles, README/tooling). Each entry has a reason and a
  validation command; adding a new local change to an upstream-shared file means adding an exception
  entry in the same pull request.

## Compatibility gates

Run these before any upstream update is merged into `staging`/`main`:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run format:site:check
bun run test:site                 # contract, locale/URL, media/markdown, SEO/visibility, CMS, preview, upstream reporter
bun test src/utils/posts.test.ts  # upstream Unicode slug tests, unchanged
node scripts/verify-site.mjs --profile offline   # deterministic production-shaped build + contract
node scripts/verify-site.mjs --profile full      # refuses skipped required output
```

The contract compares against the measured baseline in
[`docs/research/2026-11-02-dsh-preflight-baseline.json`](../research/2026-11-02-dsh-preflight-baseline.json):
33 HTML routes, 12 tracked content files with SHA-256/body hashes, 2 feeds, 32 sitemap URLs,
6 generated OG images, Pagefind 33 pages (EN/VI). Changes are only accepted through the documented
exact `from → to` field allowances: the intentional VI RSS language correction and three corrected
taxonomy hreflang values. Any other drift fails.

## Update procedure

1. **Fetch** origin and both upstream repositories (use `git fetch`, never a raw copy):
   ```bash
   git fetch origin --prune
   git fetch https://github.com/kannansuresh/chirping-astro-starter main
   git fetch https://github.com/kannansuresh/chirping-astro main
   ```
2. **Capture the pins**: record starter/source SHAs, verify the starter commit message records the
   same source SHA (`sync: update from chirping-astro@<sha>`), and confirm both repositories' `main`
   heads still correspond. A mismatch is a stale source pair — stop and investigate.
3. **Check ancestry**: the candidate starter must descend from the adopted starter
   (`git merge-base --is-ancestor <adopted> <candidate>`). If not, something was force-pushed
   upstream; do not merge blindly.
4. **Create an update branch** from `staging` (e.g. `codex/upstream-update-<date>`). Never update
   `main` directly and never rewrite published history.
5. **Drift report first** (read-only, no file changes):
   ```bash
   node scripts/check-upstream.mjs --adopted <current-starter-sha> --candidate <new-starter-sha>
   ```
   Review every addition/modification/deletion/rename, protected-content change, shared exception,
   local-owned overlap and the `package.json` ↔ `bun.lock` coherence line. A non-zero exit is a
   blocking finding, not an invitation to loosen the checks.
6. **Merge normally**, preserving the second parent:
   ```bash
   git merge --no-ff <new-starter-sha> -m "merge: adopt Chirping starter <sha>"
   ```
   Never `-s ours`/`-X ours`/`-X theirs` for a new tip. Resolve conflicts deliberately: keep the
   local site seams, adopt upstream implementation, and re-read every auto-merged file (a clean
   merge is textual evidence only).
7. **Install** with the reviewed manifest/lock pair under the tested runtime
   (`bun install`, commit the paired `package.json` + `bun.lock`; keep `minimumReleaseAge`).
8. **Verify** with the compatibility gates above plus a fresh cold-cache build; compare protected
   content/routes/feeds/sitemap/OG/search output.
9. **Review**: post the drift report, the full diff versus both the previous branch and the upstream
   candidate, and the validation logs. A clean checkout link/deployment is not approval.
10. **Integrate** only after review, with ordinary merge commits (never squash/rebase, so the
    upstream ancestry survives). Confirm the adopted starter remains an ancestor afterwards.

### Optional `workflow_dispatch` PR preparer

A future update-PR workflow may fetch the pinned refs, run steps 3–8 and open a draft PR. It must
give the job minimum permissions, keep the starter/source pins in the PR body, never merge/deploy,
and never run with production secrets on PR code. Scheduled automatic updates are out of scope.

## Rollback

- **Implementation branch**: keep the pre-merge ref recorded in the update PR; rollback is a new
  commit revert (or resetting only the disposable update branch before integration). Never
  force-push `staging`/`main`.
- **Failed staging preview**: the previous Pages deployment is the rollback target; restore it and
  fix forward. Keep the failed evidence.
- **Failed production cutover**: restore the prior Pages deployment, then revert the migration
  commits on `main` with new commits while preserving posts published since. Record the exact
  deployment ID/ref used for rollback. Note that ancestry alone will not replay a reverted upstream
  merge — re-adoption needs a fresh normal merge against the recorded pins.

## Rehearsals actually run (2026-11-02)

Both rehearsals ran in disposable clones; the real branch refs were untouched.

- **Functional update** `a5cda9782b93f241f22ef38d9ff7b328a354a0b3 → a2b22df2c0619c7d157324c9de458f38585d8e50`
  (adds the 56-line base-links plugin + 2 config lines): reconstructed the current local adapters
  against the historical checkout, recorded 12 protected content hashes and 8 public post
  identities, then did a real `--no-ff` merge. It conflicted in `astro.config.mjs` exactly where the
  local adapter seam sits next to the new upstream wiring. Resolution kept the upstream plugin
  import/wiring and the local adapter entry; the merge commit kept both parents, protected content
  hashes and post identities were unchanged, and rollback restored the pre-merge tree
  (`8637fff66a7a93fdf9d8d1feaec2c468e897cff0`). A first attempt showed that a naive resolution can
  silently drop a local adapter line — which is why the runbook requires reviewing the whole diff,
  not just a zero merge exit status.
- **Dependency update** `f63a255317c8851d0f354de2fc7580d57873af3e → 821bc6171f2ed0f74d920cc5ab70794c3f779971`
  (only `package.json` + `bun.lock`, +6/−4): recorded both file hashes, confirmed
  `bun install --frozen-lockfile --dry-run` before and after, fast-forwarded the disposable branch,
  and reset back to the exact pre-update hashes/ref.
- Evidence: [`task8-rehearsal-functional.txt`](../reports/evidence/task8-rehearsal-functional.txt)
  and [`task8-rehearsal-dependency.txt`](../reports/evidence/task8-rehearsal-dependency.txt).

## Deferred features register

See `theme-upstream.json → deferred` for the machine-readable list. In short:

| Feature                        | Why deferred                                                                                       | Restoration seam                                                                | Acceptance                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| KaTeX math in `.mdx` posts     | Sätteri/MDX cannot carry inline raw HTML; KaTeX output escapes. Upstream's own math demo is `.md`. | Author math in `.md` posts, or add a site Math MDX component under `src/site/`. | Rendered KaTeX markup in `tests/site/seo.test.mjs` (current coverage uses `.md`). |
| Mermaid fences in `.mdx` posts | Same raw-HTML limitation; upstream mermaid demo is `.md`.                                          | Author in `.md`, or wrap with a site Mermaid MDX component.                     | Wrapper + island assertions in `tests/site/seo.test.mjs`.                         |
| Page-scoped KaTeX stylesheet   | Upstream Astro 7 dynamic layout links the extracted MathStyles CSS on every post page.             | Revisit with the upstream font/style import strategy.                           | Non-math pages omit the chunk (not achievable now).                               |
| Fancy direct-video controls    | Native playable video accepted; existing Plyr wrapper retained and working.                        | `src/components/VideoEmbed.astro`                                               | Authored `<VideoEmbed src=…/>` renders a playable element.                        |

Local presentation kept (not deferred): post author avatar, reading progress, back-to-top, theme
transitions, VI typography (Vietnamese `unicodeRange` subset added to the upstream font config).

## Deployment and preview contract (Task 7)

- `.github/workflows/deploy-cf.yml` runs a `checks` job first (frozen install, typecheck, lint,
  scoped formatting, site tests, upstream slug tests) and only then a `deploy` job.
- Runtimes are pinned: Node from `.node-version` (26.12.1), Bun 1.3.14.
- `main` deploys to production; `staging` deploys to `staging-blog.tvphus.dev` at the root base path
  (no `/staging` prefix, so comment path identity is preserved). Per-branch concurrency is kept.
- Both branches build the full output set: the old staging `CI_SKIP_AUTO_OG_IMAGE` skip is removed;
  no `CI_SKIP_*` flag may disable content/OG/RSS/sitemap/search in deployment builds.
- Non-production builds run `scripts/prepare-preview.mjs` (isolated CMS config) and
  `scripts/mark-preview-noindex.mjs` (adds `X-Robots-Tag: noindex, nofollow`); production is never
  marked noindex and the script refuses `main`.
- Deployment credentials are only present in the deploy job; the workflows do not run on
  `pull_request`/`pull_request_target`, so untrusted code cannot read them.
- The GitHub Pages workflow (`deploy.yml`) is preserved with its own subpath base for separate
  usage assessment; it was observed `disabled_manually` but a Pages API 404 alone is not evidence it
  is unused.

## Remaining external gates (unverified here)

These require credentials/account access and were **not** performed; do not treat this runbook as
evidence that they passed:

1. Authenticated Sveltia/Cloudinary create/edit/upload/save/reload/delete round-trip on a
   `codex/cms-validation-<run>` branch (see the CMS section below for exact steps).
2. Actual staging deployment + HTTP/browser confirmation (noindex header, assets/OG/search/CMS test
   branch/isolation), Cloudflare production branch, custom-domain mapping and rollback deployment ID.
3. Read-only production comments identity check and a live remote-asset cold build.
4. Browser interaction checks (mobile/keyboard navigation, Giscus cold-load → client navigation →
   theme/language change) beyond the static/unit evidence in `tests/site/seo.test.mjs`; the mount
   plan is unit-tested, but a real browser session is still required.

## Preflight and execution notes retained

- Prepared checkout `/home/tvp/.codex/worktrees/upstream-preflight/blog`, branch
  `codex/upstream-refactor`, derived from staging `b5931705fb42031ed3a751d651823c150c24ef4e`; main
  `b278874e33b121a0629de06e9f94bdba7a45bdd0` merged normally at `1e98ad2`.
- The prepared checkout's original Git metadata lives outside the writable workspace; the
  implementation imported that (small) metadata directory into the workspace as a standalone
  repository so commits/merges could be created. The original `/home/tvp/blog` checkout, its
  branches, stashes and the controller worktree were left untouched; backup refs
  `codex/backup-staging-20261102` and `codex/backup-main-20261102` are preserved.
- Origin/main was re-fetched before final validation on 2026-11-02 and was unchanged at
  `b278874e33b121a0629de06e9f94bdba7a45bdd0` (already an ancestor of the implementation branch); no
  intervening published content needed reconciliation.
- The controller attempt (`task-20261102153518-196db98a`) changed nothing; controller
  troubleshooting is out of scope per the manual handoff.

---

## CMS publishing and preview validation

<!-- BEGIN CMS PUBLISHING AND PREVIEW VALIDATION (Task 6) -->

The authenticated CMS/media round-trip is deliberately **not claimed** by the offline checks. This
section defines the production contract, the isolated preview rule and the exact remaining manual
gate.

### Production publishing contract

- The tracked config is `public/cms/config.yml`, served as `/cms/config.yml`. Its backend is
  `github`, `repo: miyukowo/blog`, `branch: main`; production always publishes to `main`.
- `backend.skip_ci: false` keeps automatic deployments enabled, so a normal CMS save triggers the
  Cloudflare Pages build. Do not add `[skip ci]`-style markers to `commit_messages`.
- EN/VI use `i18n.structure: multiple_folders`. Posts are
  `src/content/posts/<locale>/<postSlug>/index.mdx`; pages are
  `src/content/pages/<locale>/<slug>.md`. Keep `translationKey`, `pubDate`/`updatedDate`,
  `draft` and `unlisted` intact.
- Cloudinary output is full-URL: global and field-level `output_filename_only: false`. Sveltia
  field media options replace the matching global options, so every image-bearing field restates
  the setting. `src/site/media.ts` maps those full URLs to the optimized CDN path at render time.
- The CMS bundle is pinned to the verified published version `@sveltia/cms@0.256.1` with a SHA-384
  `integrity` hash in `public/cms/index.html`; the schema reference in `config.yml` is pinned to
  the same version. To bump it: check `https://registry.npmjs.org/@sveltia/cms`, update the version,
  recompute the SRI hash from the exact unpkg file, update the pinned schema URL, then rerun
  `node --test tests/site/cms.test.mjs`. Never use `@latest` or a floating range.
- `/cms/index.html` loads its own directory config via
  `<link href="./config.yml" type="application/yaml" rel="cms-config-url" />`. It never fetches a
  config from another path or origin. The Alert editor component emits the
  `/src/components/Alert.astro` import together with the JSX so its output compiles as MDX.
  Limitation: multiple CMS-inserted Alert blocks in one body each emit their own import, which MDX
  rejects as a duplicate binding; current authored content has at most one Alert per post. A
  follow-up can move to a single per-post import or a global MDX component map.

### Preview writes: isolated branch rule

Preview validation must never write production content. Use a short-lived branch named
`codex/cms-validation-<run>` where `<run>` is 1-64 characters of `A-Za-z0-9._-` (no `..`), distinct
from `main`, `staging` and code implementation branches.

Do not edit `public/cms/config.yml` for a preview. The build copies it to `dist/cms/config.yml`;
rewrite only that generated file:

```bash
bun run build
node scripts/prepare-preview.mjs \
  --dist dist \
  --branch codex/cms-validation-20261102-2315 \
  --site-url https://staging-blog.tvphus.dev
```

`scripts/prepare-preview.mjs` (also importable as
`preparePreviewCms({ distDir, branch, siteUrl })`) validates the built config and fails closed
before any write:

- rejects a missing/empty branch, `main`, `staging`, and any branch not matching
  `codex/cms-validation-<run>`;
- rejects a missing/empty/non-http(s) `site-url` (must be a bare origin, no credentials);
- rejects `--dist` equal to the repository root or inside `public/`, a missing
  `dist/cms/config.yml`, a foreign `backend.repo`, or a config whose `backend.branch` is no longer
  `main` (already preview-modified);
- rewrites only `backend.branch` and `site_url`, re-parses the result, verifies no other key changed
  and that no credential-looking keys were introduced, then atomically replaces the file.

The tracked `public/cms/config.yml` is never touched, so `node --test tests/site/cms.test.mjs`
asserts it stays byte-identical and that the next production build recreates a `main` config.
`--site-url` must be the verified preview origin; replace the example above with that verified
origin once the staging custom-domain mapping is confirmed.

### Remaining authenticated round-trip gate (unverified)

Offline tests cannot prove Cloudinary permissions, GitHub authentication or real save/reload
behavior. This gate remains **blocked until a person with the required credentials performs it**.
It must be run on a `codex/cms-validation-<run>` branch only; never on `main`, `staging` or the
implementation branch.

1. Create the short-lived validation branch, build it, run `prepare-preview.mjs` for that build and
   deploy the resulting artifact to the verified nonproduction preview origin (no production
   deployment).
2. Sign in to `/cms/` with an account that has write access to `miyukowo/blog`: fine-grained token
   with Contents read/write (plus Pull requests read/write only if the editorial workflow is used).
   The Cloudinary Media Library needs the existing cloud/API-key access for uploads. No secret
   belongs in the repository, config or test fixtures.
3. Create one EN draft and its VI translated draft with the same `translationKey` and
   `postSlug`; insert an Alert; select an existing image and upload one new image for the hero and
   inline body; save.
4. Reload the CMS and the rendered post: confirm both locale files exist at
   `<postSlug>/index.mdx` under their locale folders, frontmatter values survived, the hero/body
   image returns the optimized CDN path, and the Alert renders.
5. Delete the test entry and the media owned by this test, save again, and confirm only the
   `codex/cms-validation-<run>` branch ref/content changed. `main` and the implementation branch
   must be unchanged.
6. Retain evidence (branch name, commit/tree SHA, screenshots or logs) and remove the validation
   branch and test-only media afterwards.

If authentication or the preview origin is unavailable, report this gate as blocked/unverified and
do not substitute a mock for the real round-trip.

<!-- END CMS PUBLISHING AND PREVIEW VALIDATION (Task 6) -->

## Implementation report

The independent-review report for this catch-up (including validation evidence and remaining
risks) is [`docs/reports/2026-11-02-manual-upstream-implementation.md`](../reports/2026-11-02-manual-upstream-implementation.md).
