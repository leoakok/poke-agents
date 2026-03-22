"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArchiveIcon,
  ArrowLeftIcon,
  ExternalLinkIcon,
} from "lucide-react";

import { DashboardBody } from "@/components/dashboard-body";
import { useDashboardData } from "@/components/dashboard-data-context";
import { SessionChat } from "@/components/session-chat";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSessionDetail, type SessionMessage } from "@/lib/poke-agents-api";
import { buildLiveResumeIndex } from "@/lib/live-session-match";
import { SESSIONS_HREF } from "@/lib/routes";
import { cn } from "@/lib/utils";

export function ChatWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("s");

  const {
    sessions,
    diskSessions,
    liveRuntime,
    archiveSession,
    archivedSessionIds,
  } = useDashboardData();

  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailMessages, setDetailMessages] = useState<SessionMessage[]>([]);
  const [liveTranscriptFollow, setLiveTranscriptFollow] = useState(true);

  const sessionMeta = useMemo(() => {
    if (!sessionId) return null;
    return sessions.find((s) => s.id === sessionId) ?? null;
  }, [sessions, sessionId]);

  const isLive = useMemo(() => {
    if (!sessionId || !liveRuntime || liveRuntime.ok !== true) return false;
    for (const p of liveRuntime.processes) {
      const { matchingSessionIds } = buildLiveResumeIndex(
        diskSessions,
        p.command,
      );
      if (matchingSessionIds.includes(sessionId)) return true;
    }
    return false;
  }, [sessionId, liveRuntime, diskSessions]);

  useEffect(() => {
    if (sessionId?.startsWith("live:pid:")) {
      router.replace("/live");
    }
  }, [sessionId, router]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      if (!sessionId) {
        setDetailMessages([]);
        setDetailError(null);
        setDetailLoading(false);
        return;
      }
      if (sessionId.startsWith("live:pid:")) {
        setDetailMessages([]);
        setDetailError(null);
        setDetailLoading(false);
        return;
      }
      setDetailLoading(true);
      setDetailError(null);
      void fetchSessionDetail(sessionId).then((r) => {
        if (cancelled) return;
        setDetailLoading(false);
        if (!r.ok) {
          setDetailError(r.error);
          setDetailMessages([]);
          return;
        }
        setDetailMessages(r.messages);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !liveTranscriptFollow) return;
    const tick = () => {
      void fetchSessionDetail(sessionId).then((r) => {
        if (!r.ok) return;
        setDetailMessages(r.messages);
      });
    };
    const id = window.setInterval(tick, 2500);
    return () => window.clearInterval(id);
  }, [sessionId, liveTranscriptFollow]);

  const onArchive = useCallback(() => {
    if (!sessionId) return;
    archiveSession(sessionId);
    router.push(SESSIONS_HREF);
  }, [archiveSession, router, sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    if (archivedSessionIds.has(sessionId)) {
      router.replace(SESSIONS_HREF);
    }
  }, [sessionId, archivedSessionIds, router]);

  if (!sessionId) {
    return (
      <DashboardBody variant="fixed" className="gap-4">
        <p className="text-muted-foreground text-sm">
          No session selected. Open one from the sidebar or{" "}
          <Link
            href={SESSIONS_HREF}
            className="text-foreground underline-offset-4 hover:underline"
          >
            Sessions
          </Link>
          .
        </p>
        <Link href={SESSIONS_HREF} className={cn(buttonVariants(), "w-fit")}>
          Go to sessions
        </Link>
      </DashboardBody>
    );
  }

  return (
    <DashboardBody variant="fixed" className="gap-4">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={SESSIONS_HREF}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "h-8 gap-1 px-2 -ml-2",
              )}
            >
              <ArrowLeftIcon className="size-4" />
              Sessions
            </Link>
            {isLive ? (
              <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium">
                <span className="relative flex size-2 shrink-0" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                </span>
                Running (CLI)
              </span>
            ) : null}
          </div>
          <h2 className="truncate text-base font-medium tracking-tight">
            {sessionMeta?.title || "(untitled)"}
          </h2>
          <p className="text-muted-foreground font-mono text-[11px] break-all">
            {sessionId}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch
              id="chat-live-refresh"
              checked={liveTranscriptFollow}
              onCheckedChange={setLiveTranscriptFollow}
            />
            <Label
              htmlFor="chat-live-refresh"
              className="text-muted-foreground cursor-pointer text-xs font-normal"
            >
              Live refresh
            </Label>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={onArchive}
          >
            <ArchiveIcon className="size-3.5" />
            Archive
          </Button>
          <Link
            href="/live"
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "h-8 gap-1",
            )}
          >
            <ExternalLinkIcon className="size-3.5" />
            Live
          </Link>
        </div>
      </div>

      <div className="bg-card border-border flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-xl border shadow-sm">
        {detailLoading ? (
          <Skeleton className="m-3 min-h-[min(40dvh,20rem)] flex-1" />
        ) : detailError ? (
          <p className="text-destructive shrink-0 p-6 text-sm">{detailError}</p>
        ) : (
          <SessionChat
            messages={detailMessages}
            variant="page"
            className="min-h-0 flex-1 rounded-xl"
          />
        )}
      </div>
    </DashboardBody>
  );
}
