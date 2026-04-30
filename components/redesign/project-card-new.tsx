"use client";

import Link from "next/link";
import { Icon } from "./icon";
import { PhasePipeline } from "./phase-pipeline";
import { normalizePhase } from "@/lib/redeye-types";
import type { ProjectWithStatus } from "@/lib/redeye-types";

interface ProjectCardNewProps {
  project: ProjectWithStatus;
  index: number;
  onToggle: (index: number) => void;
  onSteer?: (index: number) => void;
  onAddTask?: (index: number) => void;
}

export function ProjectCardNew({
  project: p,
  index,
  onToggle,
  onSteer,
  onAddTask,
}: ProjectCardNewProps) {
  const questionCount = p.questionCount ?? 0;
  const running = p.running;
  const phase = normalizePhase(p.phase);

  let statusLabel: string;
  let statusColor: string;
  if (running) {
    statusLabel = "Running";
    statusColor = "var(--mint)";
  } else if (questionCount > 0) {
    statusLabel = "Needs input";
    statusColor = "var(--amber)";
  } else {
    statusLabel = "Idle";
    statusColor = "var(--fg-3)";
  }

  const dotClass = running
    ? "dot mint dot-pulse"
    : questionCount > 0
      ? "dot amber"
      : "dot";

  return (
    <div className="card-rd flex flex-col">
      <Link
        href={`/project/${index}`}
        className="flex flex-col"
        style={{ cursor: "pointer", textDecoration: "none", color: "inherit" }}
        aria-label={`Open ${p.name}`}
      >
      {/* Header: status row */}
      <div
        style={{
          padding: "16px 18px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 8, minWidth: 0 }}>
            <span className={dotClass} aria-hidden />
            <h3
              style={{
                margin: 0,
                fontSize: 16,
                fontWeight: 600,
                color: "var(--fg-0)",
                letterSpacing: "-0.01em",
              }}
            >
              {p.name}
            </h3>
            {questionCount > 0 && (
              <span
                className="chip amber"
                style={{ height: 18, fontSize: 10 }}
              >
                {questionCount} Q
              </span>
            )}
          </div>
          <span style={{ fontSize: 11, color: statusColor, fontWeight: 500 }}>
            {statusLabel}
          </span>
        </div>
        <div
          className="font-mono flex items-center"
          style={{
            fontSize: 11,
            color: "var(--fg-3)",
            gap: 8,
          }}
        >
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flex: 1,
              minWidth: 0,
            }}
          >
            {p.path}
          </span>
          {p.scheduleEnabled && (
            <span
              title={`Schedule: ${p.scheduleSummary ?? "enabled"}`}
              className="inline-flex items-center"
              style={{
                gap: 4,
                color: "var(--red)",
                flex: "none",
              }}
            >
              <Icon name="schedule" size={11} />
              {p.scheduleSummary && (
                <span style={{ fontSize: 10 }}>{p.scheduleSummary}</span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Working on */}
      <div style={{ padding: "0 18px 12px" }}>
        <div className="eyebrow" style={{ marginBottom: 6 }}>
          {running ? "Working on" : p.taskTitle ? "Paused on" : "No active task"}
        </div>
        {p.taskTitle ? (
          <div className="flex items-baseline" style={{ gap: 8 }}>
            {p.taskId && (
              <span
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: running ? "var(--mint)" : "var(--fg-2)",
                  fontWeight: 500,
                }}
              >
                {p.taskId}
              </span>
            )}
            <span
              style={{
                fontSize: 13,
                color: "var(--fg-1)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
                minWidth: 0,
              }}
            >
              {p.taskTitle}
            </span>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "var(--fg-3)" }}>—</div>
        )}
      </div>

      {/* Phase pipeline */}
      <div style={{ padding: "0 18px 14px" }}>
        <PhasePipeline phase={phase} running={running} compact />
        <div
          className="flex justify-between"
          style={{ marginTop: 6, fontSize: 11, color: "var(--fg-3)" }}
        >
          <span
            style={{
              color: running ? "var(--mint)" : "var(--fg-3)",
              fontWeight: 500,
            }}
          >
            {running && phase ? phase : "—"}
          </span>
          <span>{!p.initialized ? "Not initialized" : ""}</span>
        </div>
      </div>

      {/* Stats row */}
      <div
        className="grid"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr",
          borderTop: "1px solid var(--line)",
          background: "var(--bg-0)",
        }}
      >
        <div
          style={{
            padding: "10px 12px",
            borderRight: "1px solid var(--line)",
          }}
        >
          <div
            className="eyebrow"
            style={{ fontSize: 9, marginBottom: 2 }}
          >
            Backlog
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 13,
              color: "var(--fg-0)",
              fontWeight: 500,
            }}
          >
            {p.backlogCount ?? "—"}
          </div>
        </div>
        <div
          style={{
            padding: "10px 12px",
            borderRight: "1px solid var(--line)",
          }}
        >
          <div
            className="eyebrow"
            style={{ fontSize: 9, marginBottom: 2 }}
          >
            Done
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 13,
              color: "var(--fg-0)",
              fontWeight: 500,
            }}
          >
            {p.doneCount ?? "—"}
          </div>
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div
            className="eyebrow"
            style={{ fontSize: 9, marginBottom: 2 }}
          >
            Questions
          </div>
          <div
            className="font-mono"
            style={{
              fontSize: 13,
              color: questionCount > 0 ? "var(--amber)" : "var(--fg-0)",
              fontWeight: 500,
            }}
          >
            {questionCount}
          </div>
        </div>
      </div>

      </Link>

      {/* Actions — sibling of <Link>, not nested. <button> inside <a> is
          invalid HTML and breaks anchor activation in some browsers. */}
      <div
        className="flex"
        style={{
          gap: 8,
          padding: "10px 12px",
          borderTop: "1px solid var(--line)",
        }}
      >
        {running ? (
          <button
            type="button"
            onClick={() => onToggle(index)}
            className="btn sm rose-outline"
            style={{ flex: 1 }}
            aria-label={`Stop ${p.name}`}
          >
            <Icon name="stop" size={12} /> Stop
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onToggle(index)}
            className="btn sm mint"
            style={{ flex: 1 }}
            aria-label={`Start ${p.name}`}
            disabled={!p.initialized}
            title={!p.initialized ? "Project not initialized" : undefined}
          >
            <Icon name="play" size={12} /> Start
          </button>
        )}
        <button
          type="button"
          onClick={() => onAddTask?.(index)}
          className="btn sm"
          style={{ flex: 1 }}
          disabled={!onAddTask}
          aria-label={`Add task to ${p.name}`}
        >
          <Icon name="plus" size={12} /> Add task
        </button>
        <button
          type="button"
          onClick={() => onSteer?.(index)}
          className="btn sm"
          style={{ flex: 1 }}
          disabled={!onSteer}
          aria-label={`Steer ${p.name}`}
        >
          <Icon name="steer" size={12} /> Steer
        </button>
      </div>
    </div>
  );
}
