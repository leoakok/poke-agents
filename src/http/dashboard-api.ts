import type { Express, Request, Response } from "express";
import { buildConnectorsPayload } from "../connectors/connectors-payload.js";
import {
  getMessagesForProfile,
  listSessionsForProfile,
} from "../connectors/registry.js";
import { scanAgentProcesses } from "./agent-runtime-scan.js";
import { BUILTIN_TEMPLATE_IDS } from "../agent-templates-data.js";
import {
  agentTemplatesFileHint,
  deleteCustomAgentTemplate,
  mapTemplatesApiRows,
  replaceCustomAgentTemplates,
  upsertCustomAgentTemplate,
} from "../agent-templates-store.js";
import {
  getRecentMcpTraffic,
  subscribeMcpTraffic,
  type McpTrafficEntry,
} from "./mcp-traffic-hub.js";

function corsApi(req: Request, res: Response, next: () => void): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}

function parseLimit(q: unknown): number {
  const n = typeof q === "string" ? Number(q) : NaN;
  if (Number.isFinite(n) && n > 0 && n <= 500) return Math.floor(n);
  /** Dashboard default: small first page (use offset + limit for more). */
  return 10;
}

function parseOffset(q: unknown): number {
  const n = typeof q === "string" ? Number(q) : NaN;
  if (Number.isFinite(n) && n >= 0 && n < 1_000_000) return Math.floor(n);
  return 0;
}

/**
 * Read-only JSON for the local dashboard UI (same data as MCP adapters / sessions / session).
 */
