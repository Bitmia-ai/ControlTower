"use client";

// Opt out of static prerendering — all data is fetched client-side anyway.
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState, useCallback } from "react";
import type { ProjectWithStatus, InboxQuestion } from "@/lib/redeye-types";
import { Icon } from "@/components/redesign/icon";
import { FleetSummary } from "@/components/redesign/fleet-summary";
import { InboxCard, type FleetInboxQuestion } from "@/components/redesign/inbox-card";
import { ProjectCardNew } from "@/components/redesign/project-card-new";
import { AddProjectDialog } from "@/components/add-project-dialog";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { SteerDialog } from "@/components/steer-dialog";
import { AnswerModal } from "@/components/answer-modal";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";
import { HomeOnboardingWizard } from "@/components/home-onboarding-wizard";
import { InstallBanner } from "@/components/install-banner";

const ONBOARDING_DISMISS_KEY = "ct_onboarding_dismissed";
const POLL_INTERVAL_MS = 10_000;

interface FleetInboxApi {
  uid: string;
  projectIndex: number;
  projectName: string;
  projectPath: string;
  question: InboxQuestion;
}

type FilterMode = "all" | "running" | "idle";

function todayHeading(now = new Date()): string {
  return now.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function HomeClient() {
  const [projects, setProjects] = useState<ProjectWithStatus[]>([]);
  const [inbox, setInbox] = useState<FleetInboxApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [filter, setFilter] = useState<FilterMode>("all");

  // Modal state — keyed by project index where applicable.
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [addTaskFor, setAddTaskFor] = useState<number | null>(null);
  const [steerFor, setSteerFor] = useState<number | null>(null);
  const [answerOpen, setAnswerOpen] = useState<FleetInboxApi | null>(null);

  // SSR-safe: read localStorage only after mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.localStorage.getItem(ONBOARDING_DISMISS_KEY) === "true") {
        setOnboardingDismissed(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Track project count via ref so the polling callback identity stays stable.
  const projectsCountRef = useRef(projects.length);
  useEffect(() => {
    projectsCountRef.current = projects.length;
  }, [projects.length]);

  const refresh = useCallback(async () => {
    try {
      setFetchError(null);
      const [pRes, iRes] = await Promise.all([
        fetch("/api/projects"),
        fetch("/api/inbox"),
      ]);
      if (!pRes.ok) throw new Error(`HTTP ${pRes.status}`);
      const pJson = await pRes.json();
      if (pJson.data) setProjects(pJson.data as ProjectWithStatus[]);
      if (iRes.ok) {
        const iJson = await iRes.json();
        if (iJson.data) setInbox(iJson.data as FleetInboxApi[]);
      }
    } catch {
      // Only show error on initial load, not during polling.
      if (projectsCountRef.current === 0) {
        setFetchError("Failed to load projects. Check that the server is running.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(refresh, POLL_INTERVAL_MS);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        refresh();
        start();
      }
    };

    refresh();
    if (document.visibilityState !== "hidden") start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  async function handleToggle(index: number) {
    const project = projects[index];
    if (!project) return;
    const action = project.running ? "stop" : "start";
    try {
      await fetch(`/api/projects/${index}/${action}`, { method: "POST" });
      await refresh();
    } catch {
      /* ignore — next poll will reconcile */
    }
  }

  const visibleProjects = projects.filter((p) => {
    if (filter === "running") return p.running;
    if (filter === "idle") return !p.running;
    return true;
  });

  const fleetInbox: FleetInboxQuestion[] = inbox.map((row) => ({
    id: row.uid,
    projectIndex: row.projectIndex,
    projectName: row.projectName,
    taskId: null,
    title: row.question.question,
    context: row.question.context ?? null,
    ageLabel: null,
  }));

  const runningCount = projects.filter((p) => p.running).length;
  const needsInputCount = projects.filter((p) => (p.questionCount ?? 0) > 0).length;
  const scheduledCount = projects.filter((p) => p.scheduleEnabled).length;
  const headerSummary =
    projects.length === 0
      ? "Welcome"
      : `${projects.length} project${projects.length === 1 ? "" : "s"}${
          needsInputCount > 0
            ? ` · ${needsInputCount} need${needsInputCount === 1 ? "s" : ""} you`
            : ""
        }`;
  const headerSubline = (() => {
    if (projects.length === 0) return "Add your first project to get started.";
    const parts: string[] = [];
    if (runningCount > 0) {
      parts.push(`${runningCount} session${runningCount === 1 ? "" : "s"} running`);
    } else {
      parts.push("No sessions running");
    }
    if (scheduledCount > 0) {
      parts.push(`${scheduledCount} scheduled`);
    }
    return parts.join(" · ");
  })();

  return (
    <>
      <InstallBanner />
      <main
        style={{
          padding: "28px 28px 60px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        {/* Page header */}
        <div
          className="flex items-end justify-between"
          style={{ marginBottom: 20, gap: 16 }}
        >
          <div className="min-w-0">
            <div className="eyebrow" style={{ marginBottom: 4 }}>
              {todayHeading()}
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 28,
                fontWeight: 600,
                color: "var(--fg-0)",
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
              }}
            >
              {headerSummary}
            </h1>
            <p style={{ margin: "4px 0 0", fontSize: 14, color: "var(--fg-2)" }}>
              {headerSubline}
            </p>
          </div>
          <div className="flex" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn primary"
              onClick={() => setAddProjectOpen(true)}
            >
              <Icon name="plus" size={14} /> Add project
            </button>
          </div>
        </div>

        {loading ? (
          <div
            className="flex items-center justify-center"
            style={{ padding: "96px 0", color: "var(--fg-3)", fontSize: 14 }}
          >
            Loading projects…
          </div>
        ) : fetchError ? (
          <FetchError message={fetchError} onRetry={refresh} />
        ) : projects.length === 0 ? (
          !onboardingDismissed ? (
            <HomeOnboardingWizard
              onProjectAdded={refresh}
              onDismiss={() => {
                setOnboardingDismissed(true);
                try {
                  window.localStorage.setItem(ONBOARDING_DISMISS_KEY, "true");
                } catch {
                  /* ignore */
                }
              }}
            />
          ) : (
            <EmptyState
              icon={<Icon name="folder" size={20} />}
              title="Welcome to Control Tower"
              subtitle={
                <span>
                  Add your first project — point it at a git repo that has{" "}
                  <a
                    href="https://github.com/Bitmia-ai/RedEye"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--red)" }}
                  >
                    RedEye
                  </a>{" "}
                  installed, or run{" "}
                  <code className="kbd">/redeye:init</code> in Claude Code. See
                  the{" "}
                  <a
                    href="https://github.com/Bitmia-ai/ControlTower#quick-start"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--red)" }}
                  >
                    Quick Start
                  </a>{" "}
                  for setup steps.
                </span>
              }
              action={{
                label: "Add your first project",
                onClick: () => setAddProjectOpen(true),
              }}
            />
          )
        ) : (
          <>
            {/* Fleet summary */}
            <div style={{ marginBottom: 20 }}>
              <FleetSummary
                projects={projects}
                scheduledCount={scheduledCount}
                scheduledNext={null}
                shipped7d={null}
              />
            </div>

            {/* Inbox */}
            {fleetInbox.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <InboxCard
                  questions={fleetInbox}
                  onAnswer={(q) => {
                    const row = inbox.find((r) => r.uid === q.id);
                    if (row) setAnswerOpen(row);
                  }}
                />
              </div>
            )}

            {/* Project list header */}
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 12 }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "var(--fg-0)",
                  fontWeight: 600,
                }}
              >
                Projects
              </h2>
              <div className="flex" style={{ gap: 6 }}>
                {(["all", "running", "idle"] as FilterMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    className="btn sm ghost"
                    style={{
                      color:
                        filter === mode ? "var(--fg-0)" : "var(--fg-2)",
                      fontWeight: filter === mode ? 600 : 500,
                    }}
                    onClick={() => setFilter(mode)}
                    aria-pressed={filter === mode}
                  >
                    {mode === "all"
                      ? "All"
                      : mode === "running"
                        ? "Running"
                        : "Idle"}
                  </button>
                ))}
              </div>
            </div>

            {visibleProjects.length === 0 ? (
              <div
                style={{
                  padding: "40px 20px",
                  fontSize: 13,
                  color: "var(--fg-3)",
                  textAlign: "center",
                  borderRadius: "var(--radius)",
                  border: "1px dashed var(--line)",
                }}
              >
                No {filter} projects.
              </div>
            ) : (
              <div
                className="grid"
                style={{
                  gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                  gap: 14,
                }}
              >
                {visibleProjects.map((p) => {
                  const realIndex = projects.indexOf(p);
                  return (
                    <ProjectCardNew
                      key={`${p.name}-${realIndex}`}
                      project={p}
                      index={realIndex}
                      onToggle={handleToggle}
                      onAddTask={(idx) => setAddTaskFor(idx)}
                      onSteer={(idx) => setSteerFor(idx)}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}

        <AddProjectDialog
          open={addProjectOpen}
          onOpenChange={setAddProjectOpen}
          onAdded={refresh}
        />
        {addTaskFor !== null && (
          <AddTaskDialog
            projectId={addTaskFor}
            open={addTaskFor !== null}
            onOpenChange={(open) => {
              if (!open) setAddTaskFor(null);
            }}
            onAdded={refresh}
          />
        )}
        {steerFor !== null && (
          <SteerDialog
            projectId={steerFor}
            open={steerFor !== null}
            onOpenChange={(open) => {
              if (!open) setSteerFor(null);
            }}
            onSteered={refresh}
          />
        )}
        {answerOpen && (
          <AnswerModal
            question={answerOpen.question}
            projectId={answerOpen.projectIndex}
            open={true}
            onOpenChange={(open) => {
              if (!open) setAnswerOpen(null);
            }}
            onAnswered={refresh}
          />
        )}
      </main>
    </>
  );
}
