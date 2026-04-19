/**
 * Build-time image metadata lookup for <picture> generation.
 *
 * Resolves absolute site paths (e.g. "/images/posts/slug/file.jpg") to:
 *   - pixel dimensions (via sharp metadata)
 *   - WebP sibling presence (for <source type="image/webp">)
 *
 * Results are cached on disk in .astro/image-dimensions.json keyed by path + mtime
 * so incremental builds don't re-read ~19k images every time.
 *
 * @typedef {{ src: string, webp: string | null, width: number | null, height: number | null }} ImageInfo
 */
import { existsSync, statSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import sharp from 'sharp';

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = join(PROJECT_ROOT, 'public');
const CACHE_PATH = join(PROJECT_ROOT, '.astro', 'image-dimensions.json');

let cache = {};
let cacheLoaded = false;
let cacheDirty = false;
let writesSinceFlush = 0;
const FLUSH_EVERY = 100;

function loadCache() {
	if (cacheLoaded) return;
	try {
		if (existsSync(CACHE_PATH)) {
			cache = JSON.parse(readFileSync(CACHE_PATH, 'utf-8'));
		}
	} catch {
		cache = {};
	}
	cacheLoaded = true;
}

export function flushImageCache() {
	if (!cacheDirty) return;
	try {
		mkdirSync(dirname(CACHE_PATH), { recursive: true });
		writeFileSync(CACHE_PATH, JSON.stringify(cache));
		cacheDirty = false;
		writesSinceFlush = 0;
	} catch (err) {
		console.warn('[image-dimensions] failed to write cache:', err.message);
	}
}

function toFsPath(src, publicDir) {
	if (!src || !src.startsWith('/')) return null;
	return join(publicDir, src);
}

export function webpSibling(src) {
	const ext = extname(src);
	return ext ? src.slice(0, -ext.length) + '.webp' : src + '.webp';
}

/**
 * Look up image metadata for a site-absolute path.
 * Returns nulls for width/height/webp when the file is unreadable or missing —
 * callers should treat this as "skip optimization, emit plain <img>".
 *
 * @param {string} src - site-absolute path like "/images/posts/slug/file.jpg"
 * @param {{ publicDir?: string, cache?: boolean }} [options] - Test override.
 *   publicDir defaults to <cwd>/public; cache defaults to true. Tests pass
 *   a custom publicDir + cache:false to run in isolation.
 * @returns {Promise<ImageInfo>}
 */
export async function getImageInfo(src, options = {}) {
	const { publicDir = PUBLIC_DIR, cache: cacheEnabled = true } = options;

	if (cacheEnabled) loadCache();

	const fallback = { src, webp: null, width: null, height: null };
	const fsPath = toFsPath(src, publicDir);
	if (!fsPath || !existsSync(fsPath)) return fallback;

	const mtime = statSync(fsPath).mtimeMs;
	const cached = cacheEnabled ? cache[src] : null;
	if (cached && cached.mtime === mtime) {
		return {
			src,
			webp: cached.hasWebp ? webpSibling(src) : null,
			width: cached.width,
			height: cached.height,
		};
	}

	let width = null;
	let height = null;
	try {
		const meta = await sharp(fsPath).metadata();
		width = meta.width ?? null;
		height = meta.height ?? null;
	} catch (err) {
		console.warn(`[image-dimensions] could not read ${src}:`, err.message);
	}

	const webpFs = webpSibling(fsPath);
	const hasWebp = existsSync(webpFs);

	if (cacheEnabled) {
		cache[src] = { mtime, width, height, hasWebp };
		cacheDirty = true;
		writesSinceFlush++;
		if (writesSinceFlush >= FLUSH_EVERY) flushImageCache();
	}

	return {
		src,
		webp: hasWebp ? webpSibling(src) : null,
		width,
		height,
	};
}

// Persist cache on every exit path — Astro's build sometimes terminates before
// beforeExit fires, so register on multiple signals as backup.
process.on('beforeExit', flushImageCache);
process.on('exit', flushImageCache);
process.on('SIGINT', () => { flushImageCache(); process.exit(130); });
process.on('SIGTERM', () => { flushImageCache(); process.exit(143); });
