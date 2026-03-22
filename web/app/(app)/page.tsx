import type { Metadata } from "next";

import { AppPage } from "@/components/app-page";
import { HomeDashboard } from "@/components/home-dashboard";

export const metadata: Metadata = {
  title: "Overview",
  description: "API status and shortcuts for the local poke-agents dashboard.",
};

export default function HomePage() {
  return (
    <AppPage>
      <HomeDashboard />
    </AppPage>
  );
}
