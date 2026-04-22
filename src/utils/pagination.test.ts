import { describe, it, expect } from "vitest";
import { paginationUrls } from "./pagination";

describe("paginationUrls", () => {
	it("page 1 of N has next but no prev", () => {
		expect(paginationUrls(1, 10, "/posts")).toEqual({
			prevUrl: null,
			nextUrl: "/posts/2",
		});
	});

	it("last page has prev but no next", () => {
		expect(paginationUrls(10, 10, "/posts")).toEqual({
			prevUrl: "/posts/9",
			nextUrl: null,
		});
	});

	it("middle page has both prev and next", () => {
		expect(paginationUrls(5, 10, "/posts")).toEqual({
			prevUrl: "/posts/4",
			nextUrl: "/posts/6",
		});
	});

	it("single-page pagination has neither prev nor next", () => {
		expect(paginationUrls(1, 1, "/posts")).toEqual({
			prevUrl: null,
			nextUrl: null,
		});
	});

	it("respects a different baseUrl", () => {
		expect(paginationUrls(3, 5, "/archive/2022")).toEqual({
			prevUrl: "/archive/2022/2",
			nextUrl: "/archive/2022/4",
		});
	});

	it("does not emit prev when currentPage equals 1 even if totalPages is 1", () => {
		// Guards against an off-by-one regression
		expect(paginationUrls(1, 1, "/x").prevUrl).toBeNull();
	});
});
