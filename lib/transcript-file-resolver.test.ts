import { describe, it, expect, vi, beforeEach } from "vitest";
import os from "os";
import path from "path";

const mockStatSync = vi.fn();
const mockReaddirSync = vi.fn();

vi.mock("fs", () => {
  return {
    default: {
      statSync: (...args: unknown[]) => mockStatSync(...args),
      readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
    },
    statSync: (...args: unknown[]) => mockStatSync(...args),
    readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  };
});

import { resolveTranscriptFile } from "./transcript-file-resolver";

const PROJECT_PATH = "/Users/casa/my-project";
const REDEYE_FILE = path.join(PROJECT_PATH, ".redeye", "session-cto.jsonl");
const ENCODED = "-Users-casa-my-project";
const CLI_DIR = path.join(os.homedir(), ".claude", "projects", ENCODED);

beforeEach(() => {
  mockStatSync.mockReset();
  mockReaddirSync.mockReset();
});

describe("resolveTranscriptFile", () => {
  describe("priority 1: .redeye/session-cto.jsonl fresh", () => {
    it("returns .redeye file when it exists and is less than 60 seconds old", () => {
      const recentMtime = Date.now() - 30_000;
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) return { mtimeMs: recentMtime };
        throw new Error("ENOENT");
      });

      expect(resolveTranscriptFile(PROJECT_PATH)).toBe(REDEYE_FILE);
    });

    it("does not return .redeye file when it is older than 60 seconds", () => {
      const staleMtime = Date.now() - 90_000;
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) return { mtimeMs: staleMtime };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue([]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBeNull();
    });
  });

  describe("priority 2: CLI transcript files", () => {
    it("falls back to most-recent CLI .jsonl when .redeye is stale", () => {
      const staleMtime = Date.now() - 120_000;
      const file1Mtime = Date.now() - 10_000;
      const file2Mtime = Date.now() - 5_000;

      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) return { mtimeMs: staleMtime };
        if (p === path.join(CLI_DIR, "file1.jsonl")) return { isDirectory: () => false, mtimeMs: file1Mtime };
        if (p === path.join(CLI_DIR, "file2.jsonl")) return { isDirectory: () => false, mtimeMs: file2Mtime };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue(["file1.jsonl", "file2.jsonl"]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBe(path.join(CLI_DIR, "file2.jsonl"));
    });

    it("falls back to CLI file when .redeye file does not exist", () => {
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) throw new Error("ENOENT");
        if (p === path.join(CLI_DIR, "session.jsonl")) return { isDirectory: () => false, mtimeMs: Date.now() };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue(["session.jsonl"]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBe(path.join(CLI_DIR, "session.jsonl"));
    });

    it("skips non-.jsonl files in CLI directory", () => {
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) throw new Error("ENOENT");
        if (p === path.join(CLI_DIR, "session.jsonl")) return { isDirectory: () => false, mtimeMs: Date.now() };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue(["session.jsonl", "readme.txt", "data.json"]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBe(path.join(CLI_DIR, "session.jsonl"));
    });

    it("skips directories in CLI directory", () => {
      mockStatSync.mockImplementation((p: string) => {
        if (p === REDEYE_FILE) throw new Error("ENOENT");
        if (p === path.join(CLI_DIR, "session.jsonl")) return { isDirectory: () => false, mtimeMs: Date.now() };
        if (p === path.join(CLI_DIR, "subdir.jsonl")) return { isDirectory: () => true, mtimeMs: Date.now() };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockReturnValue(["session.jsonl", "subdir.jsonl"]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBe(path.join(CLI_DIR, "session.jsonl"));
    });
  });

  describe("priority 3: no file available", () => {
    it("returns null when neither .redeye file nor CLI files exist", () => {
      mockStatSync.mockImplementation(() => { throw new Error("ENOENT"); });
      mockReaddirSync.mockReturnValue([]);

      expect(resolveTranscriptFile(PROJECT_PATH)).toBeNull();
    });

    it("returns null when CLI directory does not exist", () => {
      mockStatSync.mockImplementation(() => { throw new Error("ENOENT"); });
      mockReaddirSync.mockImplementation(() => { throw new Error("ENOENT"); });

      expect(resolveTranscriptFile(PROJECT_PATH)).toBeNull();
    });
  });

  describe("path encoding (AD-3)", () => {
    it("encodes project path by replacing / with -", () => {
      const projectPath = "/Users/casa/control-tower";
      const expectedEncoded = "-Users-casa-control-tower";
      const expectedCliDir = path.join(os.homedir(), ".claude", "projects", expectedEncoded);
      const redeyePath = path.join(projectPath, ".redeye", "session-cto.jsonl");

      mockStatSync.mockImplementation((p: string) => {
        if (p === redeyePath) throw new Error("ENOENT");
        if (p.endsWith(".jsonl")) return { isDirectory: () => false, mtimeMs: Date.now() };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockImplementation((dirPath: string) => {
        if (dirPath === expectedCliDir) return ["session.jsonl"];
        return [];
      });

      expect(resolveTranscriptFile(projectPath)).toBe(path.join(expectedCliDir, "session.jsonl"));
    });

    it("encodes deeply nested project path correctly", () => {
      const deepPath = "/home/user/work/projects/my-app";
      const expectedEncoded = "-home-user-work-projects-my-app";
      const expectedCliDir = path.join(os.homedir(), ".claude", "projects", expectedEncoded);
      const redeyePath = path.join(deepPath, ".redeye", "session-cto.jsonl");

      mockStatSync.mockImplementation((p: string) => {
        if (p === redeyePath) throw new Error("ENOENT");
        if (p.endsWith(".jsonl")) return { isDirectory: () => false, mtimeMs: Date.now() };
        throw new Error("ENOENT");
      });
      mockReaddirSync.mockImplementation((dirPath: string) => {
        if (dirPath === expectedCliDir) return ["session.jsonl"];
        return [];
      });

      expect(resolveTranscriptFile(deepPath)).toBe(path.join(expectedCliDir, "session.jsonl"));
    });
  });
});
