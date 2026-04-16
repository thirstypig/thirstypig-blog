import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
	loader: glob({ base: './src/content/posts', pattern: '**/*.{md,mdx}' }),
	schema: z.object({
		title: z.string(),
		pubDate: z.coerce.date(),
		description: z.string().optional(),
		author: z.string().default('The Thirsty Pig'),
		heroImage: z.string().optional(),
		images: z.array(z.string()).default([]),
		categories: z.array(z.string()).default([]),
		tags: z.array(z.string()).default([]),
		location: z.string().optional(),
		city: z.string().optional(),
		region: z.string().optional(),
		address: z.string().optional(),
		coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
		cuisine: z.array(z.string()).default([]),
		source: z.enum(['thirstypig.com', 'thethirstypig.com', 'blog.thethirstypig.com', 'instagram', 'new']).default('new'),
		originalUrl: z.string().optional(),
		archiveUrl: z.string().optional(),
		draft: z.boolean().default(false),
	}),
});

const wishlist = defineCollection({
	loader: file('src/data/places-wishlist.yaml'),
	schema: z.object({
		id: z.string(),
		name: z.string(),
		neighborhood: z.string().optional(),
		city: z.string(),
		visited: z.boolean().default(false),
		priority: z.number().min(1).max(3).default(2),
		date_added: z.string(),
		date_visited: z.string().nullable().default(null),
		notes: z.string().optional(),
		links: z.record(z.string(), z.string().nullable()).default({}),
		thirstypig_posts: z.array(z.string()).default([]),
		tags: z.array(z.string()).default([]),
	}),
});

export const collections = { posts, wishlist };
