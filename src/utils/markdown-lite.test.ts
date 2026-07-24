import { describe, it, expect } from "vitest";
import { renderMarkdown, escapeHtml, isSafeDocLink } from "./markdown-lite";

/**
 * The output of renderMarkdown is injected with dangerouslySetInnerHTML in the
 * admin docs board. These tests are the justification for that: they assert that
 * hostile markdown cannot produce executable output.
 */
describe("XSS — escape-first must hold", () => {
	it("renders a script tag as visible text, not markup", () => {
		const out = renderMarkdown("<script>alert(1)</script>");
		expect(out).not.toContain("<script>");
		expect(out).toContain("&lt;script&gt;");
	});

	it("neutralises an img onerror payload", () => {
		const out = renderMarkdown('<img src=x onerror="alert(1)">');
		expect(out).not.toMatch(/<img[^>]*onerror/i);
		expect(out).toContain("&lt;img");
	});

	it("does not emit javascript: links", () => {
		const out = renderMarkdown("[click](javascript:alert(1))");
		expect(out).not.toContain("javascript:");
		expect(out).toContain("(link removed)");
	});

	it("does not emit data: links", () => {
		const out = renderMarkdown("[x](data:text/html;base64,PHNjcmlwdD4=)");
		expect(out).not.toContain("data:text/html");
		expect(out).toContain("(link removed)");
	});

	it("rejects protocol-relative URLs", () => {
		expect(renderMarkdown("[x](//evil.com)")).toContain("(link removed)");
	});

	it("does not treat a whitespace-bearing href as a link at all", () => {
		const out = renderMarkdown('[x](/ok" onmouseover="alert(1))');
		// Renders as escaped text in a paragraph — no anchor, no live attribute.
		expect(out).not.toContain("<a ");
		expect(out).toContain("&quot;");
	});

	it("cannot break out of the href attribute (no-whitespace variant)", () => {
		// This DOES match the link regex, so it exercises the attribute path.
		const out = renderMarkdown('[x](/ok"onmouseover="alert(1))');
		expect(out).toMatch(/<a href="[^"]*"/); // the attribute is well-formed
		// The injected quotes survive only as escaped entities inside the value.
		expect(out).not.toMatch(/<a[^>]*\sonmouseover\s*=/i);
	});

	it("escapes HTML inside fenced code", () => {
		const out = renderMarkdown("```\n<script>alert(1)</script>\n```");
		expect(out).not.toContain("<script>");
		expect(out).toContain("&lt;script&gt;");
	});

	it("escapes HTML inside table cells", () => {
		const out = renderMarkdown("| a |\n|---|\n| <script>x</script> |");
		expect(out).not.toContain("<script>");
	});

	it("does not let a blockquote round-trip reintroduce raw HTML", () => {
		const out = renderMarkdown("> <script>alert(1)</script>");
		expect(out).not.toContain("<script>");
		expect(out).toContain("&lt;script&gt;");
	});

	it("keeps literal escaped entities literal through a blockquote", () => {
		const out = renderMarkdown("> &lt;script&gt;");
		expect(out).not.toContain("<script>");
	});
});

describe("isSafeDocLink", () => {
	it.each(["https://astro.build", "http://x.dev", "/posts/", "#anchor", "relative/path.md"])(
		"allows %s", (h) => expect(isSafeDocLink(h)).toBe(true)
	);
	it.each(["javascript:alert(1)", "JavaScript:alert(1)", "data:text/html,x", "vbscript:x", "//evil.com", ""])(
		"rejects %s", (h) => expect(isSafeDocLink(h)).toBe(false)
	);
});

describe("escapeHtml", () => {
	it("escapes all five dangerous characters", () => {
		expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
	});
});

describe("rendering — the constructs our docs actually use", () => {
	it("renders headings at the right level", () => {
		expect(renderMarkdown("### Three")).toBe("<h3>Three</h3>");
	});

	it("renders a table with header and body", () => {
		const out = renderMarkdown("| A | B |\n|---|---|\n| 1 | 2 |");
		expect(out).toContain("<th>A</th>");
		expect(out).toContain("<td>2</td>");
	});

	it("renders an aligned table divider", () => {
		const out = renderMarkdown("| A | B |\n|:--|--:|\n| 1 | 2 |");
		expect(out).toContain("<table>");
	});

	it("renders unordered and ordered lists", () => {
		expect(renderMarkdown("- a\n- b")).toBe("<ul><li>a</li><li>b</li></ul>");
		expect(renderMarkdown("1. a\n2. b")).toBe("<ol><li>a</li><li>b</li></ol>");
	});

	it("renders task checkboxes", () => {
		const out = renderMarkdown("- [ ] todo\n- [x] done");
		expect(out).toContain('type="checkbox"');
		expect(out).toContain("checked");
	});

	it("renders inline code without further transforming it", () => {
		const out = renderMarkdown("use `**not bold**` here");
		expect(out).toContain("<code>**not bold**</code>");
		expect(out).not.toContain("<strong>");
	});

	it("does not corrupt prose that looks like the internal sentinel", () => {
		// Regression guard: a readable placeholder such as " C0 " would collide here.
		const out = renderMarkdown("the grade C0 result and `code`");
		expect(out).toContain("grade C0 result");
		expect(out).toContain("<code>code</code>");
	});

	it("renders bold and italic", () => {
		expect(renderMarkdown("**b** and *i*")).toContain("<strong>b</strong>");
		expect(renderMarkdown("**b** and *i*")).toContain("<em>i</em>");
	});

	it("adds rel=noopener to external links only", () => {
		expect(renderMarkdown("[x](https://a.com)")).toContain('rel="noopener noreferrer"');
		expect(renderMarkdown("[x](/local)")).not.toContain("noopener");
	});

	it("renders a horizontal rule", () => {
		expect(renderMarkdown("---")).toBe("<hr />");
	});

	it("strips author HTML comments", () => {
		const out = renderMarkdown("before\n\n<!-- TODO(james): secret note -->\n\nafter");
		expect(out).not.toContain("secret note");
		expect(out).toContain("before");
		expect(out).toContain("after");
	});

	it("handles an empty document", () => {
		expect(renderMarkdown("")).toBe("");
	});

	it("survives an unclosed fence without throwing", () => {
		expect(() => renderMarkdown("```bash\nnever closed")).not.toThrow();
	});
});
