import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** MCP tool result: validated structuredContent + human-readable JSON in content[0]. */
export function toolStructured(payload: Record<string, unknown>): CallToolResult {
  return {
    structuredContent: payload,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}
