"use client";

import { usePathname } from "next/navigation";
import { Github } from "lucide-react";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { navMetaForPath } from "@/lib/dashboard-nav";
import { POKE_AGENTS_REPO_URL } from "@/lib/repo";
import { cn } from "@/lib/utils";

export function DashboardInsetHeader() {
  const pathname = usePathname();
  const meta = navMetaForPath(pathname);

  return (
    <header className="border-border flex h-12 shrink-0 items-center gap-3 border-b px-4 md:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <SidebarTrigger className="-ml-1 shrink-0" />
        {/* Plain rule: avoids Separator `self-stretch` fighting flex `items-center` (line looked top-pinned). */}
        <span
          className="bg-border h-6 w-px shrink-0"
          aria-hidden
        />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          <h1 className="truncate text-[13px] font-medium leading-none tracking-tight">
            {meta.title}
          </h1>
          <p className="text-muted-foreground hidden truncate text-[11px] leading-snug sm:block">
            {meta.description}
          </p>
        </div>
      </div>
      <a
        href={POKE_AGENTS_REPO_URL}
        target="_blank"
        rel="noreferrer"
        title="poke-agents on GitHub — star the repo or open a PR"
        className={cn(
          "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          "flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 transition-colors sm:px-2.5",
        )}
      >
        <Github className="size-4 shrink-0" aria-hidden />
        <span className="hidden min-w-0 sm:block">
          <span className="text-foreground block text-xs font-medium leading-tight">
            Star on GitHub
          </span>
          <span className="text-muted-foreground block text-[0.65rem] leading-snug">
            Contributions &amp; issues welcome
          </span>
        </span>
      </a>
    </header>
  );
}
