import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";

export function registerForgetTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_forget",
    "Delete a specific memory entry by its ID",
    {
      id: z.string().describe("The ID of the memory entry to delete"),
    },
    async (args) => {
      const deleted = await manager.forget(args.id);

      if (deleted) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Memory entry ${args.id} deleted successfully.`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: `Memory entry ${args.id} not found.`,
          },
        ],
      };
    },
  );
}
