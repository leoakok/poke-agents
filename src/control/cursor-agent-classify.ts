/**
 * Classify Cursor Agent CLI stderr for structured MCP responses (not a black box).
 */
export const CURSOR_AGENT_ERROR_CLASSIFICATIONS = [
  "auth",
  "rate_limit",
  "network_tls",
  "network_unreachable",
  "cursor_unavailable",
  "session_headless",
  "timeout",
  "permission_denied",
  "unknown",
] as const;

export type CursorAgentErrorClassification =
  (typeof CURSOR_AGENT_ERROR_CLASSIFICATIONS)[number];

/** Best single-line summary for agents (verbatim from stderr when possible). */
export function primaryStderrMessage(stderr: string): string {
  const lines = stderr
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const line of lines) {
    if (
      /\[(unavailable|error)\]/i.test(line) ||
      /error:/i.test(line) ||
      /failed/i.test(line) ||
      /not logged in/i.test(line) ||
      /rate limit/i.test(line)
    ) {
      return line.length > 2000 ? `${line.slice(0, 2000)}…` : line;
    }
  }
  const last = lines[lines.length - 1];
  if (last) return last.length > 2000 ? `${last.slice(0, 2000)}…` : last;
  const t = stderr.trim();
  return t.length > 2000 ? `${t.slice(0, 2000)}…` : t || "(empty stderr)";
}

export function classifyCursorAgentStderr(
  stderr: string,
): CursorAgentErrorClassification {
  const s = stderr.toLowerCase();

  if (
    s.includes("[unavailable]") ||
    s.includes("service unavailable") ||
    /\b503\b/.test(s)
  ) {
    return "cursor_unavailable";
  }
  if (
    s.includes("rate limit") ||
    s.includes("too many requests") ||
    /\b429\b/.test(s)
  ) {
    return "rate_limit";
  }
  if (
    s.includes("not logged in") ||
    s.includes("login required") ||
    s.includes("unauthorized") ||
    /\b401\b/.test(s) ||
    (s.includes("403") && (s.includes("forbid") || s.includes("auth")))
  ) {
    return "auth";
  }
  if (
    s.includes("certificate") ||
    s.includes("ssl") ||
    s.includes("tls") ||
    s.includes("cert_verify")
  ) {
    return "network_tls";
  }
  if (
    s.includes("econnrefused") ||
    s.includes("enotfound") ||
    s.includes("enetunreach") ||
    s.includes("econnreset") ||
    s.includes("socket hang up") ||
    s.includes("network error") ||
    s.includes("vpn")
  ) {
    return "network_unreachable";
  }
  if (
    s.includes("tty") ||
    s.includes("interactive terminal") ||
    s.includes("not a terminal") ||
    s.includes("stdin is not a tty") ||
    s.includes("requires a terminal")
  ) {
    return "session_headless";
  }
  if (s.includes("timed out") || s.includes("timeout") || s.includes("etimedout")) {
    return "timeout";
  }
  if (
    s.includes("eacces") ||
    s.includes("permission denied") ||
    s.includes("operation not permitted")
  ) {
    return "permission_denied";
  }
  return "unknown";
}

function hintForClassification(
  c: CursorAgentErrorClassification,
  stderr: string,
): string | undefined {
  const primary = primaryStderrMessage(stderr);
  switch (c) {
    case "cursor_unavailable":
      return [
        `Cursor reported unavailability — raw line: ${JSON.stringify(primary)}`,
        "Typical causes: cloud/auth/subscription, regional outage, or headless policy. Run `control_agent_check` or `agent status` / `agent about` in the same cwd.",
        "Re-login in the Cursor app, update Cursor + CLI, check VPN/firewall, and Cursor status pages.",
      ].join(" ");
    case "auth":
      return `Authentication issue — ${JSON.stringify(primary)}. Log in via Cursor or CLI, then retry.`;
    case "rate_limit":
      return `Rate limited — ${JSON.stringify(primary)}. Wait, retry, or switch model/plan.`;
    case "network_tls":
      return `TLS/certificate problem — ${JSON.stringify(primary)}. Check corporate proxy, system clock, and custom CAs.`;
    case "network_unreachable":
      return `Network reachability — ${JSON.stringify(primary)}. Check connectivity, DNS, VPN, and firewall.`;
    case "session_headless":
      return `Headless / session context — ${JSON.stringify(primary)}. With poke-agents, omit \`continue_chat\` and keep default \`auto_chat: true\` so a CLI chat is created automatically, or pass an explicit \`resume\` uuid.`;
    case "timeout":
      return `Timed out — ${JSON.stringify(primary)}. Increase POKE_AGENTS_AGENT_TIMEOUT_MS or simplify the prompt.`;
    case "permission_denied":
      return `Permission denied — ${JSON.stringify(primary)}. Fix filesystem permissions or sandbox policy for the cwd.`;
    case "unknown":
      return undefined;
  }
}

export function classifyCursorAgentFailure(stderr: string): {
  classification: CursorAgentErrorClassification;
  primary_message: string;
  hint: string | undefined;
} {
  const classification = classifyCursorAgentStderr(stderr);
  const primary_message = primaryStderrMessage(stderr);
  const hint = hintForClassification(classification, stderr);
  return { classification, primary_message, hint };
}
