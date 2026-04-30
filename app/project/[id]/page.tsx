import type { Metadata } from "next";
import MissionControlClient from "./mission-control-client";

export const metadata: Metadata = {
  title: "Mission Control",
};

export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <MissionControlClient params={params} />;
}
