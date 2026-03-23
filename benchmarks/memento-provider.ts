/**
 * MemoryBench-compatible provider adapter for Memento.
 *
 * Wraps the Memento HTTP API (server.ts) into a standard interface
 * that benchmark runners can consume.
 *
 * Requires `memento serve` to be running on the configured baseUrl.
 */

// ── MemoryBench Provider Interface ──────────────────────────────

export interface MemoryBenchProvider {
  addMemory(content: string, metadata?: { tags?: string[] }): Promise<string>;
  searchMemory(
    query: string,
    limit?: number,
  ): Promise<Array<{ content: string; score: number; id: string }>>;
  getProfile(): Promise<{ totalMemories: number; topTags: string[] }>;
  reset(): Promise<void>;
}

// ── Memento HTTP Response Types ─────────────────────────────────

interface SaveResponse {
  saved: number;
  ids: string[];
}

interface RecallResult {
  id: string;
  content: string;
  score: number;
  tags: string[];
  timestamp: string;
}

interface RecallResponse {
  results: RecallResult[];
}

interface ListEntry {
  id: string;
  summary: string;
  tags: string[];
  timestamp: string;
}

interface ListResponse {
  entries: ListEntry[];
}

// ── MementoProvider ─────────────────────────────────────────────

export class MementoProvider implements MemoryBenchProvider {
  private readonly baseUrl: string;

  constructor(baseUrl = "http://127.0.0.1:21476") {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async addMemory(content: string, metadata?: { tags?: string[] }): Promise<string> {
    const body: Record<string, unknown> = { content };
    if (metadata?.tags) {
      body.tags = metadata.tags;
    }

    const res = await fetch(`${this.baseUrl}/api/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      throw new Error(`POST /api/save failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as SaveResponse;
    return data.ids[0];
  }

  async searchMemory(
    query: string,
    limit = 10,
  ): Promise<Array<{ content: string; score: number; id: string }>> {
    const res = await fetch(`${this.baseUrl}/api/recall`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit }),
    });

    if (!res.ok) {
      throw new Error(`POST /api/recall failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as RecallResponse;
    return data.results.map((r) => ({
      content: r.content,
      score: r.score,
      id: r.id,
    }));
  }

  async getProfile(): Promise<{ totalMemories: number; topTags: string[] }> {
    // Fetch all entries via paginated list and aggregate tags
    const allEntries: ListEntry[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const url = `${this.baseUrl}/api/list?limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`GET /api/list failed: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as ListResponse;
      allEntries.push(...data.entries);

      if (data.entries.length < pageSize) break;
      offset += pageSize;
    }

    // Aggregate tag counts
    const tagCounts = new Map<string, number>();
    for (const entry of allEntries) {
      for (const tag of entry.tags ?? []) {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }

    const topTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag]) => tag);

    return { totalMemories: allEntries.length, topTags };
  }

  async reset(): Promise<void> {
    // List all entries then delete each one
    const allIds: string[] = [];
    let offset = 0;
    const pageSize = 100;

    while (true) {
      const url = `${this.baseUrl}/api/list?limit=${pageSize}&offset=${offset}`;
      const res = await fetch(url);

      if (!res.ok) {
        throw new Error(`GET /api/list failed: ${res.status} ${await res.text()}`);
      }

      const data = (await res.json()) as ListResponse;
      allIds.push(...data.entries.map((e) => e.id));

      if (data.entries.length < pageSize) break;
      offset += pageSize;
    }

    // Delete all entries in parallel batches
    const batchSize = 20;
    for (let i = 0; i < allIds.length; i += batchSize) {
      const batch = allIds.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (id) => {
          const res = await fetch(`${this.baseUrl}/api/${id}`, { method: "DELETE" });
          if (!res.ok) {
            throw new Error(`DELETE /api/${id} failed: ${res.status}`);
          }
        }),
      );
    }
  }

  /** Health check — throws if server is unreachable. */
  async healthCheck(): Promise<boolean> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) {
      throw new Error(`Health check failed: ${res.status}`);
    }
    return true;
  }
}
