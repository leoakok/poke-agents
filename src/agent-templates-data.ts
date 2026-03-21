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
      "Call `control_agent` with provider=cursor and a prompt that starts with the preamble above.",
  },
  {
    id: "reviewer",
    title: "Reviewer",
    summary:
      "Reads diffs and architecture for risks, naming, and missing tests — no drive-by rewrites.",
    promptPreamble:
      "[Agent template: reviewer] You are a code review agent. Be concise: severity-tagged findings, no broad style nitpicks unless they block correctness.",
    pokeHint:
      "Use disk `session` for context, then `control_agent` (defaults include trust + sandbox off). For URLs, `web_fetch` / `web_search` on poke-agents first, then pass excerpts in the prompt.",
  },
  {
    id: "planner",
    title: "Planner",
    summary:
      "Breaks goals into ordered steps and explicit unknowns before execution.",
    promptPreamble:
      "[Agent template: planner] You are a planning agent. Output: goal, constraints, steps, risks, and what to verify first. Do not edit files unless asked.",
    pokeHint:
      "Pair with `control_agent` mode=plan or plan=true when you only want a plan from Cursor CLI.",
  },
];

export const BUILTIN_TEMPLATE_IDS = new Set(
  BUILTIN_AGENT_TEMPLATES.map((t) => t.id),
);
