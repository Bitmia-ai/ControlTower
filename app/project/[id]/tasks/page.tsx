import type { Metadata } from "next";
import TasksPageClient from "./tasks-client";

export const metadata: Metadata = {
  title: "Tasks",
};

export default function TasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <TasksPageClient params={params} />;
}
