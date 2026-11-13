/**
 * The complete, exact list of accepted deviations from the measured baseline.
 *
 * Shared by every verification entry point (`scripts/verify-site.mjs` and
 * `scripts/validate-built-site.mjs`) so a deploy validation cannot silently
 * accept different corrections than the local/full contract.
 *
 * These are the only accepted contract deviations:
 *
 * 1. `/vi/rss.xml` language `en-us` -> `vi-vn`: the known baseline defect
 *    this refactor fixes.
 * 2. `/categories/guide/` `hreflangs.vi`: the baseline recorded
 *    `/vi/categories/guide/`, which does not exist; the real translated
 *    destination is `/vi/categories/huong-dan/`.
 * 3. `/vi/categories/huong-dan/` `hreflangs.en` (and `hreflangs.x-default`,
 *    which follows the default-locale sibling): the baseline recorded
 *    `/categories/huong-dan/`, which does not exist; the real EN counterpart
 *    is `/categories/guide/`.
 *
 * Every entry is an exact `from` -> `to` pair with a reason; nothing else is
 * allowed to drift. Entries 2 and 3 are pre-Task-2 baseline defects: inert in a
 * checkout where Task 2 has not landed, active once the taxonomy fix is
 * integrated.
 */
export const ALLOWED_CHANGES = {
  // Task 1 regression fixture: a permanently unlisted, mixed-case/space
  // filename. It is additive only (direct route + generated OG image + source
  // file); it never enters RSS, sitemap, listings or Pagefind, and it does not
  // change any protected baseline value. Routine (current-source) validation
  // does not need these entries; they keep the explicit historical
  // migration-preflight mode passing without editing the baseline.
  addedSourceContent: ['src/content/posts/en/Review Hidden.md'],
  addedHtmlRoutes: ['/posts/review-hidden/'],
  addedOgPaths: ['/og/review-hidden.png'],
  fieldChanges: [
    {
      path: '/vi/rss.xml',
      field: 'language',
      from: 'en-us',
      to: 'vi-vn',
      reason: 'Known baseline defect: the VI feed must report the VI language.',
    },
    {
      path: '/categories/guide/',
      field: 'hreflangs.vi',
      from: 'https://blog.tvphus.dev/vi/categories/guide/',
      to: 'https://blog.tvphus.dev/vi/categories/huong-dan/',
      reason:
        'Baseline recorded a non-existent VI taxonomy destination; the real translated route is /vi/categories/huong-dan/.',
    },
    {
      path: '/vi/categories/huong-dan/',
      field: 'hreflangs.en',
      from: 'https://blog.tvphus.dev/categories/huong-dan/',
      to: 'https://blog.tvphus.dev/categories/guide/',
      reason:
        'Baseline recorded a non-existent EN taxonomy destination; the real EN counterpart is /categories/guide/.',
    },
    {
      path: '/vi/categories/huong-dan/',
      field: 'hreflangs.x-default',
      from: 'https://blog.tvphus.dev/categories/huong-dan/',
      to: 'https://blog.tvphus.dev/categories/guide/',
      reason:
        'x-default follows the default-locale sibling, so it records the same non-existent EN taxonomy destination as hreflangs.en.',
    },
  ],
};
