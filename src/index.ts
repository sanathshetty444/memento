import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { createStore } from "./storage/index.js";
import { createEmbeddingProvider } from "./embeddings/index.js";
import { MemoryManager } from "./memory/memory-manager.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const config = loadConfig();

  const store = await createStore({
    type: config.store.type,
    local: { path: config.store.localPath },
    chromadb: { path: config.store.chromaPath },
  });

  const embeddings = await createEmbeddingProvider({
    type: config.embeddings.provider,
    local: { modelPath: config.dataDir ? `${config.dataDir}/models` : undefined },
  });

  const manager = new MemoryManager({
    store,
    embeddings,
    config: {
      deduplicationThreshold: config.memory.deduplicationThreshold,
      chunkSize: config.memory.chunkSize,
      chunkOverlap: config.memory.chunkOverlap,
    },
  });

  const server = new McpServer({
    name: "memory",
    version: "1.0.0",
  });

  registerAllTools(server, manager, store);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("Memento MCP server running\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  process.stderr.write(`Uncaught exception: ${err.message}\n`);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(
    `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}\n`,
  );
  process.exit(1);
});
