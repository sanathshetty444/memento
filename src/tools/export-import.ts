import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { MemoryEntry } from "../memory/types.js";
import { MAX_LIMIT } from "../memory/types.js";

export function registerExportTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_export",
    "Export all memories from a namespace as JSONL or JSON (without embeddings to keep size down)",
    {
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      format: z
        .enum(["jsonl", "json"])
        .default("jsonl")
        .describe("Export format: one JSON object per line (jsonl) or a JSON array (json)"),
    },
    async (args) => {
      const allEntries: MemoryEntry[] = [];
      let offset = 0;

      // Paginate through all entries
      while (true) {
        const batch = await manager.list({
          namespace: args.namespace,
          limit: MAX_LIMIT,
          offset,
        });

        if (batch.length === 0) {
          break;
        }

        allEntries.push(...batch);
        offset += batch.length;

        // If we got fewer than the limit, we've reached the end
        if (batch.length < MAX_LIMIT) {
          break;
        }
      }

      // Strip embeddings to keep export size down
      const stripped = allEntries.map(({ embedding: _embedding, ...rest }) => rest);

      let exportData: string;
      if (args.format === "jsonl") {
        exportData = stripped.map((entry) => JSON.stringify(entry)).join("\n");
      } else {
        exportData = JSON.stringify(stripped, null, 2);
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Exported ${allEntries.length} ${allEntries.length === 1 ? "entry" : "entries"} (format: ${args.format})\n\n${exportData}`,
          },
        ],
      };
    },
  );
}
