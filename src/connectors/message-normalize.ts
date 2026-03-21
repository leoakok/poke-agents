import type { MessageRole, SessionMessage } from "./types.js";

function normalizeRole(r: unknown): MessageRole {
  if (r === "user" || r === "assistant" || r === "system") return r;
  return "unknown";
}

/** Map vendored editor message rows (role, content, _model, …) to MCP shape. */
export function normalizeSessionMessages(raw: unknown[]): SessionMessage[] {
  const out: SessionMessage[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const m = row as Record<string, unknown>;
    const content =
      typeof m.content === "string"
        ? m.content
        : m.content != null
          ? JSON.stringify(m.content)
          : "";
    const model =
      typeof m._model === "string"
        ? m._model
        : typeof m.model === "string"
          ? m.model
          : undefined;
    out.push({
      role: normalizeRole(m.role),
      content,
      model,
    });
  }
  return out;
}
