"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import type { ProjectDetail, InboxQuestion } from "@/lib/redeye-types";
import { useTaskTransitionTracker } from "@/lib/use-task-transition-tracker";
import { WorkingOnCard } from "@/components/mission-control/working-on-card";
import { HealthCard } from "@/components/mission-control/health-card";
import { QuestionsCard } from "@/components/mission-control/questions-card";
import { UpNextCard } from "@/components/mission-control/up-next-card";
import { ShippedCard } from "@/components/mission-control/shipped-card";
import { ControlsCard } from "@/components/mission-control/controls-card";
import { CostCard } from "@/components/mission-control/cost-card";
import { AnswerModal } from "@/components/answer-modal";
import { AddBacklogDialog } from "@/components/add-backlog-dialog";
import { SteerDialog } from "@/components/steer-dialog";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { FetchError } from "@/components/fetch-error";

export default function ProjectPage({
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
  const [backlogOpen, setBacklogOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    try {
      setFetchError(null);
      const res = await fetch(`/api/projects/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.data) setDetail(json.data);
    } catch {
      if (!detail) {
        setFetchError("Failed to load project details.");
      }
    } finally {
      setLoading(false);
    }
  }, [id, detail]);

  useEffect(() => {
    fetchDetail();
    const interval = setInterval(fetchDetail, 5_000);
    return () => clearInterval(interval);
  }, [fetchDetail]);

  // BL-046: record per-task cost baseline on task start, delta on task end.
  // Both POSTs are fire-and-forget — they must not block the UI. Server-side
  // idempotency (cost-start AD-7 guard) prevents duplicate baselines.
  const activeId = detail ? (detail.state?.backlog_item ?? null) : undefined;
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
  const pendingQuestions = (detail?.pendingQuestions ?? []).filter(
    (q) => !q.answered
  );
  const hasPendingQuestions = pendingQuestions.length > 0;
  const firstQuestion: InboxQuestion | null = pendingQuestions[0] ?? null;

  return (
    <main className="px-4 sm:px-6 pb-8 max-w-6xl mx-auto">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WorkingOnCard state={detail?.state ?? null} running={running} projectId={projectId} upNextCount={detail?.upNext?.length ?? 0} />
          <HealthCard
            state={detail?.state ?? null}
            recentlyShippedCount={detail?.recentlyShipped?.length ?? 0}
          />

          <div className="md:col-span-2">
            <CostCard projectId={projectId} running={running} />
          </div>

          <div className={hasPendingQuestions ? "md:col-span-2" : ""}>
            <QuestionsCard
              questions={detail?.pendingQuestions ?? []}
              onAnswer={() => setAnswerOpen(true)}
            />
          </div>

          <UpNextCard items={detail?.upNext ?? []} projectId={projectId} />

          <ShippedCard
            items={detail?.recentlyShipped ?? []}
            changelog={detail?.recentChangelog ?? []}
            projectId={projectId}
          />

          <ControlsCard
            running={running}
            stalled={stalled}
            onStart={() => handleAction("start")}
            onStop={() => handleAction("stop")}
            onPause={() => handleAction("pause")}
            onSteer={() => setSteerOpen(true)}
            onAddBacklog={() => setBacklogOpen(true)}
            onRestart={handleRestart}
            onForceStop={handleForceStop}
          />
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

      <AddBacklogDialog
        projectId={projectId}
        open={backlogOpen}
        onOpenChange={setBacklogOpen}
        onAdded={fetchDetail}
      />
    </main>
  );
}
