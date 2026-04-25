import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs/promises";
import path from "path";
import os from "os";
import {
  listProjects,
  addProject,
  removeProject,
  getProjectByIndex,
} from "./projects.js";

let tmpDir: string;
let configPath: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-test-"));
  configPath = path.join(tmpDir, "config.json");
  process.env.REDEYE_CONFIG_PATH = configPath;
  // Tests use /tmp paths which addProject would reject as outside $HOME.
  // Opt-out for test environment only.
  process.env.ALLOW_OUTSIDE_HOME = "1";
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
  delete process.env.REDEYE_CONFIG_PATH;
  delete process.env.ALLOW_OUTSIDE_HOME;
});

async function readRawConfig(p: string) {
  const raw = await fs.readFile(p, "utf-8");
  return JSON.parse(raw);
}

describe("listProjects", () => {
  it("returns empty array when config file does not exist", async () => {
    const projects = await listProjects();
    expect(projects).toEqual([]);
  });

  it("returns projects from existing config", async () => {
    const data = { projects: [{ name: "foo", path: tmpDir }] };
    await fs.writeFile(configPath, JSON.stringify(data), "utf-8");

    const projects = await listProjects();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe("foo");
  });
});

describe("addProject", () => {
  it("creates config.json if it does not exist", async () => {
    await addProject("myproject", tmpDir);

    const raw = await readRawConfig(configPath);
    expect(raw.projects).toHaveLength(1);
    expect(raw.projects[0].name).toBe("myproject");
  });

  it("resolves symlinks via realpath", async () => {
    const linkPath = path.join(tmpDir, "link");
    const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-target-"));
    try {
      await fs.symlink(targetDir, linkPath);
      await addProject("linked", linkPath);

      const raw = await readRawConfig(configPath);
      const storedPath = raw.projects[0].path;
      const realTarget = await fs.realpath(targetDir);
      expect(storedPath).toBe(realTarget);
      expect(storedPath).not.toBe(linkPath);
    } finally {
      await fs.rm(targetDir, { recursive: true, force: true });
    }
  });

  it("throws when path does not exist", async () => {
    const badPath = path.join(tmpDir, "nonexistent");
    await expect(addProject("bad", badPath)).rejects.toThrow();
  });

  it("does not add duplicate paths", async () => {
    await addProject("first", tmpDir);
    await addProject("second", tmpDir); // same path, different name

    const raw = await readRawConfig(configPath);
    expect(raw.projects).toHaveLength(1);
    expect(raw.projects[0].name).toBe("first");
  });

  it("appends to existing projects", async () => {
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-dir2-"));
    try {
      await addProject("proj1", tmpDir);
      await addProject("proj2", dir2);

      const raw = await readRawConfig(configPath);
      expect(raw.projects).toHaveLength(2);
    } finally {
      await fs.rm(dir2, { recursive: true, force: true });
    }
  });
});

describe("removeProject", () => {
  it("removes a project by path", async () => {
    await addProject("myproject", tmpDir);
    const realPath = await fs.realpath(tmpDir);
    await removeProject(realPath);

    const raw = await readRawConfig(configPath);
    expect(raw.projects).toHaveLength(0);
  });

  it("is a no-op when path is not in the list", async () => {
    await addProject("myproject", tmpDir);
    await removeProject("/some/other/path");

    const raw = await readRawConfig(configPath);
    expect(raw.projects).toHaveLength(1);
  });
});

describe("getProjectByIndex", () => {
  it("returns null for empty list", async () => {
    const result = await getProjectByIndex(0);
    expect(result).toBeNull();
  });

  it("returns null for out-of-range index", async () => {
    await addProject("myproject", tmpDir);
    const result = await getProjectByIndex(5);
    expect(result).toBeNull();
  });

  it("returns the correct project by index", async () => {
    const dir2 = await fs.mkdtemp(path.join(os.tmpdir(), "redeye-dir2-"));
    try {
      await addProject("first", tmpDir);
      await addProject("second", dir2);

      const first = await getProjectByIndex(0);
      const second = await getProjectByIndex(1);

      expect(first?.name).toBe("first");
      expect(second?.name).toBe("second");
    } finally {
      await fs.rm(dir2, { recursive: true, force: true });
    }
  });
});
