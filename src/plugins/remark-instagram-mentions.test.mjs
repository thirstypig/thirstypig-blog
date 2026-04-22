import { describe, it, expect } from "vitest";
import remarkInstagramMentions from "./remark-instagram-mentions.mjs";

/**
 * Unit tests for the @mention → Instagram-link remark plugin.
 *
 * Approach: build a minimal mdast tree containing a paragraph with a single
 * text node, run the plugin's transformer on it, and assert the resulting
 * children. The plugin mutates the tree in place.
 *
 * Overrides come from src/data/mention-overrides.json at module load. That
 * file currently contains skip entries for common English short words
 * (the, a, is, was, etc.) — the "skip English word" test relies on that.
 */

// Helper: build a minimal mdast tree with one paragraph holding a single text node
function paragraphTree(text) {
	return {
		type: "root",
		children: [{ type: "paragraph", children: [{ type: "text", value: text }] }],
	};
}

// Helper: run the plugin transformer on the tree, then return the paragraph's children
function runPluginOn(text) {
	const tree = paragraphTree(text);
	const transformer = remarkInstagramMentions();
	transformer(tree);
	return tree.children[0].children;
}

describe("remarkInstagramMentions", () => {
	it("leaves text without @ completely alone", () => {
		const kids = runPluginOn("Plain text with no mentions here.");
		expect(kids).toHaveLength(1);
		expect(kids[0]).toMatchObject({ type: "text", value: "Plain text with no mentions here." });
	});

	it("splits a single @handle into [text, link, text]", () => {
		const kids = runPluginOn("Ate at @franklinbbq yesterday");
		expect(kids).toHaveLength(3);
		expect(kids[0]).toMatchObject({ type: "text", value: "Ate at " });
		expect(kids[1]).toMatchObject({
			type: "link",
			url: "https://www.instagram.com/franklinbbq/",
			children: [{ type: "text", value: "@franklinbbq" }],
		});
		expect(kids[2]).toMatchObject({ type: "text", value: " yesterday" });
	});

	it("emits the link with target/rel/class hProperties for security + styling", () => {
		const kids = runPluginOn("Hello @test_account");
		const link = kids.find(k => k.type === "link");
		expect(link.data.hProperties).toEqual({
			target: "_blank",
			rel: "noopener noreferrer",
			class: "mention-link",
		});
	});

	it("handles @handle at the very start of text", () => {
		const kids = runPluginOn("@miopaneusa opened nearby");
		expect(kids).toHaveLength(2);
		expect(kids[0].type).toBe("link");
		expect(kids[1]).toMatchObject({ type: "text", value: " opened nearby" });
	});

	it("handles @handle at the very end of text", () => {
		const kids = runPluginOn("Saw @perse_la");
		expect(kids).toHaveLength(2);
		expect(kids[0]).toMatchObject({ type: "text", value: "Saw " });
		expect(kids[1].type).toBe("link");
	});

	it("matches multiple @handles in one text node", () => {
		const kids = runPluginOn("@snowsbbq and @franklinbbq are both great");
		const links = kids.filter(k => k.type === "link");
		expect(links).toHaveLength(2);
		expect(links[0].url).toBe("https://www.instagram.com/snowsbbq/");
		expect(links[1].url).toBe("https://www.instagram.com/franklinbbq/");
	});

	it("does NOT match email-style text (word char before @)", () => {
		const kids = runPluginOn("Contact me at foo@example.com please");
		// Text unchanged — the regex negative-lookbehind on word chars + @ filters this out
		expect(kids).toHaveLength(1);
		expect(kids[0].type).toBe("text");
	});

	it("handles dots + underscores inside handles (valid IG chars)", () => {
		const kids = runPluginOn("try @ma.rie_cooks for recipes");
		const link = kids.find(k => k.type === "link");
		expect(link).toBeDefined();
		expect(link.url).toBe("https://www.instagram.com/ma.rie_cooks/");
	});

	it("does NOT link when handle matches a skip override (English word)", () => {
		// @was, @the, @a, etc. are skip-overrides in mention-overrides.json
		const kids = runPluginOn("It @was a great time");
		// When every match is a skip, parts array stays empty and node is left as-is
		expect(kids).toHaveLength(1);
		expect(kids[0]).toMatchObject({ type: "text", value: "It @was a great time" });
	});

	it("processes a mix of real handles and skip-overrides correctly", () => {
		// @the is skipped; @franklinbbq should still link
		const kids = runPluginOn("Visited @the @franklinbbq spot");
		const links = kids.filter(k => k.type === "link");
		expect(links).toHaveLength(1);
		expect(links[0].url).toBe("https://www.instagram.com/franklinbbq/");
	});

	it("preserves text case in the display label", () => {
		// The Instagram URL lowercases via override lookup, but the display
		// `@text` preserves original case
		const kids = runPluginOn("thanks to @GordonRamsay for the tip");
		const link = kids.find(k => k.type === "link");
		expect(link.children[0].value).toBe("@GordonRamsay");
		expect(link.url).toBe("https://www.instagram.com/GordonRamsay/");
	});
});
