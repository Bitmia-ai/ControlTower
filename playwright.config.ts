import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // Phase-change toast tests are inherently timing-sensitive (5s polling
  // interval combined with 5s toast auto-dismiss) — give them one retry
  // so a flake doesn't fail the whole suite.
  retries: 2,
  // The single shared prod server at :3200 cannot reliably handle
  // multiple concurrent test workers — we've seen flakes in
  // phase-change-toast and cost-card under parallel load
  // (5s polling intervals overlap with 5s toast auto-dismiss windows).
  // Run all e2e specs in a single worker to keep timing deterministic.
  workers: 1,
  use: {
    baseURL: "http://localhost:3200",
  },
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:3200",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
