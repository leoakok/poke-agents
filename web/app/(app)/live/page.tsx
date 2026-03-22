import type { Metadata } from "next";

import { AppPage } from "@/components/app-page";
import { LiveProcessesPanel } from "@/components/live-processes-panel";

export const metadata: Metadata = {
  title: "Live processes",
  description: "Local Cursor agent CLI processes visible to poke-agents.",
};

export default function LivePage() {
  return (
    <AppPage
      intro={
        <>
          OS-visible <code className="font-mono text-[11px]">agent</code>{" "}
          processes on the MCP host — not in-IDE-only sessions.
        </>
      }
    >
      <LiveProcessesPanel className="min-h-0 flex-1" />
    </AppPage>
  );
}
