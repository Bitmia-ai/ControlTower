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
    include: ["src/**/*.test.{ts,tsx}", "lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}", "app/**/*.test.{ts,tsx}"],
  },
});
