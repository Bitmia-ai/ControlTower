"use client";
import Link from "next/link";
import React from "react";

interface BacklogIdProps {
  id: string;
  projectId: number | string;
  className?: string;
}

export function TaskId({ id, projectId, className }: BacklogIdProps) {
  return (
    <Link
      href={`/project/${projectId}/backlog/${id}`}
      className={`font-mono text-red-400 hover:text-red-300 transition ${className ?? ""}`}
    >
      {id}
    </Link>
  );
}

export function linkifyBacklogIds(text: string, projectId: number | string): React.ReactNode[] {
  const parts = text.split(/(BL-\d+)/g);
  return parts.map((part, i) =>
    /^BL-\d+$/.test(part) ? (
      <TaskId key={i} id={part} projectId={projectId} />
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
