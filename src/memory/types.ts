export interface MemoryEntry {
  id: string;
  content: string;
  embedding?: number[];
  contentHash: string;
  parentId?: string;
  metadata: MemoryMetadata;
}

export interface MemoryMetadata {
  namespace: string;
  tags: MemoryTag[];
  timestamp: string;
  source: MemorySource;
  files?: string[];
  functions?: string[];
  sessionId?: string;
  summary?: string;
  relatedMemoryIds?: string[];
}

export type MemoryTag = "conversation" | "decision" | "code" | "error" | "architecture" | "config" | "dependency" | "todo";

export type MemorySource = "explicit" | "hook:post_tool_use" | "hook:stop";

export interface MemoryResult {
  entry: MemoryEntry;
  score: number;
}

export interface SaveOptions {
  content: string;
  tags?: MemoryTag[];
  namespace?: string;
  global?: boolean;
  source?: MemorySource;
  files?: string[];
  functions?: string[];
  sessionId?: string;
  summary?: string;
}

export interface RecallOptions {
  query: string;
  namespace?: string;
  tags?: MemoryTag[];
  limit?: number;
  after?: string;
  before?: string;
}

export interface ListOptions {
  namespace?: string;
  tags?: MemoryTag[];
  limit?: number;
  offset?: number;
}

export const GLOBAL_NAMESPACE = "__global__";
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
