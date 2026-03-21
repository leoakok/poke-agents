export type ChatSegment =
  | { kind: "markdown"; text: string }
  | { kind: "thinking"; text: string };

/** `<user_query>…</user_query>` wrappers (training / tool echoes): drop tags, keep inner text. */
export function unwrapUserQueryTags(raw: string): string {
  let s = raw;
  let prev = "";
  while (s !== prev) {
    prev = s;
    s = s.replace(/<user_query\b[^>]*>([\s\S]*?)<\/user_query>/gi, "$1");
  }
  s = s.replace(/<\/user_query\b[^>]*>/gi, "");
  s = s.replace(/<user_query\b[^>]*>/gi, "");
  return s;
}

/** Chain-of-thought fences: `\`thinking\` … \`/thinking\`` (built without literal escapes). */
const FENCE_OPEN_PRIMARY = ["`", "thinking", "`"].join("");
const FENCE_CLOSE = ["`", "/", "thinking", "`"].join("");
const TAG_OPEN = "<thinking>";
const TAG_CLOSE = "</thinking>";

const TRIPLE_LANGS = new Set([
  "thinking",
  "reasoning",
  "chain-of-thought",
]);

/** Lines that are only leaked delimiter tokens (models sometimes echo markers). */
const LEAKED_LINE =
  /^\s*(`{1,3}\s*)?(\/?thinking|reasoning|\/reasoning|chain-of-thought)(`{1,3})?\s*$/i;

const LEAKED_XML_LINE = /^\s*<\/?thinking>\s*$/i;

/**
 * Drop standalone delimiter-looking lines so they do not render as noisy markdown.
 */
export function scrubLeakedThinkingLines(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => !LEAKED_LINE.test(line) && !LEAKED_XML_LINE.test(line))
    .join("\n");
}

function findTagBlock(
  raw: string,
  from: number,
): { start: number; end: number; inner: string } | null {
  const sub = raw.slice(from);
  const rel = sub.toLowerCase().indexOf(TAG_OPEN.toLowerCase());
  if (rel < 0) return null;
  const start = from + rel;
  const afterOpen = start + TAG_OPEN.length;
  const closeIdx = raw.toLowerCase().indexOf(TAG_CLOSE.toLowerCase(), afterOpen);
  if (closeIdx === -1) return null;
  return {
    start,
    end: closeIdx + TAG_CLOSE.length,
    inner: raw.slice(afterOpen, closeIdx),
  };
}

function findPrimaryFenceBlock(
  raw: string,
  from: number,
): { start: number; end: number; inner: string } | null {
  const sub = raw.slice(from);
  const rel = sub.indexOf(FENCE_OPEN_PRIMARY);
  if (rel < 0) return null;
  const start = from + rel;
  const afterOpen = start + FENCE_OPEN_PRIMARY.length;
  const closeIdx = raw.indexOf(FENCE_CLOSE, afterOpen);
  if (closeIdx === -1) return null;
  return {
    start,
    end: closeIdx + FENCE_CLOSE.length,
    inner: raw.slice(afterOpen, closeIdx),
  };
}

function findTripleFenceBlock(
  raw: string,
  from: number,
): { start: number; end: number; inner: string } | null {
  const tick = "```";
  let pos = from;
  while (pos < raw.length) {
    const i = raw.indexOf(tick, pos);
    if (i === -1) return null;
    const lineEnd = raw.indexOf("\n", i + 3);
    if (lineEnd === -1) {
      pos = i + 3;
      continue;
    }
    const lang = raw.slice(i + 3, lineEnd).trim().toLowerCase();
    if (!TRIPLE_LANGS.has(lang)) {
      pos = lineEnd + 1;
      continue;
    }
    const contentStart = lineEnd + 1;
    const close = raw.indexOf("\n```", contentStart);
    if (close === -1) {
      return {
        start: i,
        end: raw.length,
        inner: raw.slice(contentStart),
      };
    }
    return {
      start: i,
      end: close + 4,
      inner: raw.slice(contentStart, close),
    };
  }
  return null;
}

function pickEarliest(
  a: { start: number; end: number; inner: string } | null,
  b: { start: number; end: number; inner: string } | null,
): { start: number; end: number; inner: string } | null {
  if (!a) return b;
  if (!b) return a;
  return a.start <= b.start ? a : b;
}

function findNextThinkingBlock(
  raw: string,
  from: number,
): { start: number; end: number; inner: string } | null {
  let best: { start: number; end: number; inner: string } | null = null;
  best = pickEarliest(best, findPrimaryFenceBlock(raw, from));
  best = pickEarliest(best, findTagBlock(raw, from));
  best = pickEarliest(best, findTripleFenceBlock(raw, from));
  return best;
}

/** Split model output into markdown vs fenced / XML “thinking” regions. */
export function segmentMessageContent(raw: string): ChatSegment[] {
  const cleaned = scrubLeakedThinkingLines(unwrapUserQueryTags(raw));
  const segments: ChatSegment[] = [];
  let pos = 0;
  while (pos < cleaned.length) {
    const next = findNextThinkingBlock(cleaned, pos);
    if (!next) {
      const tail = cleaned.slice(pos).trimEnd();
      if (tail) segments.push({ kind: "markdown", text: cleaned.slice(pos) });
      break;
    }
    if (next.start > pos) {
      const before = cleaned.slice(pos, next.start);
      if (before.trim()) segments.push({ kind: "markdown", text: before });
    }
    const inner = next.inner.trim();
    if (inner) segments.push({ kind: "thinking", text: inner });
    pos = next.end;
  }
  if (segments.length === 0 && cleaned.trim()) {
    return [{ kind: "markdown", text: cleaned }];
  }
  return segments;
}
