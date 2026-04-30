"use client";

import { ProjectShell } from "@/components/redesign/project-shell";

export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ProjectShell>{children}</ProjectShell>;
}
