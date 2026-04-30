"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/redesign/modal-shell";

interface AddTaskDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddTaskDialog({
  projectId,
  open,
  onOpenChange,
  onAdded,
}: AddTaskDialogProps) {
  const [text, setText] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"P0" | "P1" | "P2">("P1");
  const [showDetails, setShowDetails] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const body: Record<string, string> = { text };
      if (showDetails && description.trim()) body.description = description;
      if (showDetails) body.priority = priority;

      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add item");
        return;
      }
      setText("");
      setDescription("");
      setPriority("P1");
      setShowDetails(false);
      onOpenChange(false);
      onAdded();
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      width={520}
      ariaLabel="Add task"
    >
      <ModalHeader
        icon="plus"
        tone="mint"
        title="Add a task"
        subtitle="Drop an item into the CEO request queue. The team picks it up on the next iteration."
      />
      <form onSubmit={handleSubmit} className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        <ModalBody>
          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="task-title"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Task
            </label>
            <input
              id="task-title"
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="What needs to be done?"
              aria-label="Task title"
              required
              autoFocus
              className="input-rd"
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
            {showDetails ? "▼ Hide details" : "▶ Add details (description, priority)"}
          </button>

          {showDetails && (
            <div className="flex flex-col" style={{ gap: 14 }}>
              <div className="flex flex-col" style={{ gap: 6 }}>
                <label
                  htmlFor="task-description"
                  className="eyebrow"
                  style={{ fontSize: 10 }}
                >
                  Description
                </label>
                <textarea
                  id="task-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Acceptance criteria, links, examples…"
                  aria-label="Task description"
                  rows={3}
                  className="input-rd"
                  style={{ resize: "vertical" }}
                />
              </div>
              <div className="flex flex-col" style={{ gap: 6 }}>
                <label
                  htmlFor="task-priority"
                  className="eyebrow"
                  style={{ fontSize: 10 }}
                >
                  Priority
                </label>
                <select
                  id="task-priority"
                  value={priority}
                  onChange={(e) =>
                    setPriority(e.target.value as "P0" | "P1" | "P2")
                  }
                  className="input-rd"
                >
                  <option value="P0">P0 — Critical</option>
                  <option value="P1">P1 — High</option>
                  <option value="P2">P2 — Normal</option>
                </select>
              </div>
            </div>
          )}

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--rose)" }}>{error}</p>
          )}
        </ModalBody>
        <ModalFooter
          hint={
            <span>
              Appended to{" "}
              <span className="font-mono" style={{ color: "var(--fg-2)" }}>
                .redeye/tasks.md
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
            disabled={loading || !text.trim()}
            className="btn primary"
            style={loading || !text.trim() ? { opacity: 0.5 } : undefined}
          >
            {loading ? "Adding…" : "Add task"}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
