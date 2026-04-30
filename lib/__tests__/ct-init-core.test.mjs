// lib/__tests__/ct-init-core.test.mjs — Unit tests for ct-init-core.
// Mocks fs/promises to avoid real disk I/O.

import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMkdir, mockWriteFile } = vi.hoisted(() => ({
  mockMkdir: vi.fn().mockResolvedValue(undefined),
  mockWriteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("fs/promises", () => ({
  default: { mkdir: mockMkdir, writeFile: mockWriteFile },
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

import {
  makeConfigMd,
  makeTasksMd,
  makeStateJson,
  makeSteeringMd,
  makeInboxMd,
  makeSchedulesMd,
  runInit,
} from "../ct-init-core.mjs";

beforeEach(() => {
  mockMkdir.mockClear();
  mockWriteFile.mockClear();
});

// ---------------------------------------------------------------------------
// makeConfigMd
// ---------------------------------------------------------------------------

describe("makeConfigMd", () => {
  const baseOpts = {
    projectName: "my-project",
    cwd: "/tmp/my-project",
    redeyePluginPath: "~/redeye",
    timestamp: "2026-04-27T15:00:00Z",
  };

  it("contains the project name in the heading", () => {
    const out = makeConfigMd(baseOpts);
    expect(out).toContain("# my-project — RedEye Configuration");
  });

  it("contains the repo path (cwd)", () => {
    const out = makeConfigMd(baseOpts);
    expect(out).toContain("/tmp/my-project");
  });

  it("contains the passed timestamp", () => {
    const out = makeConfigMd(baseOpts);
    expect(out).toContain("2026-04-27T15:00:00Z");
  });

  it("contains the Engineering Culture section", () => {
    const out = makeConfigMd(baseOpts);
    expect(out).toContain("## Engineering Culture");
  });

  it("contains the redeye plugin path", () => {
    const out = makeConfigMd(baseOpts);
    expect(out).toContain("~/redeye");
  });
});

// ---------------------------------------------------------------------------
// makeTasksMd
// ---------------------------------------------------------------------------

describe("makeTasksMd", () => {
  it("with addSampleTask=true contains T001 entry", () => {
    const out = makeTasksMd({ addSampleTask: true });
    expect(out).toContain("### T001:");
  });

  it("with addSampleTask=false does NOT contain T001 entry", () => {
    const out = makeTasksMd({ addSampleTask: false });
    expect(out).not.toContain("### T001:");
  });

  it("always contains '## CEO Requests'", () => {
    expect(makeTasksMd({ addSampleTask: true })).toContain("## CEO Requests");
    expect(makeTasksMd({ addSampleTask: false })).toContain("## CEO Requests");
  });

  it("always contains '## Discovered'", () => {
    expect(makeTasksMd({ addSampleTask: true })).toContain("## Discovered");
    expect(makeTasksMd({ addSampleTask: false })).toContain("## Discovered");
  });

  it("always contains '## Triaged'", () => {
    expect(makeTasksMd({ addSampleTask: true })).toContain("## Triaged");
    expect(makeTasksMd({ addSampleTask: false })).toContain("## Triaged");
  });

  it("always contains '## Won't Do'", () => {
    expect(makeTasksMd({ addSampleTask: true })).toContain("## Won't Do");
    expect(makeTasksMd({ addSampleTask: false })).toContain("## Won't Do");
  });
});

// ---------------------------------------------------------------------------
// makeStateJson
// ---------------------------------------------------------------------------

describe("makeStateJson", () => {
  it("returns valid JSON parseable by JSON.parse", () => {
    const out = makeStateJson({ addSampleTask: false });
    expect(() => JSON.parse(out)).not.toThrow();
  });

  it("schema_version equals 1", () => {
    const parsed = JSON.parse(makeStateJson({ addSampleTask: false }));
    expect(parsed.schema_version).toBe(1);
  });

  it("with addSampleTask=true counters.next_task_id equals 2", () => {
    const parsed = JSON.parse(makeStateJson({ addSampleTask: true }));
    expect(parsed.counters.next_task_id).toBe(2);
  });

  it("with addSampleTask=false counters.next_task_id equals 1", () => {
    const parsed = JSON.parse(makeStateJson({ addSampleTask: false }));
    expect(parsed.counters.next_task_id).toBe(1);
  });

  it("phase is 'triage' and phase_status is 'pending'", () => {
    const parsed = JSON.parse(makeStateJson({}));
    expect(parsed.phase).toBe("triage");
    expect(parsed.phase_status).toBe("pending");
  });
});

// ---------------------------------------------------------------------------
// makeSteeringMd / makeInboxMd / makeSchedulesMd
// ---------------------------------------------------------------------------

describe("makeSteeringMd", () => {
  it("contains '## Directives'", () => {
    expect(makeSteeringMd()).toContain("## Directives");
  });
});

describe("makeInboxMd", () => {
  it("contains '# Inbox'", () => {
    expect(makeInboxMd()).toContain("# Inbox");
  });
});

describe("makeSchedulesMd", () => {
  it("contains '# Schedules'", () => {
    expect(makeSchedulesMd()).toContain("# Schedules");
  });
});

// ---------------------------------------------------------------------------
// runInit
// ---------------------------------------------------------------------------

describe("runInit", () => {
  const baseOpts = {
    projectName: "test-proj",
    cwd: "/tmp/test-proj",
    redeyePluginPath: "~/redeye",
    addSampleTask: false,
    timestamp: "2026-04-27T15:00:00Z",
  };

  it("calls fs.mkdir once with a path containing '.redeye'", async () => {
    await runInit(baseOpts);
    expect(mockMkdir).toHaveBeenCalledTimes(1);
    const arg = mockMkdir.mock.calls[0][0];
    expect(arg).toContain(".redeye");
  });

  it("calls fs.writeFile exactly 6 times", async () => {
    await runInit(baseOpts);
    expect(mockWriteFile).toHaveBeenCalledTimes(6);
  });

  it("written paths include all 6 expected files", async () => {
    await runInit(baseOpts);
    const writtenPaths = mockWriteFile.mock.calls.map((c) => c[0]);
    expect(writtenPaths.some((p) => p.endsWith("config.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("tasks.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("state.json"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("steering.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("inbox.md"))).toBe(true);
    expect(writtenPaths.some((p) => p.endsWith("schedules.md"))).toBe(true);
  });

  it("returns the list of written file paths", async () => {
    const result = await runInit(baseOpts);
    expect(result.written).toHaveLength(6);
  });

  it("throws if projectName is missing", async () => {
    await expect(
      runInit({ cwd: "/tmp/x" }, { mkdir: mockMkdir, writeFile: mockWriteFile })
    ).rejects.toThrow(/projectName/);
  });

  it("throws if cwd is missing", async () => {
    await expect(
      runInit(
        { projectName: "x" },
        { mkdir: mockMkdir, writeFile: mockWriteFile }
      )
    ).rejects.toThrow(/cwd/);
  });
});
