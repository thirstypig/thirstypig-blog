import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, rmSync, writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { webpSibling, getImageInfo } from "./image-dimensions.mjs";

describe("webpSibling", () => {
	it("replaces lowercase .jpg with .webp", () => {
		expect(webpSibling("/images/posts/x/foo.jpg")).toBe("/images/posts/x/foo.webp");
	});

	it("replaces uppercase .JPG with .webp (preserves path, drops extension)", () => {
		// Our import pipeline produces lowercase paths but legacy posts reference
		// .JPG (e.g., 2009-10-01-asa-ramen-gardena has IMG_0933.JPG).
		expect(webpSibling("/images/posts/asa/IMG_0933.JPG")).toBe("/images/posts/asa/IMG_0933.webp");
	});

	it("handles .jpeg extension", () => {
		expect(webpSibling("/a/b.jpeg")).toBe("/a/b.webp");
	});

	it("handles .png extension (even though we don't generate webp for png today)", () => {
		expect(webpSibling("/a/logo.png")).toBe("/a/logo.webp");
	});

	it("preserves multi-dot filenames by only stripping the final extension", () => {
		expect(webpSibling("/a/file.backup.jpg")).toBe("/a/file.backup.webp");
	});

	it("appends .webp when the path has no extension at all", () => {
		// Defensive — unlikely in practice but shouldn't crash
		expect(webpSibling("/a/noext")).toBe("/a/noext.webp");
	});

	it("keeps the leading slash and directory structure intact", () => {
		expect(webpSibling("/deep/nested/path/image.jpg")).toBe("/deep/nested/path/image.webp");
	});
});

describe("getImageInfo integration", () => {
	/*
	 * Integration tests for the I/O-heavy path. Uses a temp directory as the
	 * publicDir, populated with generated fixture files in beforeAll. The
	 * {cache: false} option keeps these tests from reading or writing the
	 * production .astro/image-dimensions.json cache.
	 */
	let fixtureRoot;
	const opts = () => ({ publicDir: fixtureRoot, cache: false });

	beforeAll(async () => {
		fixtureRoot = join(tmpdir(), `tp-imgtest-${process.pid}-${Date.now()}`);
		mkdirSync(join(fixtureRoot, "images"), { recursive: true });

		// Generate a small JPG with known dimensions
		await sharp({
			create: { width: 100, height: 75, channels: 3, background: "#B45309" },
		}).jpeg().toFile(join(fixtureRoot, "images", "solo.jpg"));

		// Generate a JPG + sibling WebP pair
		await sharp({
			create: { width: 200, height: 150, channels: 3, background: "#6B7B5E" },
		}).jpeg().toFile(join(fixtureRoot, "images", "with-webp.jpg"));
		await sharp({
			create: { width: 200, height: 150, channels: 3, background: "#6B7B5E" },
		}).webp().toFile(join(fixtureRoot, "images", "with-webp.webp"));

		// Generate a tall portrait-orientation fixture
		await sharp({
			create: { width: 300, height: 400, channels: 3, background: "#1A1A1A" },
		}).jpeg().toFile(join(fixtureRoot, "images", "portrait.jpg"));
	});

	afterAll(() => {
		rmSync(fixtureRoot, { recursive: true, force: true });
	});

	it("returns all-null fallback for a path that doesn't resolve to a real file", async () => {
		const info = await getImageInfo("/images/does-not-exist.jpg", opts());
		expect(info).toEqual({
			src: "/images/does-not-exist.jpg",
			webp: null,
			width: null,
			height: null,
		});
	});

	it("returns dimensions from sharp when file exists", async () => {
		const info = await getImageInfo("/images/solo.jpg", opts());
		expect(info.width).toBe(100);
		expect(info.height).toBe(75);
	});

	it("reports webp: null when no sibling webp exists", async () => {
		const info = await getImageInfo("/images/solo.jpg", opts());
		expect(info.webp).toBeNull();
	});

	it("detects a sibling webp and returns its path", async () => {
		const info = await getImageInfo("/images/with-webp.jpg", opts());
		expect(info.webp).toBe("/images/with-webp.webp");
		expect(info.width).toBe(200);
		expect(info.height).toBe(150);
	});

	it("preserves aspect ratio through dimension reads (portrait orientation)", async () => {
		const info = await getImageInfo("/images/portrait.jpg", opts());
		expect(info.width).toBe(300);
		expect(info.height).toBe(400);
		// Sanity — width/height returned as-stored, not swapped
		expect(info.height).toBeGreaterThan(info.width);
	});

	it("rejects non-absolute paths (src must start with '/')", async () => {
		const info = await getImageInfo("relative/path.jpg", opts());
		expect(info.width).toBeNull();
		expect(info.webp).toBeNull();
	});
});

