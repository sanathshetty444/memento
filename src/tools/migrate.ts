import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { MemoryEntry } from "../memory/types.js";
import { MAX_LIMIT } from "../memory/types.js";

export function registerMigrateTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_migrate",
    "Re-embed all memories with the current embedding provider (use after switching embedding models)",
    {
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      dryRun: z
        .boolean()
        .default(false)
        .describe("If true, count entries without actually re-embedding"),
    },
    async (args) => {
      // Collect all entries by paginating
      const allEntries: MemoryEntry[] = [];
      let offset = 0;

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

        if (batch.length < MAX_LIMIT) {
          break;
        }
      }

      const total = allEntries.length;

      if (args.dryRun) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Dry run: found ${total} ${total === 1 ? "entry" : "entries"} to re-embed. No changes made.`,
            },
          ],
        };
      }

      let processed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const entry of allEntries) {
        try {
          // Delete old entry and re-save with fresh embedding
          await manager.forget(entry.id);
          await manager.save({
            content: entry.content,
            tags: entry.metadata.tags,
            namespace: entry.metadata.namespace,
            source: entry.metadata.source,
            files: entry.metadata.files,
            functions: entry.metadata.functions,
            sessionId: entry.metadata.sessionId,
            summary: entry.metadata.summary,
          });

          processed++;
        } catch (err) {
          failed++;
          errors.push(`${entry.id}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      const summary = [
        `Migration complete:`,
        `  Total:     ${total}`,
        `  Processed: ${processed}`,
        `  Failed:    ${failed}`,
        `  Skipped:   ${total - processed - failed}`,
      ];

      if (errors.length > 0) {
        summary.push("", "Errors:", ...errors.map((e) => `  - ${e}`));
      }

      return {
        content: [
          {
            type: "text" as const,
            text: summary.join("\n"),
          },
        ],
      };
    },
  );
}
