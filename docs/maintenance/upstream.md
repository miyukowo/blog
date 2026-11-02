# Upstream migration execution record

## Preflight — 2026-11-02

The user approved the plan and DSH execution. This record covers host-only preparation; it does not claim the migration is implemented.

- Controller connection is available; list_tasks initially reported no existing tasks.
- Native managed checkout: /home/tvp/.codex/worktrees/upstream-preflight/blog, branch codex/upstream-refactor, derived from staging b5931705fb42031ed3a751d651823c150c24ef4e.
- Ordinary merge of origin/main b278874e33b121a0629de06e9f94bdba7a45bdd0 created 1e98ad20269a5bc9b8718d949854a7c745276a24. Only the branch-aware Cloudflare workflow changed. Original staging checkout and both main stashes remain intact.
- Local backup branches: codex/backup-staging-20261102 and codex/backup-main-20261102.
- Source and starter heads remain 4585c2d78f1c429e5c3092ed79e68cc839413964 and 821bc6171f2ed0f74d920cc5ab70794c3f779971. No upstream bridge/adoption merge has happened.
- GitHub reports Cloudflare workflow active and GitHub Pages workflow disabled_manually. Pages API returned 404; that alone does not establish whether an old public endpoint is still used. Preserve its workflow until the deployment review.
- Latest successful main Cloudflare workflow run: https://github.com/miyukowo/blog/actions/runs/27092205173 at b278874. Exact Cloudflare deployment ID/account/custom-domain settings require later read-only verification; an Actions success is not itself a verified rollback deployment.
- Fresh explicit Node production-shaped build passed: 33 HTML pages, six OG images, 32 sitemap URLs. Pagefind passed: 33 pages, EN/VI. Local avatar and installed dependencies were used; no environment file was copied and no external write was performed.
- Refreshed baseline: ../research/2026-11-02-dsh-preflight-baseline.json. All protected content hashes, routes, feed data, sitemap URLs and OG paths match the original measured baseline exactly.
- Node 26.12.1, Bun 1.3.14. Existing dependency directory exposes parse5 and fast-xml-parser for the initial contract task. It was initially linked, then replaced with a regular dependency directory after controller bootstrap validation rejected symlinks; Git info/exclude keeps dependency material out of snapshots.

## Current execution method — manual DeepSeek

The user switched to manual DeepSeek implementation and deferred controller troubleshooting. Follow [the manual task brief](../handoffs/2026-11-02-manual-deepseek-tasks.md) and [report template](../handoffs/2026-11-02-manual-deepseek-report-template.md). Work in the prepared staging-derived checkout, commit reviewable phases, and return the report/branch/HEAD for independent Codex validation. Do not invoke the controller, repair its permissions, merge into main or publish production as part of this handoff.

## Deferred release gates

Cold-cache final Astro 7 installation/build, authenticated isolated CMS/media round-trip, Cloudflare account/domain/rollback-ID confirmation, live read-only comments check, staging deployment and final content reconciliation remain required at the owning later phases. None blocks the isolated fixture-based contract implementation.

## First DSH attempt — blocked

Task task-20261102153518-196db98a was submitted from the canonical blog repository at reviewed base d036734. The controller denied ordinary commands within its own assigned worktree as protected state, then requested approval for the worker diagnostic /bin/ls /tmp. The task was cancelled; no files changed, no tests ran, no snapshot was made. Artifacts/worktree remain available. See ../handoffs/2026-11-02-dsh-controller-blocker.md for evidence and the read-only source diagnosis. No controller permissions were relaxed and no further model turns were started.

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
`--site-url` must be the verified preview origin; the actual staging domain/branch mapping is
confirmed in Task 7, so replace the example above with that verified origin.

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
