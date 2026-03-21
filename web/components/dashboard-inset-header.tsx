"use client";

import { usePathname } from "next/navigation";

import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

const ROUTES: Record<
  string,
  { title: string; description: string }
> = {
  "/": {
    title: "Overview",
    description: "Status and shortcuts",
  },
  "/sessions": {
    title: "Sessions",
    description: "Transcripts from disk · sidebar for quick open",
  },
  "/live": {
    title: "Live processes",
    description: "CLI agent PIDs · SSE snapshot",
  },
  "/templates": {
    title: "Agent templates",
    description: "Personas for Poke and control_agent",
  },
  "/chat": {
    title: "Chat",
    description: "Transcript · sidebar to switch threads",
  },
  "/settings": {
    title: "Settings",
    description: "Connectors and session sources",
  },
};

export function DashboardInsetHeader() {
  const pathname = usePathname();
  const meta = ROUTES[pathname] ?? {
    title: "Poke agents",
    description: "Local MCP dashboard",
  };

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-medium">{meta.title}</span>
        <span className="text-muted-foreground truncate text-xs">
          {meta.description}
        </span>
      </div>
    </header>
  );
}
