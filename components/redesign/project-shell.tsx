"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { Icon, type IconName } from "./icon";

interface ProjectShellInfo {
  name: string;
  path: string | null;
  running: boolean;
  questionCount: number;
  backlogCount: number;
  scheduleEnabled: boolean;
}

interface TabDef {
  key: "now" | "tasks" | "history";
  href: (id: string) => string;
  label: string;
  icon: IconName;
  badge?: number;
}

function buildTabs(id: string, info: ProjectShellInfo | null): TabDef[] {
  return [
    { key: "now", href: () => `/project/${id}`, label: "Now", icon: "bolt" },
    {
      key: "tasks",
      href: () => `/project/${id}/tasks`,
      label: "Tasks",
      icon: "tasks",
      badge: info?.backlogCount ?? 0,
    },
    {
      key: "history",
      href: () => `/project/${id}/history`,
      label: "History",
      icon: "history",
    },
  ];
}

export function ProjectShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const pathname = usePathname();
  const router = useRouter();
  const [info, setInfo] = useState<ProjectShellInfo | null>(null);

  const fetchInfo = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) return;
      const json = await res.json();
      const project = json.data?.project;
      if (!project) return;
      const upNext: Array<{ status: string }> = json.data?.upNext ?? [];
      const allDone: Array<unknown> = json.data?.allDoneItems ?? [];
      void allDone;
      setInfo({
        name: project.name ?? "Project",
        path: project.path ?? null,
        running: Boolean(project.running),
        questionCount: (json.data?.pendingQuestions ?? []).filter(
          (q: { answered?: boolean }) => !q.answered
        ).length,
        backlogCount: upNext.filter(
          (i) => i.status === "pending" || i.status === "planned"
        ).length,
        scheduleEnabled: false,
      });
    } catch {
      /* polling errors swallowed */
    }
  }, [id]);

  useEffect(() => {
    fetchInfo();
    const t = setInterval(fetchInfo, 5_000);
    return () => clearInterval(t);
  }, [fetchInfo]);

  const tabs = buildTabs(id, info);
  const activeTab: TabDef["key"] = pathname?.endsWith("/tasks")
    ? "tasks"
    : pathname?.endsWith("/history")
      ? "history"
      : "now";

  // Fall back to a neutral title until the fetch returns so the bar height
  // is stable on first paint.
  const name = info?.name ?? "Project";
  const path = info?.path ?? "";
  const running = info?.running ?? false;
  const needsInput = (info?.questionCount ?? 0) > 0;

  return (
    <div className="flex flex-col" style={{ flex: 1 }}>
      {/* Project bar */}
      <div
        style={{
          padding: "16px 28px 0",
          borderBottom: "1px solid var(--line)",
          background: "var(--bg-0)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/")}
          className="btn ghost sm"
          style={{ marginBottom: 10, marginLeft: -8, color: "var(--fg-2)" }}
        >
          <Icon name="arrowLeft" size={12} /> All projects
        </button>
        <div
          className="flex items-center justify-between"
          style={{ gap: 16, marginBottom: 14 }}
        >
          <div className="flex items-center min-w-0" style={{ gap: 12 }}>
            <span
              className={
                running
                  ? "dot mint dot-pulse"
                  : needsInput
                    ? "dot amber"
                    : "dot"
              }
              style={{ width: 12, height: 12 }}
              aria-hidden
            />
            <h1
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 600,
                color: "var(--fg-0)",
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </h1>
            {path && (
              <span
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: "var(--fg-3)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  minWidth: 0,
                }}
              >
                {path}
              </span>
            )}
          </div>
        </div>
        <div className="flex" style={{ gap: 4 }}>
          {tabs.map((t) => {
            const isActive = activeTab === t.key;
            return (
              <Link
                key={t.key}
                href={t.href(id)}
                className="inline-flex items-center"
                style={{
                  gap: 8,
                  height: 38,
                  padding: "0 14px",
                  borderBottom: isActive
                    ? "2px solid var(--mint)"
                    : "2px solid transparent",
                  color: isActive ? "var(--fg-0)" : "var(--fg-2)",
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  marginBottom: -1,
                  textDecoration: "none",
                }}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon name={t.icon} size={14} />
                {t.label}
                {t.badge !== undefined && t.badge > 0 && (
                  <span
                    className="chip"
                    style={{
                      height: 18,
                      fontSize: 10,
                      padding: "0 6px",
                      background: "var(--bg-3)",
                    }}
                  >
                    {t.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
