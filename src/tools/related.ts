import { z } from "zod";
import { homedir } from "node:os";
import { join } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { MemoryManager } from "../memory/memory-manager.js";
import { getRelated } from "../memory/relations.js";
import { findMemoriesByEntity } from "../memory/entities.js";

export function registerRelatedTool(server: McpServer, manager: MemoryManager) {
  server.tool(
    "memory_related",
    "Find memories related to a specific memory ID via the memory graph, or find all memories mentioning a specific entity (file path, function, class, package, etc.)",
    {
      id: z.string().optional().describe("The memory ID to find relations for"),
      entity: z
        .string()
        .optional()
        .describe(
          "Entity value to search for (e.g., 'auth.ts', 'handleLogin', 'express'). Returns all memories mentioning this entity.",
        ),
      namespace: z.string().optional().describe("Project namespace (auto-detected if omitted)"),
    },
    async (args) => {
      const dataDir = join(homedir(), ".claude-memory");
      const namespace = args.namespace ?? "__global__";

      // Entity-based search: find all memories mentioning a specific entity
      if (args.entity) {
        const memoryIds = findMemoriesByEntity(dataDir, namespace, args.entity);

        if (memoryIds.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `No memories found mentioning entity "${args.entity}".`,
              },
            ],
          };
        }

        // Load entries from the store to get content/summaries
        const entries = await manager.list({ namespace, limit: 100 });
        const entryMap = new Map(entries.map((e) => [e.id, e]));

        const formatted = memoryIds.map((id, i) => {
          const entry = entryMap.get(id);
          if (!entry) {
            return `--- Result ${i + 1} ---\nID: ${id}\n(entry not found in store)`;
          }
          const content = entry.content;
          return [
            `--- Result ${i + 1} ---`,
            `ID: ${id}`,
            `Summary: ${entry.metadata.summary ?? "N/A"}`,
            `Tags: ${entry.metadata.tags.length > 0 ? entry.metadata.tags.join(", ") : "none"}`,
            `Timestamp: ${entry.metadata.timestamp}`,
            `Content: ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`,
          ].join("\n");
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Found ${memoryIds.length} memories mentioning "${args.entity}":\n\n${formatted.join("\n\n")}`,
            },
          ],
        };
      }

      // ID-based relation search (original behavior)
      if (!args.id) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Either 'id' or 'entity' parameter is required.",
            },
          ],
        };
      }

      const relations = getRelated(dataDir, namespace, args.id);

      if (relations.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No related memories found for this ID.",
            },
          ],
        };
      }

      // Collect unique related memory IDs
      const relatedIds = new Set<string>();
      for (const rel of relations) {
        if (rel.sourceId === args.id) {
          relatedIds.add(rel.targetId);
        } else {
          relatedIds.add(rel.sourceId);
        }
      }

      // Load entries from the store via list
      const entries = await manager.list({ namespace, limit: 100 });
      const entryMap = new Map(entries.map((e) => [e.id, e]));

      const formatted = relations.map((rel, i) => {
        const otherId = rel.sourceId === args.id ? rel.targetId : rel.sourceId;
        const entry = entryMap.get(otherId);
        const summary = entry?.metadata.summary ?? "N/A";
        const content = entry?.content ?? "(not found)";
        return [
          `--- Relation ${i + 1} ---`,
          `Related ID: ${otherId}`,
          `Type: ${rel.type}`,
          `Strength: ${rel.strength}`,
          `Summary: ${summary}`,
          `Content: ${content.slice(0, 200)}${content.length > 200 ? "..." : ""}`,
          `Created: ${rel.createdAt}`,
        ].join("\n");
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${relations.length} relations for memory ${args.id}:\n\n${formatted.join("\n\n")}`,
          },
        ],
      };
    },
  );
}
