import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { BUILT_IN_TAGS } from "../memory/types.js";

export function registerSearchTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_search",
    "Search memories across all projects and namespaces using semantic search",
    {
      query: z.string().describe("The search query to find relevant memories"),
      tags: z
        .array(z.string())
        .optional()
        .describe(
          `Filter by semantic tags. Built-in: ${BUILT_IN_TAGS.join(", ")}. Custom tags also accepted.`,
        ),
      limit: z.number().optional().describe("Maximum number of results (default 10, max 100)"),
      searchMode: z
        .enum(["vector", "hybrid", "keyword"])
        .optional()
        .describe(
          "Search strategy: 'vector' (default) for cosine similarity, 'keyword' for BM25 keyword matching, 'hybrid' for weighted combination of both",
        ),
    },
    async (args) => {
      const results = await manager.search({
        query: args.query,
        tags: args.tags,
        limit: args.limit ?? 10,
        searchMode: args.searchMode,
      });

      if (results.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No matching memories found across any namespace.",
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
          `Namespace: ${entry.metadata.namespace}`,
          `Summary: ${entry.metadata.summary ?? "N/A"}`,
          `Tags: ${tags}`,
          `Timestamp: ${entry.metadata.timestamp}`,
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
