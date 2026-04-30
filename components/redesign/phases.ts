import { normalizePhase } from "@/lib/redeye-types";

export type PipelinePhaseKey =
  | "TRIAGE"
  | "PLAN"
  | "BUILD"
  | "REVIEW"
  | "DEPLOY"
  | "VERIFY"
  | "MERGE";

export interface PipelinePhase {
  key: PipelinePhaseKey;
  label: string;
}

export const PIPELINE_PHASES: readonly PipelinePhase[] = [
  { key: "TRIAGE", label: "Triage" },
  { key: "PLAN", label: "Plan" },
  { key: "BUILD", label: "Build" },
  { key: "REVIEW", label: "Review" },
  { key: "DEPLOY", label: "Deploy" },
  { key: "VERIFY", label: "Verify" },
  { key: "MERGE", label: "Merge" },
] as const;

export function pipelinePhaseIndex(phase: string | null | undefined): number {
  const key = normalizePhase(phase);
  return PIPELINE_PHASES.findIndex(p => p.key === key);
}
