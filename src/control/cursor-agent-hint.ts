/**
 * Map common Cursor Agent CLI stderr to actionable hints for MCP clients.
 */
export function hintForCursorAgentStderr(stderr: string): string | undefined {
  const s = stderr.toLowerCase();
  if (
    s.includes("[unavailable]") ||
    s.includes("service unavailable") ||
    (s.includes("unavailable") && s.includes("error"))
  ) {
    return [
      "Cursor Agent returned a service/unavailability error — this is from Cursor (cloud/auth/plan), not poke-agents.",
      "Try: run `control_cli_status` or in a terminal `agent status` / `agent about` in the same workspace.",
      "Re-login or update the Cursor app + CLI if prompted; confirm subscription and network/VPN.",
      "If it persists, check Cursor status and community threads for “agent unavailable” / headless errors.",
    ].join(" ");
  }
  if (s.includes("not logged in") || s.includes("login required")) {
    return "Cursor Agent needs authentication. Log in via the Cursor app or CLI (`agent login` if available), then retry.";
  }
  if (s.includes("rate limit") || s.includes("429")) {
    return "Cursor Agent hit a rate limit; wait and retry or switch model.";
  }
  return undefined;
}
