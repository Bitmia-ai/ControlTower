"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/redesign/modal-shell";

interface AddScheduleDialogProps {
  projectId: number | string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

/**
 * Modal dialog for creating a new schedule entry.  POSTs to
 * `/api/projects/{projectId}/schedules` and on success calls onAdded()
 * so the parent can refetch the list. Steps are entered as one-per-line.
 */
export function AddScheduleDialog({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: AddScheduleDialogProps) {
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState("");
  const [stepsText, setStepsText] = useState("");
  const [description, setDescription] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const trimmedFreq = frequency.trim();
  const stepLines = stepsText
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const canSubmit =
    !loading &&
    trimmedName.length > 0 &&
    trimmedFreq.length > 0 &&
    stepLines.length > 0;

  function reset() {
    setName("");
    setFrequency("");
    setStepsText("");
    setDescription("");
    setShowDetails(false);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        name: trimmedName,
        frequency: trimmedFreq,
        steps: stepLines,
      };
      if (showDetails && description.trim().length > 0) {
        body.description = description.trim();
      }
      const res = await fetch(`/api/projects/${projectId}/schedules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Failed to add schedule");
        return;
      }
      reset();
      onOpenChange(false);
      onAdded();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const presets = [
    { label: "Every 4h", value: "every 4h" },
    { label: "Daily", value: "daily" },
    { label: "Weekdays · 9pm", value: "weekdays 9pm" },
    { label: "Weekly", value: "weekly" },
  ];

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      width={560}
      ariaLabel="Add schedule"
    >
      <ModalHeader
        icon="schedule"
        tone="red"
        title="Add a schedule"
        subtitle="Define a recurring task. The team picks it up on its next iteration."
      />
      <form onSubmit={handleSubmit} className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        <ModalBody>
          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="schedule-name"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Name
            </label>
            <input
              id="schedule-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly dependency audit"
              aria-label="Schedule name"
              required
              autoFocus
              className="input-rd"
            />
          </div>

          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="schedule-frequency"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Frequency
            </label>
            <input
              id="schedule-frequency"
              type="text"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. every 7d, daily, weekdays 9pm"
              aria-label="Schedule frequency"
              required
              className="input-rd"
            />
            <div className="flex flex-wrap" style={{ gap: 6, marginTop: 2 }}>
              {presets.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  className={frequency === p.value ? "btn sm primary" : "btn sm"}
                  onClick={() => setFrequency(p.value)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="schedule-steps"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Steps (one per line)
            </label>
            <textarea
              id="schedule-steps"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              placeholder={"1. Run npm audit\n2. Report findings to .redeye/tester-reports.md"}
              aria-label="Schedule steps"
              rows={5}
              required
              className="input-rd font-mono"
              style={{ resize: "vertical", fontSize: 13, lineHeight: 1.5 }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            style={{
              fontSize: 11,
              color: "var(--sky)",
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              textAlign: "left",
              alignSelf: "flex-start",
              fontWeight: 500,
            }}
          >
            {showDetails ? "▼ Hide details" : "▶ Add details"}
          </button>

          {showDetails && (
            <div className="flex flex-col" style={{ gap: 6 }}>
              <label
                htmlFor="schedule-description"
                className="eyebrow"
                style={{ fontSize: 10 }}
              >
                Description (optional)
              </label>
              <textarea
                id="schedule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What does this task accomplish?"
                aria-label="Schedule description"
                rows={3}
                className="input-rd"
                style={{ resize: "vertical" }}
              />
            </div>
          )}

          {error && (
            <p
              role="alert"
              style={{ margin: 0, fontSize: 13, color: "var(--rose)" }}
            >
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter
          hint={
            <span>
              Appended to{" "}
              <span className="font-mono" style={{ color: "var(--fg-2)" }}>
                .redeye/schedules.md
              </span>
            </span>
          }
        >
          <Dialog.Close asChild>
            <button type="button" className="btn ghost">
              Cancel
            </button>
          </Dialog.Close>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn primary"
            style={!canSubmit ? { opacity: 0.5 } : undefined}
          >
            {loading ? "Adding…" : "Add schedule"}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
