import type { Metadata } from "next";

import { AppPage } from "@/components/app-page";
import { SettingsPage } from "@/components/settings-page";

export const metadata: Metadata = {
  title: "Settings",
  description: "Enable connectors and control which sources appear in session lists.",
};

export default function SettingsRoute() {
  return (
    <AppPage>
      <SettingsPage />
    </AppPage>
  );
}
