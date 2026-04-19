import { describe, it, expect } from "vitest";
import { slugify } from "./utils";

describe("slugify", () => {
	it("lowercases and hyphenates spaces", () => {
		expect(slugify("Hello World")).toBe("hello-world");
	});

	it("strips diacritics for ASCII-safe output", () => {
		expect(slugify("Churrería El Moro")).toBe("churreria-el-moro");
		expect(slugify("Persé")).toBe("perse");
	});

	it("removes non-alphanumeric characters", () => {
		expect(slugify("Ma's Pasadena!")).toBe("mas-pasadena");
		expect(slugify("A & B")).toBe("a-b");
	});

	it("collapses multiple spaces and hyphens", () => {
		expect(slugify("Too   many    spaces")).toBe("too-many-spaces");
		expect(slugify("already--hyphenated")).toBe("already-hyphenated");
	});

	it("trims leading and trailing hyphens", () => {
		expect(slugify("-leading")).toBe("leading");
		expect(slugify("trailing-")).toBe("trailing");
		expect(slugify("  padded  ")).toBe("padded");
	});

	it("handles CJK by stripping it entirely (known limitation)", () => {
		// CJK chars don't survive NFKD + [a-z0-9] filter. Documented here so nobody
		// is surprised — override the slug via `- id:` in vault markdown for these.
		expect(slugify("鹿港小鎮")).toBe("");
	});
});
