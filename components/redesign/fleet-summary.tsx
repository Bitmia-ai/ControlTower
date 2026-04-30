"use client";

import type { ReactNode } from "react";
import type { ProjectWithStatus } from "@/lib/redeye-types";

interface StatProps {
  label: string;
  value: ReactNode;
  accent?: string;
  sub?: ReactNode;
}

function Stat({ label, value, accent, sub }: StatProps) {
  return (
    <div className="flex-1" style={{ padding: "16px 20px" }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: 24,
          fontWeight: 600,
          color: accent ?? "var(--fg-0)",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}

function Divider() {
  // Horizontal hairline on stacked mobile, vertical hairline on desktop.
  return (
    <div
      className="h-px w-full md:w-px md:h-auto"
      style={{ background: "var(--line)" }}
      aria-hidden
    />
  );
}

interface FleetSummaryProps {
  projects: ProjectWithStatus[];
  scheduledCount?: number;
  scheduledNext?: string | null;
  shipped7d?: number | null;
}

export function FleetSummary({
  projects,
  scheduledCount = 0,
  scheduledNext = null,
  shipped7d = null,
}: FleetSummaryProps) {
  const running = projects.filter((p) => p.running).length;
  const needsInput = projects.filter((p) => (p.questionCount ?? 0) > 0).length;

  return (
    <div className="card-rd flex flex-col md:flex-row items-stretch">
      <Stat
        label="Running"
        value={
          <span className="inline-flex items-center" style={{ gap: 8 }}>
            <span className="dot mint dot-pulse" />
            {running}
          </span>
        }
        sub={`of ${projects.length} project${projects.length === 1 ? "" : "s"}`}
      />
      <Divider />
      <Stat
        label="Needs input"
        value={needsInput}
        accent={needsInput > 0 ? "var(--amber)" : undefined}
        sub={needsInput > 0 ? "Open questions" : "All clear"}
      />
      <Divider />
      <Stat
        label="Scheduled"
        value={
          <span style={{ color: scheduledCount > 0 ? "var(--red)" : undefined }}>
            {scheduledCount}
          </span>
        }
        sub={
          <span style={{ color: "var(--fg-2)" }}>
            {scheduledCount === 0
              ? "No schedules set"
              : scheduledNext
                ? `Next: ${scheduledNext}`
                : `Across ${scheduledCount} project${scheduledCount === 1 ? "" : "s"}`}
          </span>
        }
      />
      <Divider />
      <Stat
        label="Shipped (7d)"
        value={
          shipped7d === null ? (
            <span style={{ color: "var(--fg-3)" }}>—</span>
          ) : (
            <span style={{ color: "var(--mint)" }}>+{shipped7d}</span>
          )
        }
        sub={shipped7d === null ? "No history yet" : "Across fleet"}
      />
    </div>
  );
}
