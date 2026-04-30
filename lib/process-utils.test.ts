// @vitest-environment node
import { describe, it, expect } from "vitest";
import { isProcessRunning } from "./process-utils";

describe("isProcessRunning", () => {
  it("returns true for the current process", () => {
    expect(isProcessRunning(process.pid)).toBe(true);
  });
  it("returns false for an impossible PID", () => {
    expect(isProcessRunning(999_999_999)).toBe(false);
  });
  it("returns true for the parent process", () => {
    expect(isProcessRunning(process.ppid)).toBe(true);
  });
});
