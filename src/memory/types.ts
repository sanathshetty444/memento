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
  container?: string;
  priority?: MemoryPriority;
  importance?: number;
  accessCount?: number;
  conversationId?: string;
}

/**
 * Memory tags — accepts any string. Built-in tags listed below for reference:
 * "conversation", "decision", "code", "error", "architecture", "config", "dependency", "todo"
 */
export type MemoryTag = string;

/** Built-in tags for auto-tagging and tool descriptions */
export const BUILT_IN_TAGS = [
  "conversation",
  "decision",
  "code",
  "error",
  "architecture",
  "config",
  "dependency",
  "todo",
] as const;

export type BuiltInTag = (typeof BUILT_IN_TAGS)[number];

export type MemorySource = "explicit" | "hook:post_tool_use" | "hook:stop" | "import";

export interface MemoryRelation {
  sourceId: string;
  targetId: string;
  type: RelationType;
  strength: number; // 0.0-1.0
  createdAt: string; // ISO-8601
}

export type RelationType = "similar" | "supersedes" | "references" | "contradicts" | "elaborates";

export type MemoryPriority = "low" | "normal" | "high";

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
  container?: string;
  priority?: MemoryPriority;
}

export interface RecallOptions {
  query: string;
  namespace?: string;
  tags?: MemoryTag[];
  limit?: number;
  after?: string;
  before?: string;
  container?: string;
  searchMode?: "vector" | "hybrid" | "keyword";
}

export interface ListOptions {
  namespace?: string;
  tags?: MemoryTag[];
  limit?: number;
  offset?: number;
  container?: string;
}

export const GLOBAL_NAMESPACE = "__global__";
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;

/** Signal keywords that indicate high-priority content */
export const SIGNAL_KEYWORDS = [
  "remember",
  "important",
  "decision",
  "architecture",
  "bug",
  "fix",
  "never",
  "always",
  "convention",
  "pattern",
  "rule",
  "workaround",
  "deprecated",
  "migrate",
] as const;
