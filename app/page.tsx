import type { Metadata } from "next";
import HomeClient from "./home-client";

export const metadata: Metadata = {
  title: "Projects",
};

export default function Home() {
  return <HomeClient />;
}
