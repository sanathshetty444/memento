/**
 * Project indexer — scans key project files and saves them as high-importance
 * architecture/config memories. Runs once per project (idempotent via marker file).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { MemoryManager } from "../memory/memory-manager.js";

export interface IndexResult {
  indexed: string[];
  skipped: string[];
  alreadyIndexed: boolean;
}

/** Files to scan in order. Each entry is an array of alternatives (first found wins). */
const FILE_GROUPS: string[][] = [
  ["README.md", "README"],
  ["package.json", "Cargo.toml", "pyproject.toml", "go.mod", "pom.xml"],
  ["tsconfig.json"],
  [".env.example", ".env.sample"],
];

/** Glob-like prefixes for config files that may have varied extensions. */
const CONFIG_PREFIXES = ["jest.config", "vitest.config"];

export async function indexProject(
  manager: MemoryManager,
  options?: { cwd?: string; namespace?: string },
): Promise<IndexResult> {
  const cwd = options?.cwd ?? process.cwd();
  const markerDir = join(cwd, ".claude-memory");
  const markerFile = join(markerDir, ".indexed");

  // Check marker — already indexed
  if (existsSync(markerFile)) {
    return { indexed: [], skipped: [], alreadyIndexed: true };
  }

  const indexed: string[] = [];
  const skipped: string[] = [];

  // --- Phase 1: Scan key files ---
  for (const group of FILE_GROUPS) {
    let found = false;
    for (const filename of group) {
      const filePath = join(cwd, filename);
      if (existsSync(filePath)) {
        await saveFileMemory(manager, filePath, filename, options?.namespace);
        indexed.push(filename);
        found = true;
        break; // only first match per group
      }
    }
    if (!found) {
      skipped.push(group.join(" | "));
    }
  }

  // Scan for config files with varied extensions (jest.config.*, vitest.config.*)
  try {
    const topFiles = readdirSync(cwd);
    for (const prefix of CONFIG_PREFIXES) {
      const match = topFiles.find((f) => f.startsWith(prefix));
      if (match) {
        const filePath = join(cwd, match);
        await saveFileMemory(manager, filePath, match, options?.namespace);
        indexed.push(match);
      } else {
        skipped.push(`${prefix}.*`);
      }
    }
  } catch {
    // Non-fatal: directory read failure
  }

  // --- Phase 2: Directory tree (2 levels deep) ---
  const tree = buildDirectoryTree(cwd, 2);
  if (tree) {
    await manager.save({
      content: `Project directory structure:\n\n${tree}`,
      tags: ["architecture"],
      source: "explicit",
      priority: "high",
      summary: "Project index: directory tree",
      ...(options?.namespace ? { namespace: options.namespace } : {}),
    });
  }

  // --- Phase 3: Write marker file ---
  if (!existsSync(markerDir)) {
    mkdirSync(markerDir, { recursive: true });
  }
  writeFileSync(markerFile, new Date().toISOString(), "utf-8");

  return { indexed, skipped, alreadyIndexed: false };
}

async function saveFileMemory(
  manager: MemoryManager,
  filePath: string,
  filename: string,
  namespace?: string,
): Promise<void> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return; // skip unreadable files
  }

  // Cap at 5000 chars
  if (content.length > 5000) {
    content = content.slice(0, 5000) + "\n... (truncated)";
  }

  await manager.save({
    content: `File: ${filename}\n\n${content}`,
    tags: ["architecture", "config"],
    source: "explicit",
    priority: "high",
    summary: `Project index: ${filename}`,
    ...(namespace ? { namespace } : {}),
  });
}

/** Build a text representation of the directory tree up to `maxDepth` levels. */
function buildDirectoryTree(dir: string, maxDepth: number, prefix = "", depth = 0): string {
  if (depth > maxDepth) return "";

  const IGNORE = new Set([
    "node_modules",
    ".git",
    ".claude-memory",
    "dist",
    "build",
    "coverage",
    ".next",
    ".cache",
    "__pycache__",
    "target",
    ".DS_Store",
  ]);

  let result = "";
  let entries: string[];
  try {
    entries = readdirSync(dir)
      .filter((e) => !IGNORE.has(e))
      .sort();
  } catch {
    return "";
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const fullPath = join(dir, entry);
    const isLast = i === entries.length - 1;
    const connector = isLast ? "└── " : "├── ";
    const childPrefix = isLast ? "    " : "│   ";

    let isDir = false;
    try {
      isDir = statSync(fullPath).isDirectory();
    } catch {
      continue;
    }

    result += `${prefix}${connector}${entry}${isDir ? "/" : ""}\n`;

    if (isDir && depth < maxDepth) {
      result += buildDirectoryTree(fullPath, maxDepth, prefix + childPrefix, depth + 1);
    }
  }

  return result;
}
