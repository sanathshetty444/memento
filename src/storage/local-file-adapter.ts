/**
 * Local file-based vector store.
 * Zero-config, zero-dependency — stores entries as JSON files with brute-force
 * cosine similarity search. Works offline, no server required.
 *
 * Storage layout:
 *   <dataDir>/
 *     <namespace>/
 *       <id>.json   — one MemoryEntry per file
 */

import { readFileSync, writeFileSync, unlinkSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
import type { MemoryEntry, MemoryResult } from "../memory/types.js";
import type { VectorStore, SearchFilters, ListFilters } from "./interface.js";

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB);
  return mag === 0 ? 0 : dot / mag;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export class LocalFileAdapter implements VectorStore {
  private readonly dataDir: string;

  constructor(config: { path: string }) {
    this.dataDir = config.path.replace(/^~/, homedir());
  }

  async initialize(): Promise<void> {
    mkdirSync(this.dataDir, { recursive: true });
  }

  private namespacePath(namespace: string): string {
    return join(this.dataDir, sanitizeName(namespace));
  }

  private entryPath(namespace: string, id: string): string {
    return join(this.namespacePath(namespace), `${id}.json`);
  }

  private ensureNamespaceDir(namespace: string): void {
    mkdirSync(this.namespacePath(namespace), { recursive: true });
  }

  private readEntry(filePath: string): MemoryEntry | null {
    try {
      return JSON.parse(readFileSync(filePath, "utf-8")) as MemoryEntry;
    } catch {
      return null;
    }
  }

  private listNamespaces(): string[] {
    if (!existsSync(this.dataDir)) return [];
    return readdirSync(this.dataDir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  }

  private readAllEntries(namespace: string): MemoryEntry[] {
    const dir = this.namespacePath(namespace);
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter(f => f.endsWith(".json"));
    const entries: MemoryEntry[] = [];
    for (const file of files) {
      const entry = this.readEntry(join(dir, file));
      if (entry) entries.push(entry);
    }
    return entries;
  }

  async upsert(entry: MemoryEntry): Promise<void> {
    this.ensureNamespaceDir(entry.metadata.namespace);
    const path = this.entryPath(entry.metadata.namespace, entry.id);
    writeFileSync(path, JSON.stringify(entry, null, 2), "utf-8");
  }

  async search(queryEmbedding: number[], filters: SearchFilters): Promise<MemoryResult[]> {
    const namespaces = filters.namespace
      ? [sanitizeName(filters.namespace)]
      : this.listNamespaces();

    const scored: MemoryResult[] = [];

    for (const ns of namespaces) {
      const entries = this.readAllEntries(ns);
      for (const entry of entries) {
        if (!this.matchesFilters(entry, filters)) continue;
        const score = entry.embedding
          ? cosineSimilarity(queryEmbedding, entry.embedding)
          : 0;
        scored.push({ entry, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, filters.limit);
  }

  async delete(id: string): Promise<boolean> {
    for (const ns of this.listNamespaces()) {
      const path = join(this.namespacePath(ns), `${id}.json`);
      if (existsSync(path)) {
        unlinkSync(path);
        return true;
      }
    }
    return false;
  }

  async list(filters: ListFilters): Promise<MemoryEntry[]> {
    const namespaces = filters.namespace
      ? [sanitizeName(filters.namespace)]
      : this.listNamespaces();

    let all: MemoryEntry[] = [];
    for (const ns of namespaces) {
      const entries = this.readAllEntries(ns);
      for (const entry of entries) {
        if (this.matchesListFilters(entry, filters)) {
          all.push(entry);
        }
      }
    }

    all.sort((a, b) =>
      new Date(b.metadata.timestamp).getTime() - new Date(a.metadata.timestamp).getTime()
    );
    return all.slice(filters.offset, filters.offset + filters.limit);
  }

  async count(namespace?: string): Promise<number> {
    const namespaces = namespace
      ? [sanitizeName(namespace)]
      : this.listNamespaces();

    let total = 0;
    for (const ns of namespaces) {
      const dir = this.namespacePath(ns);
      if (existsSync(dir)) {
        total += readdirSync(dir).filter(f => f.endsWith(".json")).length;
      }
    }
    return total;
  }

  async close(): Promise<void> {
    // No-op for file-based store
  }

  private matchesFilters(entry: MemoryEntry, filters: SearchFilters): boolean {
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some(t => entry.metadata.tags.includes(t as any));
      if (!hasTag) return false;
    }
    if (filters.after && entry.metadata.timestamp < filters.after) return false;
    if (filters.before && entry.metadata.timestamp > filters.before) return false;
    return true;
  }

  private matchesListFilters(entry: MemoryEntry, filters: ListFilters): boolean {
    if (filters.tags && filters.tags.length > 0) {
      const hasTag = filters.tags.some(t => entry.metadata.tags.includes(t as any));
      if (!hasTag) return false;
    }
    return true;
  }
}
