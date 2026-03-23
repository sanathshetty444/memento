import { MemoryEntry, MemoryResult } from "../memory/types.js";

export type SearchMode = "vector" | "hybrid" | "keyword";

export interface SearchFilters {
  namespace?: string;
  tags?: string[];
  after?: string;
  before?: string;
  limit: number;
  searchMode?: SearchMode;
  /** Raw query text — required for keyword and hybrid search modes (BM25). */
  query?: string;
}

export interface ListFilters {
  namespace?: string;
  tags?: string[];
  limit: number;
  offset: number;
}

export interface VectorStore {
  initialize(): Promise<void>;
  upsert(entry: MemoryEntry): Promise<void>;
  search(queryEmbedding: number[], filters: SearchFilters): Promise<MemoryResult[]>;
  delete(id: string): Promise<boolean>;
  list(filters: ListFilters): Promise<MemoryEntry[]>;
  count(namespace?: string): Promise<number>;
  close(): Promise<void>;
}
