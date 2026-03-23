import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/optional-deps.d.ts"],
      // Current: ~20% lines, ~60% branches, ~74% functions (post v1.0.0 expansion)
      // Target: raise thresholds as test coverage catches up with new modules
      thresholds: {
        branches: 55,
        functions: 60,
        lines: 18,
        statements: 18,
      },
    },
  },
});
