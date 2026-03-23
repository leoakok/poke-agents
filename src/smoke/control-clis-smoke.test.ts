/**
 * End-to-end smoke: real CLIs (Cursor Agent, OpenCode, Codex, Claude Code) — one short prompt each,
 * wait for completion, assert the model output contains a known token.
 *
 * Uses whichever CLIs are installed (default: **skip** missing binaries). Set **`POKE_AGENTS_SMOKE_PARTIAL=0`**
 * to require all four on PATH (or *BIN overrides) with working auth.
 *
 * Run all four in one go:
 *   npm run test:smoke:control
 *
 * Or with full MCP tool smoke + these CLIs:
 *   npm run test:smoke:all
 *
 * Env:
 *   POKE_AGENTS_SMOKE_CONTROL_CLIS=1  — required (set by npm scripts above)
 *   POKE_AGENTS_SMOKE_CWD             — cwd for runs (default: process.cwd())
 *   POKE_AGENTS_SMOKE_WORKSPACE     — optional `workspace` arg for Cursor runs
 *   POKE_AGENTS_SMOKE_AGENT_TIMEOUT_MS — per-run CLI timeout (default: 180000)
 *   POKE_AGENTS_CODEX_SKIP_GIT=1      — passed through for non-git cwd (codex)
 *   POKE_AGENTS_SMOKE_PARTIAL         — skip backends whose CLI is missing (**default: on** — unset or any value except 0/false/off). Set **`0`** / **`false`** / **`off`** to **require** every backend’s binary (fail if codex/claude/etc. not installed).
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, before, describe, test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { claudeBin, claudeSpawnCheck } from "../control/claude-cli.js";
import { codexSpawnCheck } from "../control/codex-cli.js";
import { cursorAgentBin } from "../control/cursor-agent.js";
import { opencodeSpawnCheck } from "../control/opencode-cli.js";
import { createPokeAgentsMcpServer } from "../mcp/server.js";

const SMOKE_ENABLED = process.env.POKE_AGENTS_SMOKE_CONTROL_CLIS === "1";

/** Skip per-backend tests when the CLI binary is missing (ENOENT, etc.). Default on so `npm run test:smoke:control` passes with only some CLIs installed. */
function smokePartialSkipsMissing(): boolean {
  const raw = process.env.POKE_AGENTS_SMOKE_PARTIAL?.trim().toLowerCase();
  if (raw === undefined || raw === "") return true;
  return !(
    raw === "0" ||
    raw === "false" ||
    raw === "off" ||
    raw === "no"
  );
}

const SMOKE_PARTIAL = smokePartialSkipsMissing();
const SMOKE_CWD = process.env.POKE_AGENTS_SMOKE_CWD?.trim() || process.cwd();
const SMOKE_WORKSPACE = process.env.POKE_AGENTS_SMOKE_WORKSPACE?.trim();
const ACK = "POKE_SMOKE_ACK";

const SMOKE_PROMPT = [
  "Smoke test: the user says hi.",
  `Reply with one short line of plain text that contains the exact substring ${ACK}.`,
  "Do not use tools, shells, or file access; answer immediately.",
].join(" ");

function structured(r: unknown): Record<string, unknown> {
  const sc = (r as { structuredContent?: unknown }).structuredContent;
  assert.ok(
    sc !== undefined && typeof sc === "object",
    "expected structuredContent object",
  );
  return sc as Record<string, unknown>;
}

function cursorSpawnCheck(cwd: string): { ok: true } | { ok: false; error: string } {
  const bin = cursorAgentBin();
  const r = spawnSync(bin, ["about"], {
    cwd,
    encoding: "utf8",
    timeout: 45_000,
    env: {
      ...process.env,
      CI: "1",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });
  if (r.error) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true };
}

function claudeAuthLoggedIn(cwd: string): { ok: true; loggedIn: boolean } | { ok: false; error: string } {
  const bin = claudeBin();
  const r = spawnSync(bin, ["auth", "status"], {
    cwd,
    encoding: "utf8",
    timeout: 60_000,
    env: {
      ...process.env,
      CI: "1",
      NO_COLOR: "1",
      FORCE_COLOR: "0",
    },
  });
  if (r.error) {
    return { ok: false, error: r.error.message };
  }
  const out = String(r.stdout ?? "").trim();
  if (!out) {
    return { ok: false, error: "empty output from `claude auth status`" };
  }
  try {
    const o = JSON.parse(out) as { loggedIn?: unknown };
    return { ok: true, loggedIn: Boolean(o.loggedIn) };
  } catch (e) {
    return { ok: false, error: `failed to parse JSON: ${e instanceof Error ? e.message : String(e)}` };
  }
}

