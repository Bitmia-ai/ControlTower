import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // React 19.2 only exposes `React.act` in the development bundle. Vitest
  // defaults `process.env.NODE_ENV` to "test", so React resolves the prod
  // bundle and `@testing-library/react` v16 throws "React.act is not a
  // function" on every render. Forcing "development" here loads the dev
  // bundle that exports `act`. See React 19 changelog + RTL v16 notes.
  define: {
    "process.env.NODE_ENV": JSON.stringify("development"),
  },
  test: {
    env: {
      NODE_ENV: "development",
      LOGGER_LEVEL: "silent",
    },
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx,mjs}", "lib/**/*.test.{ts,tsx,mjs}", "components/**/*.test.{ts,tsx,mjs}", "app/**/*.test.{ts,tsx,mjs}", "*.test.{ts,tsx,mjs}"],
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
