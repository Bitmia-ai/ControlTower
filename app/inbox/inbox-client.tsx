"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useCallback } from "react";
import type { InboxQuestion } from "@/lib/redeye-types";
import { Icon } from "@/components/redesign/icon";
import { InboxCard, type FleetInboxQuestion } from "@/components/redesign/inbox-card";
import { AnswerModal } from "@/components/answer-modal";
import { EmptyState } from "@/components/empty-state";
import { FetchError } from "@/components/fetch-error";

interface FleetInboxApi {
  uid: string;
  projectIndex: number;
  projectName: string;
  projectPath: string;
  question: InboxQuestion;
}

const POLL_INTERVAL_MS = 10_000;

export default function InboxClient() {
  const [rows, setRows] = useState<FleetInboxApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [answerOpen, setAnswerOpen] = useState<FleetInboxApi | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/inbox");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setRows((json.data as FleetInboxApi[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const fleetQuestions: FleetInboxQuestion[] = rows.map((r) => ({
    id: r.uid,
    projectIndex: r.projectIndex,
    projectName: r.projectName,
    taskId: null,
    title: r.question.question,
    context: r.question.context ?? null,
    ageLabel: null,
  }));

  return (
    <main
      style={{
        padding: "28px 28px 60px",
        maxWidth: 880,
        margin: "0 auto",
      }}
    >
      <div
        className="flex items-end justify-between"
        style={{ marginBottom: 20, gap: 16 }}
      >
        <div className="min-w-0">
          <div className="eyebrow" style={{ marginBottom: 4 }}>
            Fleet
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
            Inbox
          </h1>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 14,
              color: "var(--fg-2)",
            }}
          >
            Every open question across every project.
          </p>
        </div>
      </div>

      {loading ? (
        <div
          className="flex items-center justify-center"
          style={{ padding: "96px 0", color: "var(--fg-3)", fontSize: 14 }}
        >
          Loading…
        </div>
      ) : error ? (
        <FetchError message={error} onRetry={refresh} />
      ) : fleetQuestions.length === 0 ? (
        <EmptyState
          icon={<Icon name="inbox" size={20} />}
          title="Inbox zero"
          subtitle={
            <span>
              No open questions right now. When the agent needs your input,
              it&apos;ll show up here.
            </span>
          }
        />
      ) : (
        <InboxCard
          questions={fleetQuestions}
          onAnswer={(q) => {
            const row = rows.find((r) => r.uid === q.id);
            if (row) setAnswerOpen(row);
          }}
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
  );
}
