// @vitest-environment node
/**
 * Tests for lib/atomic-write.ts — torn-write defense for state.json and
 * other concurrently-mutated state files.
 *
 * Mocks `fs/promises` (writeFile, rename, unlink) and `crypto`
 * (randomBytes) at the module level. Verifies:
 *   - Success path: writeFile + rename, no unlink.
 *   - Rename failure: unlink cleanup + original error re-thrown.
 *   - writeFile failure: rename never called, unlink attempted, error
 *     re-thrown.
 *   - Temp path format: <target>.tmp.<pid>.<8-hex>.
 *   - Concurrent uniqueness: distinct randomBytes → distinct temp paths.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted ensures these mock fns are defined before vi.mock factories
// (which run before any import statement).
const { mockWriteFile, mockRename, mockUnlink, mockRandomBytes } = vi.hoisted(
  () => ({
    mockWriteFile: vi.fn(),
    mockRename: vi.fn(),
    mockUnlink: vi.fn(),
    mockRandomBytes: vi.fn(),
  })
);

// `atomic-write.ts` does `import fs from "fs/promises"` and
// `import crypto from "crypto"` — both default imports. Provide mocks
// under both `default` and named exports so either import style works.
vi.mock("fs/promises", () => ({
  default: {
    writeFile: (...a: unknown[]) => mockWriteFile(...a),
    rename: (...a: unknown[]) => mockRename(...a),
    unlink: (...a: unknown[]) => mockUnlink(...a),
  },
  writeFile: (...a: unknown[]) => mockWriteFile(...a),
  rename: (...a: unknown[]) => mockRename(...a),
  unlink: (...a: unknown[]) => mockUnlink(...a),
}));

vi.mock("crypto", () => ({
  default: {
    randomBytes: (...a: unknown[]) => mockRandomBytes(...a),
  },
  randomBytes: (...a: unknown[]) => mockRandomBytes(...a),
}));

import { atomicWriteJson } from "./atomic-write";

beforeEach(() => {
  mockWriteFile.mockReset();
  mockRename.mockReset();
  mockUnlink.mockReset();
  mockRandomBytes.mockReset();
  // Default success: a Buffer-like object with .toString("hex") → "deadbeef"
  mockRandomBytes.mockReturnValue({ toString: (_enc: string) => "deadbeef" });
  mockWriteFile.mockResolvedValue(undefined);
  mockRename.mockResolvedValue(undefined);
  mockUnlink.mockResolvedValue(undefined);
});

describe("atomicWriteJson", () => {
  it("success path: writeFile then rename, unlink not called", async () => {
    await atomicWriteJson("/tmp/state.json", '{"a":1}');

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockUnlink).not.toHaveBeenCalled();

    // writeFile gets (tmpPath, content, "utf-8")
    const writeCall = mockWriteFile.mock.calls[0]!;
    expect(writeCall[1]).toBe('{"a":1}');
    expect(writeCall[2]).toBe("utf-8");

    // rename gets (tmpPath, targetPath)
    const renameCall = mockRename.mock.calls[0]!;
    expect(renameCall[1]).toBe("/tmp/state.json");
    // tmp path passed to rename matches the one passed to writeFile
    expect(renameCall[0]).toBe(writeCall[0]);
  });

  it("rename failure: unlink called with the temp path and original error re-thrown", async () => {
    const renameErr = Object.assign(new Error("EXDEV"), { code: "EXDEV" });
    mockRename.mockRejectedValueOnce(renameErr);

    await expect(atomicWriteJson("/tmp/state.json", "x")).rejects.toBe(
      renameErr
    );

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).toHaveBeenCalledTimes(1);
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    // Cleanup unlinks the tmp path that writeFile produced.
    const tmpPath = mockWriteFile.mock.calls[0]![0];
    expect(mockUnlink.mock.calls[0]![0]).toBe(tmpPath);
  });

  it("writeFile failure: rename never called, unlink attempted, original error re-thrown", async () => {
    const writeErr = Object.assign(new Error("ENOSPC"), { code: "ENOSPC" });
    mockWriteFile.mockRejectedValueOnce(writeErr);

    await expect(atomicWriteJson("/tmp/state.json", "x")).rejects.toBe(
      writeErr
    );

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    expect(mockRename).not.toHaveBeenCalled();
    // Cleanup unlink is attempted even though writeFile never created the file.
    expect(mockUnlink).toHaveBeenCalledTimes(1);
  });

  it("unlink failure during cleanup is swallowed; the original error still surfaces", async () => {
    const renameErr = new Error("rename-failed");
    mockRename.mockRejectedValueOnce(renameErr);
    mockUnlink.mockRejectedValueOnce(new Error("unlink-also-failed"));

    // The caller still sees the rename error, not the unlink error.
    await expect(atomicWriteJson("/tmp/state.json", "x")).rejects.toBe(
      renameErr
    );
  });

  it("temp path matches `<target>.tmp.<pid>.<8-hex>` format", async () => {
    mockRandomBytes.mockReturnValueOnce({
      toString: (_enc: string) => "ab12cd34",
    });

    await atomicWriteJson("/var/state.json", "{}");

    const tmpPath = mockWriteFile.mock.calls[0]![0] as string;
    const pattern = new RegExp(
      `^/var/state\\.json\\.tmp\\.${process.pid}\\.[0-9a-f]{8}$`
    );
    expect(tmpPath).toMatch(pattern);
    expect(tmpPath).toBe(`/var/state.json.tmp.${process.pid}.ab12cd34`);

    // randomBytes was called with 4 (per source: crypto.randomBytes(4))
    expect(mockRandomBytes).toHaveBeenCalledWith(4);
  });

  it("two concurrent calls produce different temp paths (uniqueness via randomBytes)", async () => {
    // Each call must read a fresh randomBytes value, so concurrent same-PID
    // writers do not collide on a fixed temp filename.
    mockRandomBytes
      .mockReturnValueOnce({ toString: () => "aaaaaaaa" })
      .mockReturnValueOnce({ toString: () => "bbbbbbbb" });

    await Promise.all([
      atomicWriteJson("/tmp/x.json", "1"),
      atomicWriteJson("/tmp/x.json", "2"),
    ]);

    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    const tmp1 = mockWriteFile.mock.calls[0]![0] as string;
    const tmp2 = mockWriteFile.mock.calls[1]![0] as string;
    expect(tmp1).not.toBe(tmp2);
    expect(tmp1.endsWith("aaaaaaaa")).toBe(true);
    expect(tmp2.endsWith("bbbbbbbb")).toBe(true);
  });
});
