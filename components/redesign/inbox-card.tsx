"use client";

import { Icon } from "./icon";

export interface FleetInboxQuestion {
  id: string;
  projectIndex: number;
  projectName: string;
  taskId: string | null;
  title: string;
  context: string | null;
  ageLabel: string | null;
}

interface InboxItemProps {
  q: FleetInboxQuestion;
  onAnswer: (q: FleetInboxQuestion) => void;
  onSnooze?: (q: FleetInboxQuestion) => void;
}

function InboxItem({ q, onAnswer, onSnooze }: InboxItemProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 14,
        alignItems: "start",
        padding: "14px 18px",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: "var(--amber-tint)",
          color: "var(--amber)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "none",
        }}
      >
        <Icon name="q" size={16} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div className="flex items-center" style={{ gap: 8, marginBottom: 4 }}>
          <span className="font-mono" style={{ fontSize: 11, color: "var(--fg-3)" }}>
            {q.projectName}
          </span>
          {q.taskId && (
            <>
              <span style={{ color: "var(--fg-3)" }}>·</span>
              <span className="font-mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>
                {q.taskId}
              </span>
            </>
          )}
          {q.ageLabel && (
            <>
              <span style={{ color: "var(--fg-3)" }}>·</span>
              <span style={{ fontSize: 11, color: "var(--fg-3)" }}>{q.ageLabel}</span>
            </>
          )}
        </div>
        <div
          style={{
            fontSize: 14,
            color: "var(--fg-0)",
            fontWeight: 500,
            marginBottom: q.context ? 4 : 0,
          }}
        >
          {q.title}
        </div>
        {q.context && (
          <div style={{ fontSize: 13, color: "var(--fg-2)" }}>{q.context}</div>
        )}
      </div>
      <div className="flex" style={{ gap: 6 }}>
        {onSnooze && (
          <button
            type="button"
            className="btn sm ghost"
            onClick={() => onSnooze(q)}
          >
            Snooze
          </button>
        )}
        <button
          type="button"
          className="btn sm primary"
          onClick={() => onAnswer(q)}
        >
          Answer
        </button>
      </div>
    </div>
  );
}

interface InboxCardProps {
  questions: FleetInboxQuestion[];
  onAnswer: (q: FleetInboxQuestion) => void;
  onSnooze?: (q: FleetInboxQuestion) => void;
  oldestLabel?: string | null;
}

export function InboxCard({ questions, onAnswer, onSnooze, oldestLabel }: InboxCardProps) {
  if (questions.length === 0) return null;

  return (
    <div className="card-rd" style={{ borderColor: "var(--amber-tint)" }}>
      <div
        className="flex items-center justify-between"
        style={{
          padding: "14px 18px",
          borderBottom: "1px solid var(--line)",
          background: "var(--amber-tint)",
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <span style={{ color: "var(--amber)" }}>
            <Icon name="inbox" size={18} />
          </span>
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: "var(--fg-0)",
            }}
          >
            Needs your input
          </h3>
          <span className="chip amber">{questions.length} open</span>
        </div>
        {oldestLabel && (
          <span style={{ fontSize: 11, color: "var(--fg-2)" }}>
            Oldest {oldestLabel}
          </span>
        )}
      </div>
      <div>
        {questions.map((q) => (
          <InboxItem key={q.id} q={q} onAnswer={onAnswer} onSnooze={onSnooze} />
        ))}
      </div>
    </div>
  );
}
