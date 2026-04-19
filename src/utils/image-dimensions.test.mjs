import { describe, it, expect } from "vitest";
import { webpSibling } from "./image-dimensions.mjs";

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
