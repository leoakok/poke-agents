"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ActivityIcon, MessageSquareIcon } from "lucide-react";

import { useDashboardData } from "@/components/dashboard-data-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildLiveResumeIndex } from "@/lib/live-session-match";
import { chatHref } from "@/lib/routes";
import { stopAgentProcess } from "@/lib/poke-agents-api";
import { cn } from "@/lib/utils";

function truncateCmd(cmd: string, max = 140) {
  return cmd.length <= max ? cmd : `${cmd.slice(0, max)}…`;
}

export function LiveProcessesPanel() {
  const router = useRouter();
  const { sessions, liveRuntime, liveSse, refreshLiveSnapshot } =
    useDashboardData();

  const [stoppingPid, setStoppingPid] = useState<number | null>(null);
  const [stopError, setStopError] = useState<string | null>(null);
  const [selectedLivePid, setSelectedLivePid] = useState<number | null>(null);

  const selectedLiveProcess = useMemo(() => {
    if (!liveRuntime || liveRuntime.ok !== true || selectedLivePid == null) {
      return null;
    }
    return liveRuntime.processes.find((p) => p.pid === selectedLivePid) ?? null;
  }, [liveRuntime, selectedLivePid]);

  const requestStop = useCallback(
    async (pid: number) => {
      setStopError(null);
      setStoppingPid(pid);
      const r = await stopAgentProcess(pid);
      setStoppingPid(null);
      if (!r.ok) {
        setStopError(r.error);
        return;
      }
      refreshLiveSnapshot();
    },
    [refreshLiveSnapshot],
  );

  const openChat = useCallback(
    (sessionId: string) => {
      router.push(chatHref(sessionId));
    },
    [router],
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ActivityIcon
              className={cn(
                "size-4",
                liveSse === "open"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-muted-foreground",
              )}
            />
            <CardTitle className="text-base">Live agent processes</CardTitle>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            onClick={() => refreshLiveSnapshot()}
          >
            Refresh snapshot
          </Button>
        </div>
        <CardDescription>
          Updates about every 2s (SSE). <strong>Stop</strong> sends{" "}
          <code className="font-mono text-xs">SIGINT</code> to the PID. Matches
          are linked to{" "}
          <Link href="/sessions" className="text-foreground underline-offset-4 hover:underline">
            Sessions
          </Link>{" "}
          when the command UUID matches a saved{" "}
          <code className="font-mono text-xs">composerId</code>. IDE-embedded
          agents usually do not appear here.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {stopError ? (
          <p className="text-destructive text-sm">{stopError}</p>
        ) : null}
        {liveSse === "error" ? (
          <p className="text-destructive text-sm">
            Live stream disconnected. Is{" "}
            <code className="font-mono text-xs">npm run start:http</code>{" "}
            running?
          </p>
        ) : null}
        {!liveRuntime ? (
          <Skeleton className="h-24 w-full" />
        ) : liveRuntime.ok === false ? (
          <p className="text-destructive text-sm">
            Could not scan processes: {liveRuntime.error}
          </p>
        ) : liveRuntime.processes.length === 0 ? (
          <div className="text-muted-foreground space-y-2 text-sm">
            <p>
              No matching <code className="font-mono text-xs">agent</code>{" "}
              processes.
            </p>
            {liveRuntime.note ? <p>{liveRuntime.note}</p> : null}
          </div>
        ) : (
          <>
            <div className="max-h-[min(50vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border">
              <div className="flex flex-col gap-2 p-2">
                {liveRuntime.processes.map((p) => {
                  const isSel = selectedLivePid === p.pid;
                  const { resume, matchingSessionIds } = buildLiveResumeIndex(
                    sessions,
                    p.command,
                  );
                  const singleChatTarget =
                    matchingSessionIds.length === 1
                      ? matchingSessionIds[0]
                      : null;
                  const selectOrOpenChat = () => {
                    if (singleChatTarget) {
                      openChat(singleChatTarget);
                      return;
                    }
                    setSelectedLivePid((cur) =>
                      cur === p.pid ? null : p.pid,
                    );
                  };
                  return (
                    <div
                      key={p.pid}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          selectOrOpenChat();
                        }
                      }}
                      className={cn(
                        "bg-muted/40 flex flex-col gap-2 rounded-md p-3 text-sm transition-colors",
                        "cursor-pointer hover:bg-muted/60",
                        isSel && "ring-ring bg-muted/70 ring-2",
                        singleChatTarget && "hover:border-primary/30 border border-transparent",
                      )}
                      onClick={selectOrOpenChat}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-semibold">
                            pid {p.pid}
                          </span>
                          <span className="text-muted-foreground font-mono text-xs">
                            ppid {p.ppid}
                          </span>
                          <Badge variant="secondary" className="text-xs">
                            {p.mode}
                          </Badge>
                          <span className="text-muted-foreground text-xs">
                            etime {p.elapsed}
                          </span>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          className="h-8"
                          disabled={stoppingPid === p.pid}
                          onClick={(e) => {
                            e.stopPropagation();
                            void requestStop(p.pid);
                          }}
                        >
                          {stoppingPid === p.pid ? "Stopping…" : "Stop"}
                        </Button>
                      </div>
                      <pre className="font-mono text-xs break-words whitespace-pre-wrap">
                        {truncateCmd(p.command, 400)}
                      </pre>
                      {singleChatTarget ? (
                        <p className="text-muted-foreground text-[0.65rem] leading-snug">
                          Click this row (outside Stop) to open the transcript
                          chat.
                        </p>
                      ) : null}
                      {matchingSessionIds.length > 1 ? (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {matchingSessionIds.map((sid) => (
                            <Button
                              key={sid}
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="h-7 gap-1 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                openChat(sid);
                              }}
                            >
                              <MessageSquareIcon className="size-3.5" />
                              Open chat
                            </Button>
                          ))}
                        </div>
                      ) : resume ? (
                        <p className="text-muted-foreground pt-1 text-[0.65rem] leading-snug">
                          Resume uuid in command; no matching disk session yet
                          (Composer may not have synced).
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
            {selectedLivePid != null ? (
              <div className="bg-muted/30 space-y-2 rounded-lg border p-3 text-sm">
                <div className="text-foreground font-medium">
                  Live process watch
                </div>
                {selectedLiveProcess ? (
                  <>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      Stats refresh with SSE (~2s). Stdout is not streamed here;
                      open the matching session under Sessions for transcripts.
                    </p>
                    <dl className="grid gap-1 text-xs sm:grid-cols-[auto_1fr] sm:gap-x-3">
                      <dt className="text-muted-foreground font-medium">PID</dt>
                      <dd className="font-mono">{selectedLiveProcess.pid}</dd>
                      <dt className="text-muted-foreground font-medium">
                        PPID
                      </dt>
                      <dd className="font-mono">{selectedLiveProcess.ppid}</dd>
                      <dt className="text-muted-foreground font-medium">
                        Mode
                      </dt>
                      <dd>{selectedLiveProcess.mode}</dd>
                      <dt className="text-muted-foreground font-medium">
                        Elapsed
                      </dt>
                      <dd className="font-mono">{selectedLiveProcess.elapsed}</dd>
                    </dl>
                    <pre className="font-mono max-h-40 overflow-y-auto break-words whitespace-pre-wrap rounded-md border bg-background p-2 text-xs">
                      {selectedLiveProcess.command}
                    </pre>
                  </>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    This PID is not in the latest scan (it may have exited). Pick
                    another row or wait for the next SSE update.
                  </p>
                )}
              </div>
            ) : null}
          </>
        )}
        {liveRuntime?.ok === true && liveRuntime.scanned_at ? (
          <p className="text-muted-foreground text-xs">
            Last event:{" "}
            {new Date(liveRuntime.scanned_at).toLocaleString()} ·{" "}
            {liveRuntime.platform}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
