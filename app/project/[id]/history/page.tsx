import type { Metadata } from "next";
import HistoryPageClient from "./history-client";

export const metadata: Metadata = {
  title: "History",
};

export default function HistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <HistoryPageClient params={params} />;
}
