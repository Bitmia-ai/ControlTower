/**
 * LocalProjectStore — thin pass-through to the existing local-only
 * modules in `lib/projects.ts` and `lib/redeye-files.ts`.
 *
 * Every method delegates one-to-one. No state, no side effects beyond
 * what the underlying functions do today. The point of this class is
 * the `implements ProjectStore` constraint: when the Radio adapter
 * lands in Phase 3, it just has to satisfy the same interface.
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
import * as files from "@/lib/redeye-files";
import * as projects from "@/lib/projects";

import type { ProjectStore } from "./index";

export class LocalProjectStore implements ProjectStore {
  list(): Promise<Project[]> {
    return projects.listProjects();
  }
  add(name: string, projectPath: string): Promise<{ name: string; path: string }> {
    return projects.addProject(name, projectPath);
  }
  remove(projectPath: string): Promise<void> {
    return projects.removeProject(projectPath);
  }
  byIndex(index: number): Promise<Project | null> {
    return projects.getProjectByIndex(index);
  }

  state(projectPath: string): Promise<RedEyeState | null> {
    return files.readState(projectPath);
  }
  tasks(projectPath: string): Promise<TaskItem[]> {
    return files.readTasks(projectPath);
  }
  allTasks(projectPath: string): Promise<TaskItem[]> {
    return files.readAllTasks(projectPath);
  }
  inbox(projectPath: string): Promise<InboxQuestion[]> {
    return files.readInbox(projectPath);
  }
  changelog(projectPath: string): Promise<ChangelogEntry[]> {
    return files.readChangelog(projectPath);
  }
  steering(projectPath: string): Promise<SteeringDirective[]> {
    return files.readSteering(projectPath);
  }
  status(projectPath: string): Promise<string> {
    return files.readStatus(projectPath);
  }
  isInitialized(projectPath: string): Promise<boolean> {
    return files.isInitialized(projectPath);
  }
  scanMaxTaskId(projectPath: string): Promise<number> {
    return files.scanMaxTaskId(projectPath);
  }
  detail(projectPath: string, project: ProjectWithStatus): Promise<ProjectDetail> {
    return files.readProjectDetail(projectPath, project);
  }
}
