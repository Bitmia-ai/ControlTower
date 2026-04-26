import type { Metadata } from "next";
import BacklogPageClient from "./tasks-client";

export const metadata: Metadata = {
  title: "Tasks",
};

export default function TasksPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <BacklogPageClient params={params} />;
}
