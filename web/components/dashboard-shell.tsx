"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardInsetHeader } from "@/components/dashboard-inset-header";
import { DashboardDataProvider } from "@/components/dashboard-data-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDataProvider>
      <SidebarProvider className="flex min-h-0 flex-1 flex-row">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DashboardInsetHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DashboardDataProvider>
  );
}
