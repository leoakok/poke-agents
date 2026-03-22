import type { Metadata } from "next";

import { AppPage } from "@/components/app-page";
import { McpTrafficWorkspace } from "@/components/mcp-traffic-workspace";

export const metadata: Metadata = {
  title: "MCP traffic",
  description: "Live JSON-RPC request and response log from the local MCP server.",
};

export default function McpTrafficPage() {
  return (
    <AppPage>
      <McpTrafficWorkspace />
    </AppPage>
  );
}
