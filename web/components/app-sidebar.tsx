"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  HomeIcon,
  LayoutListIcon,
  SettingsIcon,
  SparklesIcon,
} from "lucide-react";

import { SessionSidebarNav } from "@/components/session-sidebar-nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/", label: "Overview", icon: HomeIcon, tooltip: "Home & status" },
  {
    href: "/sessions",
    label: "Sessions",
    icon: LayoutListIcon,
    tooltip: "Chats & transcripts",
  },
  {
    href: "/live",
    label: "Live",
    icon: ActivityIcon,
    tooltip: "CLI agent processes",
  },
  {
    href: "/templates",
    label: "Templates",
    icon: SparklesIcon,
    tooltip: "Agent personas",
  },
  {
    href: "/settings",
    label: "Settings",
    icon: SettingsIcon,
    tooltip: "Connectors",
  },
] as const;

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-col gap-1 border-b border-sidebar-border p-4">
        <span className="text-sm font-semibold tracking-tight">
          Poke agents
        </span>
        <span className="text-muted-foreground group-data-[collapsible=icon]:hidden text-xs leading-snug">
          Local dashboard for the poke-agents MCP server
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map(({ href, label, icon: Icon, tooltip }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    render={<Link href={href} />}
                    isActive={
                      href === "/"
                        ? pathname === "/"
                        : pathname === href ||
                          pathname.startsWith(`${href}/`)
                    }
                    tooltip={tooltip}
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SessionSidebarNav />
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="text-muted-foreground group-data-[collapsible=icon]:hidden space-y-2 p-4 text-[0.65rem] leading-snug">
        <p>
          <a
            href="https://github.com/leoakok/poke-agents"
            className="text-sidebar-foreground font-medium underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            poke-agents on GitHub
          </a>
          {" · "}
          MIT
        </p>
        <p>
          Advanced: set{" "}
          <code className="bg-sidebar-accent rounded px-1 py-0.5 font-mono">
            POKE_AGENTS_MCP_ORIGIN
          </code>{" "}
          in <code className="font-mono">web/.env.local</code> if the API is not
          on the default port.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
