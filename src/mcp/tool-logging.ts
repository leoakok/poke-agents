import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function mcpLogEnabled(): boolean {
  const raw = process.env.POKE_AGENTS_MCP_LOG?.trim().toLowerCase();
  if (!raw) return true;
  return raw !== "0" && raw !== "false" && raw !== "off";
}

function runIdFromArgs(args: unknown[]): string | undefined {
  const a = args[0];
  if (a && typeof a === "object" && "run_id" in a) {
    const v = (a as { run_id?: unknown }).run_id;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function statusFromResult(result: CallToolResult): "success" | "failed" {
  const structured = (result as { structuredContent?: unknown }).structuredContent;
  if (structured && typeof structured === "object" && "ok" in structured) {
    const ok = (structured as { ok?: unknown }).ok;
    if (ok === false) return "failed";
  }
  return "success";
}

export function withMcpToolLogging<TArgs extends unknown[]>(
  toolName: string,
  handler: (...args: TArgs) => Promise<CallToolResult> | CallToolResult,
): (...args: TArgs) => Promise<CallToolResult> {
  return async (...args: TArgs): Promise<CallToolResult> => {
    const enabled = mcpLogEnabled();
    const startedAt = Date.now();
    if (enabled) {
      const rid = runIdFromArgs(args);
      console.error(
        `[mcp] tool=${toolName} event=start${rid ? ` run_id=${rid}` : ""}`,
      );
    }
    try {
      const result = await handler(...args);
      if (enabled) {
        const durationMs = Date.now() - startedAt;
        const status = statusFromResult(result);
        console.error(
          `[mcp] tool=${toolName} event=end status=${status} duration_ms=${durationMs}`,
        );
      }
      return result;
    } catch (error) {
      if (enabled) {
        const durationMs = Date.now() - startedAt;
        const message =
          error instanceof Error ? error.message : String(error);
        console.error(
          `[mcp] tool=${toolName} event=end status=failed error=${JSON.stringify(message)} duration_ms=${durationMs}`,
        );
      }
      throw error;
    }
  };
}
