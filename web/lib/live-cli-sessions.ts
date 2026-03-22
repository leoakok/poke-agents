import type {
  AgentProcessRow,
  AgentRuntimeResponse,
  SessionRow,
} from "@/lib/poke-agents-api";
import { buildLiveResumeIndex } from "@/lib/live-session-match";

function sourceForCli(
  cli: AgentProcessRow["cli"],
): "cursor" | "opencode" | "codex" | "claude" | "live" {
  if (cli === "cursor-agent") return "cursor";
  if (cli === "opencode") return "opencode";
  if (cli === "codex") return "codex";
  if (cli === "claude-code") return "claude";
  return "live";
}

/**
 * Headless agent processes with no matching saved session — show in the sessions list.
 */
export function liveCliSessionsNotOnDisk(
  live: AgentRuntimeResponse | null,
  diskSessions: SessionRow[],
): SessionRow[] {
  if (!live || live.ok !== true) return [];
  const out: SessionRow[] = [];
  for (const p of live.processes) {
    if (p.mode !== "headless") continue;
    const { matchingSessionIds } = buildLiveResumeIndex(
      diskSessions,
      p.command,
    );
    if (matchingSessionIds.length > 0) continue;
    const src = sourceForCli(p.cli);
    const preview =
      p.command.length > 100 ? `${p.command.slice(0, 100)}…` : p.command;
    out.push({
      id: `live:pid:${p.pid}`,
      source: src,
      title: `Running · ${preview}`,
      kind: "live",
      pid: p.pid,
      last_updated_at: new Date().toISOString(),
    });
  }
  return out;
}
