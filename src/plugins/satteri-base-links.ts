/**
 * rehype-base-links — Prefixed absolute URLs in Markdown links and images
 * with the configured `BASE_PATH`, exactly once.
 *
 * In Astro, standard markdown links like `[link](/posts/foo)` generate
 * `<a href="/posts/foo">`. If the site is deployed to a subpath (e.g.,
 * GitHub Pages at `/<repo-name>`), those links need the base prefix or they
 * 404.
 *
 * The rewrite is deliberately idempotent and segment-aware:
 *
 *   /posts/a/      -> /blog/posts/a/   (prefixed once)
 *   /blog/posts/a/ -> unchanged        (already based)
 *   /blogger/a/    -> /blog/blogger/a/ (not the /blog/ segment)
 *   /blog?x=1      -> unchanged        (base identity + query)
 *   /blog#x        -> unchanged        (base identity + hash)
 *
 * External, protocol-relative, relative and fragment-only URLs are untouched,
 * and query/hash suffixes are preserved. The same rule applies to `<img>`
 * sources. A root base (`/`) is a no-op.
 *
 * This plugin runs at build time to rewrite those paths natively.
 */

import { defineHastPlugin } from 'satteri';

function normalizeBase(base: string): string {
  if (!base || base === '/') return '';
  return base.replace(/\/+$/, '');
}

/**
 * Prefix `value` with `base` unless it is already a path inside the base.
 * Exported for direct, dependency-free testing.
 */
export function withBaseOnce(value: string, base: string): string {
  const prefix = normalizeBase(base);
  if (!prefix) return value;
  // Absolute paths only: external, protocol-relative, relative, hash-only and
  // query-only values must survive unchanged.
  if (!value.startsWith('/') || value.startsWith('//')) return value;

  const match = /^([^?#]*)(.*)$/s.exec(value);
  const path = match?.[1] ?? value;
  const suffix = match?.[2] ?? '';
  if (!path) return value;
  // Segment boundary: `/blog` and `/blog/...` are already based, but
  // `/blogger/...` is not.
  if (path === prefix || path.startsWith(`${prefix}/`)) return value;
  return `${prefix}${path}${suffix}`;
}

export function satteriBaseLinks(options: { base: string }) {
  const base = normalizeBase(options.base);

  if (!base) {
    return defineHastPlugin({ name: 'rehype-base-links-noop' });
  }

  return defineHastPlugin({
    name: 'rehype-base-links',
    element: [
      {
        filter: ['a'],
        visit(node, ctx) {
          if (node.properties && typeof node.properties.href === 'string') {
            const href = node.properties.href;
            const next = withBaseOnce(href, base);
            if (next !== href) {
              ctx.replaceNode(node, {
                ...node,
                properties: { ...node.properties, href: next },
              });
            }
          }
        },
      },
      {
        filter: ['img'],
        visit(node, ctx) {
          if (node.properties && typeof node.properties.src === 'string') {
            const src = node.properties.src;
            const next = withBaseOnce(src, base);
            if (next !== src) {
              ctx.replaceNode(node, {
                ...node,
                properties: { ...node.properties, src: next },
              });
            }
          }
        },
      },
    ],
  });
}
