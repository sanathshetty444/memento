/**
 * Memory Stats MCP tool — provides overview of memory usage.
 * Total count, per tag, per source, oldest/newest, avg entries/session, disk size.
 */

import { z } from "zod";
import { statSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { MemoryEntry } from "../memory/types.js";
import { MAX_LIMIT } from "../memory/types.js";

/**
 * Recursively calculate directory size in bytes.
 */
function dirSize(dirPath: string): number {
  let total = 0;
  try {
    const items = readdirSync(dirPath, { withFileTypes: true });
    for (const item of items) {
      const fullPath = join(dirPath, item.name);
      if (item.isDirectory()) {
        total += dirSize(fullPath);
      } else {
        try {
          total += statSync(fullPath).size;
        } catch {
          // Skip inaccessible files
        }
      }
    }
  } catch {
    // Directory may not exist or be inaccessible
  }
  return total;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function registerStatsTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_stats",
    "Show memory statistics: total count, per-tag breakdown, sources, oldest/newest, disk usage",
    {
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
    },
    async (args) => {
      // Paginate through all entries
      const allEntries: MemoryEntry[] = [];
      let offset = 0;
      while (true) {
        const batch = await manager.list({
          namespace: args.namespace,
          limit: MAX_LIMIT,
          offset,
        });
        if (batch.length === 0) break;
        allEntries.push(...batch);
        offset += batch.length;
        if (batch.length < MAX_LIMIT) break;
      }

      const total = allEntries.length;

      if (total === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No memory entries found in this namespace.",
            },
          ],
        };
      }

      // Per-tag counts
      const tagCounts = new Map<string, number>();
      for (const entry of allEntries) {
        for (const tag of entry.metadata.tags) {
          tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
        }
      }

      // Per-source counts
      const sourceCounts = new Map<string, number>();
      for (const entry of allEntries) {
        const src = entry.metadata.source;
        sourceCounts.set(src, (sourceCounts.get(src) ?? 0) + 1);
      }

      // Sessions
      const sessions = new Set<string>();
      for (const entry of allEntries) {
        if (entry.metadata.sessionId) {
          sessions.add(entry.metadata.sessionId);
        }
      }

      // Timestamps
      const timestamps = allEntries
        .map((e) => Date.parse(e.metadata.timestamp))
        .filter((t) => !Number.isNaN(t))
        .sort((a, b) => a - b);

      const oldest = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : "N/A";
      const newest =
        timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : "N/A";

      // Disk size
      const homedir = (await import("node:os")).homedir();
      const dataDir = join(homedir, ".claude-memory");
      const diskBytes = dirSize(dataDir);

      // Build output
      const lines: string[] = [
        `## Memory Statistics`,
        ``,
        `**Total entries**: ${total}`,
        `**Sessions**: ${sessions.size}`,
        `**Avg entries/session**: ${sessions.size > 0 ? (total / sessions.size).toFixed(1) : "N/A"}`,
        `**Oldest**: ${oldest}`,
        `**Newest**: ${newest}`,
        `**Disk usage**: ${formatBytes(diskBytes)}`,
        ``,
        `### By Tag`,
        ...[...tagCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([tag, count]) => `- ${tag}: ${count}`),
        ``,
        `### By Source`,
        ...[...sourceCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([source, count]) => `- ${source}: ${count}`),
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
