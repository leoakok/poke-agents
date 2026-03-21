"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardInsetHeader } from "@/components/dashboard-inset-header";
import { DashboardDataProvider } from "@/components/dashboard-data-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDataProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardInsetHeader />
          <div className="flex flex-1 flex-col overflow-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DashboardDataProvider>
  );
}
