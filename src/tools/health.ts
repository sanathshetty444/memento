import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { resolveNamespace } from "../memory/namespace.js";
import { loadConfig } from "../config.js";

export function registerHealthTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_health",
    "Check the health and status of the Memento memory system",
    {},
    async () => {
      const config = loadConfig();
      const namespace = resolveNamespace();
      const entryCount = await manager.count(namespace);
      const globalCount = await manager.count("__global__");

      const info = [
        "Memento Health Status",
        "=====================",
        `Storage type: ${config.store.type}`,
        `Embedding provider: ${config.embeddings.provider}`,
        `Embedding model: ${config.embeddings.model}`,
        `Current namespace: ${namespace}`,
        `Entries in namespace: ${entryCount}`,
        `Global entries: ${globalCount}`,
        `Auto-capture: ${config.capture.autoCapture ? "enabled" : "disabled"}`,
      ];

      return {
        content: [
          {
            type: "text" as const,
            text: info.join("\n"),
          },
        ],
      };
    },
  );
}
