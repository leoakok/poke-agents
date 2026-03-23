#!/usr/bin/env node
import type { Request, Response } from "express";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { createPokeAgentsMcpServer } from "./server.js";
import { mountDashboardApi } from "../http/dashboard-api.js";
import {
  logMcpHttpRequest,
  wrapExpressResponseForMcpLogging,
} from "../http/mcp-traffic-hub.js";
import { runWithMcpRequestContext } from "../control/mcp-request-context.js";
import { checkNpmLatestVersion } from "../version/npm-latest.js";

function parseArgs(argv: string[]): { mode: "stdio" | "http"; port: number } {
  const httpIdx = argv.indexOf("--http");
  if (httpIdx !== -1) {
    const portRaw = argv[httpIdx + 1];
    const port = portRaw && /^\d+$/.test(portRaw)
      ? Number(portRaw)
      : Number(process.env.POKE_AGENTS_PORT) || 8740;
    return { mode: "http", port };
  }
  return { mode: "stdio", port: 8740 };
}

async function main(): Promise<void> {
  const { mode, port } = parseArgs(process.argv.slice(2));

  // Startup notice (stderr): tells users how to get full performance.
  // Kept short and cached; failures are non-fatal (offline / no network).
  try {
    const r = await checkNpmLatestVersion({ timeoutMs: 1500 });
    if ("ok" in r && r.ok && r.needsUpdate) {
      console.error(
        `poke-agents npm update available: ${r.current} → ${r.latest}. Run: npx poke-agents@latest`,
      );
    }
  } catch {
    // ignore
  }

  if (mode === "stdio") {
    const mcp = createPokeAgentsMcpServer();
    const transport = new StdioServerTransport();
    await mcp.connect(transport);
    return;
  }

  const app = createMcpExpressApp();
  mountDashboardApi(app);
  app.post("/mcp", async (req: Request, res: Response) => {
    logMcpHttpRequest(req.body);
    wrapExpressResponseForMcpLogging(res);
    const mcp = createPokeAgentsMcpServer();
    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      await mcp.connect(transport);
      const pokeCallbackUrl = headerOne(req, "x-poke-callback-url");
      const pokeCallbackToken = headerOne(req, "x-poke-callback-token");
      await runWithMcpRequestContext(
        { pokeCallbackUrl, pokeCallbackToken },
        () => transport.handleRequest(req, res, req.body),
      );
      res.on("close", () => {
        void transport.close();
        void mcp.close();
      });
    } catch (e) {
      console.error(e);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });
  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  await new Promise<void>((resolve, reject) => {
    app.listen(port, "127.0.0.1", (err?: Error) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const url = `http://127.0.0.1:${port}/mcp`;
  const api = `http://127.0.0.1:${port}/api`;
  console.error(`poke-agents MCP (HTTP) → ${url}`);
  console.error(
    `poke-agents dashboard API → ${api}/connectors | /sessions | /session | /agent-templates | /agent-runtime | /agent-runtime/stream | /mcp-traffic | /mcp-traffic/stream | POST /agent-runtime/stop`
  );
  console.error(`Poke: poke tunnel ${url} -n "Poke agents"`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

function headerOne(
  req: Request,
  name: string,
): string | undefined {
  const v = req.headers[name];
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}
