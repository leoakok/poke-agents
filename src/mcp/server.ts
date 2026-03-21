import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getAllowedEditorIds } from "../profile.js";
import {
  activeConnectors,
  getMessagesForProfile,
  listSessionsForProfile,
} from "../connectors/registry.js";
import { registerControlTools } from "./control-tools.js";
import { registerPokeAgentsPromptsAndResources } from "./prompts-resources.js";
import { toolStructured } from "./tool-result.js";
import {
  READ,
  getSessionInput,
  getSessionOutputShape,
  listConnectorsOutput,
  listSessionsInput,
  listSessionsOutput,
} from "./tool-schemas.js";

export function createPokeAgentsMcpServer(): McpServer {
  const mcp = new McpServer(
    {
      name: "poke-agents",
      version: "0.1.1",
    },
    {
      capabilities: {},
    }
  );

  mcp.registerTool(
    "list_connectors",
    {
      title: READ.list_connectors.title,
      description: READ.list_connectors.description,
      outputSchema: listConnectorsOutput,
    },
    async () => {
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
        profile_editors: [...getAllowedEditorIds()],
      });
    }
  );

  mcp.registerTool(
    "list_sessions",
    {
      title: READ.list_sessions.title,
      description: READ.list_sessions.description,
      inputSchema: listSessionsInput,
      outputSchema: listSessionsOutput,
    },
    async ({ source, limit, project_path }) => {
      const sessions = await listSessionsForProfile({
        source,
        limit: limit ?? 50,
        projectPath: project_path,
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
    }
  );

  mcp.registerTool(
    "get_session",
    {
      title: READ.get_session.title,
      description: READ.get_session.description,
      inputSchema: getSessionInput,
      outputSchema: getSessionOutputShape,
    },
    async ({ session_id }) => {
      const result = await getMessagesForProfile(session_id);
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
    }
  );

  registerControlTools(mcp);
  registerPokeAgentsPromptsAndResources(mcp);

  return mcp;
}
