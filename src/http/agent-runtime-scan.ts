import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type AgentProcessInfo = {
  pid: number;
  ppid: number;
  elapsed: string;
  command: string;
  mode: "headless" | "interactive" | "other";
};

export type AgentRuntimeSnapshot =
  | {
      ok: true;
      scanned_at: string;
      platform: NodeJS.Platform;
      processes: AgentProcessInfo[];
      note?: string;
    }
  | { ok: false; error: string; scanned_at: string };

function parsePsLine(line: string): {
  pid: number;
  ppid: number;
  elapsed: string;
  command: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const m = trimmed.match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.+)$/);
  if (!m) return null;
  const pid = Number(m[1]);
  const ppid = Number(m[2]);
  if (!Number.isFinite(pid) || !Number.isFinite(ppid)) return null;
  return { pid, ppid, elapsed: m[3], command: m[4] };
}

function classifyCommand(cmd: string): AgentProcessInfo["mode"] {
  const c = cmd;
  if (/\s-p\b/.test(c) || /--print\b/.test(c)) return "headless";
  if (/\sagent\s/.test(c) || /[/\\]agent(\s|$)/.test(c)) {
    if (/\s(-p|--print)\b/.test(c)) return "headless";
    return "interactive";
  }
  return "other";
}

function shouldIncludeProcess(cmd: string): boolean {
  const lower = cmd.toLowerCase();
  if (lower.includes("grep") || /\bps\s+/.test(lower)) return false;
  if (lower.includes("rg ") || lower.startsWith("rg ")) return false;
  // Cursor IDE sandbox shells — not a user-visible agent run
  if (lower.includes("__cursor_sandbox") || lower.includes("dump_zsh_state")) {
    return false;
  }
  if (lower.includes("command cat <&3")) return false;

  if (/\bworker-server\b/i.test(cmd)) return false;
  // Ephemeral CLI probes (not a long-running “agent task”)
  if (/\sstatus(\s|$)/i.test(cmd) && !/\s-p\b/.test(cmd)) return false;
  if (/\sabout(\s|$)/i.test(cmd) && !/\s-p\b/.test(cmd)) return false;

  // Packaged Cursor Agent CLI (Node entry under cursor-agent/versions)
  if (/cursor-agent[/\\]versions[/\\]/i.test(cmd) && /\.(js|mjs|cjs)(\s|$)/i.test(cmd)) {
    return true;
  }
  if (/\/\.local\/bin\/agent\b/.test(cmd)) return true;
  if (/\/\.local\/bin\/cursor-agent\b/.test(cmd)) return true;

  if (/\sagent\s+.*\s-p\b/.test(cmd)) return true;
  if (/\sagent\s+.*--print\b/.test(cmd)) return true;
  // Interactive / create-chat style runs: `agent` with an explicit resume chat id
  if (/\sagent\s/i.test(cmd) && /--resume(?:=|\s+)/i.test(cmd)) return true;
  return false;
}

async function runPs(): Promise<string> {
  const { platform } = process;
  if (platform === "darwin") {
    const { stdout } = await execFileAsync("ps", [
      "-axww",
      "-o",
      "pid=,ppid=,etime=,command=",
    ], { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  }
  if (platform === "linux") {
    const { stdout } = await execFileAsync("ps", [
      "ww",
      "-eo",
      "pid=,ppid=,etime=,args=",
    ], { maxBuffer: 20 * 1024 * 1024 });
    return stdout;
  }
  throw new Error(`unsupported platform: ${platform}`);
}

/**
 * Best-effort list of local Cursor `agent` CLI processes (headless `-p`, create-chat, etc.).
 * Does not see Agent UI embedded inside the Cursor app unless it spawns a separate `agent` process.
 */
export async function scanAgentProcesses(): Promise<AgentRuntimeSnapshot> {
  const scanned_at = new Date().toISOString();
  if (process.platform === "win32") {
    return {
      ok: true,
      scanned_at,
      platform: "win32",
      processes: [],
      note:
        "Process scan is not implemented on Windows yet; use Task Manager or `Get-Process` for agent-related processes.",
    };
  }
  try {
    const stdout = await runPs();
    const processes: AgentProcessInfo[] = [];
    for (const line of stdout.split("\n")) {
      const row = parsePsLine(line);
      if (!row) continue;
      if (!shouldIncludeProcess(row.command)) continue;
      processes.push({
        pid: row.pid,
        ppid: row.ppid,
        elapsed: row.elapsed,
        command: row.command,
        mode: classifyCommand(row.command),
      });
    }
    processes.sort((a, b) => a.pid - b.pid);
    return {
      ok: true,
      scanned_at,
      platform: process.platform,
      processes,
    };
  } catch (e) {
    return {
      ok: false,
      scanned_at,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
