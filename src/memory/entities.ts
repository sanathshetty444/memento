/**
 * Entity extraction and knowledge graph index.
 * Extracts structured entities (file paths, functions, classes, packages, URLs, env vars)
 * from memory content and maintains a per-namespace entity index.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export type EntityType = "file_path" | "function" | "class" | "package" | "url" | "env_var";

export interface Entity {
  type: EntityType;
  value: string;
  memoryIds: string[];
}

export interface EntityIndex {
  entities: Entity[];
  lastUpdated: string;
}

/**
 * Extract entities from raw content using regex patterns.
 * Returns deduplicated entities with their types.
 */
export function extractEntities(content: string): Array<{ type: EntityType; value: string }> {
  const results: Array<{ type: EntityType; value: string }> = [];
  const seen = new Set<string>();

  function add(type: EntityType, value: string): void {
    const key = `${type}::${value}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ type, value });
    }
  }

  // URLs (must come before file paths to avoid partial matches)
  const urlRegex = /https?:\/\/[^\s)"']+/g;
  let match: RegExpExecArray | null;
  while ((match = urlRegex.exec(content)) !== null) {
    // Strip trailing punctuation that's likely not part of the URL
    const url = match[0].replace(/[.,;:!?]+$/, "");
    add("url", url);
  }

  // File paths: things like src/foo.ts, ./bar.js, /absolute/path.py
  const filePathRegex = /(?:\.{0,2}\/)?(?:[\w@.-]+\/)*[\w@.-]+\.[a-z]{1,4}\b/g;
  while ((match = filePathRegex.exec(content)) !== null) {
    const value = match[0];
    // Skip URLs (already captured) and very short matches
    if (value.startsWith("http") || value.length < 4) continue;
    // Must contain at least one slash or start with ./ or have a recognizable extension
    const hasSlash = value.includes("/");
    const codeExtensions =
      /\.(ts|js|tsx|jsx|py|rs|go|java|rb|css|scss|html|json|yaml|yml|toml|md|sh|sql|vue|svelte|astro)$/;
    if (hasSlash || codeExtensions.test(value)) {
      add("file_path", value);
    }
  }

  // Classes: class Foo
  const classRegex = /\bclass\s+([A-Z]\w+)/g;
  while ((match = classRegex.exec(content)) !== null) {
    add("class", match[1]);
  }

  // Functions: function foo, def foo, fn foo, or patterns like foo() in definitions
  const fnDeclRegex = /\b(?:function|def|fn)\s+(\w+)/g;
  while ((match = fnDeclRegex.exec(content)) !== null) {
    add("function", match[1]);
  }

  // Also catch method/function-like patterns: export function/const name, or name(
  const fnCallRegex = /\b(?:export\s+(?:async\s+)?(?:function|const)\s+)(\w+)/g;
  while ((match = fnCallRegex.exec(content)) !== null) {
    add("function", match[1]);
  }

  // Packages: from 'pkg' or require('pkg')
  const importFromRegex = /\bfrom\s+["']([^"']+)["']/g;
  while ((match = importFromRegex.exec(content)) !== null) {
    add("package", match[1]);
  }

  const requireRegex = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    add("package", match[1]);
  }

  // Also catch import "pkg" (no from)
  const importDirectRegex = /\bimport\s+["']([^"']+)["']/g;
  while ((match = importDirectRegex.exec(content)) !== null) {
    add("package", match[1]);
  }

  // Env vars: ALL_CAPS_WITH_UNDERSCORES (3+ chars)
  const envVarRegex = /\b([A-Z][A-Z0-9_]{2,})\b/g;
  while ((match = envVarRegex.exec(content)) !== null) {
    const value = match[1];
    // Filter out common false positives (common English abbreviations, type names, etc.)
    const falsePositives = new Set([
      "TODO",
      "NOTE",
      "FIXME",
      "HACK",
      "XXX",
      "README",
      "NULL",
      "TRUE",
      "FALSE",
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "HEAD",
      "OPTIONS",
      "JSON",
      "HTML",
      "CSS",
      "XML",
      "SQL",
      "URL",
      "URI",
      "API",
      "EOF",
      "AND",
      "NOT",
      "THE",
      "FOR",
      "BUT",
      "NOR",
      "YET",
    ]);
    if (!falsePositives.has(value)) {
      add("env_var", value);
    }
  }

  return results;
}

function entityIndexPath(dataDir: string, namespace: string): string {
  return join(dataDir, "store", namespace, "_entities.json");
}

/**
 * Load the entity index for a namespace. Returns empty index if file doesn't exist.
 */
export function loadEntityIndex(dataDir: string, namespace: string): EntityIndex {
  try {
    const raw = readFileSync(entityIndexPath(dataDir, namespace), "utf-8");
    return JSON.parse(raw) as EntityIndex;
  } catch {
    return { entities: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * Save the entity index for a namespace.
 */
export function saveEntityIndex(dataDir: string, namespace: string, index: EntityIndex): void {
  const filePath = entityIndexPath(dataDir, namespace);
  const dir = join(dataDir, "store", namespace);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(index, null, 2), "utf-8");
}

/**
 * Extract entities from content and update the namespace entity index.
 * Adds the memoryId to each entity's memoryIds list (deduped).
 */
export function updateEntityIndex(
  dataDir: string,
  namespace: string,
  memoryId: string,
  content: string,
): void {
  const extracted = extractEntities(content);
  if (extracted.length === 0) return;

  const index = loadEntityIndex(dataDir, namespace);

  // Build a lookup map for existing entities: "type::value" -> Entity
  const entityMap = new Map<string, Entity>();
  for (const entity of index.entities) {
    entityMap.set(`${entity.type}::${entity.value}`, entity);
  }

  // Merge extracted entities
  for (const { type, value } of extracted) {
    const key = `${type}::${value}`;
    const existing = entityMap.get(key);
    if (existing) {
      if (!existing.memoryIds.includes(memoryId)) {
        existing.memoryIds.push(memoryId);
      }
    } else {
      entityMap.set(key, { type, value, memoryIds: [memoryId] });
    }
  }

  index.entities = Array.from(entityMap.values());
  index.lastUpdated = new Date().toISOString();

  saveEntityIndex(dataDir, namespace, index);
}

/**
 * Find all memory IDs that reference a given entity value.
 * Searches across all entity types for a matching value.
 */
export function findMemoriesByEntity(
  dataDir: string,
  namespace: string,
  entityValue: string,
): string[] {
  const index = loadEntityIndex(dataDir, namespace);
  const lowerValue = entityValue.toLowerCase();

  const memoryIds = new Set<string>();
  for (const entity of index.entities) {
    if (
      entity.value.toLowerCase() === lowerValue ||
      entity.value.toLowerCase().includes(lowerValue)
    ) {
      for (const id of entity.memoryIds) {
        memoryIds.add(id);
      }
    }
  }

  return Array.from(memoryIds);
}
