import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { BUILT_IN_TAGS } from "../memory/types.js";

export function registerRecallTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_recall",
    "Recall relevant memories from a specific project namespace using semantic search",
    {
      query: z.string().describe("The search query to find relevant memories"),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          `Filter by semantic tags. Built-in: ${BUILT_IN_TAGS.join(", ")}. Custom tags also accepted.`,
        ),
      limit: z.number().optional().describe("Maximum number of results (default 10, max 100)"),
      container: z
        .string()
        .optional()
        .describe("Filter by container for multi-project/team scoping"),
      searchMode: z
        .enum(["vector", "hybrid", "keyword"])
        .optional()
        .describe(
          "Search strategy: 'vector' (default) for cosine similarity, 'keyword' for BM25 keyword matching, 'hybrid' for weighted combination of both",
        ),
    },
    async (args) => {
      const results = await manager.recall({
        query: args.query,
        namespace: args.namespace,
        tags: args.tags,
        limit: args.limit ?? 10,
        container: args.container,
        searchMode: args.searchMode,
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No matching memories found.",
            },
          ],
        };
      }

      const formatted = results.map((r, i) => {
        const entry = r.entry;
        const preview =
          entry.content.length > 200 ? entry.content.slice(0, 200) + "..." : entry.content;
        const tags = entry.metadata.tags.length > 0 ? entry.metadata.tags.join(", ") : "none";
        return [
          `--- Result ${i + 1} ---`,
          `ID: ${entry.id}`,
          `Score: ${r.score.toFixed(4)}`,
          `Summary: ${entry.metadata.summary ?? "N/A"}`,
          `Tags: ${tags}`,
          `Timestamp: ${entry.metadata.timestamp}`,
          ...(entry.metadata.container ? [`Container: ${entry.metadata.container}`] : []),
          `Content: ${preview}`,
        ].join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${results.length} matching memories:\n\n${formatted.join("\n\n")}`,
          },
        ],
      };
    },
  );
}
