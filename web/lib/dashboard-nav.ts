import type { LucideIcon } from "lucide-react";
import {
  ActivityIcon,
  HomeIcon,
  LayoutListIcon,
  RadioIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";

/** Single source for sidebar, inset header, and route metadata. */
export type DashboardNavItem = {
  href: string;
  label: string;
  title: string;
  description: string;
  tooltip: string;
  Icon: LucideIcon;
};

export const DASHBOARD_NAV: DashboardNavItem[] = [
  {
    href: "/",
    label: "Overview",
    title: "Overview",
    description: "Status & links",
    tooltip: "Home",
    Icon: HomeIcon,
  },
  {
    href: "/sessions",
    label: "Sessions",
    title: "Sessions",
    description: "Disk transcripts",
    tooltip: "Browse transcripts",
    Icon: LayoutListIcon,
  },
  {
    href: "/live",
    label: "Live",
    title: "Live processes",
    description: "Cursor, OpenCode, Codex CLIs",
    tooltip: "CLI PIDs",
    Icon: ActivityIcon,
  },
  {
    href: "/mcp-traffic",
    label: "MCP log",
    title: "MCP traffic",
    description: "MCP request log",
    tooltip: "Request log",
    Icon: RadioIcon,
  },
  {
    href: "/templates",
    label: "Templates",
    title: "Agent templates",
    description: "control_agent personas",
    tooltip: "Edit templates",
    Icon: SparklesIcon,
  },
  {
    href: "/settings",
    label: "Settings",
    title: "Settings",
    description: "Sources & env",
    tooltip: "Connectors",
    Icon: SettingsIcon,
  },
];

export function navMetaForPath(pathname: string): {
  title: string;
  description: string;
} {
  if (pathname === "/chat" || pathname.startsWith("/chat/")) {
    return {
      title: "Chat",
      description: "Transcript for one saved session",
    };
  }
  for (const item of DASHBOARD_NAV) {
    if (item.href === "/") {
      if (pathname === "/") return { title: item.title, description: item.description };
      continue;
    }
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return { title: item.title, description: item.description };
    }
  }
  return { title: "Poke agents", description: "Local MCP dashboard" };
}
