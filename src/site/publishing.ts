/**
 * Site-owned publishing policy shared by the build and routine validation.
 *
 * Keep values that derive output counts here so the build manifest,
 * expectations helper and page generators cannot disagree.
 */

/** Number of posts per listing page (mirrored in `SITE.postsPerPage`). */
export const POSTS_PER_PAGE = 8;
