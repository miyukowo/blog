/**
 * Site-owned Markdown/MDX image hook (Task 4).
 *
 * Upstream Astro 7 uses the Sätteri processor (`@astrojs/markdown-satteri`).
 * `siteMediaPlugin()` is a `defineMdastPlugin` visitor that rewrites Markdown
 * image URLs with the single `resolveMediaUrl` policy *before* Astro collects
 * images. Nodes are readonly, so mutations go through
 * `ctx.setProperty(node, 'url', value)`.
 *
 * Coverage:
 *  - Markdown inline images (`![alt](url)`) in both `.md` and `.mdx` (MDX 7
 *    inherits the configured Sätteri processor, so no second pipeline is
 *    needed).
 *  - Reference-style images: the referenced `definition.url` is rewritten when
 *    the identifier is used by an `imageReference` and is not used by a link.
 *    Definitions that are never used by an image are left untouched (link
 *    targets keep their URL).
 *  - NOT covered here: MDX JSX `<img src="…">` / `<SmartImage src="…">`
 *    attributes. Sätteri's mdast op-stream cannot mutate JSX attributes, and
 *    arbitrary expressions are not evaluated at compile time. Those values are
 *    normalized at the component boundary instead (`SmartImage.astro` and the
 *    hero/OG helpers call `resolveMediaUrl`), which is validated separately.
 *
 * Limitation: a reference definition that appears *before* its first image
 * reference in document order cannot be classified as image-only during the
 * single document-order visit; its original (valid) URL is retained. This is
 * covered by tests.
 */

import { defineMdastPlugin, type MdastVisitorContext } from 'satteri';
import type { Definition, Image, ImageReference } from 'mdast';

import { resolveMediaUrl } from './media.ts';

const REFERENCE_IDS_KEY = 'siteMediaImageReferenceIds';

function referenceIdSet(ctx: MdastVisitorContext): Set<string> {
  const data = ctx.data as Record<string, unknown>;
  const existing = data[REFERENCE_IDS_KEY];
  if (existing instanceof Set) return existing as Set<string>;
  const created = new Set<string>();
  data[REFERENCE_IDS_KEY] = created;
  return created;
}

/**
 * The site image visitor. Exported separately from the plugin definition so
 * behavior can be tested directly with the Sätteri compile API.
 */
export const siteMediaVisitor = {
  name: 'site-media',

  image(node: Readonly<Image>, ctx: MdastVisitorContext): void {
    const next = resolveMediaUrl(node.url);
    if (next !== node.url) ctx.setProperty(node, 'url', next);
  },

  imageReference(node: Readonly<ImageReference>, ctx: MdastVisitorContext): void {
    if (node.identifier) referenceIdSet(ctx).add(node.identifier);
  },

  definition(node: Readonly<Definition>, ctx: MdastVisitorContext): void {
    if (!referenceIdSet(ctx).has(node.identifier)) return;
    const next = resolveMediaUrl(node.url);
    if (next !== node.url) ctx.setProperty(node, 'url', next);
  },
};

/**
 * Sätteri MDAST plugin registered in `astro.config.mjs`.
 *
 * A factory (not a shared instance) so any per-document closure state is
 * reset per compile.
 */
export function siteMediaPlugin() {
  return defineMdastPlugin(siteMediaVisitor);
}
