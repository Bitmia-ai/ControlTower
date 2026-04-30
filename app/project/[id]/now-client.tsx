"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import Link from "next/link";
import type { ProjectDetail, InboxQuestion } from "@/lib/redeye-types";
import { normalizePhase, getPhaseLabel } from "@/lib/redeye-types";
import { useTaskTransitionTracker } from "@/lib/use-task-transition-tracker";
import { usePhaseNotifications } from "@/lib/use-phase-notifications";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { Icon } from "@/components/redesign/icon";
import { PhasePipeline } from "@/components/redesign/phase-pipeline";
import { AnswerModal } from "@/components/answer-modal";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { SteerDialog } from "@/components/steer-dialog";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { FetchError } from "@/components/fetch-error";
import { AddScheduleDialog } from "@/components/schedules/add-schedule-dialog";
import { formatRelativeTime } from "@/lib/format-relative-time";

interface ScheduleEntryLite {
  id: string;
  title: string;
  frequency: string;
  nextDueMs: number | null;
  isOverdue: boolean;
}

function formatNextRun(nextDueMs: number | null): string {
  if (!nextDueMs) return "—";
  const diff = nextDueMs - Date.now();
  if (diff < 0) return "Overdue";
  const min = Math.round(diff / 60_000);
  if (min < 60) return `in ${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `in ${hr}h`;
  const d = Math.round(hr / 24);
  return `in ${d}d`;
}

export default function NowClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [schedules, setSchedules] = useState<ScheduleEntryLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [answerOpen, setAnswerOpen] = useState(false);
  const [steerOpen, setSteerOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addScheduleOpen, setAddScheduleOpen] = useState(false);

  const detailRef = useRef(detail);
  useEffect(() => {
    detailRef.current = detail;
  }, [detail]);

  const fetchDetail = useCallback(async () => {
    try {
      setFetchError(null);
      const [dRes, sRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/schedules`),
      ]);
      if (!dRes.ok) throw new Error(`HTTP ${dRes.status}`);
      const dJson = await dRes.json();
      if (dJson.data) setDetail(dJson.data);
      if (sRes.ok) {
        const sJson = await sRes.json();
        setSchedules(sJson.data?.schedules ?? []);
      }
    } catch {
      if (!detailRef.current) {
        setFetchError("Failed to load project details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 5_000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  // Per-task cost-tracking — same fire-and-forget contract as the legacy
  // mission-control client.
  const activeId = detail ? detail.state?.task_id ?? null : undefined;
  const postCostStart = useCallback(
    (taskId: string) => {
      fetch(`/api/projects/${id}/cost-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      }).catch(() => {});
    },
    [id]
  );
  const postCostSnapshot = useCallback(
    (taskId: string) => {
      fetch(`/api/projects/${id}/cost-snapshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      }).catch(() => {});
    },
    [id]
  );
  useTaskTransitionTracker(activeId, postCostStart, postCostSnapshot);

  const phaseForNotifications = detail ? detail.state?.phase ?? null : undefined;
  const taskTitleForNotifications = detail?.state?.task_title ?? null;
  usePhaseNotifications(phaseForNotifications, taskTitleForNotifications, projectId);

  async function handleAction(action: "start" | "stop" | "pause") {
    try {
      await fetch(`/api/projects/${id}/${action}`, { method: "POST" });
      await fetchDetail();
    } catch {
      /* ignore */
    }
  }

  const running = detail?.project?.running ?? false;
  const stalled = detail?.project?.sessionStatus?.cto?.status === "stalled";
  void stalled;

  useKeyboardShortcuts({
    enabled: !answerOpen && !steerOpen && !addTaskOpen && !addScheduleOpen,
    running,
    projectId,
    onStart: () => handleAction("start"),
    onStop: () => handleAction("stop"),
    onPause: () => handleAction("pause"),
    onAddTask: () => setAddTaskOpen(true),
    navigate: (path) => {
      window.location.href = path;
    },
  });

  const pendingQuestions = (detail?.pendingQuestions ?? []).filter(
    (q) => !q.answered
  );
  const firstQuestion: InboxQuestion | null = pendingQuestions[0] ?? null;

  if (loading && !detail) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ padding: "96px 0", color: "var(--fg-3)", fontSize: 14 }}
      >
        Loading project…
      </div>
    );
  }
  if (fetchError && !detail) {
    return (
      <div style={{ padding: 28 }}>
        <FetchError message={fetchError} onRetry={fetchDetail} />
      </div>
    );
  }
  if (detail && !detail.project.initialized) {
    return (
      <div
        className="flex justify-center"
        style={{ padding: "32px 28px" }}
      >
        <OnboardingWizard
          projectId={projectId}
          projectName={detail.project.name}
          onComplete={fetchDetail}
          onCancel={fetchDetail}
        />
      </div>
    );
  }

  const phase = normalizePhase(detail?.state?.phase);
  const phaseLabel = getPhaseLabel(detail?.state?.phase);
  const taskId = detail?.state?.task_id ?? null;
  const taskTitle = detail?.state?.task_title ?? detail?.activeItem?.title ?? null;
  const upNextItem = detail?.upNext?.[0] ?? null;
  const upNextOpen = (detail?.upNext ?? []).filter(
    (i) => i.status === "pending" || i.status === "planned"
  ).length;
  const recent = detail?.recentlyShipped?.slice(0, 4) ?? [];
  const allDoneCount = detail?.allDoneItems?.length ?? 0;
  const blockers =
    detail?.state?.health?.blocked_items_count ?? 0;
  const lastDeploy = detail?.state?.health?.iterations_since_last_deploy;
  const sched = schedules[0] ?? null;

  return (
    <main
      className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-5 md:gap-5"
      style={{
        padding: "24px clamp(16px, 4vw, 28px) 40px",
        maxWidth: 1280,
        margin: "0 auto",
      }}
    >
      {/* LEFT COLUMN */}
      <div className="flex flex-col" style={{ gap: 20, minWidth: 0 }}>
        {/* Hero: Working on */}
        <div className="card-rd" style={{ padding: 24 }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 18 }}
          >
            <div className="flex items-center" style={{ gap: 10 }}>
              <span
                className={running ? "dot mint dot-pulse" : pendingQuestions.length > 0 ? "dot amber" : "dot"}
                aria-hidden
              />
              <span className="eyebrow">
                {running
                  ? "Working on"
                  : taskTitle
                    ? "Paused on"
                    : "No active task"}
              </span>
            </div>
            <span
              className={`chip ${running ? "mint" : pendingQuestions.length > 0 ? "amber" : ""}`}
            >
              <Icon name={running ? "bolt" : "pause"} size={10} />{" "}
              {phase || "IDLE"}
            </span>
          </div>
          {taskTitle ? (
            <div
              className="flex items-baseline"
              style={{ gap: 12, marginBottom: 18 }}
            >
              {taskId && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: 14,
                    color: "var(--mint)",
                    fontWeight: 500,
                  }}
                >
                  {taskId}
                </span>
              )}
              <h2
                style={{
                  margin: 0,
                  fontSize: 19,
                  fontWeight: 600,
                  color: "var(--fg-0)",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.3,
                }}
              >
                {taskTitle}
              </h2>
            </div>
          ) : (
            <div
              style={{
                fontSize: 14,
                color: "var(--fg-2)",
                marginBottom: 18,
              }}
            >
              No task is currently active. Click <strong>Add task</strong> on the
              right rail to queue work, or <strong>Start session</strong> to let
              the agent triage.
            </div>
          )}
          <PhasePipeline phase={phase} running={running} />
          {phaseLabel && (
            <div
              className="font-mono uppercase"
              style={{
                marginTop: 8,
                fontSize: 10,
                letterSpacing: "0.1em",
                color: "var(--fg-3)",
                textAlign: "right",
              }}
            >
              {phaseLabel}
            </div>
          )}
        </div>

        {/* Questions banner */}
        {pendingQuestions.length > 0 && (
          <div
            className="card-rd"
            style={{
              borderColor: "var(--amber-tint)",
              padding: "14px 18px",
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 14,
              alignItems: "center",
              background: "var(--amber-tint)",
            }}
          >
            <span style={{ color: "var(--amber)" }} aria-hidden>
              <Icon name="q" size={18} />
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--fg-0)",
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                {pendingQuestions.length} question{pendingQuestions.length === 1 ? "" : "s"} waiting
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-2)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {firstQuestion?.question ?? ""}
              </div>
            </div>
            <button
              type="button"
              className="btn sm primary"
              onClick={() => setAnswerOpen(true)}
            >
              Answer
            </button>
          </div>
        )}

        {/* Up next + Recently shipped */}
        <div
          className="grid grid-cols-1 md:grid-cols-[1fr_2fr]"
          style={{ gap: 16 }}
        >
          <div className="card-rd" style={{ padding: "14px 18px" }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>
              Up next
            </div>
            {upNextItem ? (
              <>
                <div
                  className="flex flex-col"
                  style={{ gap: 4 }}
                >
                  <span
                    className="font-mono"
                    style={{ fontSize: 11, color: "var(--fg-2)" }}
                  >
                    {upNextItem.id}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: "var(--fg-0)",
                      lineHeight: 1.4,
                    }}
                  >
                    {upNextItem.title}
                  </span>
                </div>
                <Link
                  href={`/project/${id}/tasks`}
                  className="btn sm ghost"
                  style={{
                    width: "100%",
                    marginTop: 12,
                    justifyContent: "space-between",
                    color: "var(--sky)",
                  }}
                >
                  View backlog ({upNextOpen}){" "}
                  <Icon name="chev" size={12} />
                </Link>
              </>
            ) : (
              <div style={{ fontSize: 13, color: "var(--fg-3)" }}>
                Backlog is empty.
              </div>
            )}
          </div>
          <div className="card-rd" style={{ padding: "14px 18px" }}>
            <div
              className="flex items-center justify-between"
              style={{ marginBottom: 10 }}
            >
              <div className="eyebrow">Recently shipped</div>
              <Link
                href={`/project/${id}/history`}
                style={{
                  fontSize: 11,
                  color: "var(--sky)",
                  textDecoration: "none",
                }}
              >
                View all
              </Link>
            </div>
            {recent.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--fg-3)" }}>
                Nothing shipped yet.
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 8 }}>
                {recent.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center"
                    style={{ gap: 10 }}
                  >
                    <span style={{ color: "var(--mint)", flex: "none" }}>
                      <Icon name="check" size={12} />
                    </span>
                    <span
                      className="font-mono"
                      style={{ fontSize: 11, color: "var(--fg-2)", flex: "none" }}
                    >
                      {r.id}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--fg-1)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.title}
                    </span>
                    {typeof r.cost_usd === "number" && (
                      <span
                        className="font-mono"
                        style={{ fontSize: 10, color: "var(--fg-3)" }}
                      >
                        ${r.cost_usd.toFixed(2)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Live transcript pointer */}
        <div className="card-rd">
          <div
            className="flex items-center justify-between"
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--line)",
            }}
          >
            <div className="flex items-center" style={{ gap: 10 }}>
              <span
                className={running ? "dot mint dot-pulse" : "dot"}
                aria-hidden
              />
              <div className="eyebrow">Live transcript</div>
              {running && (
                <span style={{ fontSize: 11, color: "var(--fg-3)" }}>
                  {phase ? `phase ${phase.toLowerCase()}` : "—"}
                </span>
              )}
            </div>
            <Link
              href={`/project/${id}/live`}
              className="btn sm ghost"
              style={{ color: "var(--sky)" }}
            >
              Open full <Icon name="arrow" size={12} />
            </Link>
          </div>
          <div
            style={{
              padding: "16px 18px",
              fontSize: 12,
              color: "var(--fg-2)",
            }}
          >
            {running
              ? "Stream is open. Click Open full for the live tail."
              : "Session is idle. Streaming resumes on the next start."}
          </div>
        </div>
      </div>

      {/* RIGHT RAIL */}
      <div className="flex flex-col" style={{ gap: 16 }}>
        {/* Controls */}
        <div className="card-rd" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Controls
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: "1fr 1fr", gap: 6 }}
          >
            {running ? (
              <button
                type="button"
                className="btn rose-outline"
                style={{ gridColumn: "1 / -1" }}
                onClick={() => handleAction("stop")}
              >
                <Icon name="stop" size={14} /> Stop session
              </button>
            ) : (
              <button
                type="button"
                className="btn mint"
                style={{ gridColumn: "1 / -1" }}
                onClick={() => handleAction("start")}
              >
                <Icon name="play" size={14} /> Start session
              </button>
            )}
            <button
              type="button"
              className="btn sm"
              disabled={!running}
              style={{ opacity: running ? 1 : 0.5 }}
              onClick={() => handleAction("pause")}
            >
              <Icon name="pause" size={12} /> Pause
            </button>
            <button
              type="button"
              className="btn sm"
              onClick={() => setSteerOpen(true)}
            >
              <Icon name="steer" size={12} /> Steer
            </button>
            <button
              type="button"
              className="btn sm"
              style={{ gridColumn: "1 / -1" }}
              onClick={() => setAddTaskOpen(true)}
            >
              <Icon name="plus" size={12} /> Add task
            </button>
          </div>
          <div
            className="flex justify-between"
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--line)",
              fontSize: 10,
              color: "var(--fg-3)",
            }}
          >
            <span>Shortcuts</span>
            <span className="flex" style={{ gap: 4 }}>
              <span className="kbd">S</span>
              <span className="kbd">P</span>
              <span className="kbd">B</span>
            </span>
          </div>
        </div>

        {/* Schedule */}
        <ScheduleCard
          schedule={sched}
          extraCount={Math.max(0, schedules.length - 1)}
          onAddOrManage={() => setAddScheduleOpen(true)}
          projectId={id}
        />

        {/* Health */}
        <div className="card-rd" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 10 }}>
            Health
          </div>
          <div
            className="flex items-center"
            style={{ gap: 8, marginBottom: 12 }}
          >
            <span
              className={blockers > 0 ? "dot rose" : "dot mint"}
              aria-hidden
            />
            <span
              style={{
                fontSize: 14,
                color: blockers > 0 ? "var(--rose)" : "var(--mint)",
                fontWeight: 600,
              }}
            >
              {blockers > 0 ? "Blocked" : "Healthy"}
            </span>
          </div>
          <div
            className="flex flex-col"
            style={{ gap: 6, fontSize: 12, color: "var(--fg-2)" }}
          >
            <Row label="Shipped" value={String(allDoneCount)} mono />
            <Row label="Backlog" value={String(upNextOpen)} mono />
            <Row
              label="Blockers"
              value={String(blockers)}
              mono
              valueColor={blockers > 0 ? "var(--rose)" : "var(--mint)"}
            />
            {typeof lastDeploy === "number" && (
              <Row
                label="Iters since deploy"
                value={String(lastDeploy)}
                mono
              />
            )}
          </div>
        </div>
      </div>

      {firstQuestion && (
        <AnswerModal
          question={firstQuestion}
          projectId={projectId}
          open={answerOpen}
          onOpenChange={setAnswerOpen}
          onAnswered={fetchDetail}
        />
      )}
      <SteerDialog
        projectId={projectId}
        open={steerOpen}
        onOpenChange={setSteerOpen}
        onSteered={fetchDetail}
      />
      <AddTaskDialog
        projectId={projectId}
        open={addTaskOpen}
        onOpenChange={setAddTaskOpen}
        onAdded={fetchDetail}
      />
      <AddScheduleDialog
        projectId={projectId}
        open={addScheduleOpen}
        onOpenChange={setAddScheduleOpen}
        onAdded={fetchDetail}
      />
    </main>
  );
}

