import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllowedEditorIds } from "../profile.js";
import {
  activeConnectors,
  getMessagesForProfile,
  listSessionsForProfile,
} from "../connectors/registry.js";
import { registerAgentTemplateTools } from "./agent-template-tools.js";
import { registerControlTools } from "./control-tools.js";
import { registerPokeAgentsGuideTool } from "./guide-tool.js";
import { registerPokeAgentsPromptsAndResources } from "./prompts-resources.js";
import { withMcpToolLogging } from "./tool-logging.js";
import { toolStructured } from "./tool-result.js";
import {
  READ,
  adaptersOutput,
  sessionInput,
  sessionOutputShape,
  sessionsInput,
  sessionsOutput,
} from "./tool-schemas.js";

export function createPokeAgentsMcpServer(): McpServer {
  const mcp = new McpServer(
    {
      name: "poke-agents",
      version: "0.2.0",
    },
    {
      capabilities: {},
    }
  );

  mcp.registerTool(
    "adapters",
    {
      title: READ.adapters.title,
      description: READ.adapters.description,
      outputSchema: adaptersOutput,
    },
    withMcpToolLogging("adapters", async () => {
      const connectors = await Promise.all(
        activeConnectors().map(async (c) => {
          const h = await c.health();
          return {
            id: c.id,
            display_name: c.displayName,
            available: h.available,
            detail: h.detail,
          };
        })
      );
      return toolStructured({
        ok: true as const,
        connectors,
        editors: [...getAllowedEditorIds()],
      });
    })
  );

  mcp.registerTool(
    "sessions",
    {
      title: READ.sessions.title,
      description: READ.sessions.description,
      inputSchema: sessionsInput,
      outputSchema: sessionsOutput,
    },
    withMcpToolLogging("sessions", async ({ editor, limit, folder }) => {
      const sessions = await listSessionsForProfile({
        source: editor,
        limit: limit ?? 50,
        projectPath: folder,
      });
      return toolStructured({
        ok: true as const,
        sessions: sessions.map((s) => ({
          id: s.id,
          source: s.source,
          title: s.title,
          last_updated_at: s.lastUpdatedAt,
          project_path: s.projectPath,
        })),
      });
    })
  );

  mcp.registerTool(
    "session",
    {
      title: READ.session.title,
      description: READ.session.description,
      inputSchema: sessionInput,
      outputSchema: sessionOutputShape,
    },
    withMcpToolLogging("session", async ({ id }) => {
      const result = await getMessagesForProfile(id);
      if (!result.ok) {
        return toolStructured({
          ok: false as const,
          error: result.error,
        });
      }
      return toolStructured({
        ok: true as const,
        session: result.session,
        messages: result.messages,
      });
    })
  );

  registerPokeAgentsGuideTool(mcp);

  registerControlTools(mcp);
  registerAgentTemplateTools(mcp);
  registerPokeAgentsPromptsAndResources(mcp);

  return mcp;
}
