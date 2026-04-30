import type { Metadata } from "next";
import TaskDetailClient from "./task-detail-client";

export const metadata: Metadata = {
  title: "Task Detail",
};

export default function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string; taskId: string }>;
}) {
  return <TaskDetailClient params={params} />;
}
