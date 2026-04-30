import type { Metadata } from "next";
import NowClient from "./now-client";

export const metadata: Metadata = {
  title: "Now",
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <NowClient params={params} />;
}
