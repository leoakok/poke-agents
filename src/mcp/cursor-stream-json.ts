/**
 * Parse Cursor `agent --output-format stream-json` stdout (often NDJSON / line-delimited JSON).
 */
export function parseCursorStreamJsonStdout(stdout: string, maxEvents = 800): {
  stream_json_events: unknown[];
  stream_json_truncated: boolean;
} {
  const lines = stdout.split(/\n/);
  const stream_json_events: unknown[] = [];
  let truncated = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (stream_json_events.length >= maxEvents) {
      truncated = true;
      break;
    }
    if (!line.startsWith("{") && !line.startsWith("[")) continue;
    try {
      stream_json_events.push(JSON.parse(line) as unknown);
    } catch {
      stream_json_events.push({ _parse_error: true, line });
    }
  }
  return { stream_json_events, stream_json_truncated: truncated };
}
