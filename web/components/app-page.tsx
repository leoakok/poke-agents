import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared page frame: optional intro + one body column (full width of shell `max-w-5xl`).
 * Use {@link DashboardBody} inside `children` for the standard scroll / fixed variants.
 */
export function AppPage({
  children,
  intro,
  className,
}: {
  children: ReactNode;
  intro?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-hidden md:gap-5",
        className,
      )}
    >
      {intro != null && intro !== false ? (
        <div className="text-muted-foreground shrink-0 text-sm leading-relaxed">
          {intro}
        </div>
      ) : null}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
