"use client";
import Link from "next/link";
import React from "react";

interface TaskIdProps {
  id: string;
  projectId: number | string;
  className?: string;
}

export function TaskId({ id, projectId, className }: TaskIdProps) {
  return (
    <Link
      href={`/project/${projectId}/tasks/${id}`}
      className={`font-mono text-red-400 hover:text-red-300 transition ${className ?? ""}`}
    >
      {id}
    </Link>
  );
}

export function linkifyTaskIds(text: string, projectId: number | string): React.ReactNode[] {
  const parts = text.split(/(T\d+)/g);
  return parts.map((part, i) =>
    /^T\d+$/.test(part) ? (
      <TaskId key={i} id={part} projectId={projectId} />
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
