// Offline rendering fixture for the site media/Markdown hook (Task 4).
// Renders Markdown/MDX image syntax and the SmartImage boundary without any
// network access so rendered src/alt/srcset fixtures are deterministic.
//
// `BASE_PATH` lets the test build this fixture at a subpath (e.g. `/blog`) to
// prove that authored absolute links/images and imported Astro images carry
// the base exactly once.
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';

import { siteMediaPlugin } from '../../../../src/site/markdown.ts';
import { satteriBaseLinks } from '../../../../src/plugins/satteri-base-links.ts';

const BASE = process.env.BASE_PATH ?? '/';

export default defineConfig({
  site: 'https://markdown-fixture.invalid',
  base: BASE,
  integrations: [mdx()],
  markdown: {
    processor: satteri({
      mdastPlugins: [siteMediaPlugin()],
      hastPlugins: [satteriBaseLinks({ base: BASE })],
    }),
  },
  build: { format: 'directory' },
});
