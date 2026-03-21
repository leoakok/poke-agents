import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { controlCapabilitiesPayload } from "../control/provider-meta.js";
import {
  cursorAgentAbout,
  cursorAgentStatusText,
  cursorAgentBin,
  cursorCreateEmptyChat,
  cursorRunHeadless,
} from "../control/cursor-agent.js";
import { hintForCursorAgentStderr } from "../control/cursor-agent-hint.js";
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
  controlCapabilitiesOutputShape,
  controlCliChatFromSessionInput,
  controlCliChatFromSessionOutputShape,
  controlCliStatusInput,
  controlCliStatusOutputShape,
  controlCreateSessionInput,
  controlCreateSessionOutputShape,
  controlRunAgentInput,
  controlRunAgentOutputShape,
  controlSessionStatusInput,
  controlSessionStatusOutputShape,
  controlStopInput,
  controlStopOutputShape,
} from "./tool-schemas.js";

function resolveWorkspace(raw?: string): string {
  const w = raw?.trim();
  if (w) return w;
  return process.cwd();
}

export function registerControlTools(mcp: McpServer): void {
  mcp.registerTool(
    "control_capabilities",
    {
      title: CONTROL.capabilities.title,
      description: CONTROL.capabilities.description,
      outputSchema: controlCapabilitiesOutputShape,
    },
    async () =>
      toolStructured(
        controlCapabilitiesPayload() as unknown as Record<string, unknown>
      )
  );

  mcp.registerTool(
    "control_create_session",
    {
      title: CONTROL.create_session.title,
      description: CONTROL.create_session.description,
      inputSchema: controlCreateSessionInput,
      outputSchema: controlCreateSessionOutputShape,
    },
    async ({ provider, workspace }) => {
      if (provider !== "cursor") {
        return toolStructured({
          ok: false,
          provider,
          error: "create_session is not implemented for this provider yet",
        });
      }
      const cwd = resolveWorkspace(workspace);
      const r = await cursorCreateEmptyChat(cwd);
      if (!r.ok) {
        return toolStructured({
          ok: false,
          provider,
          cwd,
          binary: cursorAgentBin(),
          error: r.error,
          stdout: r.stdout,
          stderr: r.stderr,
        });
      }
      return toolStructured({
        ok: true,
        provider,
        cwd,
        chat_id: r.chat_id,
        hint: "Use chat_id as session_id in control_run_agent (Cursor CLI --resume).",
      });
    }
  );

  mcp.registerTool(
    "control_run_agent",
    {
      title: CONTROL.run_agent.title,
      description: CONTROL.run_agent.description,
      inputSchema: controlRunAgentInput,
      outputSchema: controlRunAgentOutputShape,
    },
    async (args) => {
      if (args.provider !== "cursor") {
        return toolStructured({
          ok: false,
          provider: args.provider,
          error: "control_run_agent is not implemented for this provider yet",
        });
      }
      const cwd = resolveWorkspace(args.workspace);
      const r = await cursorRunHeadless({
        cwd,
        prompt: args.prompt,
        sessionId: args.session_id,
        continueSession: args.continue_session,
        outputFormat: args.output_format ?? "text",
        streamPartialOutput: args.stream_partial_output,
        model: args.model,
        mode: args.mode,
        plan: args.plan,
        trust: args.trust,
        force: args.force,
        approveMcps: args.approve_mcps,
        sandbox: args.sandbox,
        cloud: args.cloud,
      });
      const ok = r.code === 0 && !r.timedOut;
      const hint =
        !ok && r.stderr ? hintForCursorAgentStderr(r.stderr) : undefined;
      return toolStructured({
        ok,
        provider: args.provider,
        cwd,
        exit_code: r.code,
        signal: r.signal,
        timed_out: r.timedOut,
        stdout: r.stdout,
        stderr: r.stderr,
        ...(hint ? { hint } : {}),
      });
    }
  );

  mcp.registerTool(
    "control_cli_status",
    {
      title: CONTROL.cli_status.title,
      description: CONTROL.cli_status.description,
      inputSchema: controlCliStatusInput,
      outputSchema: controlCliStatusOutputShape,
    },
    async ({ provider, workspace }) => {
      if (provider !== "cursor") {
        return toolStructured({
          ok: false,
          provider,
          error: "control_cli_status is not implemented for this provider yet",
        });
      }
      const cwd = resolveWorkspace(workspace);
      const [about, status] = await Promise.all([
        cursorAgentAbout(cwd),
        cursorAgentStatusText(cwd),
      ]);
      return toolStructured({
        ok: true,
        provider,
        cwd,
        binary: cursorAgentBin(),
        about,
        status,
      });
    }
  );

  mcp.registerTool(
    "control_session_status",
    {
      title: CONTROL.session_status.title,
      description: CONTROL.session_status.description,
      inputSchema: controlSessionStatusInput,
      outputSchema: controlSessionStatusOutputShape,
    },
    async ({ provider, session_id, include_message_count }) => {
      const parsed = parseUnifiedSessionId(session_id);
      if (!parsed) {
        return toolStructured({
          ok: false,
          error: "Invalid session_id (expected source:base64payload)",
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
        String(chat.source ?? "")
      )?.name;
      const allowed = getAllowedEditorIds();
      if (!adapterName || !allowed.has(adapterName)) {
        return toolStructured({
          ok: false,
          error:
            "Session adapter not in POKE_AGENTS_EDITORS profile or unknown source",
        });
      }
      if (provider === "cursor" && adapterName !== "cursor") {
        return toolStructured({
          ok: false,
          error: `Expected a Cursor session but adapter is "${adapterName}"`,
        });
      }
      if (provider === "opencode" && adapterName !== "opencode") {
        return toolStructured({
          ok: false,
          error: `Expected an OpenCode session but adapter is "${adapterName}"`,
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
      if (!include_message_count) {
        return toolStructured({
          ok: true,
          provider,
          adapter: adapterName,
          session,
          message_count: null,
        });
      }
      const full = await getMessagesForProfile(session_id);
      if (!full.ok) {
        return toolStructured({
          ok: true,
          provider,
          adapter: adapterName,
          session,
          message_count: null,
          message_count_error: full.error,
        });
      }
      return toolStructured({
        ok: true,
        provider,
        adapter: adapterName,
        session,
        message_count: full.messages.length,
      });
    }
  );

  mcp.registerTool(
    "control_stop_session",
    {
      title: CONTROL.stop_session.title,
      description: CONTROL.stop_session.description,
      inputSchema: controlStopInput,
      outputSchema: controlStopOutputShape,
    },
    async ({ provider }) =>
      toolStructured({
        ok: false,
        supported: false,
        provider,
        guidance:
          provider === "cursor"
            ? "The Cursor `agent` CLI does not expose stop/cancel for an in-flight `agent -p` run. Send SIGINT to the process from the host, or wait for it to exit. Cloud Agent work is managed in the Cursor web app."
            : "OpenCode session control via MCP is not implemented yet.",
      })
  );

  mcp.registerTool(
    "control_cursor_cli_chat_from_session",
    {
      title: CONTROL.cli_chat_from_session.title,
      description: CONTROL.cli_chat_from_session.description,
      inputSchema: controlCliChatFromSessionInput,
      outputSchema: controlCliChatFromSessionOutputShape,
    },
    async ({ session_id }) => {
      const parsed = parseUnifiedSessionId(session_id);
      if (!parsed) {
        return toolStructured({ ok: false, error: "Invalid session_id" });
      }
      let chat: Record<string, unknown>;
      try {
        chat = decodeChatRef(parsed.nativeId);
      } catch {
        return toolStructured({ ok: false, error: "Bad session payload" });
      }
      const src = String(chat.source ?? "");
      if (!src.startsWith("cursor")) {
        return toolStructured({
          ok: false,
          error: `Not a Cursor-backed row (source=${src})`,
        });
      }
      const composerId =
        typeof chat.composerId === "string" ? chat.composerId : null;
      return toolStructured({
        ok: true,
        session_id,
        cli_chat_id: composerId,
        hint: composerId
          ? "Pass cli_chat_id as session_id to control_run_agent."
          : "No composerId on this row; use control_create_session for a new CLI UUID or inspect row_keys.",
        row_keys: Object.keys(chat).sort(),
      });
    }
  );
}
