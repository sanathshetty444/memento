import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { EmbeddingProvider } from "../embeddings/interface.js";
import { registerSaveTool } from "./save-context.js";
import { registerRecallTool } from "./recall-context.js";
import { registerSearchTool } from "./search-memory.js";
import { registerForgetTool } from "./forget.js";
import { registerListTool } from "./list-memories.js";
import { registerHealthTool } from "./health.js";
import { registerExportTool } from "./export-import.js";
import { registerMigrateTool } from "./migrate.js";

export function registerAllTools(
  server: McpServer,
  manager: MemoryManager,
  embeddings: EmbeddingProvider,
) {
  registerSaveTool(server, manager);
  registerRecallTool(server, manager);
  registerSearchTool(server, manager);
  registerForgetTool(server, manager);
  registerListTool(server, manager);
  registerHealthTool(server, manager);
  registerExportTool(server, manager);
  registerMigrateTool(server, manager, embeddings);
}