export function mountDashboardApi(app: Express): void {
  app.use("/api", corsApi);

  app.get("/api/connectors", async (_req: Request, res: Response) => {
    try {
      const { connectors, editors } = await buildConnectorsPayload();
      res.json({
        ok: true as const,
        connectors,
        editors,
      });
    } catch (e) {
      res.status(500).json({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/sessions", async (req: Request, res: Response) => {
    try {
      const editor =
        typeof req.query.editor === "string" ? req.query.editor : undefined;
      const folder =
        typeof req.query.folder === "string" ? req.query.folder : undefined;
      const limit = parseLimit(req.query.limit);
      const offset = parseOffset(req.query.offset);
      const page = await listSessionsForProfile({
        source: editor,
        limit,
        offset,
        projectPath: folder,
      });
      const has_more = offset + page.sessions.length < page.total_count;
      res.json({
        ok: true as const,
        sessions: page.sessions.map((s) => ({
          id: s.id,
          source: s.source,
          title: s.title,
          last_updated_at: s.lastUpdatedAt,
          project_path: s.projectPath,
        })),
        total_count: page.total_count,
        offset,
        limit,
        has_more,
      });
    } catch (e) {
      res.status(500).json({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/agent-runtime", async (_req: Request, res: Response) => {
    try {
      const snapshot = await scanAgentProcesses();
      res.json(snapshot);
    } catch (e) {
      res.status(500).json({
        ok: false as const,
        scanned_at: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post("/api/agent-runtime/stop", async (req: Request, res: Response) => {
    const raw = req.body?.pid;
    const pid = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(pid) || pid <= 0 || pid > 2_147_483_647) {
      res.status(400).json({
        ok: false as const,
        error: "Invalid pid (positive integer required)",
      });
      return;
    }
    const snapshot = await scanAgentProcesses();
    if (!snapshot.ok) {
      res.status(503).json({
        ok: false as const,
        error: snapshot.error,
      });
      return;
    }
    const allowed = snapshot.processes.some((p) => p.pid === pid);
    if (!allowed) {
      res.status(400).json({
        ok: false as const,
        error:
          "That PID is not in the current live agent process list — refresh and try again.",
      });
      return;
    }
    try {
      process.kill(pid, "SIGINT");
      res.json({ ok: true as const, pid });
    } catch (e) {
      const err = e as NodeJS.ErrnoException;
      if (err.code === "ESRCH") {
        res.status(404).json({
          ok: false as const,
          error: "Process already exited",
        });
        return;
      }
      if (err.code === "EPERM") {
        res.status(403).json({
          ok: false as const,
          error: "Permission denied sending signal to that process",
        });
        return;
      }
      res.status(500).json({
        ok: false as const,
        error: err.message ?? String(e),
      });
    }
  });

  app.get("/api/agent-runtime/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const tick = async (): Promise<void> => {
      try {
        const snapshot = await scanAgentProcesses();
        res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
      } catch (e) {
        const err = e instanceof Error ? e.message : String(e);
        res.write(
          `event: error\ndata: ${JSON.stringify({ ok: false, error: err })}\n\n`
        );
      }
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, 2000);

    req.on("close", () => {
      clearInterval(interval);
      if (!res.writableEnded) {
        res.end();
      }
    });
  });

  app.get("/api/agent-templates", (_req: Request, res: Response) => {
    try {
      res.json({
        ok: true as const,
        storage_path: agentTemplatesFileHint(),
        built_in_ids: [...BUILTIN_TEMPLATE_IDS],
        templates: mapTemplatesApiRows(),
      });
    } catch (e) {
      res.status(500).json({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.post("/api/agent-templates", (req: Request, res: Response) => {
    try {
      const body = req.body as {
        upsert?: {
          id: string;
          title: string;
          summary: string;
          promptPreamble: string;
          pokeHint: string;
        };
        delete_id?: string;
        replace_custom?: Array<{
          id: string;
          title: string;
          summary: string;
          promptPreamble: string;
          pokeHint: string;
        }>;
      };
      if (body.replace_custom && Array.isArray(body.replace_custom)) {
        replaceCustomAgentTemplates(body.replace_custom);
      } else if (body.upsert && typeof body.upsert.id === "string") {
        upsertCustomAgentTemplate({
          id: body.upsert.id.trim(),
          title: String(body.upsert.title ?? ""),
          summary: String(body.upsert.summary ?? ""),
          promptPreamble: String(body.upsert.promptPreamble ?? ""),
          pokeHint: String(body.upsert.pokeHint ?? ""),
        });
      } else if (typeof body.delete_id === "string" && body.delete_id.trim()) {
        const r = deleteCustomAgentTemplate(body.delete_id.trim());
        if (!r.ok) {
          res.status(400).json({ ok: false as const, error: r.error });
          return;
        }
      } else {
        res.status(400).json({
          ok: false as const,
          error: "Expected replace_custom[], upsert{}, or delete_id",
        });
        return;
      }
      res.json({
        ok: true as const,
        storage_path: agentTemplatesFileHint(),
        built_in_ids: [...BUILTIN_TEMPLATE_IDS],
        templates: mapTemplatesApiRows(),
      });
    } catch (e) {
      res.status(500).json({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/session", async (req: Request, res: Response) => {
    const id = req.query.id;
    if (typeof id !== "string" || !id.trim()) {
      res.status(400).json({ ok: false as const, error: "Missing id query" });
      return;
    }
    try {
      const result = await getMessagesForProfile(id);
      if (!result.ok) {
        res.status(400).json({ ok: false as const, error: result.error });
        return;
      }
      res.json({
        ok: true as const,
        session: result.session,
        messages: result.messages,
      });
    } catch (e) {
      res.status(500).json({
        ok: false as const,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });

  app.get("/api/mcp-traffic", (_req: Request, res: Response) => {
    res.json({
      ok: true as const,
      entries: getRecentMcpTraffic(200),
    });
  });

  app.get("/api/mcp-traffic/stream", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    const send = (entry: McpTrafficEntry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    for (const e of getRecentMcpTraffic(100)) {
      send(e);
    }

    const unsub = subscribeMcpTraffic(send);
    const onClose = () => {
      unsub();
      if (!res.writableEnded) {
        res.end();
      }
    };
    req.on("close", onClose);
    req.on("aborted", onClose);
  });
}
