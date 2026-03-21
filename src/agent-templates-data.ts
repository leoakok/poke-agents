/** Built-in templates (ids reserved — not stored on disk). */
export type AgentTemplateJson = {
  id: string;
  title: string;
  summary: string;
  promptPreamble: string;
  pokeHint: string;
};

export const BUILTIN_AGENT_TEMPLATES: AgentTemplateJson[] = [
  {
    id: "tester",
    title: "Tester",
    summary:
      "Exercises APIs and UI flows, writes minimal repro steps, and suggests edge cases.",
    promptPreamble:
      "[Agent template: tester] You are a testing-focused agent. Prefer small, repeatable checks; cite files and commands; propose tests before large refactors.",
    pokeHint:
      "Prefer `control_agent` with `agent_template: \"tester\"` plus your task in `prompt`, or paste the preamble manually.",
  },
  {
    id: "reviewer",
    title: "Reviewer",
    summary:
      "Reads diffs and architecture for risks, naming, and missing tests — no drive-by rewrites.",
    promptPreamble:
      "[Agent template: reviewer] You are a code review agent. Be concise: severity-tagged findings, no broad style nitpicks unless they block correctness.",
    pokeHint:
      "`control_agent` with `agent_template: \"reviewer\"` plus your ask; use disk `session` for context. For URLs/search, use Poke’s tools first, then pass excerpts in `prompt`.",
  },
  {
    id: "planner",
    title: "Planner",
    summary:
      "Breaks goals into ordered steps and explicit unknowns before execution.",
    promptPreamble:
      "[Agent template: planner] You are a planning agent. Output: goal, constraints, steps, risks, and what to verify first. Do not edit files unless asked.",
    pokeHint:
      "`control_agent` with `agent_template: \"planner\"`; when `POKE_AGENTS_CONTROL=cursor`, add `mode=plan` or `plan=true` for plan-only output.",
  },
];

export const BUILTIN_TEMPLATE_IDS = new Set(
  BUILTIN_AGENT_TEMPLATES.map((t) => t.id),
);
