/**
 * ProjectStore — abstract read/write surface over the local
 * `~/.redeye/config.json` project registry plus per-project state in
 * `<root>/.redeye/*`.
 *
 * Phase 1 of the Radio integration (see Radio/INTEGRATION.md). The
 * concrete `LocalProjectStore` (./local.ts) is a thin wrapper around
 * the existing `lib/projects.ts` and `lib/redeye-files.ts` modules.
 * Phase 3 will add a `RadioProjectStore` that talks to a Radio daemon
 * over WSS.
 *
 * Routes should depend on this interface (via `getStore()` from
 * `@/lib/app`), never the underlying modules directly.
 */

import type {
  ChangelogEntry,
  InboxQuestion,
  Project,
  ProjectDetail,
  ProjectWithStatus,
  RedEyeState,
  SteeringDirective,
  TaskItem,
} from "@/lib/redeye-types";

export interface ProjectStore {
  // ---- Registry ---------------------------------------------------------
  list(): Promise<Project[]>;
  add(name: string, projectPath: string): Promise<{ name: string; path: string }>;
  remove(projectPath: string): Promise<void>;
  byIndex(index: number): Promise<Project | null>;

  // ---- Per-project state (read) -----------------------------------------
  state(projectPath: string): Promise<RedEyeState | null>;
  tasks(projectPath: string): Promise<TaskItem[]>;
  allTasks(projectPath: string): Promise<TaskItem[]>;
  inbox(projectPath: string): Promise<InboxQuestion[]>;
  changelog(projectPath: string): Promise<ChangelogEntry[]>;
  steering(projectPath: string): Promise<SteeringDirective[]>;
  status(projectPath: string): Promise<string>;
  isInitialized(projectPath: string): Promise<boolean>;
  scanMaxTaskId(projectPath: string): Promise<number>;
  detail(projectPath: string, project: ProjectWithStatus): Promise<ProjectDetail>;
}
