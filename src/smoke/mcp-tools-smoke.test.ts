/**
 * In-process MCP smoke: list tools + one call per tool (safe args; no long-running Cursor runs).
 *
 * Run: npm run test:smoke
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createPokeAgentsMcpServer } from "../mcp/server.js";

/** All tools registered by createPokeAgentsMcpServer (keep in sync when adding tools). */
export const EXPECTED_MCP_TOOL_NAMES = [
  "adapters",
  "sessions",
  "session",
  "poke_agents_guide",
  "control_plan",
  "control_agent",
  "control_run_status",
  "control_run_output_slice",
  "control_chat_slice",
  "control_chat_tail",
  "control_chat_around",
  "control_agent_check",
  "control_session_meta",
  "control_disk_to_cli",
  "agent_templates",
] as const;

function structured(r: unknown): Record<string, unknown> {
  const sc = (r as { structuredContent?: unknown }).structuredContent;
  assert.ok(
    sc !== undefined && typeof sc === "object",
    "expected structuredContent object",
  );
  return sc as Record<string, unknown>;
}

describe(
  "MCP tools smoke (in-memory transport)",
  { concurrency: false },
  () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = createPokeAgentsMcpServer();
  const client = new Client({ name: "poke-agents-smoke", version: "0.0.0" });

  before(async () => {
    process.env.POKE_AGENTS_MCP_LOG = "0";
    await serverTransport.start();
    await clientTransport.start();
    await mcp.connect(serverTransport);
    await client.connect(clientTransport);
    await client.listTools();
  });

  after(async () => {
    await client.close();
    await mcp.close();
  });

  test("tools/list includes every expected tool name", async () => {
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    for (const name of EXPECTED_MCP_TOOL_NAMES) {
      assert.ok(names.has(name), `missing tool: ${name}`);
    }
  });

  test("adapters", async () => {
    const r = await client.callTool({ name: "adapters", arguments: {} });
    const s = structured(r);
    assert.equal(s.ok, true);
    assert.ok(Array.isArray(s.connectors));
    assert.ok(Array.isArray(s.editors));
    const ids = new Set(
      (s.connectors as { id: string }[]).map((c: { id: string }) => c.id),
    );
    for (const need of ["cursor", "opencode", "codex"]) {
      assert.ok(ids.has(need), `adapters should list core id ${need}`);
    }
  });

  test("sessions", async () => {
    const r = await client.callTool({ name: "sessions", arguments: {} });
    const s = structured(r);
    assert.equal(s.ok, true);
    assert.ok(Array.isArray(s.sessions));
  });

  test("session (invalid id)", async () => {
    const r = await client.callTool({
      name: "session",
      arguments: { id: "not-a-valid-session-id" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
    assert.ok(typeof s.error === "string");
  });

  test("poke_agents_guide (overview)", async () => {
    const r = await client.callTool({
      name: "poke_agents_guide",
      arguments: {},
    });
    const s = structured(r);
    assert.equal(s.ok, true);
    assert.equal(s.topic, "overview");
    assert.ok(typeof s.markdown === "string" && s.markdown.length > 100);
    assert.ok(Array.isArray(s.topics));
  });

  test("poke_agents_guide (invalid topic falls back)", async () => {
    const r = await client.callTool({
      name: "poke_agents_guide",
      arguments: { topic: "not-a-real-topic" },
    });
    const s = structured(r);
    assert.equal(s.ok, true);
    assert.equal(s.topic, "overview");
  });

  test("control_plan", async () => {
    const r = await client.callTool({ name: "control_plan", arguments: {} });
    const s = structured(r);
    assert.ok(Array.isArray(s.providers));
    assert.ok(typeof s.cursor_agent_binary === "string");
    assert.ok(typeof s.opencode_cli_binary === "string");
    assert.ok(typeof s.codex_cli_binary === "string");
    assert.ok(
      s.active_control === "cursor" ||
        s.active_control === "opencode" ||
        s.active_control === "codex",
    );
    assert.ok(s.orchestration && typeof s.orchestration === "object");
    assert.ok(
      typeof (s.orchestration as { http_mcp_and_tunnel?: string })
        .http_mcp_and_tunnel === "string",
    );
  });

  test("control_agent (invalid agent_template → fast fail, no CLI)", async () => {
    const r = await client.callTool({
      name: "control_agent",
      arguments: {
        prompt: "smoke-no-run",
        agent_template: "__poke_agents_nonexistent_template_smoke__",
      },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
    assert.equal(s.accepted, false);
    assert.equal(s.status, "failed_to_start");
    assert.ok(
      typeof s.error === "string" && s.error.length > 0,
      "expected error string",
    );
  });

  test("control_agent (cursor, invalid binary → fast fail)", async () => {
    const prevBin = process.env.POKE_AGENTS_CURSOR_AGENT_BIN;
    const prevCtl = process.env.POKE_AGENTS_CONTROL;
    process.env.POKE_AGENTS_CONTROL = "cursor";
    process.env.POKE_AGENTS_CURSOR_AGENT_BIN =
      process.platform === "win32" ? "cmd.exe" : "/usr/bin/false";
    try {
      const r = await client.callTool({
        name: "control_agent",
        arguments: { prompt: "smoke-no-run" },
      });
      const s = structured(r);
      assert.equal(s.ok, false);
      assert.equal(s.accepted, false);
      assert.equal(s.status, "failed_to_start");
      assert.equal(s.backend, "cursor");
    } finally {
      if (prevBin === undefined) delete process.env.POKE_AGENTS_CURSOR_AGENT_BIN;
      else process.env.POKE_AGENTS_CURSOR_AGENT_BIN = prevBin;
      if (prevCtl === undefined) delete process.env.POKE_AGENTS_CONTROL;
      else process.env.POKE_AGENTS_CONTROL = prevCtl;
    }
  });

  test("control_agent (codex, invalid binary → fast fail)", async () => {
    const prevBin = process.env.POKE_AGENTS_CODEX_BIN;
    const prevCtl = process.env.POKE_AGENTS_CONTROL;
    process.env.POKE_AGENTS_CONTROL = "codex";
    process.env.POKE_AGENTS_CODEX_BIN =
      "/nonexistent/poke-agents-codex-smoke-missing";
    try {
      const r = await client.callTool({
        name: "control_agent",
        arguments: { prompt: "smoke-no-run" },
      });
      const s = structured(r);
      assert.equal(s.ok, false);
      assert.equal(s.accepted, false);
      assert.equal(s.status, "failed_to_start");
      assert.equal(s.backend, "codex");
    } finally {
      if (prevBin === undefined) delete process.env.POKE_AGENTS_CODEX_BIN;
      else process.env.POKE_AGENTS_CODEX_BIN = prevBin;
      if (prevCtl === undefined) delete process.env.POKE_AGENTS_CONTROL;
      else process.env.POKE_AGENTS_CONTROL = prevCtl;
    }
  });

  test("control_agent (opencode, invalid binary → fast fail)", async () => {
    const prevBin = process.env.POKE_AGENTS_OPENCODE_BIN;
    const prevCtl = process.env.POKE_AGENTS_CONTROL;
    process.env.POKE_AGENTS_CONTROL = "opencode";
    process.env.POKE_AGENTS_OPENCODE_BIN =
      "/nonexistent/poke-agents-opencode-smoke-missing";
    try {
      const r = await client.callTool({
        name: "control_agent",
        arguments: { prompt: "smoke-no-run" },
      });
      const s = structured(r);
      assert.equal(s.ok, false);
      assert.equal(s.accepted, false);
      assert.equal(s.status, "failed_to_start");
      assert.equal(s.backend, "opencode");
    } finally {
      if (prevBin === undefined) delete process.env.POKE_AGENTS_OPENCODE_BIN;
      else process.env.POKE_AGENTS_OPENCODE_BIN = prevBin;
      if (prevCtl === undefined) delete process.env.POKE_AGENTS_CONTROL;
      else process.env.POKE_AGENTS_CONTROL = prevCtl;
    }
  });

  test("control_run_status (unknown run)", async () => {
    const r = await client.callTool({
      name: "control_run_status",
      arguments: { run_id: "run_not_found_smoke" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_run_output_slice (unknown run)", async () => {
    const r = await client.callTool({
      name: "control_run_output_slice",
      arguments: { run_id: "run_not_found_smoke", stream: "stdout" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_chat_slice (bad disk id)", async () => {
    const r = await client.callTool({
      name: "control_chat_slice",
      arguments: { id: "cursor:x", offset: 0, limit: 5 },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_chat_tail (bad disk id)", async () => {
    const r = await client.callTool({
      name: "control_chat_tail",
      arguments: { id: "cursor:x", limit: 3 },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_chat_around (bad disk id)", async () => {
    const r = await client.callTool({
      name: "control_chat_around",
      arguments: { id: "cursor:x", index: 0, before: 1, after: 1 },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_agent_check", async () => {
    const r = await client.callTool({
      name: "control_agent_check",
      arguments: {},
    });
    const s = structured(r);
    assert.equal(s.ok, true);
    assert.ok(
      s.backend === "cursor" ||
        s.backend === "opencode" ||
        s.backend === "codex",
    );
  });

  test("control_session_meta (invalid id)", async () => {
    const r = await client.callTool({
      name: "control_session_meta",
      arguments: { id: "nope" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_disk_to_cli (invalid payload)", async () => {
    const r = await client.callTool({
      name: "control_disk_to_cli",
      arguments: { id: "cursor:x" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("agent_templates list", async () => {
    const r = await client.callTool({
      name: "agent_templates",
      arguments: { action: "list" },
    });
    const s = structured(r);
    assert.equal(s.ok, true);
    assert.ok(Array.isArray(s.templates));
    assert.ok(Array.isArray(s.built_in_ids));
  });
});
