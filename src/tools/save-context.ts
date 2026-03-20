import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";

export function registerSaveTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_save",
    "Save context, decisions, or knowledge to persistent memory for later recall",
    {
      content: z.string().describe("The content to remember"),
      tags: z
        .array(
          z.enum([
            "conversation",
            "decision",
            "code",
            "error",
            "architecture",
            "config",
            "dependency",
            "todo",
          ]),
        )
        .optional()
        .describe("Semantic tags"),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
      global: z
        .boolean()
        .optional()
        .describe("Save to global namespace accessible across all projects"),
    },
    async (args) => {
      const entries = await manager.save({
        content: args.content,
        tags: args.tags,
        namespace: args.namespace,
        global: args.global,
        source: "explicit",
      });
      return {
        content: [
          {
            type: "text" as const,
            text: `Saved ${entries.length} memory ${entries.length === 1 ? "entry" : "entries"} (${entries.map((e) => e.id).join(", ")})`,
          },
        ],
      };
    },
  );
}
