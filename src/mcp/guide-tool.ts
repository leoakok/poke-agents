import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  buildPokeAgentsGuideMarkdown,
  GUIDE_TOPICS,
  normalizePokeAgentsGuideTopic,
} from "./poke-agents-guide-content.js";
import { toolStructured } from "./tool-result.js";
import {
  GUIDE,
  pokeAgentsGuideInput,
  pokeAgentsGuideOutputShape,
} from "./tool-schemas.js";
import { withMcpToolLogging } from "./tool-logging.js";

export function registerPokeAgentsGuideTool(mcp: McpServer): void {
  mcp.registerTool(
    "poke_agents_guide",
    {
      title: GUIDE.poke_agents_guide.title,
      description: GUIDE.poke_agents_guide.description,
      inputSchema: pokeAgentsGuideInput,
      outputSchema: pokeAgentsGuideOutputShape,
    },
    withMcpToolLogging("poke_agents_guide", async (args: { topic?: string }) => {
      const topic = normalizePokeAgentsGuideTopic(args.topic);
      const markdown = buildPokeAgentsGuideMarkdown(topic);
      return toolStructured({
        ok: true as const,
        topic,
        markdown,
        topics: [...GUIDE_TOPICS],
      });
    }),
  );
}
