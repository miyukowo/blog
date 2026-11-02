// Offline rendering fixture for the site media/Markdown hook (Task 4).
// Renders Markdown/MDX image syntax and the SmartImage boundary without any
// network access so rendered src/alt/srcset fixtures are deterministic.
import mdx from '@astrojs/mdx';
import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';

import { siteMediaPlugin } from '../../../../src/site/markdown.ts';

export default defineConfig({
  site: 'https://markdown-fixture.invalid',
  integrations: [mdx()],
  markdown: {
    processor: satteri({
      mdastPlugins: [siteMediaPlugin()],
    }),
  },
  build: { format: 'directory' },
});