async function readFullStream(
  client: Client,
  runId: string,
  stream: "stdout" | "stderr",
): Promise<string> {
  let offset = 0;
  let out = "";
  const limit = 64_000;
  for (let i = 0; i < 512 && out.length < 2_000_000; i += 1) {
    const r = await client.callTool({
      name: "control_run_output_slice",
      arguments: { run_id: runId, stream, offset, limit },
    });
    const s = structured(r);
    if (s.ok !== true) break;
    out += String(s.text ?? "");
    const next = Number(s.next_offset);
    if (!s.truncated) break;
    offset = Number.isFinite(next) ? next : offset + limit;
  }
  return out;
}

async function waitForRunDone(
  client: Client,
  runId: string,
  maxWaitMs: number,
): Promise<Record<string, unknown>> {
  const deadline = Date.now() + maxWaitMs;
  let last: Record<string, unknown> = {};
  while (Date.now() < deadline) {
    const r = await client.callTool({
      name: "control_run_status",
      arguments: { run_id: runId },
    });
    const s = structured(r);
    assert.equal(s.ok, true, "control_run_status should succeed for known run_id");
    last = s;
    const st = String(s.status);
    if (st === "completed" || st === "failed" || st === "failed_to_start") {
      return s;
    }
    await new Promise((res) => setTimeout(res, 750));
  }
  assert.fail(`timeout waiting for run ${runId} (last status: ${JSON.stringify(last.status)})`);
}

async function smokeOneBackend(
  client: Client,
  backend: "cursor" | "opencode" | "codex" | "claude",
): Promise<void> {
  process.env.POKE_AGENTS_CONTROL = backend;

  const args: Record<string, unknown> = {
    prompt: SMOKE_PROMPT,
    cwd: SMOKE_CWD,
    format: "text",
  };
  if (SMOKE_WORKSPACE) args.workspace = SMOKE_WORKSPACE;
  if (backend === "cursor") {
    args.mode = "ask";
    args.trust = true;
    args.sandbox = "disabled";
  }
  if (backend === "claude") {
    args.force = true;
  }
  if (backend === "codex" && process.env.POKE_AGENTS_CODEX_SKIP_GIT !== "0") {
    process.env.POKE_AGENTS_CODEX_SKIP_GIT =
      process.env.POKE_AGENTS_CODEX_SKIP_GIT ?? "1";
  }

  const start = await client.callTool({
    name: "control_agent",
    arguments: args,
  });
  const body = structured(start);
  assert.equal(body.ok, true, `control_agent start ok (${backend})`);
  assert.equal(body.accepted, true);
  const runId = String(body.run_id ?? "");
  assert.ok(runId.length > 5, "expected run_id");

  const timeoutMs = (() => {
    const raw = process.env.POKE_AGENTS_SMOKE_AGENT_TIMEOUT_MS?.trim();
    const n = raw ? Number(raw) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
    return 180_000;
  })();

  const status = await waitForRunDone(client, runId, timeoutMs + 30_000);
  assert.equal(
    status.status,
    "completed",
    `expected completed for ${backend}; got ${JSON.stringify(status)}`,
  );
  assert.equal(status.exit_code, 0, `non-zero exit for ${backend}`);

  const stdout = await readFullStream(client, runId, "stdout");
  const stderr = await readFullStream(client, runId, "stderr");
  const combined = `${stdout}\n${stderr}`.toLowerCase();
  assert.ok(
    combined.includes(ACK.toLowerCase()),
    `${backend}: output should contain ${ACK}. stdout (tail): ${stdout.slice(-4000)} stderr (tail): ${stderr.slice(-2000)}`,
  );
}

