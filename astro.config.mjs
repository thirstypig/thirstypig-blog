// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import remarkInstagramMentions from './src/plugins/remark-instagram-mentions.mjs';
import remarkImageOptimize from './src/plugins/remark-image-optimize.mjs';

// https://astro.build/config
export default defineConfig({
  site: 'https://thirstypig.com',
  integrations: [mdx(), sitemap()],

  // URL renames — preserve old links for external traffic.
  redirects: {
    '/best-of': '/cuisine',
    '/archive': '/posts',
    // /categories was orphaned from nav once we built /cuisine + /cities.
    // Send the bare /categories index to /cuisine since that's the closest
    // analogue. The /categories/[category] detail pages still resolve.
    '/categories': '/cuisine',
  },

  markdown: {
    remarkPlugins: [remarkInstagramMentions, remarkImageOptimize],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});