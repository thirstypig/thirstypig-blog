/**
 * Remark plugin that transforms markdown images into <picture> elements with:
 *   - WebP source (when a sibling .webp exists in public/)
 *   - Explicit width/height (read via sharp, so browsers reserve layout space)
 *   - loading="lazy" + decoding="async" (deferred payload)
 *
 * Images whose dimensions cannot be read fall back to a plain <img> — so a
 * missing file never breaks the post, it just loses the optimization.
 *
 * Recognizes two markdown patterns common in our archive:
 *   ![alt](/images/.../x.jpg)
 *   [![alt](/images/.../x.jpg "title")](http://external-url/)
 *
 * Converts `image` AST nodes into `html` nodes so the generated <picture>
 * markup survives MDX compilation intact.
 */
import { visit } from 'unist-util-visit';
import { getImageInfo } from '../utils/image-dimensions.mjs';

function escAttr(s) {
	return String(s)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

export function buildPictureHtml({ src, webp, width, height, alt }) {
	const dimAttrs = width && height ? ` width="${width}" height="${height}"` : '';
	const imgTag = `<img src="${escAttr(src)}" alt="${escAttr(alt || '')}"${dimAttrs} loading="lazy" decoding="async">`;

	if (!webp) return imgTag;

	return `<picture><source type="image/webp" srcset="${escAttr(webp)}">${imgTag}</picture>`;
}

export default function remarkImageOptimize() {
	return async (tree) => {
		const tasks = [];

		visit(tree, 'image', (node, index, parent) => {
			if (!parent || index === null) return;
			if (!node.url || !node.url.startsWith('/')) return;

			tasks.push((async () => {
				const info = await getImageInfo(node.url);
				const html = buildPictureHtml({
					src: node.url,
					webp: info.webp,
					width: info.width,
					height: info.height,
					alt: node.alt,
				});

				parent.children[index] = { type: 'html', value: html };
			})());
		});

		await Promise.all(tasks);
	};
}
