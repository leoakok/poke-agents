import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Templates",
  description:
    "Agent persona templates for Poke and MCP — built-ins plus custom JSON on disk.",
};

export default function TemplatesLayout({ children }: { children: ReactNode }) {
  return children;
}
