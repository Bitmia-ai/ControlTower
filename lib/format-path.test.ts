import { describe, it, expect } from "vitest";
import { tildify } from "./format-path";

describe("tildify", () => {
  it("replaces a leading home-dir match with ~", () => {
    expect(tildify("/home/alice/code/foo", "/home/alice")).toBe("~/code/foo");
  });

  it("returns ~ when path equals home", () => {
    expect(tildify("/home/alice", "/home/alice")).toBe("~");
  });

  it("does not match a similarly-prefixed but distinct directory", () => {
    // /home/alicelong should not be shortened by /home/alice
    expect(tildify("/home/alicelong/code", "/home/alice")).toBe(
      "/home/alicelong/code"
    );
  });

  it("tolerates a trailing slash on homeDir", () => {
    expect(tildify("/home/alice/x", "/home/alice/")).toBe("~/x");
  });

  it("returns absPath unchanged when homeDir is empty", () => {
    expect(tildify("/home/alice/x", "")).toBe("/home/alice/x");
  });

  it("returns absPath unchanged when homeDir is null/undefined", () => {
    expect(tildify("/home/alice/x", null)).toBe("/home/alice/x");
    expect(tildify("/home/alice/x", undefined)).toBe("/home/alice/x");
  });

  it("returns absPath unchanged when home prefix doesn't match", () => {
    expect(tildify("/var/log/syslog", "/home/alice")).toBe("/var/log/syslog");
  });

  it("works with macOS-style home dir", () => {
    expect(tildify("/Users/bob/projects/x", "/Users/bob")).toBe("~/projects/x");
  });
});
