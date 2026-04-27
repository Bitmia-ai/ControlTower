"use client";

import { useEffect, useRef, useState, useCallback, use } from "react";
import Link from "next/link";
import type { ProjectDetail, InboxQuestion } from "@/lib/redeye-types";
import { useTaskTransitionTracker } from "@/lib/use-task-transition-tracker";
import { usePhaseNotifications } from "@/lib/use-phase-notifications";
import { useKeyboardShortcuts } from "@/lib/use-keyboard-shortcuts";
import { WorkingOnCard } from "@/components/mission-control/working-on-card";
import { HealthCard } from "@/components/mission-control/health-card";
import { QuestionsCard } from "@/components/mission-control/questions-card";
import { UpNextCard } from "@/components/mission-control/up-next-card";
import { ShippedCard } from "@/components/mission-control/shipped-card";
import { ControlsCard } from "@/components/mission-control/controls-card";
import { CostCard } from "@/components/mission-control/cost-card";
import { AnswerModal } from "@/components/answer-modal";
import { AddTaskDialog } from "@/components/add-task-dialog";
import { SteerDialog } from "@/components/steer-dialog";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { FetchError } from "@/components/fetch-error";

export default function MissionControlClient({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const projectId = parseInt(id, 10);

  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Dialog state
  const [answerOpen, setAnswerOpen] = useState(false);
  const [steerOpen, setSteerOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);

  // Hold the latest detail in a ref so the fetch callback's identity is
  // stable across renders. Otherwise the polling interval re-creates after
  // every successful fetch (callback identity changes when `detail` updates),
  // leaving small uncovered windows in the timer schedule.
  const detailRef = useRef(detail);
  useEffect(() => { detailRef.current = detail; }, [detail]);

  const fetchDetail = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setDetail(json.data);
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

  // T046: record per-task cost baseline on task start, delta on task end.
  // Both POSTs are fire-and-forget — they must not block the UI. Server-side
  // idempotency (cost-start AD-7 guard) prevents duplicate baselines.
  const activeId = detail ? (detail.state?.task_id ?? null) : undefined;
  const postCostStart = useCallback((blId: string) => {
    fetch(`/api/projects/${id}/cost-start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blId }),
    }).catch(console.error);
  }, [id]);
  const postCostSnapshot = useCallback((blId: string) => {
    fetch(`/api/projects/${id}/cost-snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blId }),
    }).catch(console.error);
  }, [id]);
  useTaskTransitionTracker(activeId, postCostStart, postCostSnapshot);

  // T050: in-app + native notifications when RedEye phase transitions.
  // Hook is no-op until a real transition is observed (skips first mount).
  const phaseForNotifications = detail ? (detail.state?.phase ?? null) : undefined;
  const taskTitleForNotifications = detail?.state?.task_title ?? null;
  usePhaseNotifications(phaseForNotifications, taskTitleForNotifications, projectId);

  async function handleAction(action: "start" | "stop" | "pause") {
    try {
      await fetch(`/api/projects/${id}/${action}`, { method: "POST" });
      await fetchDetail();
    } catch {
      // ignore
    }
  }

  async function handleForceStop() {
    try {
      await fetch(`/api/projects/${id}/force-stop`, { method: "POST" });
      await fetchDetail();
    } catch {
      // ignore
    }
  }

  async function handleRestart() {
    try {
      const res = await fetch(`/api/projects/${id}/restart`, { method: "POST" });
      if (!res.ok) {
        console.error(`[handleRestart] restart request failed: HTTP ${res.status}`);
      }
      await fetchDetail();
    } catch (err) {
      console.error("[handleRestart] fetch error:", err);
    }
  }

  const running = detail?.project?.running ?? false;
  const stalled =
    detail?.project?.sessionStatus?.cto?.status === "stalled";

  // T052: global keyboard shortcuts for mission-control actions.
  // Disabled while any dialog is open to avoid double-handling key events.
  useKeyboardShortcuts({
    enabled: !answerOpen && !steerOpen && !addTaskOpen,
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

  return (
    <main className="px-4 sm:px-6 pb-12 max-w-6xl mx-auto">
      {loading && !detail ? (
        <div className="flex items-center justify-center py-24 text-gray-500 dark:text-zinc-600 text-sm">
          Loading project…
        </div>
      ) : fetchError && !detail ? (
        <FetchError message={fetchError} onRetry={fetchDetail} />
      ) : detail && !detail.project.initialized ? (
        <div className="flex justify-center py-8">
          <OnboardingWizard
            projectId={projectId}
            projectName={detail.project.name}
            onComplete={fetchDetail}
            onCancel={fetchDetail}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 lg:items-start">
          {/*
            T067: Asymmetric two-column command layout.
            Left column = mission feed (WorkingOn hero, Questions, Shipped+UpNext).
            Right rail = control panel (Controls, Cost, Health) — fixed 300px.
          */}
          <div className="flex flex-col gap-4 min-w-0">
            <WorkingOnCard
              state={detail?.state ?? null}
              running={running}
              projectId={projectId}
              upNextCount={detail?.upNext?.length ?? 0}
              openQuestionCount={pendingQuestions.length}
              activeTaskTitle={detail?.activeItem?.title ?? null}
            />

            <QuestionsCard
              questions={detail?.pendingQuestions ?? []}
              onAnswer={() => setAnswerOpen(true)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-4">
              <ShippedCard
                items={detail?.recentlyShipped ?? []}
                changelog={detail?.recentChangelog ?? []}
                projectId={projectId}
              />
              <UpNextCard items={detail?.upNext ?? []} projectId={projectId} />
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <ControlsCard
              running={running}
              stalled={stalled}
              onStart={() => handleAction("start")}
              onStop={() => handleAction("stop")}
              onPause={() => handleAction("pause")}
              onSteer={() => setSteerOpen(true)}
              onAddTask={() => setAddTaskOpen(true)}
              onRestart={handleRestart}
              onForceStop={handleForceStop}
            />

            <CostCard projectId={projectId} running={running} />

            <HealthCard
              state={detail?.state ?? null}
              recentlyShippedCount={detail?.recentlyShipped?.length ?? 0}
            />
          </div>
        </div>
      )}

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
    </main>
  );
}
