"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { SessionSidebarNav } from "@/components/session-sidebar-nav";
import { DASHBOARD_NAV } from "@/lib/dashboard-nav";
import { POKE_AGENTS_REPO_URL } from "@/lib/repo";
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
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3.5">
        <p className="text-[13px] font-medium tracking-tight">Poke agents</p>
        <p className="text-muted-foreground group-data-[collapsible=icon]:hidden text-[11px] leading-snug">
          MCP dashboard
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigate</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DASHBOARD_NAV.map(({ href, label, tooltip, Icon }) => (
                <SidebarMenuItem key={href}>
                  <SidebarMenuButton
                    render={<Link href={href} />}
                    isActive={
                      href === "/"
                        ? pathname === "/"
                        : pathname === href || pathname.startsWith(`${href}/`)
                    }
                    tooltip={tooltip}
                  >
                    <Icon className="size-4" />
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
      <SidebarFooter className="text-muted-foreground group-data-[collapsible=icon]:hidden px-3 py-3 text-[11px] leading-snug">
        <a
          href={POKE_AGENTS_REPO_URL}
          className="text-sidebar-foreground font-medium underline-offset-2 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <span className="text-muted-foreground"> · MIT</span>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