describe(
  "Control CLIs smoke (Cursor + OpenCode + Codex + Claude)",
  { skip: !SMOKE_ENABLED, concurrency: false },
  () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const mcp = createPokeAgentsMcpServer();
    const client = new Client({
      name: "poke-agents-control-smoke",
      version: "0.0.0",
    });

    const savedControl = process.env.POKE_AGENTS_CONTROL;
    const savedTimeout = process.env.POKE_AGENTS_AGENT_TIMEOUT_MS;
    const savedCodexSkip = process.env.POKE_AGENTS_CODEX_SKIP_GIT;

    before(async () => {
      process.env.POKE_AGENTS_MCP_LOG = "0";
      const t = process.env.POKE_AGENTS_SMOKE_AGENT_TIMEOUT_MS?.trim();
      if (t && Number.isFinite(Number(t)) && Number(t) > 0) {
        process.env.POKE_AGENTS_AGENT_TIMEOUT_MS = t;
      } else {
        process.env.POKE_AGENTS_AGENT_TIMEOUT_MS = "180000";
      }

      await serverTransport.start();
      await clientTransport.start();
      await mcp.connect(serverTransport);
      await client.connect(clientTransport);
      await client.listTools();
    });

    after(async () => {
      await client.close();
      await mcp.close();
      if (savedControl === undefined) delete process.env.POKE_AGENTS_CONTROL;
      else process.env.POKE_AGENTS_CONTROL = savedControl;
      if (savedTimeout === undefined) delete process.env.POKE_AGENTS_AGENT_TIMEOUT_MS;
      else process.env.POKE_AGENTS_AGENT_TIMEOUT_MS = savedTimeout;
      if (savedCodexSkip === undefined) delete process.env.POKE_AGENTS_CODEX_SKIP_GIT;
      else process.env.POKE_AGENTS_CODEX_SKIP_GIT = savedCodexSkip;
    });

    test("partial mode: at least one CLI binary present", async (t) => {
      if (!SMOKE_PARTIAL) {
        t.skip("skipped in strict mode (POKE_AGENTS_SMOKE_PARTIAL=0)");
        return;
      }
      const cursorOk = cursorSpawnCheck(SMOKE_CWD).ok;
      const openOk = opencodeSpawnCheck(SMOKE_CWD).ok;
      const codexOk = codexSpawnCheck(SMOKE_CWD).ok;
      const claudeOk = claudeSpawnCheck(SMOKE_CWD).ok;
      assert.ok(
        cursorOk || openOk || codexOk || claudeOk,
        "partial mode is on but no CLIs found (agent, opencode, codex, claude). Install at least one or disable this suite.",
      );
    });

    test("Cursor Agent CLI: hi-style prompt → output contains token", async (t) => {
      const probe = cursorSpawnCheck(SMOKE_CWD);
      if (!probe.ok) {
        if (SMOKE_PARTIAL) {
          t.skip(`cursor CLI unavailable: ${probe.error}`);
          return;
        }
        assert.fail(
          `cursor/agent CLI missing or not runnable (${probe.error}). Install Cursor CLI, or leave POKE_AGENTS_SMOKE_PARTIAL unset (default skips missing CLIs).`,
        );
      }
      await smokeOneBackend(client, "cursor");
    });

    test("OpenCode CLI: hi-style prompt → output contains token", async (t) => {
      const probe = opencodeSpawnCheck(SMOKE_CWD);
      if (!probe.ok) {
        if (SMOKE_PARTIAL) {
          t.skip(`opencode CLI unavailable: ${probe.error}`);
          return;
        }
        assert.fail(
          `opencode CLI missing or not runnable (${probe.error}). Install OpenCode, or use default partial mode (skip missing CLIs).`,
        );
      }
      await smokeOneBackend(client, "opencode");
    });

    test("Codex CLI: hi-style prompt → output contains token", async (t) => {
      const probe = codexSpawnCheck(SMOKE_CWD);
      if (!probe.ok) {
        if (SMOKE_PARTIAL) {
          t.skip(`codex CLI unavailable: ${probe.error}`);
          return;
        }
        assert.fail(
          `codex CLI missing or not runnable (${probe.error}). Install Codex CLI, or use default partial mode (skip missing CLIs).`,
        );
      }
      await smokeOneBackend(client, "codex");
    });

    test("Claude Code CLI: hi-style prompt → output contains token", async (t) => {
      const probe = claudeSpawnCheck(SMOKE_CWD);
      if (!probe.ok) {
        if (SMOKE_PARTIAL) {
          t.skip(`claude CLI unavailable: ${probe.error}`);
          return;
        }
        assert.fail(
          `claude CLI missing or not runnable (${probe.error}). Install Claude Code CLI, or use default partial mode (skip missing CLIs).`,
        );
      }
      if (SMOKE_PARTIAL) {
        const auth = claudeAuthLoggedIn(SMOKE_CWD);
        if (!auth.ok) {
          t.skip(`claude auth status unavailable: ${auth.error}`);
          return;
        }
        if (!auth.loggedIn) {
          t.skip("claude CLI installed but not logged in (`claude auth status` loggedIn=false)");
          return;
        }
      }
      await smokeOneBackend(client, "claude");
    });
  },
);
