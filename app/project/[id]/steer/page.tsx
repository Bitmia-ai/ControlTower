import type { Metadata } from "next";
import SteerPageClient from "./steer-client";

export const metadata: Metadata = {
  title: "Steer",
};

export default function SteerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <SteerPageClient params={params} />;
}
