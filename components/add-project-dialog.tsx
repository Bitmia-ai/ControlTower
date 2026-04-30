"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@/components/redesign/modal-shell";

interface AddProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}

export function AddProjectDialog({ open, onOpenChange, onAdded }: AddProjectDialogProps) {
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, path }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to add project");
        return;
      }
      const registeredPath: string = json.data?.path ?? path;
      const listRes = await fetch("/api/projects");
      const listJson = await listRes.json();
      const projects: Array<{ name: string; path: string; initialized: boolean }> =
        listJson.data ?? [];
      const newIndex = projects.findIndex((p) => p.path === registeredPath);

      setName("");
      setPath("");
      onOpenChange(false);
      onAdded();

      if (newIndex >= 0) {
        router.push(`/project/${newIndex}`);
      }
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
      ariaLabel="Add project"
    >
      <ModalHeader
        icon="folder"
        tone="sky"
        title="Add a project"
        subtitle="Point Control Tower at a local repo with RedEye installed."
      />
      <form onSubmit={handleSubmit} className="flex flex-col" style={{ flex: 1, minHeight: 0 }}>
        <ModalBody>
          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="project-name"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Name
            </label>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-app"
              required
              autoFocus
              className="input-rd"
            />
          </div>

          <div className="flex flex-col" style={{ gap: 6 }}>
            <label
              htmlFor="project-path"
              className="eyebrow"
              style={{ fontSize: 10 }}
            >
              Path
            </label>
            <input
              id="project-path"
              type="text"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="/Users/you/my-app"
              required
              className="input-rd font-mono"
              style={{ fontSize: 13 }}
            />
          </div>

          {error && (
            <p style={{ margin: 0, fontSize: 13, color: "var(--rose)" }}>
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter
          hint={
            <span>
              Stored in{" "}
              <span className="font-mono" style={{ color: "var(--fg-2)" }}>
                ~/.redeye/config.json
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
            disabled={loading}
            className="btn primary"
            style={loading ? { opacity: 0.5 } : undefined}
          >
            {loading ? "Adding…" : "Add project"}
          </button>
        </ModalFooter>
      </form>
    </ModalShell>
  );
}
