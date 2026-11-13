/**
 * Site-owned MDX raw-HTML compatibility seam (review repair Task 2).
 *
 * Several Sätteri plugins emit MDAST `html` nodes for output that must be
 * pre-rendered HTML: KaTeX math, the Mermaid wrapper, `alert` fences and
 * `ashtml` fences. `html` nodes are valid in plain Markdown, but MDX has no
 * raw-HTML syntax — the MDX compiler serializes them as string children, so
 * `<span class="katex">…</span>` ends up as escaped text on CMS-authored
 * `.mdx` posts instead of a rendered element.
 *
 * MDX does support JSX elements, and Astro's MDX renderer always provides the
 * `Fragment` component (see `@astrojs/mdx`'s `transformContentExport`).
 * Astro's JSX runtime honours the `set:html` directive on `Fragment`, which is
 * exactly the mechanism Astro's own MDX `optimizeStatic` uses.
 *
 * So for MDX only, replace each `html` node with
 *   `<Fragment set:html="…" />`
 * using an `mdxJsxTextElement` when the node sits in phrasing content and an
 * `mdxJsxFlowElement` when it is block content. Plain Markdown is untouched,
 * so `.md` rendering and authored raw HTML keep their current behavior, and
 * authored JSX in MDX is never rewritten.
 *
 * This must run after the plugins that generate HTML (`katex`, Mermaid,
 * Alert, ashtml) because Sätteri applies `mdastPlugins` in order.
 */

import {
  defineMdastPlugin,
  type MdastNode,
  type MdxJsxFlowElement,
  type MdxJsxTextElement,
} from 'satteri';

/** Parents whose children are phrasing content, so JSX must be inline. */
const INLINE_PARENTS = new Set([
  'paragraph',
  'heading',
  'emphasis',
  'strong',
  'link',
  'linkReference',
  'delete',
  'tableCell',
  'footnoteDefinition',
]);

function htmlToFragment(node: Readonly<{ value: string }>, flow: boolean) {
  const attributes = [
    { type: 'mdxJsxAttribute' as const, name: 'set:html', value: node.value },
  ] as const;
  if (flow) {
    const element: MdxJsxFlowElement = {
      type: 'mdxJsxFlowElement',
      name: 'Fragment',
      attributes: [...attributes],
      children: [],
    };
    return element;
  }
  const element: MdxJsxTextElement = {
    type: 'mdxJsxTextElement',
    name: 'Fragment',
    attributes: [...attributes],
    children: [],
  };
  return element;
}

export function satteriMdxHtmlElements() {
  return defineMdastPlugin({
    name: 'satteri-mdx-html-elements',
    html(node, ctx) {
      // Keep the Markdown pipeline byte-for-byte: only MDX needs the seam.
      if (ctx.sourceFormat !== 'mdx') return;
      const parent = ctx.parent(node as Readonly<MdastNode>);
      const flow = !parent || !INLINE_PARENTS.has(parent.type);
      ctx.replaceNode(node, htmlToFragment(node, flow));
    },
  });
}
