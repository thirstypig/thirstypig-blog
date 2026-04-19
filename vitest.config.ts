import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		// Match *.test.ts, *.test.mjs, *.test.js anywhere under src/ or scripts/
		include: ["src/**/*.test.{ts,mjs,js}", "scripts/**/*.test.{ts,mjs,js}"],
		// Keep unit tests fast — no coverage by default; add when we have enough tests to warrant it
		reporters: ["default"],
		// Node environment — our code is build-time, not browser
		environment: "node",
	},
});
