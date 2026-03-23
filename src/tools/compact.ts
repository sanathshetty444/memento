/**
 * Compact MCP tool — exposes existing compactMemories() to MCP clients.
 * Params: dryRun, ttlDays, maxEntries.
 */

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { compactMemories } from "../memory/compactor.js";
import type { VectorStore } from "../storage/interface.js";

export function registerCompactTool(
  server: McpServer,
  _manager: MemoryManager,
  store: VectorStore,
) {
  server.tool(
    "memory_compact",
    "Compact memories: remove expired entries, merge near-duplicates, evict oldest if over limit",
    {
      namespace: z.string().describe("Project namespace to compact"),
      dryRun: z
        .boolean()
        .optional()
        .default(false)
        .describe("Preview what would be removed without actually deleting"),
      ttlDays: z
        .number()
        .optional()
        .describe("TTL in days — entries older than this are expired (default 180)"),
      maxEntries: z
        .number()
        .optional()
        .describe("Maximum entries to keep in namespace (default 10,000)"),
    },
    async (args) => {
      const result = await compactMemories(store, {
        namespace: args.namespace,
        dryRun: args.dryRun,
        ttlDays: args.ttlDays,
        maxEntries: args.maxEntries,
      });

      const lines = [
        args.dryRun ? "## Compaction Preview (dry run)" : "## Compaction Complete",
        "",
        `**Total entries**: ${result.total}`,
        `**Expired (TTL)**: ${result.expired}`,
        `**Merged (near-duplicates)**: ${result.merged}`,
        `**Evicted (over limit)**: ${result.evicted}`,
        `**Remaining**: ${result.remaining}`,
      ];

      return {
        content: [
          {
            type: "text" as const,
            text: lines.join("\n"),
          },
        ],
      };
    },
  );
}
