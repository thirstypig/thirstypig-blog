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

  markdown: {
    remarkPlugins: [remarkInstagramMentions, remarkImageOptimize],
  },

  vite: {
    plugins: [tailwindcss()],
  },
});