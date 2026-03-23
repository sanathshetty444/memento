/**
 * Local HTTP API server for Memento.
 * Mirrors MCP tools over REST, enabling Chrome extensions and third-party integrations.
 *
 * Endpoints:
 *   POST   /api/save    — save memory
 *   POST   /api/recall  — semantic recall within a namespace
 *   POST   /api/search  — cross-namespace search
 *   GET    /api/health  — health check
 *   GET    /api/list    — paginated list with filters
 *   DELETE /api/:id     — forget a memory
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MemoryManager } from "./memory/memory-manager.js";

// ── Static file serving for UI ──────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.resolve(__dirname, "..", "ui");

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function serveStaticFile(res: http.ServerResponse, filePath: string): boolean {
  try {
    const resolved = path.resolve(filePath);
    // Prevent directory traversal
    if (!resolved.startsWith(UI_DIR)) {
      return false;
    }
    if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
      return false;
    }
    const ext = path.extname(resolved);
    const mime = MIME_TYPES[ext] || "application/octet-stream";
    const content = fs.readFileSync(resolved);
    res.writeHead(200, {
      "Content-Type": mime,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(content);
    return true;
  } catch {
    return false;
  }
}

const VERSION = "0.9.0";

// ── Helpers ──────────────────────────────────────────────────────

function jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  res.end(payload);
}

function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

// ── Server ───────────────────────────────────────────────────────

export function startServer(manager: MemoryManager): Promise<http.Server> {
  const port = parseInt(process.env.MEMENTO_PORT ?? "21476", 10);
  const host = "127.0.0.1";
  const apiKey = process.env.MEMENTO_API_KEY;

  const server = http.createServer(async (req, res) => {
    // CORS preflight
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      });
      res.end();
      return;
    }

    // Auth check
    if (apiKey) {
      const authHeader = req.headers.authorization;
      if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
        jsonResponse(res, 401, { error: "Unauthorized" });
        return;
      }
    }

    const url = new URL(req.url ?? "/", `http://${host}:${port}`);
    const pathname = url.pathname;

    try {
      // POST /api/save
      if (req.method === "POST" && pathname === "/api/save") {
        const body = (await parseBody(req)) as {
          content?: string;
          tags?: string[];
          namespace?: string;
          global?: boolean;
          container?: string;
        };

        if (!body.content || typeof body.content !== "string") {
          jsonResponse(res, 400, { error: "Missing required field: content" });
          return;
        }

        const entries = await manager.save({
          content: body.content,
          tags: body.tags,
          namespace: body.namespace,
          global: body.global,
          container: body.container,
        });

        jsonResponse(res, 200, {
          saved: entries.length,
          ids: entries.map((e) => e.id),
        });
        return;
      }

      // POST /api/recall
      if (req.method === "POST" && pathname === "/api/recall") {
        const body = (await parseBody(req)) as {
          query?: string;
          namespace?: string;
          tags?: string[];
          limit?: number;
          container?: string;
          searchMode?: "vector" | "hybrid" | "keyword";
        };

        if (!body.query || typeof body.query !== "string") {
          jsonResponse(res, 400, { error: "Missing required field: query" });
          return;
        }

        const results = await manager.recall({
          query: body.query,
          namespace: body.namespace,
          tags: body.tags,
          limit: body.limit,
          container: body.container,
          searchMode: body.searchMode,
        });

        jsonResponse(res, 200, {
          results: results.map((r) => ({
            id: r.entry.id,
            content: r.entry.content,
            score: r.score,
            tags: r.entry.metadata.tags,
            timestamp: r.entry.metadata.timestamp,
          })),
        });
        return;
      }

      // POST /api/search
      if (req.method === "POST" && pathname === "/api/search") {
        const body = (await parseBody(req)) as {
          query?: string;
          tags?: string[];
          limit?: number;
          searchMode?: "vector" | "hybrid" | "keyword";
        };

        if (!body.query || typeof body.query !== "string") {
          jsonResponse(res, 400, { error: "Missing required field: query" });
          return;
        }

        const results = await manager.search({
          query: body.query,
          tags: body.tags,
          limit: body.limit,
          searchMode: body.searchMode,
        });

        jsonResponse(res, 200, {
          results: results.map((r) => ({
            id: r.entry.id,
            content: r.entry.content,
            score: r.score,
            tags: r.entry.metadata.tags,
            timestamp: r.entry.metadata.timestamp,
          })),
        });
        return;
      }

      // GET /api/health
      if (req.method === "GET" && pathname === "/api/health") {
        const entries = await manager.count();
        jsonResponse(res, 200, { status: "ok", version: VERSION, entries });
        return;
      }

      // GET /api/list
      if (req.method === "GET" && pathname === "/api/list") {
        const namespace = url.searchParams.get("namespace") ?? undefined;
        const tagsParam = url.searchParams.get("tags");
        const tags = tagsParam ? tagsParam.split(",") : undefined;
        const limit = url.searchParams.has("limit")
          ? parseInt(url.searchParams.get("limit")!, 10)
          : undefined;
        const offset = url.searchParams.has("offset")
          ? parseInt(url.searchParams.get("offset")!, 10)
          : undefined;

        const entries = await manager.list({ namespace, tags, limit, offset });

        jsonResponse(res, 200, {
          entries: entries.map((e) => ({
            id: e.id,
            summary: e.metadata.summary ?? e.content.slice(0, 100),
            tags: e.metadata.tags,
            timestamp: e.metadata.timestamp,
          })),
        });
        return;
      }

      // DELETE /api/:id
      if (req.method === "DELETE" && pathname.startsWith("/api/")) {
        const id = pathname.slice("/api/".length);
        if (!id) {
          jsonResponse(res, 400, { error: "Missing memory ID" });
          return;
        }

        const deleted = await manager.forget(id);
        jsonResponse(res, 200, { deleted });
        return;
      }

      // GET / → redirect to /graph
      if (req.method === "GET" && pathname === "/") {
        res.writeHead(302, { Location: "/graph" });
        res.end();
        return;
      }

      // GET /graph → serve graph.html
      if (req.method === "GET" && pathname === "/graph") {
        const served = serveStaticFile(res, path.join(UI_DIR, "graph.html"));
        if (served) return;
      }

      // GET /ui/* → serve static UI files
      if (req.method === "GET" && pathname.startsWith("/ui/")) {
        const relPath = pathname.slice("/ui/".length);
        const served = serveStaticFile(res, path.join(UI_DIR, relPath));
        if (served) return;
      }

      // 404
      jsonResponse(res, 404, { error: "Not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jsonResponse(res, 500, { error: message });
    }
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, host, () => {
      const shutdownHandler = () => {
        server.close();
        process.exit(0);
      };
      process.on("SIGTERM", shutdownHandler);
      process.on("SIGINT", shutdownHandler);
      resolve(server);
    });
  });
}
