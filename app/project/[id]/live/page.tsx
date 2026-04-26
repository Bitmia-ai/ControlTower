import type { Metadata } from "next";
import LivePageClient from "./live-client";

export const metadata: Metadata = {
  title: "Live",
};

export default function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <LivePageClient params={params} />;
}
