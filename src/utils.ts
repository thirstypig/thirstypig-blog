/**
 * Convert a string to a URL-safe slug.
 */
export function slugify(text: string): string {
	return text
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '') // strip diacritics
		.replace(/[^a-z0-9\s-]/g, '')    // remove non-alphanumeric
		.replace(/\s+/g, '-')            // spaces to hyphens
		.replace(/-+/g, '-')             // collapse hyphens
		.replace(/^-|-$/g, '');          // trim hyphens
}
