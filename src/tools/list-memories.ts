import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { BUILT_IN_TAGS } from "../memory/types.js";

export function registerListTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_list",
    "List memory entries with optional filtering by namespace, tags, and container",
    {
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          `Filter by semantic tags. Built-in: ${BUILT_IN_TAGS.join(", ")}. Custom tags also accepted.`,
        ),
      limit: z.number().optional().describe("Maximum number of results (default 10, max 100)"),
      offset: z
        .number()
        .optional()
        .describe("Number of entries to skip for pagination (default 0)"),
      container: z
        .string()
        .optional()
        .describe("Filter by container for multi-project/team scoping"),
    },
    async (args) => {
      const entries = await manager.list({
        namespace: args.namespace,
        tags: args.tags,
        limit: args.limit,
        offset: args.offset,
        container: args.container,
      });

      if (entries.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No memory entries found.",
            },
          ],
        };
      }

      const formatted = entries.map((entry, i) => {
        const tags = entry.metadata.tags.length > 0 ? entry.metadata.tags.join(", ") : "none";
        return [
          `--- Entry ${i + 1} ---`,
          `ID: ${entry.id}`,
          `Summary: ${entry.metadata.summary ?? "N/A"}`,
          `Tags: ${tags}`,
          `Timestamp: ${entry.metadata.timestamp}`,
          ...(entry.metadata.container ? [`Container: ${entry.metadata.container}`] : []),
        ].join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${entries.length} memory entries:\n\n${formatted.join("\n\n")}`,
          },
        ],
      };
    },
  );
}
