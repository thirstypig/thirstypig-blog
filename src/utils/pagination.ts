/**
 * Derive prev/next URLs for a Pagination component.
 *
 * Split out of Pagination.astro so the edge-case logic (page 1, last page,
 * single page) can be unit-tested without mounting the component.
 */

export interface PaginationUrls {
	prevUrl: string | null;
	nextUrl: string | null;
}

export function paginationUrls(
	currentPage: number,
	totalPages: number,
	baseUrl: string,
): PaginationUrls {
	return {
		prevUrl: currentPage > 1 ? `${baseUrl}/${currentPage - 1}` : null,
		nextUrl: currentPage < totalPages ? `${baseUrl}/${currentPage + 1}` : null,
	};
}
