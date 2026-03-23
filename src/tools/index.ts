import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { VectorStore } from "../storage/interface.js";
import { registerSaveTool } from "./save-context.js";
import { registerRecallTool } from "./recall-context.js";
import { registerSearchTool } from "./search-memory.js";
import { registerForgetTool } from "./forget.js";
import { registerListTool } from "./list-memories.js";
import { registerHealthTool } from "./health.js";
import { registerExportTool, registerImportTool } from "./export-import.js";
import { registerMigrateTool } from "./migrate.js";
import { registerSessionStartTool } from "./session-start.js";
import { registerStatsTool } from "./stats.js";
import { registerCompactTool } from "./compact.js";
import { registerRelatedTool } from "./related.js";
import { registerSessionSummaryTool } from "./session-summary.js";
import { registerIndexProjectTool } from "./index-project.js";
import { registerIngestTool } from "./ingest.js";
import { registerProfileTool } from "./profile.js";

export function registerAllTools(server: McpServer, manager: MemoryManager, store?: VectorStore) {
  registerSaveTool(server, manager);
  registerRecallTool(server, manager);
  registerSearchTool(server, manager);
  registerForgetTool(server, manager);
  registerListTool(server, manager);
  registerHealthTool(server, manager);
  registerExportTool(server, manager);
  registerImportTool(server, manager);
  registerMigrateTool(server, manager);
  registerSessionStartTool(server, manager);
  registerStatsTool(server, manager);
  registerRelatedTool(server, manager);
  registerSessionSummaryTool(server, manager);
  registerIndexProjectTool(server, manager);
  registerIngestTool(server, manager);
  registerProfileTool(server, manager);
  if (store) {
    registerCompactTool(server, manager, store);
  }
}
