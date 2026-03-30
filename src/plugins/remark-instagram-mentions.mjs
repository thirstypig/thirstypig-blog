/**
 * Remark plugin to convert @handles in post content to Instagram links.
 *
 * Transforms @handle text into clickable links pointing to
 * https://www.instagram.com/handle/
 *
 * Uses an override map (src/data/mention-overrides.json) to:
 * - Skip non-Instagram @patterns (e.g., email fragments)
 * - Override URLs for specific handles
 * - Add display labels
 */
import { visit } from 'unist-util-visit';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_PATH = resolve(__dirname, '../data/mention-overrides.json');

let overrides = {};
try {
	overrides = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8'));
} catch (err) {
	if (err.code !== 'ENOENT') {
		console.warn('Failed to load mention overrides:', err.message);
	}
}

// Instagram handle pattern: @ followed by 1-30 alphanumeric, dots, or underscores
const MENTION_RE = /(?<![a-zA-Z0-9.@])@([a-zA-Z0-9._]{1,30})(?![a-zA-Z0-9._@])/g;

export default function remarkInstagramMentions() {
	return (tree) => {
		visit(tree, 'text', (node, index, parent) => {
			if (!parent || index === null) return;

			const text = node.value;
			if (!text.includes('@')) return;

			const parts = [];
			let lastIndex = 0;

			for (const match of text.matchAll(MENTION_RE)) {
				const handle = match[1];
				const start = match.index;
				const override = overrides[handle.toLowerCase()];

				// Skip if override says to skip
				if (override?.skip) {
					continue;
				}

				// Add text before the match
				if (start > lastIndex) {
					parts.push({ type: 'text', value: text.slice(lastIndex, start) });
				}

				// Build the link (only allow https:// URLs from overrides)
				const overrideUrl = override?.url;
				const url = (overrideUrl && overrideUrl.startsWith('https://'))
					? overrideUrl
					: `https://www.instagram.com/${handle}/`;
				parts.push({
					type: 'link',
					url,
					data: {
						hProperties: {
							target: '_blank',
							rel: 'noopener noreferrer',
							class: 'mention-link',
						},
					},
					children: [{ type: 'text', value: `@${handle}` }],
				});

				lastIndex = start + match[0].length;
			}

			// No matches found — leave node as-is
			if (parts.length === 0) return;

			// Add any trailing text
			if (lastIndex < text.length) {
				parts.push({ type: 'text', value: text.slice(lastIndex) });
			}

			// Replace the text node with our parts
			parent.children.splice(index, 1, ...parts);
			return index + parts.length;
		});
	};
}
