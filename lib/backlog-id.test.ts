import { describe, it, expect, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { getNextBacklogId } from "./backlog-id";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTempProject(opts?: {
  nextBlId?: number;
  backlogContent?: string;
  noStateJson?: boolean;
  noBacklogMd?: boolean;
}): Promise<string> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "blid-test-"));
  const redeyeDir = path.join(tmpDir, ".redeye");
  await fs.mkdir(redeyeDir);

  if (!opts?.noStateJson) {
    const state = {
      schema_version: 1,
      iteration: 1,
      phase: "BUILD",
      phase_status: "pending",
      backlog_item: null,
      backlog_title: null,
      spec_file: null,
      review_cycles: 0,
      health: {
        confidence: "HIGH",
        env_status: "healthy",
        iterations_since_last_deploy: 0,
        questions_awaiting_ceo: 0,
        blocked_items_count: 0,
      },
      counters: {
        next_bl_id: opts?.nextBlId ?? 1,
        next_q_id: 1,
      },
    };
    await fs.writeFile(
      path.join(redeyeDir, "state.json"),
      JSON.stringify(state, null, 2),
      "utf-8"
    );
  }

  if (!opts?.noBacklogMd && opts?.backlogContent !== undefined) {
    await fs.writeFile(
      path.join(redeyeDir, "backlog.md"),
      opts.backlogContent,
      "utf-8"
    );
  }

  return tmpDir;
}

async function readNextBlId(projectPath: string): Promise<number> {
  const stateRaw = await fs.readFile(
    path.join(projectPath, ".redeye", "state.json"),
    "utf-8"
  );
  const state = JSON.parse(stateRaw);
  return state.counters.next_bl_id;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const tmpDirs: string[] = [];
afterEach(async () => {
  for (const d of tmpDirs.splice(0)) {
    await fs.rm(d, { recursive: true, force: true });
  }
});

function trackDir(dir: string): string {
  tmpDirs.push(dir);
  return dir;
}

describe("getNextBacklogId", () => {
  it("uses counter when counter is ahead of backlog scan", async () => {
    // counter says 5, backlog highest is 3 → next should be BL-005, counter becomes 6
    const dir = trackDir(
      await createTempProject({
        nextBlId: 5,
        backlogContent: "## BL-003: old task\n## BL-001: older\n",
      })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toBe("BL-005");
    expect(await readNextBlId(dir)).toBe(6);
  });

  it("uses backlog scan when backlog is ahead of counter", async () => {
    // counter says 3, backlog highest is 7 → next should be BL-008, counter becomes 9
    const dir = trackDir(
      await createTempProject({
        nextBlId: 3,
        backlogContent: "## BL-007: latest task\n## BL-001: first\n",
      })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toBe("BL-008");
    expect(await readNextBlId(dir)).toBe(9);
  });

  it("uses max+1 when counter equals backlog max", async () => {
    // counter says 5 (meaning last allocated was 4), backlog highest is 4 → next BL-005
    const dir = trackDir(
      await createTempProject({
        nextBlId: 5,
        backlogContent: "## BL-004: last task\n",
      })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toBe("BL-005");
    expect(await readNextBlId(dir)).toBe(6);
  });

  it("returns BL-001 when both counter and backlog are zero/empty", async () => {
    // counter=1, no backlog items → BL-001
    const dir = trackDir(
      await createTempProject({
        nextBlId: 1,
        backlogContent: "",
      })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toBe("BL-001");
    expect(await readNextBlId(dir)).toBe(2);
  });

  it("falls back to scan only when state.json is missing", async () => {
    // no state.json, backlog highest is 3 → BL-004
    const dir = trackDir(
      await createTempProject({
        noStateJson: true,
        backlogContent: "## BL-003: some task\n",
      })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toBe("BL-004");
    // state.json should have been written with counter = 5
    expect(await readNextBlId(dir)).toBe(5);
  });

  it("falls back to counter only when backlog.md is missing", async () => {
    // counter=7, no backlog.md → BL-007, counter becomes 8
    const dir = trackDir(
      await createTempProject({
        nextBlId: 7,
        noBacklogMd: true,
      })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toBe("BL-007");
    expect(await readNextBlId(dir)).toBe(8);
  });

  it("pads single-digit IDs to three digits", async () => {
    const dir = trackDir(
      await createTempProject({ nextBlId: 1, backlogContent: "" })
    );
    const id = await getNextBacklogId(dir);
    expect(id).toMatch(/^BL-\d{3}$/);
  });
});

// ---------------------------------------------------------------------------
// T4: Integration test — two sequential calls return distinct IDs
// ---------------------------------------------------------------------------

describe("getNextBacklogId — sequential duplicate-prevention (T4)", () => {
  it("two sequential calls return distinct consecutive IDs and counter advances correctly", async () => {
    const dir = trackDir(
      await createTempProject({
        nextBlId: 5,
        backlogContent: "## BL-004: baseline\n",
      })
    );

    const id1 = await getNextBacklogId(dir);
    const id2 = await getNextBacklogId(dir);

    expect(id1).toBe("BL-005");
    expect(id2).toBe("BL-006");
    expect(id1).not.toBe(id2);

    // After both calls, counter should be 7
    expect(await readNextBlId(dir)).toBe(7);
  });

  it("three sequential calls each return a unique ID", async () => {
    const dir = trackDir(
      await createTempProject({
        nextBlId: 10,
        backlogContent: "## BL-009: existing\n",
      })
    );

    const ids = await Promise.all([
      getNextBacklogId(dir),
      // Must be sequential — each awaits the previous
    ]);
    const id2 = await getNextBacklogId(dir);
    const id3 = await getNextBacklogId(dir);
    const allIds = [...ids, id2, id3];

    // All unique
    expect(new Set(allIds).size).toBe(allIds.length);
    // Counter advanced by 3
    expect(await readNextBlId(dir)).toBe(13);
  });
});
