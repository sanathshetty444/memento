import type { VectorStore } from "./interface.js";

export async function createStore(config: {
  type: string;
  chromadb?: { path: string };
  neo4j?: { url: string; username: string; password: string };
}): Promise<VectorStore> {
  if (config.type === "chromadb") {
    const { ChromaDBAdapter } = await import("./chromadb-adapter.js");
    const store = new ChromaDBAdapter(
      config.chromadb ?? { path: "~/.claude-memory/chromadb" }
    );
    await store.initialize();
    return store;
  }

  if (config.type === "neo4j") {
    const { Neo4jAdapter } = await import("./neo4j-adapter.js");
    const store = new Neo4jAdapter(
      config.neo4j ?? { url: "bolt://localhost:7687", username: "neo4j", password: "" }
    );
    await store.initialize();
    return store;
  }

  throw new Error(`Unknown store type: ${config.type}`);
}

export type { VectorStore } from "./interface.js";
export type { SearchFilters, ListFilters } from "./interface.js";
