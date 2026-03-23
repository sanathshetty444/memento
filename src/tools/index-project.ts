/**
 * MCP tool: memory_index — Index the current project by scanning key files.
 */

import { z } from "zod";
import { unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { indexProject } from "../memory/indexer.js";

export function registerIndexProjectTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_index",
    "Index the current project by scanning key files (README, package.json, etc.) and saving them as high-importance memories",
    {
      force: z
        .boolean()
        .optional()
        .describe("Re-index even if the project has already been indexed"),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
    },
    async (args) => {
      const cwd = process.cwd();

      // If force, delete the marker file first
      if (args.force) {
        const markerFile = join(cwd, ".claude-memory", ".indexed");
        if (existsSync(markerFile)) {
          try {
            unlinkSync(markerFile);
          } catch {
            // Non-fatal
          }
        }
      }

      const result = await indexProject(manager, {
        cwd,
        namespace: args.namespace,
      });

      if (result.alreadyIndexed) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Project already indexed. Use `force: true` to re-index.",
            },
          ],
        };
      }

      const lines: string[] = [];
      if (result.indexed.length > 0) {
        lines.push(`**Indexed** (${result.indexed.length}): ${result.indexed.join(", ")}`);
      }
      if (result.skipped.length > 0) {
        lines.push(`**Skipped** (not found): ${result.skipped.join(", ")}`);
      }
      lines.push("Directory tree saved as architecture memory.");

      return {
        content: [
          {
            type: "text" as const,
            text: `## Project Indexed\n\n${lines.join("\n")}`,
          },
        ],
      };
    },
  );
}
