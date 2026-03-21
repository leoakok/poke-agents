import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BUILTIN_TEMPLATE_IDS } from "../agent-templates-data.js";
import {
  agentTemplatesFileHint,
  deleteCustomAgentTemplate,
  mapTemplatesApiRows,
  upsertCustomAgentTemplate,
} from "../agent-templates-store.js";
import { toolStructured } from "./tool-result.js";
import {
  READ,
  agentTemplatesInput,
  agentTemplatesOutputShape,
} from "./tool-schemas.js";
import { withMcpToolLogging } from "./tool-logging.js";

export function registerAgentTemplateTools(mcp: McpServer): void {
  mcp.registerTool(
    "agent_templates",
    {
      title: READ.agent_templates.title,
      description: READ.agent_templates.description,
      inputSchema: agentTemplatesInput,
      outputSchema: agentTemplatesOutputShape,
    },
    withMcpToolLogging("agent_templates", async (args) => {
      const path = agentTemplatesFileHint();
      if (args.action === "list") {
        return toolStructured({
          ok: true,
          storage_path: path,
          built_in_ids: [...BUILTIN_TEMPLATE_IDS],
          templates: mapTemplatesApiRows(),
        });
      }
      if (args.action === "upsert") {
        if (!args.template) {
          return toolStructured({
            ok: false,
            error: "upsert requires `template`",
          });
        }
        const t = args.template;
        upsertCustomAgentTemplate({
          id: t.id.trim(),
          title: t.title,
          summary: t.summary,
          promptPreamble: t.promptPreamble,
          pokeHint: t.pokeHint,
        });
        return toolStructured({
          ok: true,
          storage_path: path,
          built_in_ids: [...BUILTIN_TEMPLATE_IDS],
          templates: mapTemplatesApiRows(),
        });
      }
      if (args.action === "delete") {
        const id = args.delete_id?.trim();
        if (!id) {
          return toolStructured({
            ok: false,
            error: "delete requires `delete_id`",
          });
        }
        const r = deleteCustomAgentTemplate(id);
        if (!r.ok) {
          return toolStructured({ ok: false, error: r.error });
        }
        return toolStructured({
          ok: true,
          storage_path: path,
          built_in_ids: [...BUILTIN_TEMPLATE_IDS],
          templates: mapTemplatesApiRows(),
        });
      }
      return toolStructured({ ok: false, error: "Unknown action" });
    }),
  );
}
