"use client";

import { PIPELINE_PHASES, pipelinePhaseIndex } from "./phases";

interface PhasePipelineProps {
  phase: string | null | undefined;
  running?: boolean;
  compact?: boolean;
}

export function PhasePipeline({ phase, running = false, compact = false }: PhasePipelineProps) {
  const idx = pipelinePhaseIndex(phase);
  return (
    <div
      className="flex flex-col w-full"
      style={{ gap: compact ? 6 : 8 }}
    >
      <div className="pipeline">
        {PIPELINE_PHASES.map((p, i) => {
          const cls =
            i < idx
              ? "step done"
              : i === idx
                ? running
                  ? "step active"
                  : "step done"
                : "step";
          return <div key={p.key} className={cls} />;
        })}
      </div>
      {!compact && (
        <div
          className="flex justify-between font-mono uppercase"
          style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--fg-3)" }}
        >
          {PIPELINE_PHASES.map((p, i) => (
            <span
              key={p.key}
              className="flex-1 text-center"
              style={i === idx ? { color: "var(--mint)" } : undefined}
            >
              {p.label.slice(0, 3)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
