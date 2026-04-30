// Hermetic test environment seeding for Playwright e2e specs.
//
// Creates two RedEye-shaped projects in a deterministic temp directory and
// writes a config.json that the dashboard reads via REDEYE_CONFIG_PATH.
// Imported synchronously by playwright.config.ts so the path is set BEFORE
// `npm start` boots the dashboard.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { seedProject } from "./fixtures/seed-project";

// Deterministic so multiple Playwright workers and the webServer all read
// from the same place. Cleaned + re-seeded at the start of each run.
export const TEST_TMP_ROOT = path.join(os.tmpdir(), "ct-e2e-fixtures");
export const REDEYE_CONFIG_PATH = path.join(TEST_TMP_ROOT, "config.json");

export function seedTestEnv(): void {
  // Wipe any previous run's state so tests start from a known-good baseline.
  if (fs.existsSync(TEST_TMP_ROOT)) {
    fs.rmSync(TEST_TMP_ROOT, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });

  // Project 0 — generic dashboard project that several specs target. Carries
  // a T119 task (per-task duration test) and a few done items so the Done
  // section + Recently Shipped card surfaces.
  const project0Dir = path.join(TEST_TMP_ROOT, "project-zero");
  fs.mkdirSync(project0Dir, { recursive: true });
  seedProject({
    rootDir: project0Dir,
    state: { iteration: 56, phase: "TRIAGE", phase_status: "complete" },
    tasks: [
      {
        id: "T119",
        title: "Per-task time tracking",
        status: "done",
        summary:
          "Added per-task duration tracking with iteration_log timestamps. " +
          "Endpoint GET /api/projects/[id]/tasks/[taskId]/duration returns " +
          "{ data: { taskId, durationMs, iterationCount } }.",
        cost_usd: 5.42,
        mergedAt: "2026-04-25",
        mergedIteration: 51,
      },
      {
        id: "T120",
        title: "UI exploration regression suite",
        status: "done",
        summary: "Pinned 4 UI regressions discovered during full-route exploration.",
        cost_usd: 3.18,
        mergedAt: "2026-04-26",
        mergedIteration: 52,
      },
      {
        id: "T121",
        title: "Tab redesign smoke tests",
        status: "done",
        summary: "Added smoke tests for tasks/history/live tabs.",
        cost_usd: 2.05,
        mergedAt: "2026-04-27",
        mergedIteration: 53,
      },
      {
        id: "T122",
        title: "Steer tab",
        status: "done",
        summary: "Steer tab now appears in project nav with directive form.",
        cost_usd: 4.31,
        mergedAt: "2026-04-28",
        mergedIteration: 54,
      },
      {
        id: "T200",
        title: "Add caching layer to digest",
        status: "planned",
      },
    ],
  });

  // Project 1 — "haze"-shaped project several specs target. Carries T048
  // (summary section test) and a populated Done section.
  const project1Dir = path.join(TEST_TMP_ROOT, "project-one");
  fs.mkdirSync(project1Dir, { recursive: true });
  seedProject({
    rootDir: project1Dir,
    state: { iteration: 56, phase: "TRIAGE", phase_status: "complete" },
    tasks: [
      {
        id: "T048",
        title: "Collapsible LLM summary on completed backlog items",
        status: "done",
        summary:
          "Done items now render a green-accented Summary section that is " +
          "expanded by default and can be collapsed via a chevron toggle. " +
          "The Recently Shipped card on mission control shows an inline " +
          "summary snippet for each done item that carries a Summary field.",
        cost_usd: 6.20,
        mergedAt: "2026-04-29",
        mergedIteration: 50,
      },
      {
        id: "T044",
        title: "Add --condition flag to --help output",
        status: "done",
        summary: "Help text now lists the --condition flag with its valid values.",
        cost_usd: 2.14,
        mergedAt: "2026-04-29",
        mergedIteration: 51,
      },
      {
        id: "T043",
        title: "Weather condition filter for --max-hours",
        status: "done",
        summary: "Added --condition <c> flag that filters --max-hours search by target weather.",
        cost_usd: 8.91,
        mergedAt: "2026-04-28",
        mergedIteration: 52,
      },
      {
        id: "T042",
        title: "Today's high/low temperature line",
        status: "done",
        summary: "Default mode now renders a 'Today: X/Y C  Condition' line.",
        cost_usd: 3.55,
        mergedAt: "2026-04-27",
        mergedIteration: 53,
      },
      {
        id: "T041",
        title: "Done tasks in collapsible section",
        status: "done",
        summary: "Done items hidden behind a collapsible header on the tasks page.",
        cost_usd: 1.80,
        mergedAt: "2026-04-26",
        mergedIteration: 54,
      },
      {
        id: "T201",
        title: "Add unit selection to forecast view",
        status: "planned",
      },
      {
        id: "T202",
        title: "Snow icon should pulse in --animate",
        status: "wontdo",
        section: "wontdo",
      },
    ],
  });

  const config = {
    projects: [
      { name: "project-zero", path: project0Dir },
      { name: "project-one", path: project1Dir },
    ],
  };
  fs.writeFileSync(REDEYE_CONFIG_PATH, JSON.stringify(config, null, 2));
}
