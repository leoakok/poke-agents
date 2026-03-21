import type { AgentTemplateJson } from "../agent-templates-data.js";
import { listAgentTemplatesMerged } from "../agent-templates-store.js";

export type ResolvedControlAgentPrompt =
  | {
      ok: true;
      effectivePrompt: string;
      templateId?: string;
      templateTitle?: string;
    }
  | { ok: false; error: string };

/**
 * When `agent_template` is set, prepend that template's `promptPreamble` to the user prompt.
 * Template ids come from merged `agent_templates` list (built-ins + `~/.poke-agents/agent-templates.json`).
 */
export function resolveControlAgentPromptWithTemplate(
  agentTemplateId: string | undefined,
  userPrompt: string,
): ResolvedControlAgentPrompt {
  const trimmedPrompt = userPrompt.trim();
  const id = agentTemplateId?.trim();
  if (!id) {
    return { ok: true, effectivePrompt: trimmedPrompt };
  }
  const merged = listAgentTemplatesMerged();
  const t = merged.find((row: AgentTemplateJson) => row.id === id);
  if (!t) {
    return {
      ok: false,
      error: `Unknown agent_template "${id}". Call agent_templates with action "list" for valid ids.`,
    };
  }
  const preamble = t.promptPreamble.trim();
  const effectivePrompt = preamble
    ? `${preamble}\n\n${trimmedPrompt}`
    : trimmedPrompt;
  return {
    ok: true,
    effectivePrompt,
    templateId: t.id,
    templateTitle: t.title,
  };
}
