# Evidence index — 2026-11-13 review repairs

Command output for the repair pass described in
[the repair report](../../2026-11-13-upstream-review-repairs.md). Every file is a captured
`stdout`/`stderr` log plus the recorded exit code; no output was edited after capture.

## Failing-before evidence

| File                        | Proves                                                                                  |
| --------------------------- | --------------------------------------------------------------------------------------- |
| `task1-format-before.txt`   | Scoped formatting failed on `full-contract.json` before the fix.                        |
| `task2-mdx-before.txt`      | MDX math did not render as `.katex` elements (escaped text).                            |
| `task3-sitemap-before.txt`  | Substring matching hid a listed sitemap route sharing an unlisted slug.                 |
| `task4-base-before.txt`     | Already-based links/images gained a second base and double application kept growing it. |
| `task5-comments-before.txt` | Non-main workflow selected the production comment-enable setting.                       |
| `task6-workflow-before.txt` | No credential-free PR workflow and no pre-upload artifact gate existed.                 |

## Passing-after evidence

| File                                  | Proves                                                                |
| ------------------------------------- | --------------------------------------------------------------------- |
| `task1-format-after.txt`              | Scoped formatting exits 0 after the JSON-only reformat.               |
| `task1-semantic-equality.txt`         | Parsed JSON canonical SHA-256 is identical before/after.              |
| `task2-mdx-after.txt`                 | SEO fixture build passes with rendered MDX math/Mermaid/alert/ashtml. |
| `task2-seo-after.txt`                 | Full SEO/visibility/navigation fixture test passes.                   |
| `task2-markdown-after.txt`            | Markdown/MDX media and base build tests pass.                         |
| `task2-typecheck.txt`                 | Astro typecheck passes with the new seam.                             |
| `task3-sitemap-after.txt`             | All three sitemap identity fixtures pass.                             |
| `task3-unit-tests.txt`                | Pure sitemap normalization/matcher tests pass.                        |
| `task3-verify-full.txt`               | Root full contract still passes after the sitemap fix.                |
| `task4-base-after.txt`                | Idempotent link/image tests, root base and double application pass.   |
| `task5-comments-workflow-after.txt`   | Workflow selection and non-main comments policy tests pass.           |
| `task5-seo-after.txt`                 | Rendered non-main build emits no production comment mount.            |
| `task6-workflow-tests.txt`            | PR workflow and pre-upload validation order tests pass.               |
| `task6-validator-tests.txt`           | Artifact mutation/restore tests and CLI behavior pass.                |
| `task6-production-validate-local.txt` | Local production artifact validation passes.                          |
| `task6-preview-validate-local.txt`    | Local preview artifact validation passes.                             |
| `task6-test-site.txt`                 | Full site suite passes at the Task 6 code HEAD.                       |

## Clean-archive final run (Node 26.12.1, Bun 1.3.14)

| File                                       | Content                                                   |
| ------------------------------------------ | --------------------------------------------------------- |
| `final-clean-install.txt`                  | `bun install --frozen-lockfile` in a clean `git archive`. |
| `final-versions.txt`                       | Node/Bun/Astro versions.                                  |
| `final-typecheck.txt`                      | Typecheck result.                                         |
| `final-lint.txt`                           | Lint result.                                              |
| `final-format.txt`                         | Scoped formatting result.                                 |
| `final-test-site.txt`                      | `bun run test:site` (138/138).                            |
| `final-posts-test.txt`                     | `bun test src/utils/posts.test.ts` (10/10).               |
| `final-verify-full.txt`                    | Full contract profile.                                    |
| `final-validate-production.txt`            | Read-only production artifact validation.                 |
| `final-preview-build.txt`                  | Preview-shaped full build.                                |
| `final-prepare-preview.txt`                | Isolated preview CMS config generation.                   |
| `final-mark-noindex.txt`                   | Preview noindex header injection.                         |
| `final-validate-preview.txt`               | Read-only preview artifact validation.                    |
| `final-subpath-fixture-build.txt`          | `BASE_PATH=/blog` Markdown fixture build.                 |
| `final-ancestry.txt`                       | Ancestor, bridge-tree and merge-parent checks.            |
| `final-drift-adopted-equals-candidate.txt` | Read-only upstream drift reporter.                        |

## Notes

- The clean-archive run used a downloaded official Node 26.12.1 tarball; the working checkout itself
  runs Node 26.13.1.
- `.repairs-evidence/` (working scratch logs, downloaded Node, clean tree, Sveltia bundle) is
  intentionally untracked and is not part of the branch.
- No credential values appear in these logs; production comment and CMS checks were not executed.
