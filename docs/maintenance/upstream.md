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
