import type { Metadata } from "next";

import { AppPage } from "@/components/app-page";
import { AgentTemplatesPanel } from "@/components/agent-templates-panel";

export const metadata: Metadata = {
  title: "Templates",
  description: "Agent persona templates — built-ins and custom JSON on disk.",
};

export default function TemplatesPage() {
  return (
    <AppPage>
      <AgentTemplatesPanel />
    </AppPage>
  );
}
