import type { Metadata } from "next";

import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = {
  title: "Overview",
  description:
    "Local poke-agents dashboard: session index, live CLI processes, and templates.",
};

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-3xl flex-1 flex-col">
      <HomeDashboard />
    </div>
  );
}
