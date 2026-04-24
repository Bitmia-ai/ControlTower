import { Project } from "./redeye-types";
import fs from "fs/promises";
import path from "path";

export function getConfigPath(): string {
  return (
    process.env.REDEYE_CONFIG_PATH ||
    path.join(process.env.HOME || "~", ".redeye", "config.json")
  );
}

interface Config {
  projects: Project[];
}

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
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function listProjects(): Promise<Project[]> {
  const config = await readConfig(getConfigPath());
  return config.projects;
}

export async function addProject(
  name: string,
  projectPath: string
): Promise<void> {
  const configPath = getConfigPath();

  const resolved = path.resolve(projectPath);
  await fs.access(resolved);
  const realPath = await fs.realpath(resolved);

  const config = await readConfig(configPath);

  if (config.projects.some((p) => p.path === realPath)) {
    return;
  }

  config.projects.push({ name, path: realPath });
  await writeConfig(configPath, config);
}

export async function removeProject(projectPath: string): Promise<void> {
  const configPath = getConfigPath();
  const resolved = path.resolve(projectPath);

  const config = await readConfig(configPath);
  config.projects = config.projects.filter((p) => p.path !== resolved);
  await writeConfig(configPath, config);
}

export async function getProjectByIndex(
  index: number
): Promise<Project | null> {
  const config = await readConfig(getConfigPath());
  return config.projects[index] ?? null;
}
