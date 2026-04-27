import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}", "*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "json-summary"],
      include: [
        "lib/**/*.{ts,tsx}",
        "components/**/*.{ts,tsx}",
        "app/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.d.ts",
        "**/node_modules/**",
        "app/api/**",
        "app/layout.tsx",
        "app/global-error.tsx",
      ],
      // Report coverage even when some tests fail (483 pre-existing failures).
      reportOnFailure: true,
      // Conservative thresholds: actual coverage is ~26% lines, ~18% branches,
      // ~12% functions. 483/923 tests have pre-existing failures. Thresholds are
      // set well below actuals to avoid false CI failures while still providing
      // a floor against catastrophic regressions. Raise incrementally.
      thresholds: {
        lines: 20,
        functions: 10,
        branches: 15,
        statements: 20,
      },
    },
  },
});
