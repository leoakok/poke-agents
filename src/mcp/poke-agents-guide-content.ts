import {
  RESOURCE_AGENT_STREAMING,
  RESOURCE_GUIDE_OVERVIEW,
  RESOURCE_GUIDE_PROMPTS,
  RESOURCE_GUIDE_TEMPLATES,
  RESOURCE_GUIDE_TUNNEL,
  RESOURCE_SESSION_IDS,
  RESOURCE_TOOLS_CONTROL,
  RESOURCE_TOOLS_READ,
} from "./guide-md.js";

/** Valid `topic` values for `poke_agents_guide`. */
export const GUIDE_TOPICS = [
  "overview",
  "read",
  "control",
  "session_ids",
  "streaming",
  "tunnel",
  "templates",
  "prompts",
  "all",
] as const;

export type PokeAgentsGuideTopic = (typeof GUIDE_TOPICS)[number];

function isGuideTopic(s: string): s is PokeAgentsGuideTopic {
  return (GUIDE_TOPICS as readonly string[]).includes(s);
}

export function normalizePokeAgentsGuideTopic(
  raw: string | undefined,
): PokeAgentsGuideTopic {
  const t = raw?.trim();
  if (t && isGuideTopic(t)) return t;
  return "overview";
}

export function buildPokeAgentsGuideMarkdown(
  topic: PokeAgentsGuideTopic,
): string {
  switch (topic) {
    case "overview":
      return RESOURCE_GUIDE_OVERVIEW;
    case "read":
      return RESOURCE_TOOLS_READ;
    case "control":
      return RESOURCE_TOOLS_CONTROL;
    case "session_ids":
      return RESOURCE_SESSION_IDS;
    case "streaming":
      return RESOURCE_AGENT_STREAMING;
    case "tunnel":
      return RESOURCE_GUIDE_TUNNEL;
    case "templates":
      return RESOURCE_GUIDE_TEMPLATES;
    case "prompts":
      return RESOURCE_GUIDE_PROMPTS;
    case "all":
      return [
        RESOURCE_GUIDE_OVERVIEW,
        "\n\n---\n\n",
        RESOURCE_TOOLS_READ,
        "\n\n---\n\n",
        RESOURCE_TOOLS_CONTROL,
        "\n\n---\n\n",
        RESOURCE_SESSION_IDS,
        "\n\n---\n\n",
        RESOURCE_AGENT_STREAMING,
        "\n\n---\n\n",
        RESOURCE_GUIDE_TUNNEL,
        "\n\n---\n\n",
        RESOURCE_GUIDE_TEMPLATES,
        "\n\n---\n\n",
        RESOURCE_GUIDE_PROMPTS,
      ].join("");
    default: {
      const _exhaustive: never = topic;
      return _exhaustive;
    }
  }
}
