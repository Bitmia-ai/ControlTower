"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/redesign/modal-shell";

interface SteerDialogProps {
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSteered: () => void;
}

export function SteerDialog({
  projectId,
  open,
  onOpenChange,
  onSteered,
}: SteerDialogProps) {
  const [directive, setDirective] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!directive.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/steer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ directive }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to send directive");
        return;
      }
      setDirective("");
      onOpenChange(false);
      onSteered();
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
      width={620}
      ariaLabel="Steer the agent"
    >
      <ModalHeader
        icon="steer"
        tone="violet"
        title="Steer the agent"
        subtitle="Drop a note into the steering log. The agent reads it before picking the next move."
      />
      <form onSubmit={handleSubmit} className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        <ModalBody>
          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="steer-directive"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Directive
            </label>
            <textarea
              id="steer-directive"
              value={directive}
              onChange={(e) => setDirective(e.target.value)}
              placeholder="Tell the agent how to behave… e.g. 'Always run npm test before declaring a phase done.'"
              aria-label="Steering directive"
              rows={5}
              autoFocus
              className="input-rd"
              style={{ resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--rose)" }}>{error}</p>
          )}
        </ModalBody>
        <ModalFooter
          hint={
            <span>
              Saved to{" "}
              <span className="font-mono" style={{ color: "var(--fg-2)" }}>
                .redeye/steering.md
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
            disabled={loading || !directive.trim()}
            className="btn primary"
            style={
              loading || !directive.trim() ? { opacity: 0.5 } : undefined
            }
          >
            {loading ? "Sending…" : "Send directive"}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
