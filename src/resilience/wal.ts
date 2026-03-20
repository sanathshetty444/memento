import { randomUUID } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export interface WALEntry {
  id: string;
  timestamp: string;
  operation: "upsert" | "delete";
  data: unknown;
  committed: boolean;
}

export class WriteAheadLog {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath ?? join(homedir(), ".claude-memory", "wal.jsonl");

    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    if (!existsSync(this.filePath)) {
      writeFileSync(this.filePath, "", "utf-8");
    }
  }

  append(operation: "upsert" | "delete", data: unknown): string {
    const id = randomUUID();
    const entry: WALEntry = {
      id,
      timestamp: new Date().toISOString(),
      operation,
      data,
      committed: false,
    };

    appendFileSync(this.filePath, JSON.stringify(entry) + "\n", "utf-8");
    return id;
  }

  markCommitted(id: string): void {
    const entries = this.readAll();
    let found = false;

    for (const entry of entries) {
      if (entry.id === id) {
        entry.committed = true;
        found = true;
        break;
      }
    }

    if (found) {
      this.writeAll(entries);
    }
  }

  getPending(): WALEntry[] {
    return this.readAll().filter((entry) => !entry.committed);
  }

  prune(olderThanDays: number = 7): number {
    const entries = this.readAll();
    const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000;

    const remaining = entries.filter((entry) => {
      if (!entry.committed) return true;
      return new Date(entry.timestamp).getTime() > cutoff;
    });

    const removed = entries.length - remaining.length;
    if (removed > 0) {
      this.writeAll(remaining);
    }
    return removed;
  }

  close(): void {
    // No-op for sync file operations; exists for interface completeness
  }

  private readAll(): WALEntry[] {
    const content = readFileSync(this.filePath, "utf-8").trim();
    if (!content) return [];

    return content.split("\n").map((line) => JSON.parse(line) as WALEntry);
  }

  private writeAll(entries: WALEntry[]): void {
    const content =
      entries.length > 0 ? entries.map((e) => JSON.stringify(e)).join("\n") + "\n" : "";
    writeFileSync(this.filePath, content, "utf-8");
  }
}
