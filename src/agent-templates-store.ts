import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  BUILTIN_AGENT_TEMPLATES,
  BUILTIN_TEMPLATE_IDS,
  type AgentTemplateJson,
} from "./agent-templates-data.js";

function storePath(): string {
  const env = process.env.POKE_AGENTS_TEMPLATES_PATH?.trim();
  if (env) return env;
  return join(homedir(), ".poke-agents", "agent-templates.json");
}

function readCustom(): AgentTemplateJson[] {
  const p = storePath();
  if (!existsSync(p)) return [];
  try {
    const raw = readFileSync(p, "utf8");
    const j = JSON.parse(raw) as { templates?: unknown };
    if (!Array.isArray(j.templates)) return [];
    return j.templates.filter(isTemplate);
  } catch {
    return [];
  }
}

function isTemplate(x: unknown): x is AgentTemplateJson {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    o.id.length > 0 &&
    typeof o.title === "string" &&
    typeof o.summary === "string" &&
    typeof o.promptPreamble === "string" &&
    typeof o.pokeHint === "string"
  );
}

function writeCustom(templates: AgentTemplateJson[]): void {
  const p = storePath();
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(
    p,
    `${JSON.stringify({ templates }, null, 2)}\n`,
    "utf8",
  );
}

/** Built-ins + custom; custom overrides built-in id if present. */
export function listAgentTemplatesMerged(): AgentTemplateJson[] {
  const custom = readCustom();
  const map = new Map<string, AgentTemplateJson>();
  for (const t of BUILTIN_AGENT_TEMPLATES) map.set(t.id, t);
  for (const t of custom) map.set(t.id, t);
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function upsertCustomAgentTemplate(t: AgentTemplateJson): void {
  const custom = readCustom().filter((x) => x.id !== t.id);
  custom.push(t);
  writeCustom(custom);
}

export function deleteCustomAgentTemplate(id: string): { ok: true } | { ok: false; error: string } {
  if (BUILTIN_TEMPLATE_IDS.has(id)) {
    return { ok: false, error: `Cannot delete built-in template id: ${id}` };
  }
  const custom = readCustom().filter((x) => x.id !== id);
  writeCustom(custom);
  return { ok: true };
}

/** Replace entire custom list (dashboard save). Skips built-in-only rows. */
export function replaceCustomAgentTemplates(templates: AgentTemplateJson[]): void {
  const filtered = templates.filter((t) => !BUILTIN_TEMPLATE_IDS.has(t.id));
  writeCustom(filtered);
}

export function agentTemplatesFileHint(): string {
  return storePath();
}
