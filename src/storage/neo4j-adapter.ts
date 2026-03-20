import type { VectorStore, SearchFilters, ListFilters } from "./interface.js";
import type { MemoryEntry, MemoryResult } from "../memory/types.js";

export class Neo4jAdapter implements VectorStore {
  private driver: any = null;
  private url: string;
  private username: string;
  private password: string;

  constructor(config: { url: string; username: string; password: string }) {
    this.url = config.url;
    this.username = config.username;
    this.password = config.password;
  }

  async initialize(): Promise<void> {
    const neo4j = await this.loadDriver();
    this.driver = neo4j.driver(this.url, neo4j.auth.basic(this.username, this.password));
    await this.driver.verifyConnectivity();

    const session = this.driver.session();
    try {
      await session.run(`
        CREATE VECTOR INDEX memory_embeddings IF NOT EXISTS
        FOR (m:Memory) ON (m.embedding)
        OPTIONS {indexConfig: {\`vector.dimensions\`: 384, \`vector.similarity_function\`: 'cosine'}}
      `);
    } finally {
      await session.close();
    }
  }

  async upsert(entry: MemoryEntry): Promise<void> {
    const session = this.driver.session();
    try {
      await session.executeWrite(async (tx: any) => {
        // Upsert the Memory node
        await tx.run(
          `
          MERGE (m:Memory {id: $id})
          SET m.content = $content,
              m.contentHash = $contentHash,
              m.namespace = $namespace,
              m.tags = $tags,
              m.timestamp = $timestamp,
              m.source = $source,
              m.summary = $summary,
              m.sessionId = $sessionId,
              m.embedding = $embedding
          `,
          {
            id: entry.id,
            content: entry.content,
            contentHash: entry.contentHash,
            namespace: entry.metadata.namespace,
            tags: entry.metadata.tags,
            timestamp: entry.metadata.timestamp,
            source: entry.metadata.source,
            summary: entry.metadata.summary ?? null,
            sessionId: entry.metadata.sessionId ?? null,
            embedding: entry.embedding ?? null,
          },
        );

        // Create File relationships
        if (entry.metadata.files?.length) {
          for (const filePath of entry.metadata.files) {
            await tx.run(
              `
              MATCH (m:Memory {id: $id})
              MERGE (f:File {path: $path})
              MERGE (m)-[:REFERENCES_FILE]->(f)
              `,
              { id: entry.id, path: filePath },
            );
          }
        }

        // Create Function relationships
        if (entry.metadata.functions?.length) {
          for (const funcName of entry.metadata.functions) {
            await tx.run(
              `
              MATCH (m:Memory {id: $id})
              MERGE (fn:Function {name: $name})
              MERGE (m)-[:REFERENCES_FUNCTION]->(fn)
              `,
              { id: entry.id, name: funcName },
            );
          }
        }

        // Create RELATED_TO relationships
        if (entry.metadata.relatedMemoryIds?.length) {
          for (const relatedId of entry.metadata.relatedMemoryIds) {
            await tx.run(
              `
              MATCH (m:Memory {id: $id})
              MATCH (r:Memory {id: $relatedId})
              MERGE (m)-[:RELATED_TO]->(r)
              `,
              { id: entry.id, relatedId },
            );
          }
        }
      });
    } finally {
      await session.close();
    }
  }

  async search(queryEmbedding: number[], filters: SearchFilters): Promise<MemoryResult[]> {
    const session = this.driver.session();
    try {
      const whereClauses: string[] = [];
      const params: Record<string, any> = {
        embedding: queryEmbedding,
        limit: filters.limit,
      };

      if (filters.namespace) {
        whereClauses.push("m.namespace = $namespace");
        params.namespace = filters.namespace;
      }
      if (filters.tags?.length) {
        whereClauses.push("any(tag IN $tags WHERE tag IN m.tags)");
        params.tags = filters.tags;
      }
      if (filters.after) {
        whereClauses.push("m.timestamp >= $after");
        params.after = filters.after;
      }
      if (filters.before) {
        whereClauses.push("m.timestamp <= $before");
        params.before = filters.before;
      }

      const whereStr = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

      const result = await session.run(
        `
        CALL db.index.vector.queryNodes('memory_embeddings', $limit, $embedding)
        YIELD node AS m, score
        ${whereStr}
        RETURN m, score
        ORDER BY score DESC
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((record: any) => {
        const node = record.get("m");
        const score = record.get("score");
        return {
          entry: this.nodeToEntry(node),
          score,
        };
      });
    } finally {
      await session.close();
    }
  }

  async delete(id: string): Promise<boolean> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (m:Memory {id: $id})
        DETACH DELETE m
        RETURN count(m) AS deleted
        `,
        { id },
      );
      const deleted = result.records[0]?.get("deleted");
      return deleted > 0;
    } finally {
      await session.close();
    }
  }

  async list(filters: ListFilters): Promise<MemoryEntry[]> {
    const session = this.driver.session();
    try {
      const whereClauses: string[] = [];
      const params: Record<string, any> = {
        limit: filters.limit,
        offset: filters.offset,
      };

      if (filters.namespace) {
        whereClauses.push("m.namespace = $namespace");
        params.namespace = filters.namespace;
      }
      if (filters.tags?.length) {
        whereClauses.push("any(tag IN $tags WHERE tag IN m.tags)");
        params.tags = filters.tags;
      }

      const whereStr = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

      const result = await session.run(
        `
        MATCH (m:Memory)
        ${whereStr}
        RETURN m
        ORDER BY m.timestamp DESC
        SKIP $offset
        LIMIT $limit
        `,
        params,
      );

      return result.records.map((record: any) => this.nodeToEntry(record.get("m")));
    } finally {
      await session.close();
    }
  }

  async count(namespace?: string): Promise<number> {
    const session = this.driver.session();
    try {
      const query = namespace
        ? "MATCH (m:Memory) WHERE m.namespace = $namespace RETURN count(m) AS total"
        : "MATCH (m:Memory) RETURN count(m) AS total";

      const result = await session.run(query, namespace ? { namespace } : {});
      const total = result.records[0]?.get("total");
      return typeof total === "object" && total.toNumber ? total.toNumber() : Number(total);
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  private nodeToEntry(node: any): MemoryEntry {
    const props = node.properties;
    return {
      id: props.id,
      content: props.content,
      contentHash: props.contentHash,
      embedding: props.embedding ?? undefined,
      metadata: {
        namespace: props.namespace,
        tags: props.tags ?? [],
        timestamp: props.timestamp,
        source: props.source,
        summary: props.summary ?? undefined,
        sessionId: props.sessionId ?? undefined,
      },
    };
  }

  private async loadDriver(): Promise<any> {
    try {
      const neo4j = await import("neo4j-driver");
      return neo4j.default ?? neo4j;
    } catch {
      throw new Error("neo4j-driver is not installed. Install it with: npm install neo4j-driver");
    }
  }
}
