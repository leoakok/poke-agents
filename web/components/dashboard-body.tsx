import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Same outer shell for every route under {@link AppPage}.
 * - `scroll` — one vertical scroll (overview, settings, templates).
 * - `fixed` — height-bound; child panels own overflow (sessions, chat, live, MCP log).
 */
export function DashboardBody({
  children,
  className,
  variant = "scroll",
}: {
  children: ReactNode;
  className?: string;
  variant?: "scroll" | "fixed";
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-6",
        variant === "scroll"
          ? "overflow-y-auto overscroll-contain pb-6"
          : "overflow-hidden",
        className,
      )}
    >
      {children}
    </div>
  );
}
