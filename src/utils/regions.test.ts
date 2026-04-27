import { describe, it, expect } from "vitest";
import { aggregateRegions } from "./regions";

const post = (region?: string) => ({ data: region !== undefined ? { region } : {} });

describe("aggregateRegions", () => {
	it("buckets posts without a region into elsewhereCount, not into a phantom top region", () => {
		// Regression guard: an early version dropped the truthy check on `region`,
		// which would have created a top entry keyed on undefined.
		const result = aggregateRegions([post(), post(), post()], 3);
		expect(result.top).toEqual([]);
		expect(result.elsewhereCount).toBe(3);
	});

	it("counts repeated regions correctly and ranks by count desc", () => {
		const posts = [
			post("Shanghai"),
			post("Shanghai"),
			post("Shanghai"),
			post("LA"),
			post("LA"),
			post("Taipei"),
		];
		const { top } = aggregateRegions(posts, 3);
		expect(top).toEqual([
			{ region: "Shanghai", count: 3 },
			{ region: "LA", count: 2 },
			{ region: "Taipei", count: 1 },
		]);
	});

	it("preserves the invariant: sum(top counts) + elsewhereCount === posts.length", () => {
		const posts = [
			post("Shanghai"), post("Shanghai"),
			post("LA"), post("LA"),
			post("Taipei"),
			post("Seoul"),
			post(),  // unregioned — must land in elsewhere
			post(),
		];
		const { top, elsewhereCount } = aggregateRegions(posts, 2);
		const topTotal = top.reduce((s, r) => s + r.count, 0);
		expect(topTotal + elsewhereCount).toBe(posts.length);
		// And specifically: elsewhere collects the 4th-ranked Seoul + 2 unregioned
		expect(elsewhereCount).toBe(4);
	});

	it("respects topN — fewer regions returned when fewer exist", () => {
		const result = aggregateRegions([post("Shanghai"), post("LA")], 5);
		expect(result.top).toHaveLength(2);
		expect(result.elsewhereCount).toBe(0);
	});

	it("handles an empty post list", () => {
		expect(aggregateRegions([], 3)).toEqual({ top: [], elsewhereCount: 0 });
	});
});
