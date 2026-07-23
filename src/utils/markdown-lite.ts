/**
 * A small, dependency-free markdown → HTML renderer for the docs admin board.
 *
 * Why not a library: `marked` / `remark` are not project dependencies, and the
 * admin already ships a large TinaCMS bundle. This handles the subset our docs
 * actually use (headings, tables, lists, fences, blockquotes, links, emphasis)
 * in a fraction of the size.
 *
 * SECURITY: the input is escaped FIRST, before any markdown transform runs, so
 * raw HTML in a doc is rendered as visible text and can never execute. Links are
 * additionally filtered through `isSafeDocLink`. This matters because the output
 * is injected via dangerouslySetInnerHTML, and the /admin CSP still permits
 * `script-src 'unsafe-inline'` (see ADR-001 known gaps / RISK-003).
 */

const ESCAPES: Record<string, string> = {
	"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
};

export function escapeHtml(s: string): string {
	return s.replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Links we're willing to emit as anchors. Everything else renders as plain text.
 * Deliberately rejects javascript:, data:, vbscript:, and protocol-relative URLs.
 */
export function isSafeDocLink(href: string): boolean {
	const h = href.trim();
	if (h === "") return false;
	if (h.startsWith("//")) return false;
	if (h.startsWith("#")) return true;
	if (h.startsWith("/")) return true;
	if (/^https?:\/\//i.test(h)) return true;
	if (/^[a-z][a-z0-9+.-]*:/i.test(h)) return false; // any other scheme
	return true; // relative path
}

/** Inline formatting. Input MUST already be HTML-escaped. */
function inline(s: string): string {
	// Inline code first — its contents must not be further transformed.
	// Sentinel is \u0000 (written as an escape, never a raw NUL byte in source):
	// a readable placeholder like " C0 " would collide with real prose such as
	// "grade C0 result". U+0000 cannot survive escapeHtml or appear in markdown.
	const codes: string[] = [];
	let out = s.replace(/`([^`]+)`/g, (_m, code) => {
		codes.push(`<code>${code}</code>`);
		return `\u0000C${codes.length - 1}\u0000`;
	});

	// Links: [text](href). Href was escaped, so &amp; may appear — decode for the check.
	out = out.replace(/\[([^\]]*)\]\(([^)\s]+)\)/g, (_m, text, href) => {
		const raw = String(href).replace(/&amp;/g, "&");
		if (!isSafeDocLink(raw)) return `${text} (link removed)`;
		const external = /^https?:\/\//i.test(raw);
		const rel = external ? ' target="_blank" rel="noopener noreferrer"' : "";
		return `<a href="${href}"${rel}>${text}</a>`;
	});

	out = out
		.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
		.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
		.replace(/~~([^~]+)~~/g, "<del>$1</del>");

	return out.replace(/\u0000C(\d+)\u0000/g, (_m, i) => codes[Number(i)]);
}

const isTableDivider = (l: string) => /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l.trim());
const splitRow = (l: string) =>
	l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

/**
 * Render markdown to HTML. Input is escaped before any transform.
 */
export function renderMarkdown(src: string): string {
	const lines = escapeHtml(src.replace(/\r\n/g, "\n")).split("\n");
	const out: string[] = [];
	let i = 0;
	let para: string[] = [];

	const flushPara = () => {
		if (para.length) {
			out.push(`<p>${inline(para.join(" "))}</p>`);
			para = [];
		}
	};

	while (i < lines.length) {
		const line = lines[i];

		// Fenced code
		const fence = line.match(/^[ \t]*(```|~~~)(.*)$/);
		if (fence) {
			flushPara();
			const marker = fence[1];
			const body: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith(marker)) body.push(lines[i++]);
			i++; // closing fence
			out.push(`<pre><code>${body.join("\n")}</code></pre>`);
			continue;
		}

		// HTML comments in source — skip (they're author notes, escaped to text otherwise)
		if (/^\s*&lt;!--/.test(line)) {
			flushPara();
			while (i < lines.length && !/--&gt;/.test(lines[i])) i++;
			i++;
			continue;
		}

		// Table
		if (line.trim().startsWith("|") && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
			flushPara();
			const head = splitRow(line);
			i += 2;
			const rows: string[][] = [];
			while (i < lines.length && lines[i].trim().startsWith("|")) rows.push(splitRow(lines[i++]));
			out.push(
				`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead>` +
					`<tbody>${rows
						.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
						.join("")}</tbody></table>`
			);
			continue;
		}

		// Heading
		const h = line.match(/^(#{1,6})\s+(.+?)\s*$/);
		if (h) {
			flushPara();
			const lvl = h[1].length;
			out.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`);
			i++;
			continue;
		}

		// Horizontal rule
		if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
			flushPara();
			out.push("<hr />");
			i++;
			continue;
		}

		// Blockquote
		if (/^\s*&gt;\s?/.test(line)) {
			flushPara();
			const body: string[] = [];
			while (i < lines.length && /^\s*&gt;\s?/.test(lines[i])) {
				body.push(lines[i].replace(/^\s*&gt;\s?/, ""));
				i++;
			}
			out.push(`<blockquote>${renderMarkdown(unescapeForNested(body.join("\n")))}</blockquote>`);
			continue;
		}

		// Lists
		const li = line.match(/^\s*([-*+]|\d+\.)\s+(.+)$/);
		if (li) {
			flushPara();
			const ordered = /\d+\./.test(li[1]);
			const items: string[] = [];
			while (i < lines.length) {
				const m = lines[i].match(/^\s*([-*+]|\d+\.)\s+(.+)$/);
				if (!m) break;
				let text = m[2];
				const checkbox = text.match(/^\[([ xX])\]\s*(.*)$/);
				if (checkbox) {
					const done = checkbox[1].toLowerCase() === "x";
					text = `<input type="checkbox" disabled${done ? " checked" : ""} /> ${checkbox[2]}`;
					items.push(`<li class="task">${inline(text)}</li>`);
				} else {
					items.push(`<li>${inline(text)}</li>`);
				}
				i++;
			}
			out.push(ordered ? `<ol>${items.join("")}</ol>` : `<ul>${items.join("")}</ul>`);
			continue;
		}

		if (line.trim() === "") {
			flushPara();
			i++;
			continue;
		}

		para.push(line.trim());
		i++;
	}

	flushPara();
	return out.join("\n");
}

/** Blockquote bodies are re-rendered; undo one escape pass so we don't double-escape. */
function unescapeForNested(s: string): string {
	return s
		.replace(/&lt;/g, "<").replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"').replace(/&#39;/g, "'")
		.replace(/&amp;/g, "&");
}
