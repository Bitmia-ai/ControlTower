import type { Metadata } from "next";
import SchedulesPageClient from "./schedules-client";

export const metadata: Metadata = {
  title: "Schedules",
};

export default function SchedulesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SchedulesPageClient params={params} />;
}
