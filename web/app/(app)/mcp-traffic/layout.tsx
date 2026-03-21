import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "MCP traffic",
  description:
    "Real-time JSON-RPC request/response log from the local poke-agents MCP HTTP server.",
};

export default function McpTrafficLayout({ children }: { children: ReactNode }) {
  return children;
}