function Row({
  label,
  value,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span
        className={mono ? "font-mono" : undefined}
        style={{ color: valueColor ?? "var(--fg-1)" }}
      >
        {value}
      </span>
    </div>
  );
}

function ScheduleCard({
  schedule,
  extraCount,
  onAddOrManage,
  projectId,
}: {
  schedule: ScheduleEntryLite | null;
  extraCount: number;
  onAddOrManage: () => void;
  projectId: string;
}) {
  if (!schedule) {
    return (
      <div
        className="card-rd"
        style={{
          padding: 14,
          borderStyle: "dashed",
        }}
      >
        <div
          className="flex items-center justify-between"
          style={{ marginBottom: 8 }}
        >
          <div className="eyebrow">Schedule</div>
          <span
            className="chip"
            style={{
              background: "transparent",
              border: "1px solid var(--line)",
              color: "var(--fg-3)",
            }}
          >
            Off
          </span>
        </div>
        <div
          style={{
            fontSize: 12,
            color: "var(--fg-2)",
            marginBottom: 12,
            lineHeight: 1.5,
          }}
        >
          Run sessions automatically on a cadence. Useful for projects you want
          to nudge forward without checking in.
        </div>
        <button
          type="button"
          className="btn sm full"
          onClick={onAddOrManage}
        >
          <Icon name="plus" size={12} /> Add schedule
        </button>
      </div>
    );
  }

  const next = formatNextRun(schedule.nextDueMs);

  return (
    <div className="card-rd" style={{ padding: 14 }}>
      <div
        className="flex items-center justify-between"
        style={{ marginBottom: 12 }}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <span style={{ color: "var(--red)" }} aria-hidden>
            <Icon name="schedule" size={13} />
          </span>
          <div className="eyebrow">
            {extraCount > 0 ? `Schedules · ${1 + extraCount}` : "Schedule"}
          </div>
        </div>
        <button
          type="button"
          className="btn ghost icon-only sm"
          onClick={onAddOrManage}
          title="Add schedule"
          aria-label="Add schedule"
        >
          <Icon name="plus" size={12} />
        </button>
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "var(--fg-0)",
          marginBottom: 2,
        }}
      >
        {schedule.title || schedule.id}
      </div>
      <div
        className="font-mono"
        style={{
          fontSize: 11,
          color: "var(--fg-3)",
          marginBottom: 12,
        }}
      >
        {schedule.frequency}
      </div>
      <div
        className="flex flex-col"
        style={{
          gap: 8,
          fontSize: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--line)",
        }}
      >
        <div className="flex items-center justify-between">
          <span style={{ color: "var(--fg-3)" }}>Next run</span>
          <span
            style={{
              color: schedule.isOverdue ? "var(--amber)" : "var(--red)",
              fontWeight: 500,
            }}
          >
            {next}
          </span>
        </div>
      </div>
      <Link
        href={`/project/${projectId}/schedules`}
        className="btn sm full"
        style={{ marginTop: 12 }}
      >
        <Icon name="settings" size={11} /> Manage
      </Link>
    </div>
  );
}

// Re-export the formatRelativeTime helper to avoid an unused-import warning if
// we later decide to drop the local formatNextRun in favor of it. Currently
// kept side-by-side because formatNextRun reads as "in 1h" rather than
// "1 hour ago" which doesn't fit a future-time stat.
void formatRelativeTime;
