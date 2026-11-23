# Manual upstream implementation report

Date:
Agent/environment:
Implementation status: complete / partial / blocked

## Git and scope

- Starting branch and full commit:
- Final branch and full commit:
- Working tree status:
- Latest main reconciled:
- Adopted starter SHA:
- Corresponding canonical source SHA:
- Historical ancestry bridge and target ancestry verification:
- Per-task commits:
- Diff/stat command and output location:

## Task results

| Task                      | Status | Commit(s) | Changed files / outcome | Remaining work |
| ------------------------- | ------ | --------- | ----------------------- | -------------- |
| 1. Harness/runtime        |        |           |                         |                |
| 2. Site policies          |        |           |                         |                |
| 3. Upstream adoption      |        |           |                         |                |
| 4. Media/rendering        |        |           |                         |                |
| 5. SEO/visibility/browser |        |           |                         |                |
| 6. CMS isolation          |        |           |                         |                |
| 7. Full checks/staging    |        |           |                         |                |
| 8. Maintenance/rehearsals |        |           |                         |                |

## Validation evidence

Use pass / fail / blocked / not run. Include exact commands and exit codes.

| Check                                        | Status | Command/environment | Exit code / counts | Evidence path / limitation |
| -------------------------------------------- | ------ | ------------------- | ------------------ | -------------------------- |
| Fresh frozen install                         |        |                     |                    |                            |
| Types                                        |        |                     |                    |                            |
| Lint                                         |        |                     |                    |                            |
| Scoped formatting                            |        |                     |                    |                            |
| Local tests                                  |        |                     |                    |                            |
| Upstream tests                               |        |                     |                    |                            |
| Full build + Pagefind                        |        |                     |                    |                            |
| Cold-cache/live assets                       |        |                     |                    |                            |
| Browser/mobile/navigation                    |        |                     |                    |                            |
| Staging headers/assets                       |        |                     |                    |                            |
| Authenticated isolated CMS/media round-trip  |        |                     |                    |                            |
| Production comments read-only identity check |        |                     |                    |                            |
| Functional upstream update rehearsal         |        |                     |                    |                            |
| Dependency update rehearsal                  |        |                     |                    |                            |
| Rollback rehearsal                           |        |                     |                    |                            |

## Compatibility evidence

- Baseline(s) used:
- Original protected content hashes:
- New/edited content from main and its reconciliation:
- Existing public URLs and VI taxonomy paths:
- Actual translated sibling links and hreflang:
- Giscus mapping/repository/category preservation:
- Markdown/MDX/component/hero/card/OG image coverage:
- Draft/unlisted visibility across output/search/feeds/sitemap:
- Intentional defect corrections and explicit allowed differences:

## Upstream delta and maintenance

- Remaining shared-file exceptions and reasons:
- New local-owned modules and callers:
- Dependency/lock changes beyond upstream and why:
- Update command/runbook:
- Rehearsal before/after refs, intended effects and manual conflicts/steps:
- Rollback procedure, refs/artifacts, and preservation of later posts:

## Deferred features

| Feature actually removed/deferred | Why | Restoration seam/files | Acceptance criteria |
| --------------------------------- | --- | ---------------------- | ------------------- |
|                                   |     |                        |                     |

## Blockers and review risks

- Required checks not verified:
- Existing failures retained:
- Credentials/account actions still needed, without revealing credentials:
- Unexpected/untracked/generated changes:
- Specific areas for independent review:

## Handback

Return this report path, full final HEAD, branch, and a short summary to the user. Leave implementation available for inspection. Do not merge into main or publish production.
