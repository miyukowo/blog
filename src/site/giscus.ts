/**
 * Giscus mount-planning policy (Task 5).
 *
 * The comments island previously removed the iframe but left stale client
 * `<script>` elements behind, and always reported `mounted` before checking
 * it. These small pure helpers make the client behavior deterministic and
 * testable without a browser:
 *
 *  - exactly one giscus client script / iframe per live mount,
 *  - a remount on client navigation replaces the previous mount safely,
 *  - theme changes are posted to the live iframe instead of remounting,
 *  - language changes are applied by building the script attributes from the
 *    current page's locale (VI pages mount with `data-lang="vi"`).
 */

export type GiscusThemeName = 'light' | 'dark';

export interface GiscusMountConfig {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: string;
  strict: string;
  reactionsEnabled: string;
  emitMetadata: string;
  inputPosition: string;
  loading: string;
  locale: string;
}

export interface GiscusMountState {
  /** A previously mounted giscus client script exists in the DOM. */
  hasClientScript: boolean;
  /** A previously mounted giscus iframe exists in the DOM. */
  hasFrame: boolean;
  /** `data-mounted` is `'true'` on the current mount element. */
  markedMounted: boolean;
}

export interface GiscusMountPlan {
  action: 'mount' | 'skip';
  /** Remove stale script/iframe nodes before mounting. */
  cleanup: boolean;
}

/**
 * Decide whether to mount the comments iframe.
 *
 * - A fresh mount (no script/frame) mounts cleanly.
 * - A remount (script/frame present, e.g. after client navigation) cleans up
 *   the stale nodes and mounts exactly once.
 * - When the current mount element is already marked mounted but no client
 *   script exists (e.g. a failed previous load), retry instead of leaving the
 *   area empty forever.
 */
export function planGiscusMount(state: GiscusMountState): GiscusMountPlan {
  const stale = state.hasClientScript || state.hasFrame;
  if (stale) return { action: 'mount', cleanup: true };
  return { action: 'mount', cleanup: false };
}

/** Resolve the giscus theme name from the `data-theme` attribute. */
export function giscusThemeName(themeAttribute: string | null | undefined): GiscusThemeName {
  return themeAttribute === 'chirpy-dark' ? 'dark' : 'light';
}

/**
 * Build the giscus client `<script>` attributes for a mount config and theme.
 * Locale comes from the page (VI pages use `vi`), mapping stays `pathname`.
 */
export function giscusScriptAttributes(
  config: GiscusMountConfig,
  theme: GiscusThemeName,
): Record<string, string> {
  return {
    'data-repo': config.repo,
    'data-repo-id': config.repoId,
    'data-category': config.category,
    'data-category-id': config.categoryId,
    'data-mapping': config.mapping,
    'data-strict': config.strict,
    'data-reactions-enabled': config.reactionsEnabled,
    'data-emit-metadata': config.emitMetadata,
    'data-input-position': config.inputPosition,
    'data-loading': config.loading,
    'data-lang': config.locale,
    'data-theme': theme,
  };
}
