"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { DashboardInsetHeader } from "@/components/dashboard-inset-header";
import { DashboardDataProvider } from "@/components/dashboard-data-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

/**
 * One shell: sidebar + header + single main column (max width, scroll inside main).
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <DashboardDataProvider>
      <SidebarProvider className="flex h-full min-h-0 flex-1 flex-row">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DashboardInsetHeader />
          {/* Single scroll regions live inside each page/panel — avoids body growth past the viewport. */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-5 md:px-8 md:py-7">
            <div className="mx-auto flex min-h-0 min-w-0 w-full max-w-5xl flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </DashboardDataProvider>
  );
}
