import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.ts"],
      exclude: ["src/optional-deps.d.ts"],
      // Current: ~27% lines, ~76% branches, ~84% functions
      // Target: raise to 80% across the board as test coverage expands
      thresholds: {
        branches: 70,
        functions: 80,
        lines: 25,
        statements: 25,
      },
    },
  },
});
