import type { ChromaClient as ChromaClientType, Collection, IEmbeddingFunction } from "chromadb";
import type { MemoryEntry, MemoryMetadata, MemorySource } from "../memory/types.js";
import type {
  VectorStore,
  SearchFilters,
  ListFilters,
} from "./interface.js";
import type { MemoryResult } from "../memory/types.js";
import { mkdirSync } from "node:fs";

// ChromaDB metadata values must be string | number | boolean.
// Arrays (tags, files, functions, relatedMemoryIds) are serialized as JSON strings.

const ARRAY_METADATA_KEYS: (keyof MemoryMetadata)[] = [
  "tags",
  "files",
  "functions",
  "relatedMemoryIds",
];

function sanitizeCollectionName(namespace: string): string {
  // ChromaDB collection names: 3-63 chars, alphanumeric + underscores,
  // must start and end with an alphanumeric character.
  const sanitized = namespace.replace(/[^a-zA-Z0-9]/g, "_");
  const name = `memories_${sanitized}`;
  const trimmed = name.slice(0, 63);
  return trimmed.replace(/^[^a-zA-Z0-9]+/, "").replace(/[^a-zA-Z0-9]+$/, "");
}

function serializeMetadata(
  metadata: MemoryMetadata,
  extra: { contentHash: string; parentId?: string }
): Record<string, string | number | boolean> {
  const flat: Record<string, string | number | boolean> = {};

  flat.namespace = metadata.namespace;
  flat.timestamp = metadata.timestamp;
  flat.source = metadata.source;
  flat.contentHash = extra.contentHash;

  if (extra.parentId) {
    flat.parentId = extra.parentId;
  }
  if (metadata.sessionId) {
    flat.sessionId = metadata.sessionId;
  }
  if (metadata.summary) {
    flat.summary = metadata.summary;
  }

  // Serialize arrays as JSON strings
  for (const key of ARRAY_METADATA_KEYS) {
    const value = metadata[key];
    if (value !== undefined) {
      flat[key] = JSON.stringify(value);
    }
  }

  return flat;
}

function deserializeMetadata(
  flat: Record<string, string | number | boolean>
): { metadata: MemoryMetadata; contentHash: string; parentId?: string } {
  const metadata: MemoryMetadata = {
    namespace: flat.namespace as string,
    tags: [],
    timestamp: flat.timestamp as string,
    source: flat.source as MemorySource,
  };

  if (flat.sessionId) {
    metadata.sessionId = flat.sessionId as string;
  }
  if (flat.summary) {
    metadata.summary = flat.summary as string;
  }

  // Deserialize JSON-encoded arrays
  for (const key of ARRAY_METADATA_KEYS) {
    if (flat[key] !== undefined) {
      try {
        (metadata as unknown as Record<string, unknown>)[key] = JSON.parse(
          flat[key] as string
        );
      } catch {
        // If parsing fails, wrap as single-element array for tags, ignore others
        if (key === "tags") {
          metadata.tags = [flat[key] as string] as MemoryMetadata["tags"];
        }
      }
    }
  }

  return {
    metadata,
    contentHash: flat.contentHash as string,
    parentId: flat.parentId ? (flat.parentId as string) : undefined,
  };
}

export class ChromaDBAdapter implements VectorStore {
  private client: ChromaClientType | null = null;
  private embeddingFunction: IEmbeddingFunction | null = null;
  private readonly path: string;
  private readonly collections = new Map<string, Collection>();

  constructor(config: { path: string }) {
    // Expand ~ to home directory
    this.path = config.path.replace(/^~/, process.env.HOME ?? "~");
  }

  async initialize(): Promise<void> {
    // Ensure data directory exists
    mkdirSync(this.path, { recursive: true });

    const { ChromaClient, DefaultEmbeddingFunction } = await import("chromadb");
    this.client = new ChromaClient({ path: this.path });
    this.embeddingFunction = new DefaultEmbeddingFunction();
  }

  private getClient(): ChromaClientType {
    if (!this.client) {
      throw new Error(
        "ChromaDB client not initialized. Call initialize() first."
      );
    }
    return this.client;
  }

  private getEmbeddingFunction(): IEmbeddingFunction {
    if (!this.embeddingFunction) {
      throw new Error(
        "Embedding function not initialized. Call initialize() first."
      );
    }
    return this.embeddingFunction;
  }

