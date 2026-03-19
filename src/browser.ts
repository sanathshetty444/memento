// Browser-safe subset of memento — no Node.js dependencies.
// Import as: import { MemoryManager, IndexedDBVectorStore, ... } from "memento-memory/browser"

// Core orchestrator
export { MemoryManager } from "./memory/memory-manager.js";
export type { MemoryManagerOptions, MemoryManagerConfig } from "./memory/memory-manager.js";

// Storage
export { IndexedDBVectorStore } from "./storage/indexeddb-adapter.js";
export type { IndexedDBVectorStoreOptions } from "./storage/indexeddb-adapter.js";

// Embeddings
export { GeminiFetchEmbeddingProvider } from "./embeddings/gemini-fetch-adapter.js";
export type { GeminiFetchOptions } from "./embeddings/gemini-fetch-adapter.js";

// Processing pipeline (pure JS, browser-safe)
export { chunkContent } from "./memory/chunker.js";
export { contentHash, cosineSimilarity, isDuplicate } from "./memory/dedup.js";
export { autoTag } from "./memory/tagger.js";
export { redact } from "./memory/redactor.js";

// Types
export type {
  MemoryEntry,
  MemoryMetadata,
  MemoryTag,
  MemorySource,
  MemoryResult,
  SaveOptions,
  RecallOptions,
  ListOptions,
} from "./memory/types.js";
export type { VectorStore, SearchFilters, ListFilters } from "./storage/interface.js";
export type { EmbeddingProvider } from "./embeddings/interface.js";
