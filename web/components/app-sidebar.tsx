"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGridIcon } from "lucide-react";

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

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex flex-col gap-1 border-b border-sidebar-border p-4">
        <span className="text-sm font-semibold tracking-tight">
          Poke agents
        </span>
        <span className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          Local editor sessions
        </span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>View</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/" />}
                  isActive={pathname === "/"}
                  tooltip="Sessions overview"
                >
                  <LayoutGridIcon />
                  <span>Sessions</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarSeparator />
      <SidebarFooter className="p-4 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
        <p>
          Dev: set{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.65rem]">
            POKE_AGENTS_MCP_ORIGIN
          </code>{" "}
          in <code className="font-mono text-[0.65rem]">web/.env.local</code>{" "}
          when MCP is not the default.
        </p>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
