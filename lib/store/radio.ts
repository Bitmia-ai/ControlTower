/**
 * RadioProjectStore — talks to a connected Radio over WSS.
 *
 * Phase 3 v0 minimum: enough to back GET /api/projects and
 * GET /api/projects/[id]. Methods that need wider support
 * (`add`, `remove`, `detail`, `scanMaxTaskId`) call the Radio op
 * when there's a clean mapping; the rest currently throw to
 * surface gaps as we build out coverage.
 *
 * ID mapping caveat (per INTEGRATION.md §B): CT today addresses
 * projects by `path` (and a numeric index into the registry). Radio
 * addresses projects by `project_id` (UUID). RadioProjectStore caches
 * the projects list and resolves path → project_id on the fly. When
 * the cache is stale, it refreshes via `projects.list`.
 *
 * This is a Phase-3 bridge. Phase 4 introduces a stable surface ID
 * (UUIDv7 minted by CT) that maps `(radio_id, project_id)`.
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
import * as parsers from "@/lib/redeye-parsers";

import type { ProjectStore } from "@/lib/store";
import type { RadioConnection } from "@/lib/radio/client";
import { OPS } from "@/lib/radio/protocol";

/** Wire shape of a project as Radio reports it (see PROTOCOL.md §6.1). */
interface RadioProject {
  project_id: string;
  path: string;
  label: string;
  registered_at: string;
}

/** Wire shape of `project.state`'s response. */
interface ProjectStateResp {
  snapshot: Record<string, string>;
}

export class RadioProjectStore implements ProjectStore {
  private projectIdByPath = new Map<string, string>();
  private listCache: Project[] | null = null;
  private listCacheAt = 0;
  private readonly listTtlMs = 1_000;

  constructor(private readonly conn: RadioConnection) {}

  async list(): Promise<Project[]> {
    const now = Date.now();
    if (this.listCache && now - this.listCacheAt < this.listTtlMs) {
      return this.listCache;
    }
    const r = await this.conn.call<{ projects: RadioProject[] }>(
      OPS.PROJECTS_LIST,
      {}
    );
    this.projectIdByPath.clear();
    for (const p of r.projects) {
      this.projectIdByPath.set(p.path, p.project_id);
    }
    this.listCache = r.projects.map((p, idx) => ({
      name: p.label,
      path: p.path,
      // CT's Project type uses a numeric index — synthesize from the
      // ordering Radio returns. Phase 4 replaces with a surface id.
      index: idx,
    })) as unknown as Project[];
    this.listCacheAt = now;
    return this.listCache;
  }

  async byIndex(index: number): Promise<Project | null> {
    const all = await this.list();
    return all[index] ?? null;
  }

  async add(name: string, projectPath: string): Promise<{ name: string; path: string }> {
    const r = await this.conn.call<RadioProject>(OPS.PROJECTS_ADD, {
      path: projectPath,
      label: name,
    });
    this.invalidate();
    return { name: r.label, path: r.path };
  }

  async remove(projectPath: string): Promise<void> {
    await this.conn.call(OPS.PROJECTS_REMOVE, { id_or_path: projectPath });
    this.invalidate();
  }

  async state(projectPath: string): Promise<RedEyeState | null> {
    const projectId = await this.resolveProjectId(projectPath);
    if (!projectId) return null;
    const r = await this.conn.call<ProjectStateResp>(OPS.PROJECT_STATE, {
      project_id: projectId,
    });
    // Radio's snapshot doesn't include state.json — RedEyeState is
    // parsed from it by CT today. For Phase 3 v0 we return null;
    // ProtoCol coverage of state.json is a Phase 3.1 task.
    void r;
    return null;
  }

  async tasks(projectPath: string): Promise<TaskItem[]> {
    const snap = await this.snapshot(projectPath);
    const content = snap?.["tasks.md"];
    if (!content) return [];
    return parsers.parseTasks(content);
  }

  async allTasks(projectPath: string): Promise<TaskItem[]> {
    return this.tasks(projectPath);
  }

  async inbox(projectPath: string): Promise<InboxQuestion[]> {
    const snap = await this.snapshot(projectPath);
    const content = snap?.["inbox.md"];
    if (!content) return [];
    return parsers.parseInbox(content);
  }

  async changelog(projectPath: string): Promise<ChangelogEntry[]> {
    const snap = await this.snapshot(projectPath);
    const content = snap?.["changelog.md"];
    if (!content) return [];
    return parsers.parseChangelog(content);
  }

  async steering(projectPath: string): Promise<SteeringDirective[]> {
    const snap = await this.snapshot(projectPath);
    const content = snap?.["steering.md"];
    if (!content) return [];
    return parsers.parseSteering(content);
  }

  async status(projectPath: string): Promise<string> {
    const snap = await this.snapshot(projectPath);
    return snap?.["status.md"] ?? "";
  }

  async isInitialized(projectPath: string): Promise<boolean> {
    // Heuristic: project exists in the registry AND has any
    // .redeye/*.md file. Radio's `subscribe.project` would tell us
    // for sure, but we don't subscribe just for this check.
    const projectId = await this.resolveProjectId(projectPath);
    if (!projectId) return false;
    const snap = await this.snapshot(projectPath);
    return snap !== null && Object.keys(snap).length > 0;
  }

  async scanMaxTaskId(projectPath: string): Promise<number> {
    const tasks = await this.tasks(projectPath);
    return tasks.reduce((max, t) => { const n = Number.parseInt(String(t.id), 10); return Number.isFinite(n) && n > max ? n : max; }, 0);
  }

  async detail(_projectPath: string, _project: ProjectWithStatus): Promise<ProjectDetail> {
    throw new Error("RadioProjectStore.detail not yet implemented");
  }

  // ---- helpers ----

  private async resolveProjectId(projectPath: string): Promise<string | null> {
    const cached = this.projectIdByPath.get(projectPath);
    if (cached) return cached;
    await this.list();
    return this.projectIdByPath.get(projectPath) ?? null;
  }

  private async snapshot(projectPath: string): Promise<Record<string, string> | null> {
    const projectId = await this.resolveProjectId(projectPath);
    if (!projectId) return null;
    const r = await this.conn.call<ProjectStateResp>(OPS.PROJECT_STATE, {
      project_id: projectId,
    });
    return r.snapshot;
  }

  private invalidate(): void {
    this.listCache = null;
    this.listCacheAt = 0;
    this.projectIdByPath.clear();
  }
}