  private async getCollection(namespace: string): Promise<Collection> {
    const name = sanitizeCollectionName(namespace);
    const cached = this.collections.get(name);
    if (cached) {
      return cached;
    }

    const client = this.getClient();
    const collection = await client.getOrCreateCollection({
      name,
      metadata: { "hnsw:space": "cosine" },
      embeddingFunction: this.getEmbeddingFunction(),
    });
    this.collections.set(name, collection);
    return collection;
  }

  async upsert(entry: MemoryEntry): Promise<void> {
    const collection = await this.getCollection(entry.metadata.namespace);

    const flatMetadata = serializeMetadata(entry.metadata, {
      contentHash: entry.contentHash,
      parentId: entry.parentId,
    });

    const params: {
      ids: string[];
      documents: string[];
      metadatas: Record<string, string | number | boolean>[];
      embeddings?: number[][];
    } = {
      ids: [entry.id],
      documents: [entry.content],
      metadatas: [flatMetadata],
    };

    if (entry.embedding) {
      params.embeddings = [entry.embedding];
    }

    await collection.upsert(params);
  }

  async search(
    queryEmbedding: number[],
    filters: SearchFilters
  ): Promise<MemoryResult[]> {
    if (!filters.namespace) {
      return this.searchAllCollections(queryEmbedding, filters);
    }

    const collection = await this.getCollection(filters.namespace);
    return this.searchCollection(collection, queryEmbedding, filters);
  }

