import type { Express, Request, Response } from "express";
import { getAllowedEditorIds } from "../profile.js";
import {
  activeConnectors,
  getMessagesForProfile,
  listSessionsForProfile,
} from "../connectors/registry.js";

function corsApi(req: Request, res: Response, next: () => void): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
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
  return 100;
}

/**
 * Read-only JSON for the local dashboard UI (same data as MCP list_* / get_session).
 */
export function mountDashboardApi(app: Express): void {
  app.use("/api", corsApi);

  app.get("/api/connectors", async (_req: Request, res: Response) => {
    try {
      const connectors = await Promise.all(
        activeConnectors().map(async (c) => {
          const h = await c.health();
          return {
            id: c.id,
            display_name: c.displayName,
            available: h.available,
            detail: h.detail,
          };
        })
      );
      res.json({
        ok: true as const,
        connectors,
        profile_editors: [...getAllowedEditorIds()],
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
      const source =
        typeof req.query.source === "string" ? req.query.source : undefined;
      const project_path =
        typeof req.query.project_path === "string"
          ? req.query.project_path
          : undefined;
      const limit = parseLimit(req.query.limit);
      const sessions = await listSessionsForProfile({
        source,
        limit,
        projectPath: project_path,
      });
      res.json({
        ok: true as const,
        sessions: sessions.map((s) => ({
          id: s.id,
          source: s.source,
          title: s.title,
          last_updated_at: s.lastUpdatedAt,
          project_path: s.projectPath,
        })),
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
}
