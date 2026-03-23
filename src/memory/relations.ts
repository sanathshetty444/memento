/**
 * Manages memory relations stored as _relations.json per namespace.
 * Provides a lightweight graph layer on top of the flat memory store.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { MemoryRelation } from "./types.js";

function relationsPath(dataDir: string, namespace: string): string {
  return join(dataDir, "store", namespace, "_relations.json");
}

export function loadRelations(dataDir: string, namespace: string): MemoryRelation[] {
  try {
    const raw = readFileSync(relationsPath(dataDir, namespace), "utf-8");
    return JSON.parse(raw) as MemoryRelation[];
  } catch {
    return [];
  }
}

export function saveRelations(
  dataDir: string,
  namespace: string,
  relations: MemoryRelation[],
): void {
  const filePath = relationsPath(dataDir, namespace);
  const dir = join(dataDir, "store", namespace);
  mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(relations, null, 2), "utf-8");
}

export function addRelation(dataDir: string, namespace: string, relation: MemoryRelation): void {
  const relations = loadRelations(dataDir, namespace);
  relations.push(relation);
  saveRelations(dataDir, namespace, relations);
}

export function getRelated(dataDir: string, namespace: string, memoryId: string): MemoryRelation[] {
  const relations = loadRelations(dataDir, namespace);
  return relations.filter((r) => r.sourceId === memoryId || r.targetId === memoryId);
}

export function removeRelationsFor(dataDir: string, namespace: string, memoryId: string): void {
  const relations = loadRelations(dataDir, namespace);
  const filtered = relations.filter((r) => r.sourceId !== memoryId && r.targetId !== memoryId);
  saveRelations(dataDir, namespace, filtered);
}
