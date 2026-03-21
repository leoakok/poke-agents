/**
 * @deprecated Dashboard loads merged templates from `/api/agent-templates`.
 * Built-in definitions live in `agents/src/agent-templates-data.ts`.
 * Kept for ad-hoc imports; prefer the API for current data.
 */
export type AgentTemplate = {
  /** Stable id — reference as @tester, template:tester, or in JSON. */
  id: string;
  title: string;
  summary: string;
  /** Suggested system-style prefix for `control_agent.prompt` or user message. */
  promptPreamble: string;
  /** How Poke / automation should invoke this template. */
  pokeHint: string;
};

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: "tester",
    title: "Tester",
    summary:
      "Exercises APIs and UI flows, writes minimal repro steps, and suggests edge cases.",
    promptPreamble:
      "[Agent template: tester] You are a testing-focused agent. Prefer small, repeatable checks; cite files and commands; propose tests before large refactors.",
    pokeHint:
      "Call `control_agent` with provider=cursor and a prompt that starts with the preamble above, or nest it after `getting_started` workflow text.",
  },
  {
    id: "reviewer",
    title: "Reviewer",
    summary:
      "Reads diffs and architecture for risks, naming, and missing tests — no drive-by rewrites.",
    promptPreamble:
      "[Agent template: reviewer] You are a code review agent. Be concise: severity-tagged findings, no broad style nitpicks unless they block correctness.",
    pokeHint:
      "Use disk `session` for context, then `control_agent` with trust as appropriate and this preamble as the first paragraph.",
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

export function getAgentTemplate(id: string): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((t) => t.id === id);
}