  private async searchAllCollections(
    queryEmbedding: number[],
    filters: SearchFilters
  ): Promise<MemoryResult[]> {
    const client = this.getClient();
    const allCollections = await client.listCollections();
    const allResults: MemoryResult[] = [];

    for (const col of allCollections) {
      try {
        const collection = await client.getCollection({ name: col, embeddingFunction: this.getEmbeddingFunction() });
        const results = await this.searchCollection(
          collection,
          queryEmbedding,
          filters
        );
        allResults.push(...results);
      } catch {
        // Skip collections that fail
      }
    }

    // Sort by score descending and limit
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, filters.limit);
  }

  private async searchCollection(
    collection: Collection,
    queryEmbedding: number[],
    filters: SearchFilters
  ): Promise<MemoryResult[]> {
    const whereConditions = this.buildWhereClause(filters);

    const queryParams: {
      queryEmbeddings: number[][];
      nResults: number;
      where?: Record<string, unknown>;
    } = {
      queryEmbeddings: [queryEmbedding],
      nResults: filters.limit,
    };

    if (whereConditions) {
      queryParams.where = whereConditions;
    }

    const results = await collection.query(queryParams);

    if (!results.ids || !results.ids[0]) {
      return [];
    }

    const memoryResults: MemoryResult[] = [];
    const ids = results.ids[0];
    const documents = results.documents?.[0] ?? [];
    const metadatas = results.metadatas?.[0] ?? [];
    const distances = results.distances?.[0] ?? [];
    const embeddings = results.embeddings?.[0] ?? [];

    for (let i = 0; i < ids.length; i++) {
      const rawMeta = (metadatas[i] ?? {}) as Record<
        string,
        string | number | boolean
      >;
      const { metadata, contentHash, parentId } =
        deserializeMetadata(rawMeta);

      const entry: MemoryEntry = {
        id: ids[i],
        content: (documents[i] as string) ?? "",
        contentHash,
        parentId,
        metadata,
      };

      if (embeddings[i]) {
        entry.embedding = embeddings[i] as number[];
      }

      // ChromaDB returns distances; convert to similarity score.
      // Cosine distance ranges from 0 (identical) to 2 (opposite).
      // Similarity = 1 - (distance / 2)
      const distance = distances[i] ?? 0;
      const score = 1 - distance / 2;

      memoryResults.push({ entry, score });
    }

    return memoryResults;
  }

  private buildWhereClause(
    filters: SearchFilters | ListFilters
  ): Record<string, unknown> | undefined {
    const conditions: Record<string, unknown>[] = [];

    if ("tags" in filters && filters.tags && filters.tags.length > 0) {
      // Tags are stored as a JSON string. Use $contains to match substring
      // within the serialized array (e.g. '"decision"' inside '["decision","code"]').
      for (const tag of filters.tags) {
        conditions.push({ tags: { $contains: tag } });
      }
    }

    if ("after" in filters && filters.after) {
      conditions.push({ timestamp: { $gte: filters.after } });
    }

    if ("before" in filters && filters.before) {
      conditions.push({ timestamp: { $lte: filters.before } });
    }

    if (conditions.length === 0) {
      return undefined;
    }
    if (conditions.length === 1) {
      return conditions[0];
    }
    return { $and: conditions };
  }

  async delete(id: string): Promise<boolean> {
    const client = this.getClient();
    const allCollections = await client.listCollections();

    for (const col of allCollections) {
      try {
        const collection = await client.getCollection({ name: col, embeddingFunction: this.getEmbeddingFunction() });
        // Check if the ID exists in this collection
        const result = await collection.get({ ids: [id] });
        if (result.ids && result.ids.length > 0) {
          await collection.delete({ ids: [id] });
          return true;
        }
      } catch {
        // Skip collections that fail
      }
    }

    return false;
  }

  async list(filters: ListFilters): Promise<MemoryEntry[]> {
    if (!filters.namespace) {
      return this.listAllCollections(filters);
    }

    const collection = await this.getCollection(filters.namespace);
    return this.listFromCollection(collection, filters);
  }

  private async listAllCollections(
    filters: ListFilters
  ): Promise<MemoryEntry[]> {
    const client = this.getClient();
    const allCollections = await client.listCollections();
    const allEntries: MemoryEntry[] = [];

    for (const col of allCollections) {
      try {
        const collection = await client.getCollection({ name: col, embeddingFunction: this.getEmbeddingFunction() });
        const entries = await this.listFromCollection(collection, {
          ...filters,
          // Fetch more than needed; sort and slice after merging
          limit: filters.limit + filters.offset,
          offset: 0,
        });
        allEntries.push(...entries);
      } catch {
        // Skip collections that fail
      }
    }

    // Sort by timestamp descending
    allEntries.sort(
      (a, b) =>
        new Date(b.metadata.timestamp).getTime() -
        new Date(a.metadata.timestamp).getTime()
    );

    return allEntries.slice(filters.offset, filters.offset + filters.limit);
  }

  private async listFromCollection(
    collection: Collection,
    filters: ListFilters
  ): Promise<MemoryEntry[]> {
    const whereConditions = this.buildWhereClause(filters);

    const getParams: {
      limit?: number;
      offset?: number;
      where?: Record<string, unknown>;
    } = {};

    if (filters.limit) {
      // Fetch enough to handle offset + limit, then slice in-memory
      getParams.limit = filters.limit + filters.offset;
    }

    if (whereConditions) {
      getParams.where = whereConditions;
    }

    const results = await collection.get(getParams);

    if (!results.ids || results.ids.length === 0) {
      return [];
    }

    const entries: MemoryEntry[] = [];

    for (let i = 0; i < results.ids.length; i++) {
      const rawMeta = (results.metadatas?.[i] ?? {}) as Record<
        string,
        string | number | boolean
      >;
      const { metadata, contentHash, parentId } =
        deserializeMetadata(rawMeta);

      entries.push({
        id: results.ids[i],
        content: (results.documents?.[i] as string) ?? "",
        contentHash,
        parentId,
        metadata,
      });
    }

    // Sort by timestamp descending
    entries.sort(
      (a, b) =>
        new Date(b.metadata.timestamp).getTime() -
        new Date(a.metadata.timestamp).getTime()
    );

    return entries.slice(filters.offset, filters.offset + filters.limit);
  }

  async count(namespace?: string): Promise<number> {
    if (namespace) {
      const collection = await this.getCollection(namespace);
      return collection.count();
    }

    // Count across all collections
    const client = this.getClient();
    const allCollections = await client.listCollections();
    let total = 0;

    for (const col of allCollections) {
      try {
        const collection = await client.getCollection({ name: col, embeddingFunction: this.getEmbeddingFunction() });
        total += await collection.count();
      } catch {
        // Skip collections that fail
      }
    }

    return total;
  }

  async close(): Promise<void> {
    this.collections.clear();
    this.client = null;
  }
}
