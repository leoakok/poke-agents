import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { controlCapabilitiesPayload } from "../control/provider-meta.js";
import { resolveControlBackend } from "../control/control-backend.js";
import {
  cursorAgentAbout,
  cursorAgentStatusText,
  cursorAgentBin,
} from "../control/cursor-agent.js";
import {
  codexBin,
  codexLoginStatusText,
  codexVersionLine,
} from "../control/codex-cli.js";
import {
  openCodeAuthListText,
  openCodeVersionLine,
  opencodeBin,
} from "../control/opencode-cli.js";
import { chatToSummary, decodeChatRef } from "../connectors/chat-ref.js";
import { parseUnifiedSessionId } from "../connectors/types.js";
import { getMessagesForProfile } from "../connectors/registry.js";
import { getAllowedEditorIds } from "../profile.js";
import {
  editorForChatSource,
  loadVendorEditors,
} from "../connectors/vendor-editors-load.js";
import { toolStructured } from "./tool-result.js";
import {
  CONTROL,
  controlChatAroundInput,
  controlAgentCheckInput,
  controlAgentCheckOutputShape,
  controlAgentInput,
  controlAgentOutputShape,
  controlChatSliceInput,
  controlChatSliceOutputShape,
  controlChatTailInput,
  controlDiskToCliInput,
  controlDiskToCliOutputShape,
  controlPlanOutputShape,
  controlRunOutputSliceInput,
  controlRunOutputSliceOutputShape,
  controlRunStatusInput,
  controlRunStatusOutputShape,
  controlSessionMetaInput,
  controlSessionMetaOutputShape,
} from "./tool-schemas.js";
import { withMcpToolLogging } from "./tool-logging.js";
import {
  controlAgentStart,
  type ControlAgentStartArgs,
} from "../control/control-agent-start.js";
import { getRun } from "../control/run-registry.js";
import { sliceText } from "../control/output-slice.js";

function resolveCwd(raw?: string): string {
  const w = raw?.trim();
  if (w) return w;
  return process.cwd();
}

async function loadDiskTranscript(id: string) {
  const result = await getMessagesForProfile(id);
  if (!result.ok) return { ok: false as const, error: result.error };
  return {
    ok: true as const,
    session: result.session,
    messages: result.messages,
  };
}

