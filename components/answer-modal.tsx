"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import type { InboxQuestion } from "@/lib/redeye-types";
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/redesign/modal-shell";

interface AnswerModalProps {
  question: InboxQuestion;
  projectId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAnswered: () => void;
}

export function AnswerModal({
  question,
  projectId,
  open,
  onOpenChange,
  onAnswered,
}: AnswerModalProps) {
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!answer.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId: question.id, answer }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to submit answer");
        return;
      }
      setAnswer("");
      onOpenChange(false);
      onAnswered();
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
      width={580}
      ariaLabel={`Answer ${question.id}`}
    >
      <ModalHeader
        icon="q"
        tone="amber"
        title={question.question}
        subtitle={
          <span className="font-mono" style={{ color: "var(--fg-2)" }}>
            {question.id}
          </span>
        }
      />
      <form
        onSubmit={handleSubmit}
        className="flex flex-col"
        style={{ minHeight: 0, flex: 1 }}
      >
        <ModalBody>
          {question.context && (
            <div
              style={{
                fontSize: 13,
                color: "var(--fg-2)",
                lineHeight: 1.5,
              }}
            >
              <span
                className="eyebrow"
                style={{ marginRight: 6, fontSize: 10 }}
              >
                Context
              </span>
              {question.context}
            </div>
          )}
          {question.default && (
            <div
              style={{
                fontSize: 12,
                color: "var(--fg-3)",
                background: "var(--bg-0)",
                border: "1px solid var(--line)",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <span
                className="eyebrow"
                style={{ marginRight: 6, fontSize: 10 }}
              >
                Default
              </span>
              {question.default}
            </div>
          )}

          {question.options && question.options.length > 0 && (
            <div className="flex flex-col" style={{ gap: 6 }}>
              <div className="eyebrow" style={{ fontSize: 10 }}>
                Suggested
              </div>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {question.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setAnswer(opt)}
                    className={answer === opt ? "btn sm primary" : "btn sm"}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="answer-textarea"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Your answer
            </label>
            <textarea
              id="answer-textarea"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer…"
              aria-label="Your answer"
              rows={4}
              className="input-rd"
              style={{ resize: "vertical" }}
              autoFocus
            />
          </div>

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
              Saved to{" "}
              <span className="font-mono" style={{ color: "var(--fg-2)" }}>
                .redeye/inbox.md
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
            disabled={loading || !answer.trim()}
            className="btn primary"
            style={
              loading || !answer.trim() ? { opacity: 0.5 } : undefined
            }
          >
            {loading ? "Submitting…" : "Submit answer"}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
