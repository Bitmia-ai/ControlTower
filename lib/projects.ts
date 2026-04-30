import { Project } from "./redeye-types";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { atomicWriteJson } from "./atomic-write";

export function getConfigPath(): string {
  return (
    process.env.REDEYE_CONFIG_PATH ||
    path.join(os.homedir(), ".redeye", "config.json")
  );
}

interface Config {
  projects: Project[];
}

/** System paths we never want to register as a project root. */
const FORBIDDEN_ROOTS = [
  "/",
  "/bin",
  "/sbin",
  "/usr",
  "/etc",
  "/var",
  "/System",
  "/Library",
  "/private",
  "/opt",
  "/dev",
  "/proc",
  "/sys",
];
/** Project name format — keeps it printable, paths-safe, label-friendly. */
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

async function readConfig(configPath: string): Promise<Config> {
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw) as Config;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return { projects: [] };
    }
    throw err;
  }
}

async function writeConfig(configPath: string, config: Config): Promise<void> {
  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await atomicWriteJson(configPath, JSON.stringify(config, null, 2));
}

export async function listProjects(): Promise<Project[]> {
  const config = await readConfig(getConfigPath());
  return config.projects;
}

/**
 * Register a project. Validates the name and the resolved path:
 *   - name must match NAME_RE (no spaces, no shell metachars)
 *   - path must exist, be a directory, and resolve under the user's home
 *     (override with ALLOW_OUTSIDE_HOME=1)
 *   - path must not match a system root
 *
 * Resolves symlinks once via realpath. The realPath is stored, and is what
 * removeProject and getProjectByIndex will compare against.
 */
export async function addProject(
  name: string,
  projectPath: string
): Promise<{ name: string; path: string }> {
  if (typeof name !== "string" || !NAME_RE.test(name)) {
    throw new Error(
      "Invalid project name: must match [A-Za-z0-9][A-Za-z0-9._-]{0,63}"
    );
  }
  if (typeof projectPath !== "string" || projectPath.length === 0) {
    throw new Error("Project path required");
  }

  const configPath = getConfigPath();
  const resolved = path.resolve(projectPath);

  // Must exist + be a directory
  let stat: import("fs").Stats;
  try {
    stat = await fs.stat(resolved);
  } catch {
    throw new Error(`Project path does not exist: ${projectPath}`);
  }
  if (!stat.isDirectory()) {
    throw new Error(`Project path is not a directory: ${projectPath}`);
  }

  const realPath = await fs.realpath(resolved);

  // Reject system roots
  for (const root of FORBIDDEN_ROOTS) {
    if (realPath === root || realPath.startsWith(root + path.sep)) {
      // Allow if the user explicitly opted in AND it's still under home
      if (process.env.ALLOW_OUTSIDE_HOME !== "1") {
        throw new Error(
          `Refusing to register system path: ${realPath}. ` +
            `Set ALLOW_OUTSIDE_HOME=1 to override.`
        );
      }
    }
  }

  // Default scope: must be inside the user's home directory
  if (process.env.ALLOW_OUTSIDE_HOME !== "1") {
    const home = path.resolve(os.homedir());
    if (realPath !== home && !realPath.startsWith(home + path.sep)) {
      throw new Error(
        `Project must be inside your home directory (${home}). ` +
          `Set ALLOW_OUTSIDE_HOME=1 to override.`
      );
    }
  }

  const config = await readConfig(configPath);

  if (config.projects.some((p) => p.path === realPath)) {
    return { name, path: realPath };
  }

  config.projects.push({ name, path: realPath });
  await writeConfig(configPath, config);
  return { name, path: realPath };
}

export async function removeProject(projectPath: string): Promise<void> {
  const configPath = getConfigPath();
  const resolved = path.resolve(projectPath);

  // Try realpath too — addProject stored the realpath, so a user removing
  // by symlink path needs to compare against the resolved target.
  let realPath: string | null = null;
  try {
    realPath = await fs.realpath(resolved);
  } catch {
    // Path no longer exists — fall back to the resolved string only.
  }

  const config = await readConfig(configPath);
  config.projects = config.projects.filter(
    (p) => p.path !== resolved && (realPath === null || p.path !== realPath)
  );
  await writeConfig(configPath, config);
}

export async function getProjectByIndex(
  index: number
): Promise<Project | null> {
  const config = await readConfig(getConfigPath());
  return config.projects[index] ?? null;
}

/**
 * Parse a URL param as a non-negative integer project index.
 * Returns null for any input that is not a non-negative integer:
 * non-numeric strings, empty/whitespace, negative numbers, floats,
 * leading zeros, and strings with extra non-digit characters.
 *
 * Uses a strict regex — no parseInt ambiguity with leading zeros, leading
 * whitespace, or partial parses ("3abc" is NOT a valid index).
 */
export function parseProjectIndex(id: string): number | null {
  if (typeof id !== "string") return null;
  if (!/^(0|[1-9]\d*)$/.test(id)) return null;
  return parseInt(id, 10);
}
