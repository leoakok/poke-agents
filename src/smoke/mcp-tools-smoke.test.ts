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
  "control_plan",
  "control_chat_new",
  "control_agent",
  "control_agent_start",
  "control_run_status",
  "control_run_output_slice",
  "control_chat_slice",
  "control_chat_tail",
  "control_chat_around",
  "control_agent_check",
  "control_session_meta",
  "control_disk_to_cli",
  "agent_templates",
  "web_fetch",
  "web_search",
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

  test("control_plan", async () => {
    const r = await client.callTool({ name: "control_plan", arguments: {} });
    const s = structured(r);
    assert.ok(Array.isArray(s.providers));
    assert.ok(typeof s.cursor_agent_binary === "string");
  });

  test("control_chat_new (opencode stub)", async () => {
    const r = await client.callTool({
      name: "control_chat_new",
      arguments: { provider: "opencode" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_agent (opencode stub)", async () => {
    const r = await client.callTool({
      name: "control_agent",
      arguments: { provider: "opencode", prompt: "noop" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_agent_start (opencode stub)", async () => {
    const r = await client.callTool({
      name: "control_agent_start",
      arguments: { provider: "opencode", prompt: "noop" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
    assert.equal(s.accepted, false);
    assert.equal(s.status, "failed_to_start");
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

  test("control_agent_check (opencode stub)", async () => {
    const r = await client.callTool({
      name: "control_agent_check",
      arguments: { provider: "opencode" },
    });
    const s = structured(r);
    assert.equal(s.ok, false);
  });

  test("control_session_meta (invalid id)", async () => {
    const r = await client.callTool({
      name: "control_session_meta",
      arguments: { provider: "cursor", id: "nope" },
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

  test("web_fetch (example.com)", async () => {
    const r = await client.callTool({
      name: "web_fetch",
      arguments: { url: "https://example.com", timeout_ms: 10_000 },
    });
    const s = structured(r);
    assert.ok(typeof s.ok === "boolean");
    if (s.ok === true) {
      assert.equal(typeof s.status, "number");
    } else {
      assert.ok(typeof s.error === "string");
    }
  });

  test("web_search (no API key or network)", async () => {
    const r = await client.callTool({
      name: "web_search",
      arguments: { query: "poke-agents smoke" },
    });
    const s = structured(r);
    assert.ok(typeof s.ok === "boolean");
    if (s.ok === false) {
      assert.ok(
        typeof s.error === "string" || typeof s.setup === "string",
        "expected error or setup when search fails",
      );
    } else {
      assert.ok(Array.isArray(s.results));
    }
  });
});
