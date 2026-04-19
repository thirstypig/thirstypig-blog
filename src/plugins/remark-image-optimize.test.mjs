import { describe, it, expect } from "vitest";
import { buildPictureHtml } from "./remark-image-optimize.mjs";

describe("buildPictureHtml", () => {
	it("wraps <img> in <picture> when a webp sibling exists", () => {
		const html = buildPictureHtml({
			src: "/images/posts/x/1.jpg",
			webp: "/images/posts/x/1.webp",
			width: 1440,
			height: 1080,
			alt: "Sample",
		});
		expect(html).toContain("<picture>");
		expect(html).toContain('<source type="image/webp" srcset="/images/posts/x/1.webp">');
		expect(html).toContain('src="/images/posts/x/1.jpg"');
		expect(html).toContain('width="1440" height="1080"');
		expect(html).toContain('loading="lazy"');
		expect(html).toContain('decoding="async"');
	});

	it("falls back to bare <img> when webp is null", () => {
		const html = buildPictureHtml({
			src: "/images/legacy.jpg",
			webp: null,
			width: 800,
			height: 600,
			alt: "Legacy",
		});
		expect(html).not.toContain("<picture>");
		expect(html).not.toContain("<source");
		expect(html).toContain('src="/images/legacy.jpg"');
		expect(html).toContain('width="800" height="600"');
	});

	it("omits width/height when either is missing", () => {
		// Missing metadata should degrade gracefully, not emit width="" or similar
		const html = buildPictureHtml({
			src: "/images/unknown.jpg",
			webp: null,
			width: null,
			height: null,
			alt: "Unknown",
		});
		expect(html).not.toContain("width=");
		expect(html).not.toContain("height=");
		expect(html).toContain('src="/images/unknown.jpg"');
	});

	it("escapes special characters in alt text to prevent HTML injection", () => {
		const html = buildPictureHtml({
			src: "/images/x.jpg",
			webp: null,
			width: 100,
			height: 100,
			alt: 'Sneaky "quote" & <script>alert(1)</script>',
		});
		expect(html).toContain('alt="Sneaky &quot;quote&quot; &amp; &lt;script&gt;alert(1)&lt;/script&gt;"');
		expect(html).not.toContain("<script>");
	});

	it("handles empty alt gracefully", () => {
		const html = buildPictureHtml({
			src: "/images/x.jpg",
			webp: null,
			width: 100,
			height: 100,
			alt: "",
		});
		expect(html).toContain('alt=""');
	});
});