export function registerControlTools(mcp: McpServer): void {
  mcp.registerTool(
    "control_plan",
    {
      title: CONTROL.plan.title,
      description: CONTROL.plan.description,
      outputSchema: controlPlanOutputShape,
    },
    withMcpToolLogging(
      "control_plan",
      async () =>
        toolStructured(
          controlCapabilitiesPayload() as unknown as Record<string, unknown>,
        ),
    ),
  );

  mcp.registerTool(
    "control_agent",
    {
      title: CONTROL.agent.title,
      description: CONTROL.agent.description,
      inputSchema: controlAgentInput,
      outputSchema: controlAgentOutputShape,
    },
    withMcpToolLogging("control_agent", async (args) => {
      return controlAgentStart(args as ControlAgentStartArgs);
    }),
  );

  mcp.registerTool(
    "control_run_status",
    {
      title: CONTROL.run_status.title,
      description: CONTROL.run_status.description,
      inputSchema: controlRunStatusInput,
      outputSchema: controlRunStatusOutputShape,
    },
    withMcpToolLogging("control_run_status", async ({ run_id }) => {
      const rec = getRun(run_id);
      if (!rec) {
        return toolStructured({
          ok: false,
          error: "Unknown run_id (expired or invalid)",
        });
      }
      return toolStructured({
        ok: true,
        run_id: rec.run_id,
        status: rec.status,
        created_at: rec.created_at,
        updated_at: rec.updated_at,
        backend: rec.provider,
        cwd: rec.cwd,
        prompt_preview: rec.prompt_preview,
        resume_uuid: rec.resume_uuid,
        auto_created_cli_chat_uuid: rec.auto_created_cli_chat_uuid,
        pid: rec.pid,
        exit_code: rec.exit_code,
        signal: rec.signal,
        timed_out: rec.timed_out,
        stdout_length: rec.stdout.length,
        stderr_length: rec.stderr.length,
        format: rec.format,
        ...(rec.error ? { run_error: rec.error } : {}),
      });
    }),
  );

  mcp.registerTool(
    "control_run_output_slice",
    {
      title: CONTROL.run_output_slice.title,
      description: CONTROL.run_output_slice.description,
      inputSchema: controlRunOutputSliceInput,
      outputSchema: controlRunOutputSliceOutputShape,
    },
    withMcpToolLogging(
      "control_run_output_slice",
      async ({ run_id, stream, offset, limit }) => {
        const rec = getRun(run_id);
        if (!rec) {
          return toolStructured({
            ok: false,
            error: "Unknown run_id (expired or invalid)",
          });
        }
        const buf = stream === "stdout" ? rec.stdout : rec.stderr;
        const off = offset ?? 0;
        const lim = limit ?? 8_000;
        const sliced = sliceText(buf, off, lim);
        return toolStructured({
          ok: true,
          run_id: rec.run_id,
          stream,
          offset: off,
          limit: lim,
          total_length: sliced.total_length,
          next_offset: sliced.next_offset,
          text: sliced.text,
          truncated: sliced.truncated,
        });
      },
    ),
  );

  mcp.registerTool(
    "control_chat_slice",
    {
      title: CONTROL.chat_slice.title,
      description: CONTROL.chat_slice.description,
      inputSchema: controlChatSliceInput,
      outputSchema: controlChatSliceOutputShape,
    },
    withMcpToolLogging(
      "control_chat_slice",
      async ({ id, offset, limit }) => {
        const loaded = await loadDiskTranscript(id);
        if (!loaded.ok) {
          return toolStructured({ ok: false, error: loaded.error });
        }
        const off = offset ?? 0;
        const lim = limit ?? 50;
        const slice = loaded.messages.slice(off, off + lim);
        const truncated = off + slice.length < loaded.messages.length;
        return toolStructured({
          ok: true,
          session: loaded.session,
          messages: slice,
          offset: off,
          total_count: loaded.messages.length,
          truncated,
        });
      },
    ),
  );

  mcp.registerTool(
    "control_chat_tail",
    {
      title: CONTROL.chat_tail.title,
      description: CONTROL.chat_tail.description,
      inputSchema: controlChatTailInput,
      outputSchema: controlChatSliceOutputShape,
    },
    withMcpToolLogging("control_chat_tail", async ({ id, limit }) => {
      const loaded = await loadDiskTranscript(id);
      if (!loaded.ok) {
        return toolStructured({ ok: false, error: loaded.error });
      }
      const lim = limit ?? 30;
      const total = loaded.messages.length;
      const start = Math.max(0, total - lim);
      const slice = loaded.messages.slice(start);
      const truncated = start > 0;
      return toolStructured({
        ok: true,
        session: loaded.session,
        messages: slice,
        offset: start,
        total_count: total,
        truncated,
      });
    }),
  );

  mcp.registerTool(
    "control_chat_around",
    {
      title: CONTROL.chat_around.title,
      description: CONTROL.chat_around.description,
      inputSchema: controlChatAroundInput,
      outputSchema: controlChatSliceOutputShape,
    },
    withMcpToolLogging(
      "control_chat_around",
      async ({ id, index, before, after }) => {
        const loaded = await loadDiskTranscript(id);
        if (!loaded.ok) {
          return toolStructured({ ok: false, error: loaded.error });
        }
        const b = before ?? 5;
        const a = after ?? 5;
        const total = loaded.messages.length;
        const start = Math.max(0, index - b);
        const end = Math.min(total, index + a + 1);
        const slice = loaded.messages.slice(start, end);
        const truncated = start > 0 || end < total;
        return toolStructured({
          ok: true,
          session: loaded.session,
          messages: slice,
          offset: start,
          total_count: total,
          truncated,
        });
      },
    ),
  );

  mcp.registerTool(
    "control_agent_check",
    {
      title: CONTROL.agent_check.title,
      description: CONTROL.agent_check.description,
      inputSchema: controlAgentCheckInput,
      outputSchema: controlAgentCheckOutputShape,
    },
    withMcpToolLogging("control_agent_check", async ({ cwd }) => {
      const backend = resolveControlBackend();
      const resolved = resolveCwd(cwd);
      if (backend === "cursor") {
        const [about, status] = await Promise.all([
          cursorAgentAbout(resolved),
          cursorAgentStatusText(resolved),
        ]);
        return toolStructured({
          ok: true,
          backend,
          cwd: resolved,
          binary: cursorAgentBin(),
          about,
          status,
        });
      }
      if (backend === "opencode") {
        const [about, status] = await Promise.all([
          openCodeVersionLine(resolved),
          openCodeAuthListText(resolved),
        ]);
        return toolStructured({
          ok: true,
          backend,
          cwd: resolved,
          binary: opencodeBin(),
          about,
          status,
        });
      }
      const [about, status] = await Promise.all([
        codexVersionLine(resolved),
        codexLoginStatusText(resolved),
      ]);
      return toolStructured({
        ok: true,
        backend,
        cwd: resolved,
        binary: codexBin(),
        about,
        status,
      });
    }),
  );

  mcp.registerTool(
    "control_session_meta",
    {
      title: CONTROL.session_meta.title,
      description: CONTROL.session_meta.description,
      inputSchema: controlSessionMetaInput,
      outputSchema: controlSessionMetaOutputShape,
    },
    withMcpToolLogging(
      "control_session_meta",
      async ({ id, count }) => {
        const parsed = parseUnifiedSessionId(id);
        if (!parsed) {
          return toolStructured({
            ok: false,
            error: "Invalid id (expected source:base64payload)",
          });
        }
        let chat: Record<string, unknown>;
        try {
          chat = decodeChatRef(parsed.nativeId);
        } catch {
          return toolStructured({ ok: false, error: "Bad session payload" });
        }
        const bundle = loadVendorEditors();
        const adapterName = editorForChatSource(
          bundle.editors,
          String(chat.source ?? ""),
        )?.name;
        const allowed = getAllowedEditorIds();
        if (!adapterName || !allowed.has(adapterName)) {
          return toolStructured({
            ok: false,
            error:
              "Session adapter not in POKE_AGENTS_EDITORS profile or unknown source",
          });
        }
        const summary = chatToSummary(chat);
        const session = {
          id: summary.id,
          source: summary.source,
          title: summary.title,
          project_path: summary.projectPath,
          last_updated_at: summary.lastUpdatedAt,
        };
        if (!count) {
          return toolStructured({
            ok: true,
            adapter: adapterName,
            session,
            message_count: null,
          });
        }
        const full = await getMessagesForProfile(id);
        if (!full.ok) {
          return toolStructured({
            ok: true,
            adapter: adapterName,
            session,
            message_count: null,
            message_count_error: full.error,
          });
        }
        return toolStructured({
          ok: true,
          adapter: adapterName,
          session,
          message_count: full.messages.length,
        });
      },
    ),
  );

  mcp.registerTool(
    "control_disk_to_cli",
    {
      title: CONTROL.disk_to_cli.title,
      description: CONTROL.disk_to_cli.description,
      inputSchema: controlDiskToCliInput,
      outputSchema: controlDiskToCliOutputShape,
    },
    withMcpToolLogging("control_disk_to_cli", async ({ id }) => {
      const parsed = parseUnifiedSessionId(id);
      if (!parsed) {
        return toolStructured({ ok: false, error: "Invalid id" });
      }
      let chat: Record<string, unknown>;
      try {
        chat = decodeChatRef(parsed.nativeId);
      } catch {
        return toolStructured({ ok: false, error: "Bad session payload" });
      }
      const composerId =
        typeof chat.composerId === "string" ? chat.composerId : null;
      return toolStructured({
        ok: true,
        id,
        uuid: composerId,
        hint: composerId
          ? "Pass uuid as `resume` in control_agent (Cursor uuid, OpenCode ses_…, or Codex thread uuid)."
          : "No composerId on this row; call control_agent without resume for a new headless session, or inspect keys.",
        keys: Object.keys(chat).sort(),
      });
    }),
  );
}
