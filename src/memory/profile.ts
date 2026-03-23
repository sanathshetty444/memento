/**
 * User profile generator — analyzes memory patterns and generates a profile
 * with coding patterns, preferred languages, frequently modified files,
 * and decision history.
 */

import type { MemoryManager } from "./memory-manager.js";
import type { MemoryEntry } from "./types.js";
import { MAX_LIMIT } from "./types.js";

export interface UserProfile {
  namespace: string;
  generatedAt: string;
  stats: {
    totalMemories: number;
    sessionsCount: number;
    avgEntriesPerSession: number;
    oldestMemory: string;
    newestMemory: string;
  };
  patterns: {
    topTags: Array<{ tag: string; count: number; percentage: number }>;
    topFiles: Array<{ path: string; count: number }>;
    topFunctions: Array<{ name: string; count: number }>;
    preferredLanguages: string[];
    commonPackages: string[];
  };
  decisionSummary: string[];
}

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript",
  ".js": "JavaScript",
  ".jsx": "JavaScript",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".rb": "Ruby",
  ".cpp": "C++",
  ".c": "C",
  ".h": "C",
  ".hpp": "C++",
  ".cs": "C#",
  ".swift": "Swift",
  ".php": "PHP",
  ".sh": "Shell",
  ".bash": "Shell",
  ".zsh": "Shell",
  ".lua": "Lua",
  ".r": "R",
  ".scala": "Scala",
  ".dart": "Dart",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".html": "HTML",
  ".css": "CSS",
  ".scss": "SCSS",
  ".sql": "SQL",
  ".yaml": "YAML",
  ".yml": "YAML",
  ".json": "JSON",
  ".toml": "TOML",
  ".md": "Markdown",
};

/**
 * Paginate through all entries in a namespace.
 */
async function getAllEntries(manager: MemoryManager, namespace?: string): Promise<MemoryEntry[]> {
  const allEntries: MemoryEntry[] = [];
  let offset = 0;
  while (true) {
    const batch = await manager.list({
      namespace,
      limit: MAX_LIMIT,
      offset,
    });
    if (batch.length === 0) break;
    allEntries.push(...batch);
    offset += batch.length;
    if (batch.length < MAX_LIMIT) break;
  }
  return allEntries;
}

/**
 * Infer programming languages from file extensions.
 */
function inferLanguages(files: string[]): string[] {
  const langCounts = new Map<string, number>();

  for (const file of files) {
    const dotIndex = file.lastIndexOf(".");
    if (dotIndex === -1) continue;
    const ext = file.slice(dotIndex).toLowerCase();
    const lang = EXTENSION_LANGUAGE_MAP[ext];
    if (lang) {
      langCounts.set(lang, (langCounts.get(lang) ?? 0) + 1);
    }
  }

  return [...langCounts.entries()].sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
}

/**
 * Extract common packages from dependency-tagged entries.
 */
function extractPackages(entries: MemoryEntry[]): string[] {
  const packageCounts = new Map<string, number>();

  for (const entry of entries) {
    if (!entry.metadata.tags.includes("dependency")) continue;

    // Look for package-like patterns in content
    const patterns = [
      // npm/yarn: "package-name", '@scope/package'
      /["'](@?[\w-]+(?:\/[\w-]+)?)["']/g,
      // import from 'package'
      /(?:from|require\()\s*["'](@?[\w-]+(?:\/[\w-]+)?)/g,
      // pip: package-name, package==version
      /(?:^|\s)([\w-]+)(?:==|>=|<=|~=|!=)/gm,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(entry.content)) !== null) {
        const pkg = match[1];
        if (pkg && pkg.length > 1 && !pkg.startsWith(".")) {
          packageCounts.set(pkg, (packageCounts.get(pkg) ?? 0) + 1);
        }
      }
    }
  }

  return [...packageCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([pkg]) => pkg);
}

/**
 * Generate a user profile by analyzing all memory entries in a namespace.
 */
export async function generateProfile(
  manager: MemoryManager,
  namespace?: string,
): Promise<UserProfile> {
  const allEntries = await getAllEntries(manager, namespace);

  const total = allEntries.length;
  const resolvedNamespace = total > 0 ? allEntries[0].metadata.namespace : (namespace ?? "unknown");

  // Stats: sessions
  const sessions = new Set<string>();
  for (const entry of allEntries) {
    if (entry.metadata.sessionId) {
      sessions.add(entry.metadata.sessionId);
    }
  }

  // Stats: timestamps
  const timestamps = allEntries
    .map((e) => Date.parse(e.metadata.timestamp))
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b);

  const oldestMemory = timestamps.length > 0 ? new Date(timestamps[0]).toISOString() : "N/A";
  const newestMemory =
    timestamps.length > 0 ? new Date(timestamps[timestamps.length - 1]).toISOString() : "N/A";

  // Tags: frequency and percentages
  const tagCounts = new Map<string, number>();
  for (const entry of allEntries) {
    for (const tag of entry.metadata.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }
  const topTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({
      tag,
      count,
      percentage: total > 0 ? Math.round((count / total) * 1000) / 10 : 0,
    }));

  // Files: frequency
  const fileCounts = new Map<string, number>();
  const allFiles: string[] = [];
  for (const entry of allEntries) {
    if (entry.metadata.files) {
      for (const file of entry.metadata.files) {
        fileCounts.set(file, (fileCounts.get(file) ?? 0) + 1);
        allFiles.push(file);
      }
    }
  }
  const topFiles = [...fileCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([path, count]) => ({ path, count }));

  // Functions: frequency
  const funcCounts = new Map<string, number>();
  for (const entry of allEntries) {
    if (entry.metadata.functions) {
      for (const fn of entry.metadata.functions) {
        funcCounts.set(fn, (funcCounts.get(fn) ?? 0) + 1);
      }
    }
  }
  const topFunctions = [...funcCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));

  // Languages: inferred from file extensions
  const preferredLanguages = inferLanguages(allFiles);

  // Packages: extracted from dependency entries
  const commonPackages = extractPackages(allEntries);

  // Decision summaries: last 10
  const decisionEntries = allEntries
    .filter((e) => e.metadata.tags.includes("decision"))
    .sort((a, b) => Date.parse(b.metadata.timestamp) - Date.parse(a.metadata.timestamp))
    .slice(0, 10);
  const decisionSummary = decisionEntries.map((e) => e.metadata.summary ?? e.content.slice(0, 150));

  return {
    namespace: resolvedNamespace,
    generatedAt: new Date().toISOString(),
    stats: {
      totalMemories: total,
      sessionsCount: sessions.size,
      avgEntriesPerSession: sessions.size > 0 ? Math.round((total / sessions.size) * 10) / 10 : 0,
      oldestMemory,
      newestMemory,
    },
    patterns: {
      topTags,
      topFiles,
      topFunctions,
      preferredLanguages,
      commonPackages,
    },
    decisionSummary,
  };
}

/**
 * Save the profile as a __profile__ entry in memory.
 */
export async function saveProfile(manager: MemoryManager, profile: UserProfile): Promise<void> {
  await manager.save({
    content: `__profile__\n${JSON.stringify(profile, null, 2)}`,
    tags: ["architecture"],
    namespace: profile.namespace,
    summary: `User profile for ${profile.namespace}`,
    priority: "high",
    source: "explicit",
  });
}
