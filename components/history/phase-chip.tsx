import { PHASE_COLORS } from "@/lib/redeye-types";

/**
 * Short labels for phase names — used inside the small static chip.
 * Falls back to the first 3 chars uppercase if a phase is missing.
 */
export const PHASE_SHORT_LABELS: Record<string, string> = {
  TRIAGE: "TRI",
  PLAN: "PLN",
  BUILD: "BLD",
  REVIEW: "REV",
  DEPLOY: "DEP",
  VERIFY: "VER",
  MERGE: "MRG",
  HARDEN: "HRD",
  STABILIZE: "STB",
  INCORPORATE: "INC",
  SCHEDULES: "SCH",
};

const FALLBACK_COLORS = {
  bg: "bg-gray-100 dark:bg-zinc-800",
  text: "text-gray-600 dark:text-zinc-400",
};

/**
 * Static phase pill — used in historical session timelines.
 * Unlike `PhaseBadge` (which shows the live active phase with a pulsing dot),
 * this is a small, motionless chip suited for dense lists.
 */
export function PhaseChip({ phase }: { phase: string }) {
  const colors = PHASE_COLORS[phase];
  const bg = colors?.bg ?? FALLBACK_COLORS.bg;
  const text = colors?.text ?? FALLBACK_COLORS.text;
  const label = PHASE_SHORT_LABELS[phase] ?? phase.slice(0, 3).toUpperCase();
  return (
    <span
      title={phase}
      className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide leading-none ${bg} ${text}`}
    >
      {label}
    </span>
  );
}
